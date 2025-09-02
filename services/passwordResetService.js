import bcrypt from 'bcrypt';
import pool from '../database.js';

export class PasswordResetService {
    // Génère un mot de passe temporaire lisible pour l'admin (retourné en clair)
    static generateTempPassword(length = 12) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < length; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    /**
     * Réinitialisation des accès par un admin.
     * - Ne modifie PAS le password principal.
     * - Ecrit tempPassword (hashé), requirePasswordChange = true, passwordResetExpires.
     * - Crée identifiantTemporaire si absent.
     */
    static async resetStudentAccess(adminId, studentId) {
        let connection;
        try {
            connection = await pool.getConnection();

            // Récupérer l'étudiant avec son utilisateur
            const [studentRows] = await connection.execute(
                `SELECT e.*, u.id as user_id, u.temp_password, u.require_password_change, 
                        u.password_reset_expires, u.password
                 FROM etudiants e 
                 INNER JOIN users u ON e.user_id = u.id 
                 WHERE e.id = ?`,
                [studentId]
            );

            if (studentRows.length === 0 || !studentRows[0].user_id) {
                throw new Error('Étudiant non trouvé ou sans compte lié');
            }

            const student = studentRows[0];

            // Générer identifiant temporaire si absent
            let temporaryIdentifiant = student.identifiant_temporaire;
            if (!temporaryIdentifiant) {
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                let idt = '';
                for (let i = 0; i < 8; i++) idt += chars.charAt(Math.floor(Math.random() * chars.length));
                temporaryIdentifiant = `TEMP${idt}`;
            }

            const temporaryPasswordPlain = this.generateTempPassword(12);
            const temporaryPasswordHash = await bcrypt.hash(temporaryPasswordPlain, 10);

            // expiration (24h)
            const expirationDate = new Date();
            expirationDate.setHours(expirationDate.getHours() + 24);

            // Début de la transaction
            await connection.beginTransaction();

            try {
                // Mise à jour de l'utilisateur
                await connection.execute(
                    `UPDATE users 
                     SET temp_password = ?, require_password_change = TRUE, password_reset_expires = ?
                     WHERE id = ?`,
                    [temporaryPasswordHash, expirationDate, student.user_id]
                );

                // Mise à jour de l'étudiant
                await connection.execute(
                    `UPDATE etudiants 
                     SET identifiant_temporaire = ?
                     WHERE id = ?`,
                    [temporaryIdentifiant, studentId]
                );

                // Log d'activité si la table existe
                try {
                    await connection.execute(
                        `INSERT INTO activity_logs (action, details, user_id) 
                         VALUES (?, ?, ?)`,
                        ['RESET_STUDENT_ACCESS', `Admin ${adminId} reset student ${studentId}`, adminId]
                    );
                } catch (err) {
                    // Ne pas bloquer la requête si le log échoue
                    console.warn('Activity log failed (non blocking):', err.message);
                }

                // Commit de la transaction
                await connection.commit();

                // Récupérer les informations mises à jour de l'étudiant
                const [updatedStudentRows] = await connection.execute(
                    `SELECT nom, prenom, matricule FROM etudiants WHERE id = ?`,
                    [studentId]
                );

                return {
                    temporaryIdentifiant,
                    temporaryPassword: temporaryPasswordPlain,
                    expirationDate,
                    student: updatedStudentRows[0]
                };

            } catch (error) {
                // Rollback en cas d'erreur
                await connection.rollback();
                throw error;
            }

        } catch (error) {
            throw new Error(`Erreur lors de la réinitialisation: ${error.message}`);
        } finally {
            if (connection) connection.release();
        }
    }

    /**
     * Valide les credentials temporaires fournis par l'étudiant (identifiantTemporaire + mot de passe temporaire)
     */
    static async validateTemporaryCredentials(identifiant, password) {
        let connection;
        try {
            connection = await pool.getConnection();

            // Rechercher l'étudiant par identifiant temporaire
            const [studentRows] = await connection.execute(
                `SELECT e.*, u.id as user_id, u.temp_password, u.password_reset_expires 
                 FROM etudiants e 
                 INNER JOIN users u ON e.user_id = u.id 
                 WHERE e.identifiant_temporaire = ?`,
                [identifiant]
            );

            if (studentRows.length === 0 || !studentRows[0].user_id) {
                throw new Error('Identifiant temporaire invalide');
            }

            const student = studentRows[0];

            // Vérifier expiration si présente
            if (student.password_reset_expires && new Date(student.password_reset_expires) < new Date()) {
                throw new Error('Identifiants temporaires expirés');
            }

            const isValid = await bcrypt.compare(password, student.temp_password || '');
            if (!isValid) {
                throw new Error('Mot de passe temporaire incorrect');
            }

            return student;

        } catch (error) {
            throw new Error(`Validation échouée: ${error.message}`);
        } finally {
            if (connection) connection.release();
        }
    }

    /**
     * Complète le changement de mot de passe après une connexion temporaire.
     * - Remplace password par le nouveau hash
     * - Vide tempPassword, passwordResetExpires
     * - passe requirePasswordChange à false
     * - **Ne supprime pas** identifiantTemporaire (on garde l'identifiant créé à l'inscription)
     */
    static async completePasswordReset(userId, newPassword) {
        let connection;
        try {
            connection = await pool.getConnection();
            const hashed = await bcrypt.hash(newPassword, 10);

            await connection.execute(
                `UPDATE users 
                 SET password = ?, temp_password = NULL, require_password_change = FALSE, password_reset_expires = NULL 
                 WHERE id = ?`,
                [hashed, userId]
            );

            return true;
        } catch (error) {
            throw new Error(`Erreur lors du changement de mot de passe: ${error.message}`);
        } finally {
            if (connection) connection.release();
        }
    }
}