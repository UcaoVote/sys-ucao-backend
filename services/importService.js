// services/importService.js
import pool from '../dbconfig.js';

export const importService = {
    async verifyAdmin(userId) {
        let connection;
        try {
            connection = await pool.getConnection();
            const [adminRows] = await connection.execute(
                'SELECT id FROM admins WHERE user_id = ?',
                [userId]
            );
            return adminRows.length > 0;
        } finally {
            if (connection) await connection.release();
        }
    },

    async checkExistingMatricules(matricules) {
        let connection;
        try {
            connection = await pool.getConnection();
            const placeholders = matricules.map(() => '?').join(',');
            const [existingRows] = await connection.execute(
                `SELECT matricule FROM etudiants WHERE matricule IN (${placeholders})`,
                matricules
            );
            return existingRows.map(row => row.matricule);
        } finally {
            if (connection) await connection.release();
        }
    },

    async importMatricules(matricules) {
        let connection;
        try {
            connection = await pool.getConnection();
            const createdMatricules = [];

            for (const mat of matricules) {
                await connection.execute(
                    'INSERT INTO etudiants (matricule) VALUES (?)',
                    [mat]
                );
                createdMatricules.push(mat);
            }

            return createdMatricules;
        } finally {
            if (connection) await connection.release();
        }
    }
};