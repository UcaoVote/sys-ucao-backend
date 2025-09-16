// activityController.js

import pool from '../dbconfig.js';

async function getActivityLogs(req, res) {
    try {
        let { page = 1, limit = 20, actionType, userId, startDate, endDate, module } = req.query;

        page = parseInt(page);
        limit = parseInt(limit);
        const offset = (page - 1) * limit;

        if (isNaN(page) || page <= 0 || isNaN(limit) || limit <= 0) {
            return res.status(400).json({ error: 'Paramètres de pagination invalides' });
        }

        const finalLimit = Math.min(limit, 100);
        const finalOffset = Math.max(offset, 0);

        let query = `
            SELECT al.*, u.email, u.role 
            FROM activity_logs al
            LEFT JOIN users u ON al.userId = u.id
            WHERE 1=1
        `;
        let countQuery = `
            SELECT COUNT(*) as total 
            FROM activity_logs al 
            WHERE 1=1
        `;

        const filters = [];
        const countFilters = [];
        const values = [];
        const countValues = [];

        if (module) {
            filters.push(`AND al.module = ?`);
            countFilters.push(`AND al.module = ?`);
            values.push(module);
            countValues.push(module);
        }

        if (actionType) {
            filters.push(`AND al.actionType = ?`);
            countFilters.push(`AND al.actionType = ?`);
            values.push(actionType);
            countValues.push(actionType);
        }

        if (userId) {
            filters.push(`AND al.userId = ?`);
            countFilters.push(`AND al.userId = ?`);
            values.push(userId);
            countValues.push(userId);
        }

        if (startDate) {
            filters.push(`AND al.createdAt >= ?`);
            countFilters.push(`AND al.createdAt >= ?`);
            values.push(startDate);
            countValues.push(startDate);
        }

        if (endDate) {
            filters.push(`AND al.createdAt <= ?`);
            countFilters.push(`AND al.createdAt <= ?`);
            values.push(endDate);
            countValues.push(endDate);
        }

        query += ' ' + filters.join(' ') + ` ORDER BY al.createdAt DESC LIMIT ? OFFSET ?`;
        values.push(finalLimit, finalOffset);

        countQuery += ' ' + countFilters.join(' ');

        const [logs] = await pool.execute(query, values);
        const [countResult] = await pool.execute(countQuery, countValues);

        res.json({
            logs,
            pagination: {
                page,
                limit: finalLimit,
                total: countResult[0].total,
                pages: Math.ceil(countResult[0].total / finalLimit)
            }
        });
    } catch (error) {
        console.error('Erreur récupération logs d’activité:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
}



// Créer un nouveau log d'activité
// Fonction utilitaire : createActivityLog(data)
async function createActivityLog(data) {
    try {
        await insertActivityLog(data);
        console.log(' Journal d’activité créé');
    } catch (error) {
        console.error('Erreur lors de la création du journal d’activité:', error);
    }
}


// Fonction utilitaire : insertActivityLog(data)
async function insertActivityLog({ action, details, userId, actionType = 'INFO' }) {
    try {
        if (!action || !userId) {
            console.warn('Tentative de log avec données incomplètes:', { action, userId });
            return;
        }

        const safe = (val) => (val === undefined || val === '') ? null : val;

        await pool.execute(
            `INSERT INTO activity_logs 
             (action, details, userId, actionType, createdAt) 
             VALUES (?, ?, ?, ?, NOW())`,
            [
                safe(action),
                safe(details),
                safe(userId),
                safe(actionType)
            ]
        );

        console.log(`✅ Log ajouté : ${action} (user ${userId})`);
    } catch (err) {
        console.error('Erreur lors de l\'insertion du log:', err);
    }
}


// Statistiques des activités
async function getActivityStats(req, res) {
    try {
        const { days = 7 } = req.query;

        const [stats] = await pool.execute(`
            SELECT 
                actionType,
                COUNT(*) as count,
                DATE(createdAt) as date
            FROM activity_logs 
            WHERE createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY actionType, DATE(createdAt)
            ORDER BY date DESC, count DESC
        `, [days]);

        res.json({ stats });
    } catch (error) {
        console.error('Error fetching activity stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}


async function getRecentActivitiesByStudent(req, res) {
    try {
        const { userId, page = 1, limit = 10 } = req.query;

        // Validation des paramètres
        if (!userId || typeof userId !== 'string') {
            return res.status(400).json({ error: 'Paramètre userId invalide' });
        }

        const parsedPage = parseInt(page);
        const parsedLimit = parseInt(limit);

        if (isNaN(parsedPage) || parsedPage <= 0 || isNaN(parsedLimit) || parsedLimit <= 0) {
            return res.status(400).json({ error: 'Paramètres page ou limit invalides' });
        }

        const finalLimit = Math.min(parsedLimit, 100); // max 100 logs par page
        const offset = (parsedPage - 1) * finalLimit;

        console.log("Requête SQL avec :", { userId, finalLimit, offset });

        // Requête principale
        const query = `
            SELECT al.*, u.email, u.role
            FROM activity_logs al
            LEFT JOIN users u ON al.userId = u.id
            WHERE al.userId = ?
            ORDER BY al.createdAt DESC
            LIMIT ${finalLimit} OFFSET ${offset}
        `;
        const [logs] = await pool.execute(query, [userId]);

        // Requête pour le total
        const [countRows] = await pool.execute(`
            SELECT COUNT(*) AS total FROM activity_logs WHERE userId = ?
        `, [userId]);

        const total = countRows[0]?.total || 0;
        const totalPages = Math.ceil(total / finalLimit);

        res.status(200).json({
            logs,
            pagination: {
                currentPage: parsedPage,
                totalPages,
                totalItems: total,
                pageSize: finalLimit
            }
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des activités récentes :', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
}



export default {
    getActivityLogs,
    createActivityLog,
    getActivityStats,
    insertActivityLog,
    getRecentActivitiesByStudent
};