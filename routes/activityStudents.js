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
        const userId = req.user.id;

        // Récupérer l'ID étudiant à partir de l'ID utilisateur
        const [etudiantRows] = await pool.execute(
            'SELECT id FROM etudiants WHERE userId = ?',
            [userId]
        );

        if (etudiantRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Profil étudiant non trouvé'
            });
        }

        const studentId = etudiantRows[0].id;

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

        const userId = req.user.id;

        // Récupérer l'ID étudiant à partir de l'ID utilisateur
        const [etudiantRows] = await connection.execute(
            'SELECT id FROM etudiants WHERE userId = ?',
            [userId]
        );

        if (etudiantRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Profil étudiant non trouvé'
            });
        }

        const studentId = etudiantRows[0].id;
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

        // Gérer les sous-activités si fournies
        const { subactivities } = req.body;
        if (subactivities && typeof subactivities === 'object') {
            // Supprimer les sous-activités existantes
            await connection.execute('DELETE FROM student_subactivities WHERE student_id = ?', [studentId]);

            // Préparer données d'insertion
            const insertData = [];
            for (const [activityId, subIds] of Object.entries(subactivities)) {
                if (Array.isArray(subIds) && subIds.length > 0) {
                    for (const subId of subIds) {
                        if (subId !== undefined && subId !== null && !isNaN(parseInt(subId))) {
                            insertData.push([studentId, parseInt(activityId), parseInt(subId)]);
                        }
                    }
                }
            }

            if (insertData.length > 0) {
                // Vérifier que les sous-activités existent et appartiennent aux activités
                const allSubIds = [...new Set(insertData.map(i => i[2]))];
                const placeholders = allSubIds.map(() => '?').join(',');
                const [existingSubs] = await connection.execute(
                    `SELECT id, activity_id FROM subactivities WHERE id IN (${placeholders}) AND actif = TRUE`,
                    allSubIds
                );

                const validInsert = insertData.filter(([sId, activityId, subId]) => {
                    return existingSubs.some(sub => sub.id === subId && sub.activity_id === activityId);
                });

                if (validInsert.length > 0) {
                    await connection.query(
                        'INSERT INTO student_subactivities (student_id, activity_id, subactivity_id) VALUES ?',
                        [validInsert]
                    );
                }
            }
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

// =============================================
// NOUVELLES ROUTES POUR LA PAGE ACTIVITÉS
// =============================================

// Récupérer tous les étudiants avec leurs activités et sous-activités
router.get('/students/all/with-activities', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [students] = await pool.execute(
            `SELECT 
                e.id as student_id,
                e.nom,
                e.prenom,
                u.email,
                e.photo,
                e.annee,
                e.ecoleId,
                e.filiereId,
                ec.nom as ecole_nom,
                f.nom as filiere_nom,
                a.id as category_id,
                a.nom as category_name,
                a.icone as category_icon,
                sa.created_at as date_inscription,
                sa.actif,
                s.id as subactivity_id,
                s.nom as subactivity_name,
                s.icone as subactivity_icon,
                ss.created_at as subactivity_date_inscription
             FROM etudiants e
             INNER JOIN users u ON e.userId = u.id
             INNER JOIN ecoles ec ON e.ecoleId = ec.id
             INNER JOIN filieres f ON e.filiereId = f.id
             LEFT JOIN student_activities sa ON e.id = sa.student_id
             LEFT JOIN activities a ON sa.activity_id = a.id AND a.actif = TRUE
             LEFT JOIN student_subactivities ss ON e.id = ss.student_id AND a.id = ss.activity_id
             LEFT JOIN subactivities s ON ss.subactivity_id = s.id AND s.actif = TRUE
             WHERE e.userId IS NOT NULL
             ORDER BY e.nom, e.prenom, a.nom, s.nom`
        );

        // Structurer les données par étudiant
        const studentsMap = new Map();

        students.forEach(row => {
            const studentId = row.student_id;

            if (!studentsMap.has(studentId)) {
                studentsMap.set(studentId, {
                    id: studentId,
                    nom: row.nom,
                    prenom: row.prenom,
                    email: row.email,
                    photo: row.photo,
                    annee: row.annee,
                    ecole_id: row.ecoleId,
                    ecole_nom: row.ecole_nom,
                    filiere_id: row.filiereId,
                    filiere_nom: row.filiere_nom,
                    activities: [],
                    actif: row.actif
                });
            }

            const student = studentsMap.get(studentId);

            // Ajouter l'activité si elle existe
            if (row.category_id) {
                let activity = student.activities.find(a => a.id === row.category_id);

                if (!activity) {
                    activity = {
                        id: row.category_id,
                        nom: row.category_name,
                        icone: row.category_icon,
                        date_inscription: row.date_inscription,
                        subactivities: []
                    };
                    student.activities.push(activity);
                }

                // Ajouter la sous-activité si elle existe
                if (row.subactivity_id) {
                    const subactivityExists = activity.subactivities.some(s => s.id === row.subactivity_id);
                    if (!subactivityExists) {
                        activity.subactivities.push({
                            id: row.subactivity_id,
                            nom: row.subactivity_name,
                            icone: row.subactivity_icon,
                            date_inscription: row.subactivity_date_inscription
                        });
                    }
                }
            }
        });

        const formattedStudents = Array.from(studentsMap.values());

        res.json({
            success: true,
            data: formattedStudents
        });

    } catch (error) {
        console.error('Erreur récupération étudiants avec activités:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des étudiants avec leurs activités'
        });
    }
});

