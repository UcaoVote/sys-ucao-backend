import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';

const router = express.Router();


router.post('/', async (req, res) => {
    let connection;
    try {
        const { email, password } = req.body;

        if (!email || !password)
            return res.status(400).json({ message: 'Email et mot de passe requis' });

        connection = await pool.getConnection();

        // Trouver user ADMIN par email
        const [userRows] = await connection.execute(
            `SELECT * FROM users WHERE email = ? AND role = 'ADMIN'`,
            [email]
        );

        if (userRows.length === 0) {
            return res.status(400).json({ message: 'Administrateur non trouvé ou rôle invalide' });
        }

        const user = userRows[0];

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword)
            return res.status(400).json({ message: 'Mot de passe incorrect' });

        // Génération du token JWT
        const token = jwt.sign(
            {
                id: user.id,
                role: user.role,
                requirePasswordChange: user.requirePasswordChange || false
            },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({ message: 'Connexion réussie', token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur serveur' });
    } finally {
        if (connection) await connection.end();
    }
});

export default router;