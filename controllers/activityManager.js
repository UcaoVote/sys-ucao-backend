// activityController.js

import pool from '../dbconfig.js';

// Récupérer les logs d'activité
async function getActivityLogs(req, res) {
    try {
        const { page = 1, limit = 20, actionType, userId, startDate, endDate, module } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT al.*, u.email, u.role 
            FROM activity_logs al
            LEFT JOIN users u ON al.userId = u.id
            WHERE 1=1
        `;

        let params = [];

        // Compter le total pour la pagination
        let countQuery = 'SELECT COUNT(*) as total FROM activity_logs al WHERE 1=1';
        let countParams = [];

        if (module) {
            query += ' AND al.module = ?';
            params.push(module);

            countQuery += ' AND al.module = ?';
            countParams.push(module);
        }

        if (actionType) {
            query += ' AND al.actionType = ?';
            params.push(actionType);
        }

        if (userId) {
            query += ' AND al.userId = ?';
            params.push(userId);
        }

        if (startDate) {
            query += ' AND al.createdAt >= ?';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND al.createdAt <= ?';
            params.push(endDate);
        }

        query += ' ORDER BY al.createdAt DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [logs] = await pool.execute(query, params);

        if (actionType) {
            countQuery += ' AND al.actionType = ?';
            countParams.push(actionType);
        }

        if (userId) {
            countQuery += ' AND al.userId = ?';
            countParams.push(userId);
        }

        if (startDate) {
            countQuery += ' AND al.createdAt >= ?';
            countParams.push(startDate);
        }

        if (endDate) {
            countQuery += ' AND al.createdAt <= ?';
            countParams.push(endDate);
        }

        const [countResult] = await pool.execute(countQuery, countParams);

        res.json({
            logs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
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

        if (!userId || userId === 'undefined' || isNaN(limit)) {
            return res.status(400).json({ error: 'Paramètres invalides' });
        }

        const parsedLimit = Math.min(parseInt(limit), 100);
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