// Version simplifiée pour l'affichage en tableau
router.get('/students', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [students] = await pool.execute(
            `SELECT
  e.id as student_id,
  e.nom,
  e.prenom,
  u.email,
  e.photoUrl as photo,
  e.annee,
  e.ecoleId,
  e.filiereId,
  ec.nom as ecole_nom,
  f.nom as filiere_nom,
  a.id as category_id,
  a.nom as category_name,
  a.icone as category_icon,
  s.id as subactivity_id,
  s.nom as subactivity_name,
  s.icone as subactivity_icon,
  sa.created_at as date_inscription,
  sa.actif
FROM etudiants e
INNER JOIN users u ON e.userId = u.id
INNER JOIN ecoles ec ON e.ecoleId = ec.id
INNER JOIN filieres f ON e.filiereId = f.id
LEFT JOIN student_activities sa ON e.id = sa.student_id
LEFT JOIN activities a ON sa.activity_id = a.id AND a.actif = TRUE
LEFT JOIN student_subactivities ss ON e.id = ss.student_id AND a.id = ss.activity_id
LEFT JOIN subactivities s ON ss.subactivity_id = s.id AND s.actif = TRUE
WHERE e.userId IS NOT NULL
ORDER BY e.nom, e.prenom, a.nom, s.nom`
        );

        // Pour l'affichage en tableau, on duplique les lignes pour chaque combinaison étudiant-activité-sous-activité
        const tableData = students.map(row => ({
            student_id: row.student_id,
            nom: row.nom,
            prenom: row.prenom,
            email: row.email,
            photo: row.photo,
            annee: row.annee,
            ecole_id: row.ecoleId,
            ecole_nom: row.ecole_nom,
            filiere_id: row.filiereId,
            filiere_nom: row.filiere_nom,
            category_id: row.category_id,
            category_name: row.category_name,
            category_icon: row.category_icon,
            subactivity_id: row.subactivity_id,
            subactivity_name: row.subactivity_name,
            subactivity_icon: row.subactivity_icon,
            date_inscription: row.date_inscription,
            actif: row.actif
        }));

        res.json({
            success: true,
            data: tableData
        });

    } catch (error) {
        console.error('Erreur récupération étudiants:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des étudiants'
        });
    }
});

