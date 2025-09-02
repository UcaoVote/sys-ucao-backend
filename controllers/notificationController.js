import pool from '../config/database.js';

export const notificationController = {
    /**
     * Récupérer les notifications de l'utilisateur
     */
    getNotifications: async (req, res) => {
        let connection;
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;

            connection = await pool.getConnection();

            // Récupérer les notifications de l'utilisateur
            const [notifications] = await connection.execute(
                `SELECT n.* 
                 FROM notifications n 
                 WHERE n.user_id = ? 
                 ORDER BY n.created_at DESC 
                 LIMIT ? OFFSET ?`,
                [req.user.id, limit, offset]
            );

            // Compter le total des notifications
            const [totalResult] = await connection.execute(
                'SELECT COUNT(*) as total FROM notifications WHERE user_id = ?',
                [req.user.id]
            );

            const total = totalResult[0].total;

            res.json({
                notifications,
                total,
                totalPages: Math.ceil(total / limit),
                currentPage: page
            });
        } catch (error) {
            console.error('Erreur récupération notifications:', error);
            res.status(500).json({
                message: 'Erreur lors de la récupération des notifications',
                code: 'NOTIFICATIONS_FETCH_ERROR'
            });
        } finally {
            if (connection) connection.release();
        }
    },

    /**
     * Marquer une notification comme lue
     */
    markAsRead: async (req, res) => {
        let connection;
        try {
            const { id } = req.params;
            connection = await pool.getConnection();

            // Vérifier que la notification appartient à l'utilisateur
            const [notificationRows] = await connection.execute(
                'SELECT * FROM notifications WHERE id = ? AND user_id = ?',
                [id, req.user.id]
            );

            if (notificationRows.length === 0) {
                throw new Error('Notification non trouvée');
            }

            // Marquer comme lue
            await connection.execute(
                'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = ?',
                [id]
            );

            // Récupérer la notification mise à jour
            const [updatedNotification] = await connection.execute(
                'SELECT * FROM notifications WHERE id = ?',
                [id]
            );

            res.json({
                message: 'Notification marquée comme lue',
                notification: updatedNotification[0]
            });
        } catch (error) {
            console.error('Erreur marquage notification:', error);
            res.status(404).json({
                message: error.message || 'Notification non trouvée',
                code: 'NOTIFICATION_NOT_FOUND'
            });
        } finally {
            if (connection) connection.release();
        }
    },

    /**
     * Marquer toutes les notifications comme lues
     */
    markAllAsRead: async (req, res) => {
        let connection;
        try {
            connection = await pool.getConnection();

            await connection.execute(
                'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE user_id = ? AND is_read = FALSE',
                [req.user.id]
            );

            res.json({
                message: 'Toutes les notifications marquées comme lues'
            });
        } catch (error) {
            console.error('Erreur marquage toutes notifications:', error);
            res.status(500).json({
                message: 'Erreur lors du marquage des notifications',
                code: 'NOTIFICATIONS_MARK_ERROR'
            });
        } finally {
            if (connection) connection.release();
        }
    },

    /**
     * Supprimer une notification
     */
    deleteNotification: async (req, res) => {
        let connection;
        try {
            const { id } = req.params;
            connection = await pool.getConnection();

            // Vérifier que la notification appartient à l'utilisateur
            const [notificationRows] = await connection.execute(
                'SELECT * FROM notifications WHERE id = ? AND user_id = ?',
                [id, req.user.id]
            );

            if (notificationRows.length === 0) {
                throw new Error('Notification non trouvée');
            }

            await connection.execute(
                'DELETE FROM notifications WHERE id = ?',
                [id]
            );

            res.json({
                message: 'Notification supprimée avec succès'
            });
        } catch (error) {
            console.error('Erreur suppression notification:', error);
            res.status(404).json({
                message: error.message || 'Notification non trouvée',
                code: 'NOTIFICATION_NOT_FOUND'
            });
        } finally {
            if (connection) connection.release();
        }
    },

    /**
     * Supprimer toutes les notifications
     */
    deleteAllNotifications: async (req, res) => {
        let connection;
        try {
            connection = await pool.getConnection();

            await connection.execute(
                'DELETE FROM notifications WHERE user_id = ?',
                [req.user.id]
            );

            res.json({
                message: 'Toutes les notifications supprimées avec succès'
            });
        } catch (error) {
            console.error('Erreur suppression toutes notifications:', error);
            res.status(500).json({
                message: 'Erreur lors de la suppression des notifications',
                code: 'NOTIFICATIONS_DELETE_ERROR'
            });
        } finally {
            if (connection) connection.release();
        }
    },

    /**
     * Récupérer les statistiques des notifications
     */
    getStats: async (req, res) => {
        let connection;
        try {
            connection = await pool.getConnection();

            // Compter les notifications non lues
            const [unreadResult] = await connection.execute(
                'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
                [req.user.id]
            );

            // Compter le total des notifications
            const [totalResult] = await connection.execute(
                'SELECT COUNT(*) as count FROM notifications WHERE user_id = ?',
                [req.user.id]
            );

            res.json({
                total: totalResult[0].count,
                unread: unreadResult[0].count
            });
        } catch (error) {
            console.error('Erreur stats notifications:', error);
            res.status(500).json({
                message: 'Erreur lors de la récupération des statistiques',
                code: 'NOTIFICATIONS_STATS_ERROR'
            });
        } finally {
            if (connection) connection.release();
        }
    },

    /**
     * Récupérer les notifications pour les admins (toutes les notifications)
     */
    getAdminNotifications: async (req, res) => {
        let connection;
        try {
            if (req.user.role !== 'ADMIN') {
                return res.status(403).json({
                    message: 'Accès réservé aux administrateurs',
                    code: 'ADMIN_ACCESS_REQUIRED'
                });
            }

            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;
            const offset = (page - 1) * limit;

            connection = await pool.getConnection();

            // Construire la clause WHERE dynamiquement
            let whereClause = 'WHERE 1=1';
            const params = [];

            if (req.query.type) {
                whereClause += ' AND type = ?';
                params.push(req.query.type);
            }

            if (req.query.read !== undefined) {
                whereClause += ' AND is_read = ?';
                params.push(req.query.read === 'true' ? 1 : 0);
            }

            // Récupérer les notifications avec pagination
            const [notifications] = await connection.execute(
                `SELECT n.*, u.email as user_email, u.role as user_role 
                 FROM notifications n 
                 LEFT JOIN users u ON n.user_id = u.id 
                 ${whereClause} 
                 ORDER BY n.created_at DESC 
                 LIMIT ? OFFSET ?`,
                [...params, limit, offset]
            );

            // Compter le total
            const [totalResult] = await connection.execute(
                `SELECT COUNT(*) as total FROM notifications n ${whereClause}`,
                params
            );

            const total = totalResult[0].total;

            res.json({
                notifications,
                total,
                totalPages: Math.ceil(total / limit),
                currentPage: page
            });
        } catch (error) {
            console.error('Erreur récupération notifications admin:', error);
            res.status(500).json({
                message: 'Erreur lors de la récupération des notifications',
                code: 'NOTIFICATIONS_FETCH_ERROR'
            });
        } finally {
            if (connection) connection.release();
        }
    }
};