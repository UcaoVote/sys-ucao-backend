// activityController.js

import pool from '../dbconfig.js';

// Récupérer les logs d'activité
async function getActivityLogs(req, res) {
    try {
        let { page = 1, limit = 20, actionType, userId, startDate, endDate, module } = req.query;

        page = parseInt(page);
        limit = parseInt(limit);
        const offset = (page - 1) * limit;

        if (isNaN(limit) || isNaN(offset)) {
            return res.status(400).json({ error: 'Paramètres de pagination invalides' });
        }

        let query = `
            SELECT al.*, u.email, u.role 
            FROM activity_logs al
            LEFT JOIN users u ON al.userId = u.id
            WHERE 1=1
        `;
        let params = [];

        let countQuery = 'SELECT COUNT(*) as total FROM activity_logs al WHERE 1=1';
        let countParams = [];

        if (module) {
            query += ' AND al.module = ?';
            countQuery += ' AND al.module = ?';
            params.push(module);
            countParams.push(module);
        }

        if (actionType) {
            query += ' AND al.actionType = ?';
            countQuery += ' AND al.actionType = ?';
            params.push(actionType);
            countParams.push(actionType);
        }

        if (userId) {
            query += ' AND al.userId = ?';
            countQuery += ' AND al.userId = ?';
            params.push(userId);
            countParams.push(userId);
        }

        if (startDate) {
            query += ' AND al.createdAt >= ?';
            countQuery += ' AND al.createdAt >= ?';
            params.push(startDate);
            countParams.push(startDate);
        }

        if (endDate) {
            query += ' AND al.createdAt <= ?';
            countQuery += ' AND al.createdAt <= ?';
            params.push(endDate);
            countParams.push(endDate);
        }

        query += ' ORDER BY al.createdAt DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [logs] = await pool.execute(query, params);
        const [countResult] = await pool.execute(countQuery, countParams);

        res.json({
            logs,
            pagination: {
                page,
                limit,
                total: countResult[0].total,
                pages: Math.ceil(countResult[0].total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}



// Créer un nouveau log d'activité
async function createActivityLog(req, res) {
    try {
        await insertActivityLog(req.body);
        res.status(201).json({ message: 'Activity log created' });
    } catch (error) {
        console.error('Error creating activity log:', error);
        res.status(500).json({ error: 'Erreur serveur' });
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


// Récupérer les logs d'activités etudiant
async function getRecentActivitiesByStudent(req, res) {
    try {
        const { userId, limit = 10 } = req.query;

        if (!userId || typeof userId !== 'string') {
            return res.status(400).json({ error: 'Paramètre userId invalide' });
        }

        const parsedLimit = parseInt(limit);
        if (isNaN(parsedLimit) || parsedLimit <= 0) {
            return res.status(400).json({ error: 'Paramètre limit invalide' });
        }
        console.log("Requête SQL avec :", { userId, parsedLimit });
        const query = `
  SELECT al.*, u.email, u.role
  FROM activity_logs al
  LEFT JOIN users u ON al.userId = u.id
  WHERE al.userId = ?
  ORDER BY al.createdAt DESC
  LIMIT ?
`;

        const [logs] = await pool.execute(query, [userId, parsedLimit]);

        res.status(200).json({ logs });
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