// Exportation des données étudiants-activités
router.get('/export/students', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { format = 'csv' } = req.query;

        const [students] = await pool.execute(
            `SELECT 
                e.nom,
                e.prenom,
                u.email,
                e.annee,
                ec.nom as ecole,
                f.nom as filiere,
                a.nom as activite_principale,
                s.nom as sous_activite,
                sa.created_at as date_inscription,
                CASE WHEN sa.actif = 1 THEN 'Actif' ELSE 'Inactif' END as statut
             FROM etudiants e
             INNER JOIN users u ON e.userId = u.id
             INNER JOIN ecoles ec ON e.ecoleId = ec.id
             INNER JOIN filieres f ON e.filiereId = f.id
             LEFT JOIN student_activities sa ON e.id = sa.student_id
             LEFT JOIN activities a ON sa.activity_id = a.id AND a.actif = TRUE
             LEFT JOIN student_subactivities ss ON e.id = ss.student_id AND a.id = ss.activity_id
             LEFT JOIN subactivities s ON ss.subactivity_id = s.id AND s.actif = TRUE
             WHERE e.userId IS NOT NULL
             ORDER BY e.nom, e.prenom, a.nom, s.nom`
        );

        if (format === 'csv') {
            // Générer CSV
            const headers = ['Nom', 'Prénom', 'Email', 'Année', 'École', 'Filière', 'Activité Principale', 'Sous-Activité', 'Date Inscription', 'Statut'];
            let csvContent = headers.join(';') + '\n';

            students.forEach(row => {
                const line = [
                    `"${row.nom || ''}"`,
                    `"${row.prenom || ''}"`,
                    `"${row.email || ''}"`,
                    `"${row.annee || ''}"`,
                    `"${row.ecole || ''}"`,
                    `"${row.filiere || ''}"`,
                    `"${row.activite_principale || ''}"`,
                    `"${row.sous_activite || ''}"`,
                    `"${row.date_inscription ? new Date(row.date_inscription).toLocaleDateString('fr-FR') : ''}"`,
                    `"${row.statut || ''}"`
                ];
                csvContent += line.join(';') + '\n';
            });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=etudiants_activites.csv');
            res.send(csvContent);

        } else if (format === 'excel') {
            // Pour Excel, vous pouvez utiliser une bibliothèque comme exceljs
            // Pour l'instant, retourner un CSV avec extension xlsx
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=etudiants_activites.xlsx');
            // Implémentation Excel à compléter avec exceljs
            res.json({
                success: true,
                message: 'Export Excel à implémenter',
                data: students
            });

        } else if (format === 'pdf') {
            // Pour PDF, vous pouvez utiliser une bibliothèque comme pdfkit
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=etudiants_activites.pdf');
            // Implémentation PDF à compléter avec pdfkit
            res.json({
                success: true,
                message: 'Export PDF à implémenter',
                data: students
            });

        } else {
            res.status(400).json({
                success: false,
                message: 'Format d\'export non supporté'
            });
        }

    } catch (error) {
        console.error('Erreur exportation étudiants:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'exportation des données'
        });
    }
});

// Récupérer les statistiques complètes pour le dashboard
router.get('/dashboard/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Nombre total d'étudiants inscrits
        const [totalStudentsResult] = await pool.execute(
            'SELECT COUNT(*) as total FROM etudiants WHERE userId IS NOT NULL'
        );

        // Nombre total de catégories
        const [totalCategoriesResult] = await pool.execute(
            'SELECT COUNT(*) as total FROM activities WHERE actif = TRUE'
        );

        // Nombre total de sous-activités
        const [totalSubactivitiesResult] = await pool.execute(
            'SELECT COUNT(*) as total FROM subactivities WHERE actif = TRUE'
        );

        // Taux de participation (étudiants avec au moins une activité)
        const [participationResult] = await pool.execute(
            `SELECT COUNT(DISTINCT e.id) as participants
             FROM etudiants e
             INNER JOIN student_activities sa ON e.id = sa.student_id
             WHERE e.userId IS NOT NULL`
        );

        const totalStudents = totalStudentsResult[0].total;
        const participationRate = totalStudents > 0
            ? Math.round((participationResult[0].participants / totalStudents) * 100)
            : 0;

        res.json({
            success: true,
            data: {
                totalStudents: totalStudents,
                totalCategories: totalCategoriesResult[0].total,
                totalSubactivities: totalSubactivitiesResult[0].total,
                participationRate: participationRate
            }
        });

    } catch (error) {
        console.error('Erreur récupération statistiques dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques'
        });
    }
});

export default router;