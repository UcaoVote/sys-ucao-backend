import express from 'express';
import { authenticateToken } from '../middlewares/auth.js';
import pool from '../config/database.js';

const router = express.Router();

/**
 * GET /activity
 * Récupère les activités récentes pour le dashboard 
 */
router.get('/', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const limit = getSafeLimit(req.query.limit);
        // Récupérer les activités avec les informations utilisateur de base
        const query = `
            SELECT 
                al.*,
                u.id as user_id,
                u.email,
                u.role,
                a.nom as admin_nom,
                a.prenom as admin_prenom,
                e.nom as etudiant_nom,
                e.prenom as etudiant_prenom
            FROM activity_logs al
            LEFT JOIN users u ON al.userId = u.id
            LEFT JOIN admins a ON u.id = a.userId
            LEFT JOIN etudiants e ON u.id = e.userId
            ORDER BY al.createdAt DESC
            LIMIT ?
        `;

        const [activities] = await connection.execute(query, [parseInt(limit)]);

        // Formatter les activités
        const formattedActivities = activities.map(activity => {
            let userName = activity.email || 'Utilisateur inconnu';

            // Déterminer le nom selon le rôle
            if (activity.role === 'ADMIN' && activity.admin_nom) {
                userName = `${activity.admin_nom} ${activity.admin_prenom}`;
            } else if (activity.role === 'ETUDIANT' && activity.etudiant_nom) {
                userName = `${activity.etudiant_nom} ${activity.etudiant_prenom}`;
            }

            return {
                id: activity.id,
                title: activity.action,
                content: `${userName} - ${activity.details || 'Action effectuée'}`,
                time: formatTime(activity.createdAt),
                timestamp: activity.createdAt,
                icon: getIconForAction(activity.actionType)
            };
        });

        res.json(formattedActivities);
    } catch (err) {
        console.error("Erreur activity endpoint:", err);
        res.status(500).json({
            message: "Erreur serveur",
            error: err.message,
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        });
    } finally {
        if (connection) connection.release();
    }
});

// Helpers
function formatTime(date) {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);

    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h`;
    return `${Math.floor(hours / 24)} j`;
}

function getIconForAction(type) {
    const icons = {
        LOGIN: 'sign-in-alt',
        VOTE: 'vote-yea',
        CREATE: 'plus-circle',
        UPDATE: 'edit',
        DELETE: 'trash-alt'
    };
    return icons[type] || 'info-circle';
}

const getSafeLimit = (value, fallback = 10) => {
    const parsed = parseInt(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};


export default router;