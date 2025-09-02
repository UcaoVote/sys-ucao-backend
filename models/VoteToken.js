import mysql from 'mysql2/promise';
import crypto from 'crypto';

// Configuration de la connexion MySQL (à adapter selon votre configuration)
const dbConfig = {
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

/**
 * Modèle pour gérer les jetons de vote uniques
 * Chaque étudiant reçoit un jeton unique pour chaque élection
 */
class VoteToken {

    /**
     * Génère un jeton de vote unique
     * @returns {string} Jeton unique
     */
    static generateToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Crée une connexion à la base de données
     * @returns {Promise} Connexion MySQL
     */
    static async getConnection() {
        return await mysql.createConnection(dbConfig);
    }

    /**
     * Crée un jeton de vote pour un étudiant et une élection
     * @param {number} userId - ID de l'utilisateur
     * @param {number} electionId - ID de l'élection
     * @returns {Object} Jeton créé
     */
    static async createToken(userId, electionId) {
        let connection;
        try {
            connection = await this.getConnection();

            // Vérifier que l'utilisateur n'a pas déjà un jeton pour cette élection
            const [existingTokens] = await connection.execute(
                `SELECT * FROM VoteToken WHERE userId = ? AND electionId = ? AND isUsed = FALSE`,
                [userId, electionId]
            );

            if (existingTokens.length > 0) {
                return existingTokens[0];
            }

            // Créer un nouveau jeton
            const tokenValue = this.generateToken();
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

            const [result] = await connection.execute(
                `INSERT INTO VoteToken (token, userId, electionId, isUsed, expiresAt, createdAt, updatedAt) 
                 VALUES (?, ?, ?, FALSE, ?, NOW(), NOW())`,
                [tokenValue, userId, electionId, expiresAt]
            );

            const token = {
                id: result.insertId,
                token: tokenValue,
                userId,
                electionId,
                isUsed: false,
                expiresAt,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            return token;
        } catch (error) {
            console.error('Erreur lors de la création du jeton:', error);
            throw error;
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * Valide un jeton de vote
     * @param {string} token - Jeton à valider
     * @param {number} electionId - ID de l'élection
     * @returns {Object|null} Informations du jeton ou null si invalide
     */
    static async validateToken(token, electionId) {
        let connection;
        try {
            connection = await this.getConnection();

            const [tokens] = await connection.execute(
                `SELECT vt.*, u.*, e.* 
                 FROM VoteToken vt
                 JOIN User u ON vt.userId = u.id
                 LEFT JOIN Etudiant e ON u.id = e.userId
                 WHERE vt.token = ? AND vt.electionId = ? AND vt.isUsed = FALSE 
                 AND vt.expiresAt > NOW()`,
                [token, electionId]
            );

            if (tokens.length === 0) {
                return null;
            }

            return tokens[0];
        } catch (error) {
            console.error('Erreur lors de la validation du jeton:', error);
            return null;
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * Marque un jeton comme utilisé
     * @param {string} token - Jeton à marquer
     * @returns {boolean} Succès de l'opération
     */
    static async markTokenAsUsed(token) {
        let connection;
        try {
            connection = await this.getConnection();

            await connection.execute(
                `UPDATE VoteToken SET isUsed = TRUE, usedAt = NOW(), updatedAt = NOW() 
                 WHERE token = ?`,
                [token]
            );

            return true;
        } catch (error) {
            console.error('Erreur lors du marquage du jeton:', error);
            return false;
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * Récupère tous les jetons d'une élection
     * @param {number} electionId - ID de l'élection
     * @returns {Array} Liste des jetons
     */
    static async getTokensForElection(electionId) {
        let connection;
        try {
            connection = await this.getConnection();

            const [tokens] = await connection.execute(
                `SELECT vt.*, u.*, e.* 
                 FROM VoteToken vt
                 JOIN User u ON vt.userId = u.id
                 LEFT JOIN Etudiant e ON u.id = e.userId
                 WHERE vt.electionId = ?`,
                [electionId]
            );

            return tokens;
        } catch (error) {
            console.error('Erreur lors de la récupération des jetons:', error);
            return [];
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * Nettoie les jetons expirés
     * @returns {number} Nombre de jetons supprimés
     */
    static async cleanupExpiredTokens() {
        let connection;
        try {
            connection = await this.getConnection();

            const [result] = await connection.execute(
                `DELETE FROM VoteToken WHERE expiresAt < NOW()`
            );

            console.log(`${result.affectedRows} jetons expirés supprimés`);
            return result.affectedRows;
        } catch (error) {
            console.error('Erreur lors du nettoyage des jetons:', error);
            return 0;
        } finally {
            if (connection) await connection.end();
        }
    }
}

export default VoteToken;