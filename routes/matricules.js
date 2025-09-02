import pool from '../config/database.js';
import express from 'express';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

/**
 * Body attendu (JSON)
 * {
 *   "matricules": ["UUC2023-0001", "UUC2023-0002", ...]
 * }
 */
router.post('/import', authenticateToken, async (req, res) => {
    let connection;
    try {
        const { matricules } = req.body;

        if (!matricules || !Array.isArray(matricules) || matricules.length === 0) {
            return res.status(400).json({ message: 'Liste de matricules invalide.' });
        }

        // Récupération d'une connexion depuis le pool
        connection = await pool.getConnection();

        // Vérifier que l'utilisateur est un admin
        const [adminRows] = await connection.execute(
            'SELECT id FROM admins WHERE user_id = ?',
            [req.user.id]
        );

        if (adminRows.length === 0) {
            return res.status(403).json({ message: 'Accès refusé. Admin requis.' });
        }

        const createdMatricules = [];
        const skippedMatricules = [];

        for (const mat of matricules) {
            // Vérifier que le matricule n'existe pas déjà
            const [existingRows] = await connection.execute(
                'SELECT id FROM etudiants WHERE matricule = ?',
                [mat]
            );

            if (existingRows.length > 0) {
                skippedMatricules.push(mat);
                continue;
            }

            // Créer l'étudiant avec seulement le matricule, autres champs vides
            await connection.execute(
                'INSERT INTO etudiants (matricule) VALUES (?)',
                [mat]
            );
            createdMatricules.push(mat);
        }

        return res.status(201).json({
            message: 'Importation terminée.',
            created: createdMatricules,
            skipped: skippedMatricules
        });
    } catch (err) {
        console.error('Erreur import matricules:', err);
        return res.status(500).json({ message: 'Erreur serveur.' });
    } finally {
        // Libération de la connexion
        if (connection) connection.release();
    }
});

export default router;