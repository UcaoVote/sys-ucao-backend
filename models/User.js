// models/User.js
import { query } from '../config/database.js';
import bcrypt from 'bcrypt';

class User {
    // CREATE - Créer un utilisateur
    static async create(userData) {
        try {
            const hashedPassword = await bcrypt.hash(userData.password, 10);

            const sql = `
        INSERT INTO users (id, email, password, role, actif, tempPassword, requirePasswordChange) 
        VALUES (UUID(), ?, ?, ?, ?, ?, ?)
      `;

            const result = await query(sql, [
                userData.email,
                hashedPassword,
                userData.role || 'ADMIN',
                userData.actif !== undefined ? userData.actif : true,
                userData.tempPassword || null,
                userData.requirePasswordChange || false
            ]);

            return result.insertId;
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                throw new Error('Un utilisateur avec cet email existe déjà');
            }
            throw error;
        }
    }

    // READ - Trouver par email
    static async findByEmail(email) {
        const sql = 'SELECT * FROM users WHERE email = ?';
        const users = await query(sql, [email]);
        return users[0];
    }

    // READ - Trouver par ID
    static async findById(id) {
        const sql = 'SELECT * FROM users WHERE id = ?';
        const users = await query(sql, [id]);
        return users[0];
    }

    // READ - Trouver tous les utilisateurs
    static async findAll(limit = 100, offset = 0) {
        const sql = 'SELECT * FROM users LIMIT ? OFFSET ?';
        return await query(sql, [limit, offset]);
    }

    // UPDATE - Mettre à jour un utilisateur
    static async update(id, updates) {
        const fields = [];
        const values = [];

        // Construction dynamique de la requête
        if (updates.email !== undefined) {
            fields.push('email = ?');
            values.push(updates.email);
        }
        if (updates.password !== undefined) {
            const hashedPassword = await bcrypt.hash(updates.password, 10);
            fields.push('password = ?');
            values.push(hashedPassword);
        }
        if (updates.role !== undefined) {
            fields.push('role = ?');
            values.push(updates.role);
        }
        if (updates.actif !== undefined) {
            fields.push('actif = ?');
            values.push(updates.actif);
        }

        if (fields.length === 0) {
            throw new Error('Aucun champ à mettre à jour');
        }

        values.push(id);

        const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
        await query(sql, values);

        return await this.findById(id);
    }

    // DELETE - Désactiver un utilisateur (soft delete)
    static async disable(id) {
        const sql = 'UPDATE users SET actif = FALSE WHERE id = ?';
        await query(sql, [id]);
    }

    // VERIFY - Vérifier le mot de passe
    static async verifyPassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }

    // UPDATE - Réinitialiser le mot de passe
    static async resetPassword(id, newPassword) {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const sql = 'UPDATE users SET password = ?, tempPassword = NULL, requirePasswordChange = FALSE WHERE id = ?';
        await query(sql, [hashedPassword, id]);
    }

    // CHECK - Vérifier si l'email existe
    static async emailExists(email) {
        const sql = 'SELECT COUNT(*) as count FROM users WHERE email = ?';
        const result = await query(sql, [email]);
        return result[0].count > 0;
    }
}

export default User;