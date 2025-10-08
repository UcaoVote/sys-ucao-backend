import bcrypt from 'bcrypt';
import pool from '../dbconfig.js';

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

            // Récupérer l'étudiant avec son utilisateur - NOMS DE COLONNES CORRIGÉS
            const [studentRows] = await connection.execute(
                `SELECT e.*, u.id as userId, u.tempPassword, u.requirePasswordChange, 
                        u.passwordResetExpires, u.password
                 FROM etudiants e 
                 INNER JOIN users u ON e.userId = u.id 
                 WHERE e.id = ?`,
                [studentId]
            );

            if (studentRows.length === 0 || !studentRows[0].userId) {
                throw new Error('Étudiant non trouvé ou sans compte lié');
            }

            const student = studentRows[0];

            // Générer identifiant temporaire si absent
            let temporaryIdentifiant = student.identifiantTemporaire;
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
                // Mise à jour de l'utilisateur - NOMS DE COLONNES CORRIGÉS
                await connection.execute(
                    `UPDATE users 
                     SET tempPassword = ?, requirePasswordChange = TRUE, passwordResetExpires = ?
                     WHERE id = ?`,
                    [temporaryPasswordHash, expirationDate, student.userId]
                );

                // Mise à jour de l'étudiant - NOMS DE COLONNES CORRIGÉS
                await connection.execute(
                    `UPDATE etudiants 
                     SET identifiantTemporaire = ?
                     WHERE id = ?`,
                    [temporaryIdentifiant, studentId]
                );

                // Log d'activité si la table existe - NOMS DE COLONNES CORRIGÉS
                try {
                    await connection.execute(
                        `INSERT INTO activity_logs (action, details, userId, actionType, module) 
                         VALUES (?, ?, ?, ?, ?)`,
                        ['RESET_STUDENT_ACCESS', `Admin ${adminId} reset student ${studentId}`, adminId, 'ADMIN', 'SYSTEM']
                    );
                } catch (err) {
                    // Ne pas bloquer la requête si le log échoue
                    console.warn('Activity log failed (non blocking):', err.message);
                }

                // Commit de la transaction
                await connection.commit();

                // Récupérer les informations mises à jour de l'étudiant - NOMS DE COLONNES CORRIGÉS
                const [updatedStudentRows] = await connection.execute(
                    `SELECT nom, prenom, matricule, codeInscription FROM etudiants WHERE id = ?`,
                    [studentId]
                );

                return {
                    temporaryIdentifiant,
                    temporaryPassword: temporaryPasswordPlain,
                    expirationDate,
                    student: updatedStudentRows[0]
                };

            } catch (error) {
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

            // Rechercher l'étudiant par identifiant temporaire - NOMS DE COLONNES CORRIGÉS
            const [studentRows] = await connection.execute(
                `SELECT e.*, u.id as userId, u.tempPassword, u.passwordResetExpires 
                 FROM etudiants e 
                 INNER JOIN users u ON e.userId = u.id 
                 WHERE e.identifiantTemporaire = ?`,
                [identifiant]
            );

            if (studentRows.length === 0 || !studentRows[0].userId) {
                throw new Error('Identifiant temporaire invalide');
            }

            const student = studentRows[0];

            // Vérifier expiration si présente - NOMS DE COLONNES CORRIGÉS
            if (student.passwordResetExpires && new Date(student.passwordResetExpires) < new Date()) {
                throw new Error('Identifiants temporaires expirés');
            }

            // Vérifier si le mot de passe temporaire existe
            if (!student.tempPassword) {
                throw new Error('Aucun mot de passe temporaire défini');
            }

            const isValid = await bcrypt.compare(password, student.tempPassword);
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

            // NOMS DE COLONNES CORRIGÉS
            await connection.execute(
                `UPDATE users 
                 SET password = ?, tempPassword = NULL, requirePasswordChange = FALSE, passwordResetExpires = NULL 
                 WHERE id = ?`,
                [hashed, userId]
            );

            // Log de l'activité
            try {
                await connection.execute(
                    `INSERT INTO activity_logs (action, details, userId, actionType, module) 
                     VALUES (?, ?, ?, ?, ?)`,
                    ['PASSWORD_CHANGE', 'Mot de passe changé avec succès via réinitialisation', userId, 'INFO', 'AUTH']
                );
            } catch (err) {
                console.warn('Activity log failed (non blocking):', err.message);
            }

            return true;
        } catch (error) {
            throw new Error(`Erreur lors du changement de mot de passe: ${error.message}`);
        } finally {
            if (connection) connection.release();
        }
    }

    /**
     * Méthode supplémentaire pour vérifier si un utilisateur nécessite un changement de mot de passe
     */
    static async requiresPasswordChange(userId) {
        let connection;
        try {
            connection = await pool.getConnection();

            const [userRows] = await connection.execute(
                `SELECT requirePasswordChange, passwordResetExpires 
                 FROM users 
                 WHERE id = ?`,
                [userId]
            );

            if (userRows.length === 0) {
                throw new Error('Utilisateur non trouvé');
            }

            const user = userRows[0];

            // Vérifier si le changement est requis et si la date d'expiration n'est pas dépassée
            if (user.requirePasswordChange) {
                if (user.passwordResetExpires && new Date(user.passwordResetExpires) < new Date()) {
                    // Expiration dépassée, révoquer la demande
                    await connection.execute(
                        `UPDATE users 
                         SET requirePasswordChange = FALSE, tempPassword = NULL, passwordResetExpires = NULL 
                         WHERE id = ?`,
                        [userId]
                    );
                    return false;
                }
                return true;
            }

            return false;

        } catch (error) {
            throw new Error(`Erreur lors de la vérification: ${error.message}`);
        } finally {
            if (connection) connection.release();
        }
    }
}