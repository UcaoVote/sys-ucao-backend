import pool from '../database/connection.js';

const Admin = {
    // Trouver un admin par son ID
    async findById(id) {
        const [rows] = await pool.execute(
            'SELECT * FROM admins WHERE id = ?',
            [id]
        );
        return rows[0];
    },

    // Trouver un admin par userId
    async findByUserId(userId) {
        const [rows] = await pool.execute(
            'SELECT * FROM admins WHERE userId = ?',
            [userId]
        );
        return rows[0];
    },

    // Créer un nouvel admin
    async create(adminData) {
        const { userId, nom, prenom, poste } = adminData;

        const [result] = await pool.execute(
            'INSERT INTO admins (userId, nom, prenom, poste) VALUES (?, ?, ?, ?)',
            [userId, nom, prenom, poste]
        );

        return { id: result.insertId, ...adminData };
    },

    // Mettre à jour un admin
    async update(userId, adminData) {
        const fields = [];
        const values = [];

        for (const [key, value] of Object.entries(adminData)) {
            if (value !== undefined) {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        }

        if (fields.length === 0) return null;

        values.push(userId);
        const query = `UPDATE admins SET ${fields.join(', ')} WHERE userId = ?`;

        await pool.execute(query, values);
        return this.findByUserId(userId);
    },

    // Trouver un admin avec les infos user jointes
    async findWithUser(userId) {
        const [rows] = await pool.execute(
            `SELECT a.*, u.email, u.role, u.photoUrl 
       FROM admins a 
       INNER JOIN users u ON a.userId = u.id 
       WHERE a.userId = ?`,
            [userId]
        );
        return rows[0];
    }
};

export default Admin;