import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireRole } from '../middlewares/auth.js';

const router = express.Router();

// GET /code/list - Liste tous les codes avec pagination
router.get('/list', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { page = 1, limit = 10, search = '', status = 'all' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Construction du filtre WHERE
        let whereClause = '1=1';
        let params = [];

        // Filtre de recherche
        if (search) {
            whereClause += ` AND (
                rc.code LIKE ? OR 
                u1.nom LIKE ? OR 
                u1.prenom LIKE ? OR 
                u1.email LIKE ? OR
                u2.nom LIKE ? OR 
                u2.prenom LIKE ? OR 
                u2.email LIKE ?
            )`;
            const searchPattern = `%${search}%`;
            for (let i = 0; i < 7; i++) params.push(searchPattern);
        }

        // Filtre d'état
        if (status === 'used') {
            whereClause += ' AND rc.used = TRUE';
        } else if (status === 'unused') {
            whereClause += ' AND rc.used = FALSE';
        }

        // Requête pour récupérer les codes
        const [codeRows] = await connection.execute(`
            SELECT 
                rc.*,
                u1.id as generated_by_userId,
                u1.email as generated_by_email,
                a1.nom as generated_by_nom,
                a1.prenom as generated_by_prenom,
                u2.id as used_by_userId,
                u2.email as used_by_email,
                e2.nom as used_by_nom,
                e2.prenom as used_by_prenom
            FROM registration_codes rc
            LEFT JOIN users u1 ON rc.generated_by = u1.id
            LEFT JOIN admins a1 ON u1.id = a1.userId
            LEFT JOIN users u2 ON rc.used_by = u2.id
            LEFT JOIN etudiants e2 ON u2.id = e2.userId
            WHERE ${whereClause}
            ORDER BY rc.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), skip]);

        // Compter le total
        const [countRows] = await connection.execute(`
            SELECT COUNT(*) as total 
            FROM registration_codes rc
            LEFT JOIN users u1 ON rc.generated_by = u1.id
            LEFT JOIN admins a1 ON u1.id = a1.userId
            LEFT JOIN users u2 ON rc.used_by = u2.id
            LEFT JOIN etudiants e2 ON u2.id = e2.userId
            WHERE ${whereClause}
        `, params);

        const total = countRows[0].total;

        // Formater la réponse
        const formattedCodes = codeRows.map(code => ({
            id: code.id,
            code: code.code,
            createdAt: code.createdAt,
            expiresAt: code.expiresAt,
            used: code.used,
            usedAt: code.usedAt,
            generatedBy: code.generated_by_nom
                ? `${code.generated_by_prenom} ${code.generated_by_nom} (${code.generated_by_email})`
                : 'Système',
            usedBy: code.used_by_nom
                ? `${code.used_by_prenom} ${code.used_by_nom} (${code.used_by_email})`
                : null
        }));

        res.json({
            success: true,
            data: {
                codes: formattedCodes,
                pagination: {
                    current: parseInt(page),
                    total: Math.ceil(total / limit),
                    count: codeRows.length,
                    totalItems: total
                }
            }
        });

    } catch (err) {
        console.error("Erreur liste codes:", err);
        res.status(500).json({
            success: false,
            message: "Erreur serveur lors de la récupération des codes"
        });
    } finally {
        if (connection) connection.release();
    }
});

// POST /code/generate - Générer de nouveaux codes
router.post('/generate', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { quantity = 1, expiresInHours = 24 } = req.body;
        const userId = req.user.id;

        if (quantity < 1 || quantity > 100) {
            return res.status(400).json({
                success: false,
                message: 'La quantité doit être entre 1 et 100'
            });
        }

        const codes = [];
        for (let i = 0; i < quantity; i++) {
            const code = generateRandomCode();
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + parseInt(expiresInHours));

            // Insérer le code dans la base de données
            await connection.execute(`
                INSERT INTO registration_codes (code, expiresAt, generated_by, createdAt)
                VALUES (?, ?, ?, NOW())
            `, [code, expiresAt, userId]);

            codes.push(code);
        }

        res.status(201).json({
            success: true,
            message: quantity > 1 ? `${quantity} codes générés avec succès` : 'Code généré avec succès',
            data: { codes }
        });

    } catch (err) {
        console.error("Erreur génération code:", err);
        res.status(500).json({
            success: false,
            message: "Erreur serveur lors de la génération du code"
        });
    } finally {
        if (connection) connection.release();
    }
});

// Fonction pour générer un code aléatoire
function generateRandomCode() {
    return 'UCAO-' +
        Math.random().toString(36).substring(2, 6).toUpperCase() + '-' +
        Math.random().toString(36).substring(2, 6).toUpperCase();
}

export default router;