import { toInt, generateRegistrationCode } from '../helpers/codeHelpers.js';
import pool from '../database/dbconfig.js';
import activityManager from '../controllers/activityManager.js';


export const codeController = {
    async getCodeList(req, res) {
        try {
            const pageNum = toInt(req.query.page, 1, 1, 1_000_000);
            const limitNum = toInt(req.query.limit, 10, 1, 100);
            const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
            const status = req.query.status === 'used' || req.query.status === 'unused' ? req.query.status : 'all';

            const { codes, total } = await codeService.getCodeList(search, status, pageNum, limitNum);
            const formattedCodes = codeService.formatCodes(codes);

            res.json({
                success: true,
                data: {
                    codes: formattedCodes,
                    pagination: {
                        current: pageNum,
                        total: Math.ceil(total / limitNum),
                        count: codes.length,
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
        }
    },

    async generateCodes(req, res) {
        try {
            const qty = toInt(req.body.quantity, 1, 1, 100);
            const hours = toInt(req.body.expiresInHours, 24, 1, 720);
            const userId = req.user.id;

            if (!req.user || !req.user.id) {
                return res.status(400).json({ error: 'Utilisateur non authentifié ou ID manquant' });
            }


            const codes = await codeService.generateCodes(qty, hours, userId);

            await activityManager.createActivityLog({
                body: {
                    action: 'Génération de code d\'inscription 1ère année',
                    details: `Codes généré par ${req.user.email}`,
                    userId: req.user.id,
                    actionType: 'ADMIN'
                }
            }, { status: () => ({ json: () => { } }) });

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
        }
    }
};

// Services
const codeService = {
    async getCodeList(search, status, pageNum, limitNum) {
        let connection;
        try {
            connection = await pool.getConnection();
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

            return {
                codes: codeRows,
                total
            };
        } finally {
            if (connection) await connection.release();
        }
    },

    async generateCodes(quantity, expiresInHours, userId) {
        let connection;
        try {
            connection = await pool.getConnection();
            const codes = [];

            for (let i = 0; i < quantity; i++) {
                const codeStr = generateRegistrationCode();
                const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000);

                await connection.execute(
                    `INSERT INTO registration_codes (id, code, expiresAt, generatedBy, createdAt)
                     VALUES (UUID(), ?, ?, ?, NOW())`,
                    [String(codeStr), expiresAt, userId]
                );

                codes.push({ code: codeStr, expiresAt });
            }

            return codes;
        } finally {
            if (connection) await connection.release();
        }
    },

    formatCodes(codeRows) {
        return codeRows.map(row => ({
            id: row.id,
            code: String(row.code),
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
    }
};