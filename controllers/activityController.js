import pool from '../database/dbconfig.js';

class ActivityController {
    // Récupérer toutes les catégories principales
    async getCategories(req, res) {
        try {
            const [rows] = await pool.execute(
                `SELECT
                a.id,
                a.nom,
                a.description,
                a.icone,
                a.has_subactivities,
                a.actif,
                a.created_at,
                a.updated_at,
                COUNT(sa.id) as activities_count
             FROM activities a
             LEFT JOIN subactivities sa ON a.id = sa.activity_id AND sa.actif = TRUE
             WHERE a.actif = TRUE
             GROUP BY a.id, a.nom, a.description, a.icone, a.has_subactivities, a.actif, a.created_at, a.updated_at
             ORDER BY a.nom`
            );

            res.json({
                success: true,
                data: rows
            });
        } catch (error) {
            console.error('Erreur récupération catégories:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    }

    // Récupérer les sous-activités d'une catégorie
    async getSubactivities(req, res) {
        try {
            const { activityId } = req.params;

            const [rows] = await pool.execute(
                `SELECT 
                id, 
                nom, 
                description, 
                icone, 
                actif, 
                created_at, 
                updated_at 
             FROM subactivities 
             WHERE activity_id = ? AND actif = TRUE 
             ORDER BY nom`,
                [activityId]
            );

            res.json({
                success: true,
                data: rows
            });
        } catch (error) {
            console.error('Erreur récupération sous-activités:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    }

    // Récupérer toutes les activités avec leurs sous-activités (pour l'admin)
    async getAllWithSubactivities(req, res) {
        try {
            const [categories] = await pool.execute(
                `SELECT 
                id, 
                nom, 
                description, 
                icone, 
                has_subactivities, 
                actif, 
                created_at, 
                updated_at 
             FROM activities 
             WHERE actif = TRUE 
             ORDER BY nom`
            );

            const categoriesWithSubs = await Promise.all(
                categories.map(async (category) => {
                    const [subactivities] = await pool.execute(
                        `SELECT 
                        id, 
                        nom, 
                        description, 
                        icone, 
                        actif, 
                        created_at, 
                        updated_at 
                     FROM subactivities 
                     WHERE activity_id = ? AND actif = TRUE 
                     ORDER BY nom`,
                        [category.id]
                    );

                    return {
                        ...category,
                        subactivities
                    };
                })
            );

            res.json({
                success: true,
                data: categoriesWithSubs
            });
        } catch (error) {
            console.error('Erreur récupération complète:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    }

}

export default new ActivityController();