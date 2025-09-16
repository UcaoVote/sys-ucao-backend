// notificationsController.js
import pool from '../dbconfig.js';
import NotificationService from '../services/notificationService.js';

// Notifications Admin 
async function getAdminNotifications(req, res) {
    try {
        let { limit = 10 } = req.query;
        limit = parseInt(limit, 10);

        if (isNaN(limit) || limit < 1) {
            limit = 10;
        }

        const query = `
            SELECT 
                al.action,
                al.details,
                al.createdAt,
                al.actionType,
                u.email
            FROM activity_logs al
            LEFT JOIN users u ON al.userId = u.id
            WHERE al.actionType = 'ADMIN'
            ORDER BY al.createdAt DESC
            LIMIT ?
        `;

        const [rows] = await pool.execute(query, [limit]);

        // Renvoyer directement le tableau
        res.json(rows);
    } catch (error) {
        console.error('Erreur lors de la récupération des notifications admin:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
}

// Corriger les autres méthodes pour utiliser les bons noms de colonnes
async function getUserNotifications(req, res) {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10, unreadOnly = false } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT * FROM notifications 
            WHERE userId = ?
        `;

        let params = [userId];

        if (unreadOnly === 'true') {
            query += ' AND is_read = FALSE';
        }

        query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [notifications] = await pool.execute(query, params);

        // Compter le total pour la pagination
        let countQuery = 'SELECT COUNT(*) as total FROM notifications WHERE userId = ?';
        if (unreadOnly === 'true') {
            countQuery += ' AND is_read = FALSE';
        }

        const [countResult] = await pool.execute(countQuery, [userId]);

        res.json({
            notifications,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0].total,
                pages: Math.ceil(countResult[0].total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Marquer une notification comme lue
async function markAsRead(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const [result] = await pool.execute(
            'UPDATE notifications SET is_read = TRUE, updatedAt = NOW() WHERE id = ? AND userId = ?',
            [id, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function createNotification(req, res) {
    try {
        const {
            title,
            message,
            type,
            priority,
            relatedEntity,
            entityId,
            userId
        } = req.body;

        const id = await NotificationService.sendUserNotification({
            title,
            message,
            type,
            priority,
            relatedEntity,
            entityId,
            userId
        });

        res.status(201).json({ message: 'Notification créée', id });
    } catch (error) {
        console.error('Erreur création notification:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
}


export default {
    getUserNotifications,
    markAsRead,
    createNotification,
    getAdminNotifications
};