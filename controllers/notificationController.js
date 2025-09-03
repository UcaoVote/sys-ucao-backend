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

            const [notifications] = await connection.execute(
                `SELECT n.* 
                 FROM notifications n 
                 WHERE n.userId = ? 
                 ORDER BY n.createdAt DESC 
                 LIMIT ? OFFSET ?`,
                [req.user.id, limit, offset]
            );

            const [totalResult] = await connection.execute(
                'SELECT COUNT(*) as total FROM notifications WHERE userId = ?',
                [req.user.id]
            );

            const total = totalResult[0].total;

            res.json({
                success: true,
                data: {
                    notifications,
                    pagination: {
                        total,
                        totalPages: Math.ceil(total / limit),
                        currentPage: page,
                        limit
                    }
                }
            });
        } catch (error) {
            console.error('Erreur récupération notifications:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des notifications',
                code: 'NOTIFICATIONS_FETCH_ERROR',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        } finally {
            if (connection) await connection.release();
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

            const [notificationRows] = await connection.execute(
                'SELECT * FROM notifications WHERE id = ? AND userId = ?',
                [id, req.user.id]
            );

            if (notificationRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Notification non trouvée',
                    code: 'NOTIFICATION_NOT_FOUND'
                });
            }

            // Mise à jour avec le champ existant updatedAt au lieu de readAt
            await connection.execute(
                'UPDATE notifications SET is_read = TRUE, updatedAt = NOW() WHERE id = ?',
                [id]
            );

            const [updatedNotification] = await connection.execute(
                'SELECT * FROM notifications WHERE id = ?',
                [id]
            );

            res.json({
                success: true,
                message: 'Notification marquée comme lue',
                data: {
                    notification: updatedNotification[0]
                }
            });
        } catch (error) {
            console.error('Erreur marquage notification:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors du marquage de la notification',
                code: 'NOTIFICATION_UPDATE_ERROR',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        } finally {
            if (connection) await connection.release();
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
                'UPDATE notifications SET is_read = TRUE, updatedAt = NOW() WHERE userId = ? AND is_read = FALSE',
                [req.user.id]
            );

            res.json({
                success: true,
                message: 'Toutes les notifications marquées comme lues'
            });
        } catch (error) {
            console.error('Erreur marquage toutes notifications:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors du marquage des notifications',
                code: 'NOTIFICATIONS_MARK_ERROR',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        } finally {
            if (connection) await connection.release();
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

            const [notificationRows] = await connection.execute(
                'SELECT * FROM notifications WHERE id = ? AND userId = ?',
                [id, req.user.id]
            );

            if (notificationRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Notification non trouvée',
                    code: 'NOTIFICATION_NOT_FOUND'
                });
            }

            await connection.execute(
                'DELETE FROM notifications WHERE id = ?',
                [id]
            );

            res.json({
                success: true,
                message: 'Notification supprimée avec succès'
            });
        } catch (error) {
            console.error('Erreur suppression notification:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la suppression de la notification',
                code: 'NOTIFICATION_DELETE_ERROR',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        } finally {
            if (connection) await connection.release();
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
                'DELETE FROM notifications WHERE userId = ?',
                [req.user.id]
            );

            res.json({
                success: true,
                message: 'Toutes les notifications supprimées avec succès'
            });
        } catch (error) {
            console.error('Erreur suppression toutes notifications:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la suppression des notifications',
                code: 'NOTIFICATIONS_DELETE_ERROR',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        } finally {
            if (connection) await connection.release();
        }
    },

    /**
     * Récupérer les statistiques des notifications
     */
    getStats: async (req, res) => {
        let connection;
        try {
            connection = await pool.getConnection();

            const [unreadResult] = await connection.execute(
                'SELECT COUNT(*) as count FROM notifications WHERE userId = ? AND is_read = FALSE',
                [req.user.id]
            );

            const [totalResult] = await connection.execute(
                'SELECT COUNT(*) as count FROM notifications WHERE userId = ?',
                [req.user.id]
            );

            res.json({
                success: true,
                data: {
                    total: totalResult[0].count,
                    unread: unreadResult[0].count
                }
            });
        } catch (error) {
            console.error('Erreur stats notifications:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des statistiques',
                code: 'NOTIFICATIONS_STATS_ERROR',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        } finally {
            if (connection) await connection.release();
        }
    },

    /**
     * Récupérer les notifications pour les admins
     */
    getAdminNotifications: async (req, res) => {
        let connection;
        try {
            if (req.user.role !== 'ADMIN') {
                return res.status(403).json({
                    success: false,
                    message: 'Accès réservé aux administrateurs',
                    code: 'ADMIN_ACCESS_REQUIRED'
                });
            }

            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;
            const offset = (page - 1) * limit;

            connection = await pool.getConnection();

            // Construction dynamique de la clause WHERE
            let whereConditions = [];
            let params = [];

            if (req.query.type) {
                whereConditions.push('n.type = ?');
                params.push(req.query.type);
            }

            if (req.query.is_read !== undefined) {
                whereConditions.push('n.is_read = ?');
                params.push(req.query.is_read === 'true' ? 1 : 0);
            }

            if (req.query.priority) {
                whereConditions.push('n.priority = ?');
                params.push(req.query.priority);
            }

            const whereClause = whereConditions.length > 0
                ? `WHERE ${whereConditions.join(' AND ')}`
                : '';

            // Requête principale
            const [notifications] = await connection.execute(
                `SELECT n.*, u.email as user_email, u.role as user_role 
                 FROM notifications n 
                 LEFT JOIN users u ON n.userId = u.id 
                 ${whereClause} 
                 ORDER BY n.createdAt DESC 
                 LIMIT ? OFFSET ?`,
                [...params, limit, offset]
            );

            // Requête de comptage
            const [totalResult] = await connection.execute(
                `SELECT COUNT(*) as total FROM notifications n ${whereClause}`,
                params
            );

            const total = totalResult[0].total;

            res.json({
                success: true,
                data: {
                    notifications,
                    pagination: {
                        total,
                        totalPages: Math.ceil(total / limit),
                        currentPage: page,
                        limit
                    }
                }
            });
        } catch (error) {
            console.error('Erreur récupération notifications admin:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des notifications',
                code: 'NOTIFICATIONS_FETCH_ERROR',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        } finally {
            if (connection) await connection.release();
        }
    }
};