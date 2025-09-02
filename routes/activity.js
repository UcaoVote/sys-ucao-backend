import express from 'express';
import { authenticateToken } from '../middlewares/auth.js';
import pool from '../config/database.js';

const router = express.Router();

// Helper function
const getSafeLimit = (value, fallback = 10) => {
    const parsed = parseInt(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

function formatTime(date) {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `Il y a ${minutes} min`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Il y a ${hours} h`;

    const days = Math.floor(hours / 24);
    return `Il y a ${days} j`;
}

function getIconForAction(type) {
    const icons = {
        LOGIN: 'sign-in-alt',
        VOTE: 'vote-yea',
        CREATE: 'plus-circle',
        UPDATE: 'edit',
        DELETE: 'trash-alt',
        INFO: 'info-circle'
    };
    return icons[type] || 'info-circle';
}

/**
 * GET /activity
 * Récupère les activités récentes pour le dashboard 
 */
router.get('/', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        const limit = getSafeLimit(req.query.limit, 10);

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

        const formattedActivities = activities.map(activity => {
            let userName = activity.email || 'Utilisateur inconnu';

            if (activity.user_nom && activity.user_prenom) {
                userName = `${activity.user_prenom} ${activity.user_nom}`;
            }

            return {
                id: activity.id,
                title: activity.action,
                content: `${userName} - ${activity.details || 'Action effectuée'}`,
                time: formatTime(activity.createdAt),
                timestamp: activity.createdAt,
                icon: getIconForAction(activity.actionType),
                type: activity.actionType || 'INFO'
            };
        });

        res.json({
            success: true,
            data: formattedActivities
        });
    } catch (err) {
        console.error("Erreur activity endpoint:", err);
        res.status(500).json({
            success: false,
            message: "Erreur serveur lors de la récupération des activités",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

export default router;