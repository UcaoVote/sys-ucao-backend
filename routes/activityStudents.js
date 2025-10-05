import express from 'express';
import activityController from '../controllers/activityController.js';
import pool from '../dbconfig.js';
import { authenticateToken, requireAdmin } from '../middlewares/auth.js';

const router = express.Router();

// =============================================
// ROUTES PUBLIQUES (sans authentification)
// =============================================

// Récupérer toutes les catégories d'activités
router.get('/', activityController.getCategories);

// Récupérer les sous-activités d'une activité
router.get('/:activityId/subactivities', activityController.getSubactivities);

// Récupérer toutes les activités avec leurs sous-activités
router.get('/all/with-subactivities', activityController.getAllWithSubactivities);

// =============================================
// ROUTES ÉTUDIANT (authentification requise)
// =============================================

// Récupérer les activités de l'étudiant connecté
router.get('/my-activities', authenticateToken, async (req, res) => {
    try {
        const studentId = req.user.id;

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

// Mettre à jour ses propres activités
router.put('/my-activities', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const studentId = req.user.id;
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

// =============================================
// ROUTES ADMIN (authentification + admin requis)
// =============================================

// CRÉATION
// Créer une nouvelle activité
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { nom, description, icone, has_subactivities = false } = req.body;

        // Validation des champs obligatoires
        if (!nom || !nom.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Le nom de l\'activité est obligatoire'
            });
        }

        if (!icone || !icone.trim()) {
            return res.status(400).json({
                success: false,
                message: 'L\'icône de l\'activité est obligatoire'
            });
        }

        // Vérifier si une activité avec le même nom existe déjà
        const [existingActivities] = await connection.execute(
            'SELECT id FROM activities WHERE nom = ? AND actif = TRUE',
            [nom.trim()]
        );

        if (existingActivities.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Une activité avec ce nom existe déjà'
            });
        }

        // Insérer la nouvelle activité
        const [result] = await connection.execute(
            `INSERT INTO activities (nom, description, icone, has_subactivities, actif, created_at, updated_at) 
             VALUES (?, ?, ?, ?, TRUE, NOW(), NOW())`,
            [nom.trim(), description ? description.trim() : null, icone.trim(), has_subactivities]
        );

        // Récupérer l'activité créée
        const [newActivity] = await connection.execute(
            'SELECT * FROM activities WHERE id = ?',
            [result.insertId]
        );

        await connection.commit();

        res.status(201).json({
            success: true,
            message: 'Activité créée avec succès',
            data: newActivity[0]
        });

    } catch (error) {
        await connection.rollback();
        console.error('Erreur création activité:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de l\'activité'
        });
    } finally {
        await connection.release();
    }
});

// Créer une sous-activité
router.post('/:activityId/subactivities', authenticateToken, requireAdmin, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { activityId } = req.params;
        const { nom, description, icone } = req.body;

        // Validation des champs obligatoires
        if (!nom || !nom.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Le nom de la sous-activité est obligatoire'
            });
        }

        if (!icone || !icone.trim()) {
            return res.status(400).json({
                success: false,
                message: 'L\'icône de la sous-activité est obligatoire'
            });
        }

        // Vérifier que l'activité parent existe
        const [activityRows] = await connection.execute(
            'SELECT id FROM activities WHERE id = ? AND actif = TRUE',
            [activityId]
        );

        if (activityRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Activité parent non trouvée'
            });
        }

        // Vérifier si une sous-activité avec le même nom existe déjà pour cette activité
        const [existingSubactivities] = await connection.execute(
            'SELECT id FROM subactivities WHERE nom = ? AND activity_id = ? AND actif = TRUE',
            [nom.trim(), activityId]
        );

        if (existingSubactivities.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Une sous-activité avec ce nom existe déjà pour cette activité'
            });
        }

        // Insérer la nouvelle sous-activité
        const [result] = await connection.execute(
            `INSERT INTO subactivities (nom, description, icone, activity_id, actif, created_at, updated_at) 
             VALUES (?, ?, ?, ?, TRUE, NOW(), NOW())`,
            [nom.trim(), description ? description.trim() : null, icone.trim(), activityId]
        );

        // Récupérer la sous-activité créée
        const [newSubactivity] = await connection.execute(
            'SELECT * FROM subactivities WHERE id = ?',
            [result.insertId]
        );

        await connection.commit();

        res.status(201).json({
            success: true,
            message: 'Sous-activité créée avec succès',
            data: newSubactivity[0]
        });

    } catch (error) {
        await connection.rollback();
        console.error('Erreur création sous-activité:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de la sous-activité'
        });
    } finally {
        await connection.release();
    }
});

// GESTION DES ÉTUDIANTS
// Récupérer les activités d'un étudiant spécifique
router.get('/student/:studentId', authenticateToken, requireAdmin, async (req, res) => {
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

// Ajouter des activités à un étudiant
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

// Récupérer les étudiants d'une activité
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

// STATUT ET STATISTIQUES
// Activer/désactiver une activité
router.patch('/:activityId/actif', authenticateToken, requireAdmin, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { activityId } = req.params;
        const { actif } = req.body;

        // Vérifier que l'activité existe
        const [activityRows] = await connection.execute(
            'SELECT id FROM activities WHERE id = ?',
            [activityId]
        );

        if (activityRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Activité non trouvée'
            });
        }

        // Mettre à jour le statut
        await connection.execute(
            'UPDATE activities SET actif = ?, updated_at = NOW() WHERE id = ?',
            [actif, activityId]
        );

        await connection.commit();

        res.json({
            success: true,
            message: `Activité ${actif ? 'activée' : 'désactivée'} avec succès`
        });

    } catch (error) {
        await connection.rollback();
        console.error('Erreur mise à jour activité:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour de l\'activité'
        });
    } finally {
        await connection.release();
    }
});

// Activer/désactiver une sous-activité
router.patch('/subactivities/:subactivityId/actif', authenticateToken, requireAdmin, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { subactivityId } = req.params;
        const { actif } = req.body;

        // Vérifier que la sous-activité existe
        const [subactivityRows] = await connection.execute(
            'SELECT id FROM subactivities WHERE id = ?',
            [subactivityId]
        );

        if (subactivityRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Sous-activité non trouvée'
            });
        }

        // Mettre à jour le statut
        await connection.execute(
            'UPDATE subactivities SET actif = ?, updated_at = NOW() WHERE id = ?',
            [actif, subactivityId]
        );

        await connection.commit();

        res.json({
            success: true,
            message: `Sous-activité ${actif ? 'activée' : 'désactivée'} avec succès`
        });

    } catch (error) {
        await connection.rollback();
        console.error('Erreur mise à jour sous-activité:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour de la sous-activité'
        });
    } finally {
        await connection.release();
    }
});

// Récupérer les statistiques des activités
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