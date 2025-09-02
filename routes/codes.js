import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireRole } from '../middlewares/auth.js';
import crypto from 'crypto';

const router = express.Router();

// Petit helper pour parser/clamp proprement
const toInt = (v, def, min, max) => {
    const n = Number.parseInt(v, 10);
    if (Number.isNaN(n)) return def;
    return Math.min(Math.max(n, min), max);
};

// ---------------------------------------------
// GET /code/list - Liste tous les codes (pagination sécurisée)
// ---------------------------------------------
router.get('/list', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        const pageNum = toInt(req.query.page, 1, 1, 1_000_000);
        const limitNum = toInt(req.query.limit, 10, 1, 100);
        const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        const status = req.query.status === 'used' || req.query.status === 'unused' ? req.query.status : 'all';
        const offset = (pageNum - 1) * limitNum;

        let whereClause = '1=1';
        const params = [];

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
            const pattern = `%${search}%`;
            params.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern);
        }

        if (status === 'used') whereClause += ' AND rc.used = 1';
        if (status === 'unused') whereClause += ' AND rc.used = 0';

        // IMPORTANT: on injecte limit/offset comme des entiers validés (pas de ? ici)
        const listSql = `
      SELECT 
        rc.*,
        u1.id    AS generatedBy_userId,
        u1.email AS generatedBy_email,
        a1.nom   AS generatedBy_nom,
        a1.prenom AS generatedBy_prenom,
        u2.id    AS usedBy_userId,
        u2.email AS usedBy_email,
        e2.nom   AS usedBy_nom,
        e2.prenom AS usedBy_prenom
      FROM registration_codes rc
      LEFT JOIN users    u1 ON rc.generatedBy = u1.id
      LEFT JOIN admins   a1 ON u1.id = a1.userId
      LEFT JOIN users    u2 ON rc.usedBy     = u2.id
      LEFT JOIN etudiants e2 ON u2.id        = e2.userId
      WHERE ${whereClause}
      ORDER BY rc.createdAt DESC
      LIMIT ${limitNum} OFFSET ${offset}
    `;

        const [codeRows] = await connection.execute(listSql, params);

        const countSql = `
      SELECT COUNT(*) AS total 
      FROM registration_codes rc
      LEFT JOIN users    u1 ON rc.generatedBy = u1.id
      LEFT JOIN admins   a1 ON u1.id = a1.userId
      LEFT JOIN users    u2 ON rc.usedBy     = u2.id
      LEFT JOIN etudiants e2 ON u2.id        = e2.userId
      WHERE ${whereClause}
    `;

        const [countRows] = await connection.execute(countSql, params);
        const total = countRows[0]?.total ?? 0;

        const formattedCodes = codeRows.map(row => ({
            id: row.id,
            code: String(row.code),             // <-- force string au cas où
            createdAt: row.createdAt,
            expiresAt: row.expiresAt,
            used: row.used === 1 || row.used === true,
            usedAt: row.usedAt,
            generatedBy: row.generatedBy_nom
                ? `${row.generatedBy_prenom} ${row.generatedBy_nom} (${row.generatedBy_email})`
                : 'Système',
            usedBy: row.usedBy_nom
                ? `${row.usedBy_prenom} ${row.usedBy_nom} (${row.usedBy_email})`
                : null
        }));

        res.json({
            success: true,
            data: {
                codes: formattedCodes,
                pagination: {
                    current: pageNum,
                    total: Math.ceil(total / limitNum),
                    count: codeRows.length,
                    totalItems: total
                }
            }
        });
    } catch (err) {
        console.error('Erreur liste codes:', err);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la récupération des codes',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// ---------------------------------------------
// POST /code/generate - Générer de nouveaux codes
// ---------------------------------------------
router.post('/generate', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        const qty = toInt(req.body.quantity, 1, 1, 100);
        const hours = toInt(req.body.expiresInHours, 24, 1, 720);
        const userId = req.user.id;

        const codes = [];

        for (let i = 0; i < qty; i++) {
            const codeStr = generateRegistrationCode();   // <-- toujours une string
            const expiresAt = new Date(Date.now() + hours * 3600 * 1000);

            // Optionnel: console util pour vérifier le type
            // console.log('Generated code:', codeStr, typeof codeStr);

            await connection.execute(
                `INSERT INTO registration_codes (id, code, expiresAt, generatedBy, createdAt)
         VALUES (UUID(), ?, ?, ?, NOW())`,
                [String(codeStr), expiresAt, userId]        // <-- force string
            );

            codes.push({ code: codeStr, expiresAt });
        }

        res.status(201).json({
            success: true,
            message: qty > 1 ? `${qty} codes générés avec succès` : 'Code généré avec succès',
            data: { codes }
        });

    } catch (err) {
        console.error('Erreur génération code:', err);
        res.status(500).json({
            success: false,
            message: "Erreur serveur lors de la génération du code",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// ---------------------------------------------
// Générateur robuste: UCAO-XXXX-XXXX (sans 0/O/1/I)
// ---------------------------------------------
function generateRegistrationCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const buf = crypto.randomBytes(8);
    let out = 'UCAO-';
    for (let i = 0; i < 8; i++) {
        if (i === 4) out += '-';
        out += alphabet[buf[i] % alphabet.length];
    }
    return out; // ex: UCAO-4F7K-Q8ZP
}


export default router;