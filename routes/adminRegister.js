import express from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/database.js';

const router = express.Router();

router.post('/', async (req, res) => {
    let connection;
    try {
        const { email, password, nom, prenom, poste } = req.body;

        if (!email || !password || !nom || !prenom) {
            return res.status(400).json({ message: 'Champs requis manquants' });
        }

        connection = await pool.getConnection();

        // Vérifier si email déjà pris
        const [existingUsers] = await connection.execute(
            `SELECT id FROM users WHERE email = ?`,
            [email]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ message: 'Email déjà utilisé' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Commencer une transaction
        await connection.beginTransaction();

        try {
            // Créer l'utilisateur
            const [userResult] = await connection.execute(
                `INSERT INTO users (email, password, role, requirePasswordChange) 
                 VALUES (?, ?, 'ADMIN', false)`,
                [email, hashedPassword]
            );

            const userId = userResult.insertId;

            // Créer l'admin
            const [adminResult] = await connection.execute(
                `INSERT INTO admins (userId, nom, prenom, poste, email) 
                 VALUES (?, ?, ?, ?, ?)`,
                [userId, nom, prenom, poste || '', email]
            );

            await connection.commit();

            res.status(201).json({
                message: 'Admin créé avec succès',
                adminId: adminResult.insertId
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur serveur', error: error.message });
    } finally {
        if (connection) await connection.end();
    }
});

export default router;