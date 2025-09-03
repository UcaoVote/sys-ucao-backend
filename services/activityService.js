// services/activityService.js
import pool from '../config/database.js';
import { getSafeLimit, formatTime, getIconForAction } from '../helpers/activityHelpers.js';

export const activityService = {
    async getRecentActivities(limit) {
        let connection;
        try {
            connection = await pool.getConnection();
            const query = `
                SELECT 
                    al.*,
                    u.id AS user_id,
                    u.email,
                    u.role,
                    COALESCE(a.nom, e.nom) AS user_nom,
                    COALESCE(a.prenom, e.prenom) AS user_prenom
                FROM activity_logs al
                LEFT JOIN users u ON al.userId = u.id
                LEFT JOIN admins a ON u.id = a.userId AND u.role = 'ADMIN'
                LEFT JOIN etudiants e ON u.id = e.userId AND u.role = 'ETUDIANT'
                ORDER BY al.createdAt DESC
                LIMIT ?
            `;
            const [activities] = await connection.execute(query, [limit]);

            return activities.map(activity => ({
                id: activity.id,
                title: activity.action,
                content: `${activity.user_prenom && activity.user_nom
                    ? `${activity.user_prenom} ${activity.user_nom}`
                    : activity.email || 'Utilisateur inconnu'} - ${activity.details || 'Action effectuée'}`,
                time: formatTime(activity.createdAt),
                timestamp: activity.createdAt,
                icon: getIconForAction(activity.actionType),
                type: activity.actionType || 'INFO'
            }));
        } finally {
            if (connection) await connection.release();
        }
    }
};