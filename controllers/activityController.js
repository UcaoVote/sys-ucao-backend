// controllers/activityController.js
import { activityService } from '../services/activityService.js';
import { getSafeLimit } from '../helpers/activityHelpers.js';

export const activityController = {
    async getActivities(req, res) {
        try {
            const limit = getSafeLimit(req.query.limit, 10);
            const activities = await activityService.getRecentActivities(limit);

            res.json({
                success: true,
                data: activities
            });
        } catch (err) {
            console.error("Erreur activity endpoint:", err);
            res.status(500).json({
                success: false,
                message: "Erreur serveur lors de la récupération des activités",
                error: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }
    }
};