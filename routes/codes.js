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
            params = [
                searchPattern, searchPattern, searchPattern, searchPattern,
                searchPattern, searchPattern, searchPattern
            ];
        }

        if (status === 'used') {
            whereClause += ' AND rc.used = TRUE';
        } else if (status === 'unused') {
            whereClause += ' AND rc.used = FALSE';
        }

        // Requête principale
        const query = `
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
            LEFT JOIN users u1 ON rc.generatedBy = u1.id
            LEFT JOIN admins a1 ON u1.id = a1.userId
            LEFT JOIN users u2 ON rc.usedBy = u2.id
            LEFT JOIN etudiants e2 ON u2.id = e2.userId
            WHERE ${whereClause}
            ORDER BY rc.createdAt DESC
            LIMIT ? OFFSET ?
        `;

        const queryParams = [...params, parseInt(limit), skip];
        const [codeRows] = await connection.execute(query, queryParams);

        // Requête de comptage
        const countQuery = `
            SELECT COUNT(*) AS total 
            FROM registration_codes rc
            LEFT JOIN users u1 ON rc.generatedBy = u1.id
            LEFT JOIN admins a1 ON u1.id = a1.userId
            LEFT JOIN users u2 ON rc.usedBy = u2.id
            LEFT JOIN etudiants e2 ON u2.id = e2.userId
            WHERE ${whereClause}
        `;

        const [countRows] = await connection.execute(countQuery, params);
        const total = countRows[0].total;

        const formattedCodes = codeRows.map(code => ({
            id: code.id,
            code: code.code,
            createdAt: code.createdAt,
            expiresAt: code.expiresAt,
            used: code.used === 1, // Convertir en boolean
            usedAt: code.usedAt,
            generatedBy: code.generatedBy_nom
                ? `${code.generatedBy_prenom} ${code.generatedBy_nom} (${code.generatedBy_email})`
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
            message: "Erreur serveur lors de la récupération des codes",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    } finally {
        if (connection) await connection.release();
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

        if (expiresInHours < 1 || expiresInHours > 720) {
            return res.status(400).json({
                success: false,
                message: 'La durée d\'expiration doit être entre 1 et 720 heures'
            });
        }

        const codes = [];
        for (let i = 0; i < quantity; i++) {
            const code = generateRandomCode();
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + parseInt(expiresInHours));

            await connection.execute(`
                INSERT INTO registration_codes (id, code, expiresAt, generatedBy, createdAt)
                VALUES (UUID(), ?, ?, ?, NOW())
            `, [code, expiresAt, userId]);

            codes.push({
                code: code,
                expiresAt: expiresAt
            });
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
            message: "Erreur serveur lors de la génération du code",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// Fonction pour générer un code aléatoire
function generateRandomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'UCAO-';

    for (let i = 0; i < 8; i++) {
        if (i === 4) code += '-';
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return code;
}

export default router;