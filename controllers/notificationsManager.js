// notificationsController.js
import pool from '../dbconfig.js';
import NotificationService from '../services/notificationService.js';



async function getUnreadNotifications(req, res) {
    try {
        const userId = req.user.id; // L'ID de l'utilisateur connecté

        // Récupérer uniquement les notifications non lues de l'utilisateur
        const unreadNotifications = await Notification.find({
            user: userId,
            read: false
        }).sort({ createdAt: -1 }); // Tri par date décroissante

        res.json({
            success: true,
            notifications: unreadNotifications,
            count: unreadNotifications.length
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des notifications non lues:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la récupération des notifications non lues'
        });
    }
};

async function getUnreadCount(req, res) {
    try {
        const userId = req.user.id; // L'ID de l'utilisateur connecté

        // Compter uniquement les notifications non lues de l'utilisateur
        const unreadCount = await Notification.countDocuments({
            user: userId,
            read: false
        });

        res.json({
            success: true,
            count: unreadCount
        });
    } catch (error) {
        console.error('Erreur lors du comptage des notifications non lues:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors du comptage des notifications non lues',
            count: 0
        });
    }
};

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
    LIMIT ${Math.max(0, parseInt(limit))}`;

        console.log('Notification Query:', query);
        console.log('Limit value:', limit);

        const [rows] = await pool.execute(query, [parseInt(limit)]);

        res.json(rows);
    } catch (error) {
        console.error('Erreur lors de la récupération des notifications admin:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
}

async function getUserNotifications(req, res) {
    try {
        const userId = req.user.id;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        let { limit = 10, unreadOnly = false } = req.query;

        limit = parseInt(limit, 10);
        if (isNaN(limit) || limit < 1) {
            limit = 10;
        }

        const query = `
            SELECT 
                id, 
                title, 
                message, 
                type, 
                priority, 
                is_read as isRead, 
                relatedEntity, 
                entityId, 
                createdAt, 
                updatedAt
            FROM notifications 
            WHERE userId = ? ${unreadOnly === 'true' ? 'AND is_read = FALSE' : ''}
            ORDER BY createdAt DESC 
            LIMIT ${Math.max(0, parseInt(limit))}
        `;

        const [notifications] = await pool.execute(query, [userId]);


        return res.json({
            success: true,
            notifications
        });

    } catch (error) {
        console.error('Error in getUserNotifications:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch notifications'
        });
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

// Marquer toutes les notifications comme lues
async function markAllAsRead(req, res) {
    try {
        const userId = req.user.id;

        const [result] = await pool.execute(
            'UPDATE notifications SET is_read = TRUE, updatedAt = NOW() WHERE userId = ? AND is_read = FALSE',
            [userId]
        );

        res.json({
            message: 'Toutes les notifications ont été marquées comme lues',
            updatedCount: result.affectedRows
        });
    } catch (error) {
        console.error('Erreur lors du marquage des notifications:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
}

// Effacer toutes les notifications d'un utilisateur
async function clearAll(req, res) {
    try {
        const userId = req.user.id;

        const [result] = await pool.execute(
            'DELETE FROM notifications WHERE userId = ?',
            [userId]
        );

        res.json({
            message: 'Toutes les notifications ont été supprimées',
            deletedCount: result.affectedRows
        });
    } catch (error) {
        console.error('Erreur lors de la suppression des notifications:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
}


export default {
    getUserNotifications,
    markAsRead,
    markAllAsRead,
    clearAll,
    createNotification,
    getAdminNotifications,
    getUnreadNotifications,
    getUnreadCount
};