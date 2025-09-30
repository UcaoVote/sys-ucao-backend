import express from 'express';
import pool from '../dbconfig.js';
import { authenticateToken, requireAdmin } from '../middlewares/auth.js';
const router = express.Router();


// GET /api/activities - Récupérer toutes les activités (public)
router.get('/', async (req, res) => {
    try {
        const [activities] = await pool.execute(
            `SELECT id, nom, description, icone, actif, created_at, updated_at 
             FROM activities 
             WHERE actif = TRUE 
             ORDER BY nom`
        );

        res.json({
            success: true,
            data: activities
        });
    } catch (error) {
        console.error('Erreur récupération activités:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des activités'
        });
    }
});

// GET /api/activities/student/:studentId - Récupérer les activités d'un étudiant
router.get('/student/:studentId', authenticateToken, async (req, res) => {
    try {
        const { studentId } = req.params;

        const [activities] = await pool.execute(
            `SELECT a.id, a.nom, a.description, a.icone, sa.created_at
             FROM activities a
             INNER JOIN student_activities sa ON a.id = sa.activity_id
             WHERE sa.student_id = ? AND a.actif = TRUE
             ORDER BY a.nom`,
            [studentId]
        );

        res.json({
            success: true,
            data: activities
        });
    } catch (error) {
        console.error('Erreur récupération activités étudiant:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des activités de l\'étudiant'
        });
    }
});

// GET /api/activities/my-activities - Récupérer les activités de l'étudiant connecté
router.get('/my-activities', authenticateToken, async (req, res) => {
    try {
        // Récupérer l'ID de l'étudiant depuis le token
        const studentId = req.user.id; // À adapter selon votre système d'authentification

        const [activities] = await pool.execute(
            `SELECT a.id, a.nom, a.description, a.icone, sa.created_at
             FROM activities a
             INNER JOIN student_activities sa ON a.id = sa.activity_id
             WHERE sa.student_id = ? AND a.actif = TRUE
             ORDER BY a.nom`,
            [studentId]
        );

        res.json({
            success: true,
            data: activities
        });
    } catch (error) {
        console.error('Erreur récupération mes activités:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération de vos activités'
        });
    }
});

// POST /api/activities/student/:studentId - Ajouter des activités à un étudiant (Admin)
router.post('/student/:studentId', authenticateToken, requireAdmin, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { studentId } = req.params;
        const { activities } = req.body;

        if (!activities || !Array.isArray(activities)) {
            return res.status(400).json({
                success: false,
                message: 'La liste des activités est requise'
            });
        }

        // Vérifier que l'étudiant existe
        const [studentRows] = await connection.execute(
            'SELECT id FROM etudiants WHERE id = ?',
            [studentId]
        );

        if (studentRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Étudiant non trouvé'
            });
        }

        // Vérifier que les activités existent
        const placeholders = activities.map(() => '?').join(',');
        const [activityRows] = await connection.execute(
            `SELECT id FROM activities WHERE id IN (${placeholders}) AND actif = TRUE`,
            activities
        );

        if (activityRows.length !== activities.length) {
            return res.status(400).json({
                success: false,
                message: 'Certaines activités sont invalides'
            });
        }

        // Supprimer les activités existantes
        await connection.execute(
            'DELETE FROM student_activities WHERE student_id = ?',
            [studentId]
        );

        // Ajouter les nouvelles activités
        if (activities.length > 0) {
            const activityValues = activities.map(activityId => [studentId, activityId]);
            await connection.query(
                'INSERT INTO student_activities (student_id, activity_id) VALUES ?',
                [activityValues]
            );
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'Activités mises à jour avec succès',
            data: { studentId, activities }
        });

    } catch (error) {
        await connection.rollback();
        console.error('Erreur mise à jour activités étudiant:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour des activités'
        });
    } finally {
        await connection.release();
    }
});

// PUT /api/activities/my-activities - Mettre à jour ses propres activités
router.put('/my-activities', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const studentId = req.user.id; // À adapter
        const { activities } = req.body;

        if (!activities || !Array.isArray(activities)) {
            return res.status(400).json({
                success: false,
                message: 'La liste des activités est requise'
            });
        }

        // Vérifier que les activités existent
        const placeholders = activities.map(() => '?').join(',');
        const [activityRows] = await connection.execute(
            `SELECT id FROM activities WHERE id IN (${placeholders}) AND actif = TRUE`,
            activities
        );

        if (activityRows.length !== activities.length) {
            return res.status(400).json({
                success: false,
                message: 'Certaines activités sont invalides'
            });
        }

        // Supprimer les activités existantes
        await connection.execute(
            'DELETE FROM student_activities WHERE student_id = ?',
            [studentId]
        );

        // Ajouter les nouvelles activités
        if (activities.length > 0) {
            const activityValues = activities.map(activityId => [studentId, activityId]);
            await connection.query(
                'INSERT INTO student_activities (student_id, activity_id) VALUES ?',
                [activityValues]
            );
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'Vos activités ont été mises à jour avec succès',
            data: { activities }
        });

    } catch (error) {
        await connection.rollback();
        console.error('Erreur mise à jour mes activités:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour de vos activités'
        });
    } finally {
        await connection.release();
    }
});

// GET /api/activities/students/:activityId - Récupérer les étudiants d'une activité (Admin)
router.get('/students/:activityId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { activityId } = req.params;

        const [students] = await pool.execute(
            `SELECT e.id, e.nom, e.prenom, e.email, e.annee, e.filiereId, 
                    ec.nom as ecole, f.nom as filiere, sa.created_at
             FROM etudiants e
             INNER JOIN student_activities sa ON e.id = sa.student_id
             INNER JOIN ecoles ec ON e.ecoleId = ec.id
             INNER JOIN filieres f ON e.filiereId = f.id
             WHERE sa.activity_id = ?
             ORDER BY e.nom, e.prenom`,
            [activityId]
        );

        res.json({
            success: true,
            data: students
        });
    } catch (error) {
        console.error('Erreur récupération étudiants activité:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des étudiants'
        });
    }
});

// GET /api/activities/stats - Statistiques des activités (Admin)
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [stats] = await pool.execute(
            `SELECT a.id, a.nom, a.icone, 
                    COUNT(sa.student_id) as student_count,
                    COUNT(DISTINCT e.ecoleId) as school_count
             FROM activities a
             LEFT JOIN student_activities sa ON a.id = sa.activity_id
             LEFT JOIN etudiants e ON sa.student_id = e.id
             WHERE a.actif = TRUE
             GROUP BY a.id, a.nom, a.icone
             ORDER BY student_count DESC`
        );

        const [totalStudents] = await pool.execute(
            'SELECT COUNT(*) as total FROM etudiants WHERE userId IS NOT NULL'
        );

        res.json({
            success: true,
            data: {
                activities: stats,
                totalStudents: totalStudents[0].total
            }
        });
    } catch (error) {
        console.error('Erreur récupération statistiques:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques'
        });
    }
});

export default router;