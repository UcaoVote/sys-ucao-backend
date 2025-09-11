import bcrypt from 'bcrypt';
import pool from '../dbconfig.js';
import { generateUserId } from '../helpers/generateUserId.js';

class AdminService {

    // Trouver un admin par email
    async findAdminByEmail(email) {
        let connection;
        try {
            connection = await pool.getConnection();

            const [userRows] = await connection.execute(
                `SELECT u.*, a.nom, a.prenom, a.poste 
         FROM users u 
         JOIN admins a ON u.id = a.userId 
         WHERE u.email = ? AND u.role = 'ADMIN'`,
                [email]
            );

            return userRows[0] || null;
        } finally {
            if (connection) await connection.release();
        }
    }

    // Vérifier si l'email existe déjà
    async checkEmailExists(email) {
        let connection;
        try {
            connection = await pool.getConnection();

            const [userRows] = await connection.execute(
                'SELECT id FROM users WHERE email = ?',
                [email]
            );

            return userRows.length > 0;
        } finally {
            if (connection) await connection.release();
        }
    }

    // Créer un nouvel administrateur
    async createAdmin(adminData) {
        let connection;
        try {
            connection = await pool.getConnection();

            const hashedPassword = await bcrypt.hash(adminData.password, 10);
            const userId = generateUserId();

            await connection.beginTransaction();

            try {
                // Créer l'utilisateur
                await connection.execute(
                    `INSERT INTO users (id, email, password, role, requirePasswordChange) 
           VALUES (?, ?, ?, 'ADMIN', false)`,
                    [userId, adminData.email, hashedPassword]
                );

                // Créer l'admin
                const [adminResult] = await connection.execute(
                    `INSERT INTO admins (userId, nom, prenom, poste) 
           VALUES (?, ?, ?, ?)`,
                    [userId, adminData.nom, adminData.prenom, adminData.poste || '']
                );

                await connection.commit();

                return {
                    adminId: adminResult.insertId,
                    userId: userId
                };
            } catch (error) {
                await connection.rollback();
                throw error;
            }
        } finally {
            if (connection) await connection.release();
        }
    }

    // Vérifier le mot de passe
    async verifyPassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }

    // Profile Admin
    async getAdminProfile(userId) {
        let connection;
        try {
            connection = await pool.getConnection();
            const [adminRows] = await connection.execute(
                `SELECT a.*, u.email, u.role 
                 FROM admins a 
                 INNER JOIN users u ON a.userId = u.id 
                 WHERE a.userId = ?`,
                [userId]
            );
            return adminRows[0];
        } finally {
            if (connection) await connection.release();
        }
    }


    async updateAdminProfile(userId, nom, prenom, email) {
        let connection;
        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            await connection.execute(
                `UPDATE admins SET nom = ?, prenom = ?, email = ? WHERE userId = ?`,
                [nom, prenom, email, userId]
            );

            await connection.execute(
                `UPDATE users SET email = ? WHERE id = ?`,
                [email, userId]
            );

            const [updatedRows] = await connection.execute(
                `SELECT a.*, u.email 
                 FROM admins a 
                 INNER JOIN users u ON a.userId = u.id 
                 WHERE a.userId = ?`,
                [userId]
            );

            await connection.commit();
            return updatedRows[0];
        } catch (err) {
            if (connection) await connection.rollback();
            throw err;
        } finally {
            if (connection) await connection.release();
        }
    }

}

export default new AdminService();