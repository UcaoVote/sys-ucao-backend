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

        if (search) {
            whereClause += ` AND (
                rc.code LIKE ? OR 
                a1.nom LIKE ? OR 
                a1.prenom LIKE ? OR 
                u1.email LIKE ? OR
                e2.nom LIKE ? OR 
                e2.prenom LIKE ? OR 
                u2.email LIKE ?
            )`;
            const searchPattern = `%${search}%`;
            for (let i = 0; i < 7; i++) params.push(searchPattern);
        }

        if (status === 'used') {
            whereClause += ' AND rc.used = TRUE';
        } else if (status === 'unused') {
            whereClause += ' AND rc.used = FALSE';
        }

        // Requête principale
        const [codeRows] = await connection.execute(`
            SELECT 
                rc.*,
                u1.id AS generatedBy_userId,
                u1.email AS generatedBy_email,
                a1.nom AS generatedBy_nom,
                a1.prenom AS generatedBy_prenom,
                u2.id AS usedBy_userId,
                u2.email AS usedBy_email,
                e2.nom AS usedBy_nom,
                e2.prenom AS usedBy_prenom
            FROM registration_codes rc
            LEFT JOIN users u1 ON rc.generateBy = u1.id
            LEFT JOIN admins a1 ON u1.id = a1.userId
            LEFT JOIN users u2 ON rc.usedBy = u2.id
            LEFT JOIN etudiants e2 ON u2.id = e2.userId
            WHERE ${whereClause}
            ORDER BY rc.createdAt DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), skip]);

        // Requête de comptage
        const [countRows] = await connection.execute(`
            SELECT COUNT(*) AS total 
            FROM registration_codes rc
            LEFT JOIN users u1 ON rc.generateBy = u1.id
            LEFT JOIN admins a1 ON u1.id = a1.userId
            LEFT JOIN users u2 ON rc.usedBy = u2.id
            LEFT JOIN etudiants e2 ON u2.id = e2.userId
            WHERE ${whereClause}
        `, params);

        const total = countRows[0].total;

        const formattedCodes = codeRows.map(code => ({
            id: code.id,
            code: code.code,
            createdAt: code.createdAt,
            expiresAt: code.expiresAt,
            used: code.used,
            usedAt: code.usedAt,
            generatedBy: code.generateBy_nom
                ? `${code.generateBy_prenom} ${code.generateBy_nom} (${code.generateBy_email})`
                : 'Système',
            usedBy: code.usedBy_nom
                ? `${code.usedBy_prenom} ${code.usedBy_nom} (${code.usedBy_email})`
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

            await connection.execute(`
                INSERT INTO registration_codes (code, expiresAt, generatedBy, createdAt)
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
