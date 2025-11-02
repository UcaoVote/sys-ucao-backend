import bcrypt from 'bcrypt';
import pool from '../database/dbconfig.js';

export class PasswordResetService {
    /**
  * CORRECTION : Méthode pour générer un mot de passe temporaire lisible
  * Utilise un format plus simple pour faciliter la saisie
  */
    static generateTempPassword(length = 10) {
        // Utiliser un format plus simple pour faciliter la copie/saisie
        const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Retirer I et O pour éviter confusion
        const lowercase = 'abcdefghjkmnpqrstuvwxyz';  // Retirer i, l, o
        const numbers = '23456789';                   // Retirer 0, 1 pour éviter confusion
        const specials = '!@#$%&*';

        let password = '';

        // Assurer au moins un caractère de chaque type
        password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
        password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
        password += numbers.charAt(Math.floor(Math.random() * numbers.length));
        password += specials.charAt(Math.floor(Math.random() * specials.length));

        // Compléter avec des caractères aléatoires
        const allChars = uppercase + lowercase + numbers + specials;
        for (let i = password.length; i < length; i++) {
            password += allChars.charAt(Math.floor(Math.random() * allChars.length));
        }

        // Mélanger le mot de passe
        return password.split('').sort(() => Math.random() - 0.5).join('');
    }

    /**
  * Réinitialisation des accès par un admin.
  * - Ne modifie PAS le password principal.
  * - Ecrit tempPassword (hashé), requirePasswordChange = true, passwordResetExpires.
  * - Crée identifiantTemporaire si absent.
  * - Retourne le mot de passe temporaire en CLAIR au frontend.
  */
    static async resetStudentAccess(adminId, studentId) {
        let connection;
        try {
            connection = await pool.getConnection();

            // Récupérer l'étudiant avec son utilisateur
            const [studentRows] = await connection.execute(
                `SELECT e.*, u.id as userId, u.tempPassword, u.requirePasswordChange, 
                    u.passwordResetExpires, u.password, u.email
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

            // CORRECTION : Générer le mot de passe temporaire en clair
            const temporaryPasswordPlain = this.generateTempPassword(12);

            // CORRECTION : Hasher le mot de passe pour le stockage en base
            const temporaryPasswordHash = await bcrypt.hash(temporaryPasswordPlain, 10);

            // expiration (24h)
            const expirationDate = new Date();
            expirationDate.setHours(expirationDate.getHours() + 24);

            // Début de la transaction
            await connection.beginTransaction();

            try {
                // Mise à jour de l'utilisateur avec le mot de passe HACHÉ
                await connection.execute(
                    `UPDATE users 
                 SET tempPassword = ?, requirePasswordChange = TRUE, passwordResetExpires = ?
                 WHERE id = ?`,
                    [temporaryPasswordHash, expirationDate, student.userId]
                );

                // Mise à jour de l'étudiant avec l'identifiant temporaire
                await connection.execute(
                    `UPDATE etudiants 
                 SET identifiantTemporaire = ?
                 WHERE id = ?`,
                    [temporaryIdentifiant, studentId]
                );

                // Log d'activité
                try {
                    await connection.execute(
                        `INSERT INTO activity_logs (action, details, userId, actionType, module) 
                     VALUES (?, ?, ?, ?, ?)`,
                        ['RESET_STUDENT_ACCESS', `Admin ${adminId} reset student ${studentId}`, adminId, 'ADMIN', 'SYSTEM']
                    );
                } catch (err) {
                    console.warn('Activity log failed (non blocking):', err.message);
                }

                // Commit de la transaction
                await connection.commit();

                // CORRECTION : Récupérer les informations complètes de l'étudiant
                const [updatedStudentRows] = await connection.execute(
                    `SELECT e.nom, e.prenom, e.matricule, e.identifiantTemporaire,
                        u.email, u.requirePasswordChange, u.passwordResetExpires
                 FROM etudiants e
                 INNER JOIN users u ON e.userId = u.id
                 WHERE e.id = ?`,
                    [studentId]
                );

                // CORRECTION : Retourner le mot de passe en CLAIR au frontend
                return {
                    success: true,
                    message: 'Accès réinitialisés avec succès',
                    temporaryIdentifiant,
                    temporaryPassword: temporaryPasswordPlain, // EN CLAIR pour l'affichage
                    expirationDate: expirationDate.toISOString(),
                    student: updatedStudentRows[0],
                    // Informations supplémentaires utiles
                    credentials: {
                        identifiant: temporaryIdentifiant,
                        motDePasse: temporaryPasswordPlain, // EN CLAIR
                        email: student.email,
                        expiresLe: expirationDate.toLocaleString('fr-FR')
                    }
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
  * CORRECTION : Méthode pour valider les credentials temporaires
  * Compare avec le hash stocké en base
  */
    static async validateTemporaryCredentials(identifiant, password) {
        let connection;
        try {
            connection = await pool.getConnection();

            // Rechercher l'étudiant par identifiant temporaire
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

            // Vérifier expiration
            if (student.passwordResetExpires && new Date(student.passwordResetExpires) < new Date()) {
                throw new Error('Identifiants temporaires expirés');
            }

            // Vérifier si le mot de passe temporaire existe
            if (!student.tempPassword) {
                throw new Error('Aucun mot de passe temporaire défini');
            }

            // CORRECTION : Comparer le mot de passe fourni avec le HASH stocké
            const isValid = await bcrypt.compare(password, student.tempPassword);
            if (!isValid) {
                throw new Error('Mot de passe temporaire incorrect');
            }

            return {
                success: true,
                student: student,
                requiresPasswordChange: true
            };

        } catch (error) {
            throw new Error(`Validation échouée: ${error.message}`);
        } finally {
            if (connection) connection.release();
        }
    }

    /**
     * CORRECTION : Méthode pour compléter le changement de mot de passe
     * Remplace le mot de passe principal et nettoie les champs temporaires
     */
    static async completePasswordReset(userId, newPassword) {
        let connection;
        try {
            connection = await pool.getConnection();

            // CORRECTION : Hasher le nouveau mot de passe
            const hashedNewPassword = await bcrypt.hash(newPassword, 10);

            await connection.execute(
                `UPDATE users 
             SET password = ?, tempPassword = NULL, requirePasswordChange = FALSE, passwordResetExpires = NULL 
             WHERE id = ?`,
                [hashedNewPassword, userId]
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

            return {
                success: true,
                message: 'Mot de passe changé avec succès'
            };
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