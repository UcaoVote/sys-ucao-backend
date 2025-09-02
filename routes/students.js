import express from 'express';
import pool from '../database.js'; // Votre connexion MySQL
import { authenticateToken, requireAdmin } from '../middlewares/auth.js';
import { PasswordResetService } from '../services/passwordResetService.js';

const router = express.Router();


// PUT /api/students/:id/status - Modifier le statut d'un étudiant
router.put('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { id } = req.params;
        const { actif } = req.body;

        // Vérifier que l'étudiant existe
        const [etudiantRows] = await db.execute(
            `SELECT e.*, u.id as userId, u.actif as userActif 
             FROM etudiants e 
             LEFT JOIN users u ON e.userId = u.id 
             WHERE e.id = ?`,
            [parseInt(id)]
        );

        if (etudiantRows.length === 0 || !etudiantRows[0].userId) {
            return res.status(404).json({
                success: false,
                message: 'Étudiant non trouvé'
            });
        }

        const etudiant = etudiantRows[0];

        // Mettre à jour le statut de l'utilisateur
        await db.execute(
            'UPDATE users SET actif = ? WHERE id = ?',
            [actif, etudiant.userId]
        );

        // Récupérer les informations mises à jour
        const [updatedUserRows] = await connection.execute(
            `SELECT u.*, e.id as etudiantId, e.nom, e.prenom, e.filiere, e.annee 
             FROM users u 
             LEFT JOIN etudiants e ON u.id = e.userId 
             WHERE u.id = ?`,
            [etudiant.userId]
        );

        const updatedUser = updatedUserRows[0];

        return res.json({
            success: true,
            message: `Étudiant ${actif ? 'activé' : 'désactivé'} avec succès`,
            data: {
                id: updatedUser.id,
                email: updatedUser.email,
                actif: updatedUser.actif,
                etudiant: {
                    id: updatedUser.etudiantId,
                    nom: updatedUser.nom,
                    prenom: updatedUser.prenom,
                    filiere: updatedUser.filiere,
                    annee: updatedUser.annee
                }
            }
        });
    } catch (error) {
        console.error('Error updating student status:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la modification du statut',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// POST /api/students/:studentId/reset-access - Réinitialiser accès étudiant
router.post('/:studentId/reset-access', async (req, res) => {
    try {
        const { studentId } = req.params;
        const adminId = req.user?.id || null;

        const temporaryCredentials = await PasswordResetService.resetStudentAccess(
            adminId,
            parseInt(studentId)
        );

        return res.json({
            success: true,
            message: 'Accès réinitialisés avec succès',
            data: {
                temporaryIdentifiant: temporaryCredentials.temporaryIdentifiant,
                temporaryPassword: temporaryCredentials.temporaryPassword,
                expirationDate: temporaryCredentials.expirationDate,
                requirePasswordChange: true,
                student: {
                    id: studentId,
                    nom: temporaryCredentials.student.nom,
                    prenom: temporaryCredentials.student.prenom,
                    matricule: temporaryCredentials.student.matricule
                }
            }
        });
    } catch (error) {
        console.error('Erreur réinitialisation accès:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur lors de la réinitialisation des accès',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Recherche étudiant par matricule
router.get('/matricule/:matricule', authenticateToken, requireAdmin, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { matricule } = req.params;

        const [studentRows] = await connection.execute(
            `SELECT e.*, u.email, u.actif, u.createdAt 
             FROM etudiants e 
             LEFT JOIN users u ON e.userId = u.id 
             WHERE e.matricule = ?`,
            [matricule]
        );

        if (studentRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Étudiant non trouvé'
            });
        }

        const student = studentRows[0];

        return res.json({
            success: true,
            data: {
                ...student,
                status: student.actif ? 'Actif' : 'Inactif'
            }
        });
    } catch (error) {
        console.error('Erreur recherche étudiant:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur lors de la recherche étudiant',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Recherche étudiant par code d'inscription
router.get('/code/:code', authenticateToken, requireAdmin, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { code } = req.params;

        const [studentRows] = await connection.execute(
            `SELECT e.*, u.email, u.actif, u.createdAt 
             FROM etudiants e 
             LEFT JOIN users u ON e.userId = u.id 
             WHERE e.codeInscription = ?`,
            [code]
        );

        if (studentRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Étudiant non trouvé avec ce code d\'inscription'
            });
        }

        const student = studentRows[0];

        return res.json({
            success: true,
            data: {
                ...student,
                status: student.actif ? 'Actif' : 'Inactif'
            }
        });
    } catch (error) {
        console.error('Erreur recherche étudiant par code:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur lors de la recherche étudiant',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET /api/students - Récupérer tous les étudiants avec pagination et filtres
router.get('/', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { page = 1, limit = 10, filiere, annee, ecole, status, search } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Construction de la requête avec filtres
        let whereConditions = ['u.role = "ETUDIANT"'];
        let queryParams = [];

        if (status === 'active') whereConditions.push('u.actif = true');
        if (status === 'inactive') whereConditions.push('u.actif = false');
        if (filiere) {
            whereConditions.push('e.filiere = ?');
            queryParams.push(filiere);
        }
        if (annee) {
            whereConditions.push('e.annee = ?');
            queryParams.push(parseInt(annee));
        }
        if (ecole) {
            whereConditions.push('e.ecole = ?');
            queryParams.push(ecole);
        }
        if (search) {
            whereConditions.push(`(e.nom LIKE ? OR e.prenom LIKE ? OR e.identifiantTemporaire LIKE ? OR e.matricule LIKE ?)`);
            queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Requête pour les étudiants
        const studentsQuery = `
            SELECT e.*, u.email, u.actif 
            FROM etudiants e 
            LEFT JOIN users u ON e.userId = u.id 
            ${whereClause} 
            ORDER BY e.nom ASC, e.prenom ASC 
            LIMIT ? OFFSET ?
        `;

        // Requête pour le total
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM etudiants e 
            LEFT JOIN users u ON e.userId = u.id 
            ${whereClause}
        `;

        const [studentsRows] = await connection.execute(
            studentsQuery,
            [...queryParams, parseInt(limit), skip]
        );

        const [[totalResult]] = await connection.execute(countQuery, queryParams);
        const total = totalResult.total;

        const formattedStudents = studentsRows.map(s => ({
            id: s.id,
            nom: s.nom,
            prenom: s.prenom,
            identifiantTemporaire: s.identifiantTemporaire,
            email: s.email,
            filiere: s.filiere,
            annee: s.annee,
            status: s.actif ? 'Actif' : 'Inactif',
            matricule: s.matricule,
            ecole: s.ecole
        }));

        res.json({
            success: true,
            data: formattedStudents,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// GET /api/students/stats - Statistiques globales
router.get('/stats', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { filiere, annee, ecole } = req.query;

        let whereConditions = ['u.role = "ETUDIANT"'];
        let queryParams = [];

        if (filiere) {
            whereConditions.push('e.filiere = ?');
            queryParams.push(filiere);
        }
        if (annee) {
            whereConditions.push('e.annee = ?');
            queryParams.push(parseInt(annee));
        }
        if (ecole) {
            whereConditions.push('e.ecole = ?');
            queryParams.push(ecole);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const query = `
            SELECT e.id, u.actif, e.filiere, e.annee, e.ecole 
            FROM etudiants e 
            LEFT JOIN users u ON e.userId = u.id 
            ${whereClause}
        `;

        const [studentsRows] = await connection.execute(query, queryParams);

        const totalStudents = studentsRows.length;
        const activeStudents = studentsRows.filter(s => s.actif).length;
        const inactiveStudents = totalStudents - activeStudents;
        const activationRate = totalStudents ? ((activeStudents / totalStudents) * 100).toFixed(2) : '0.00';

        res.json({
            success: true,
            statistics: { totalStudents, activeStudents, inactiveStudents, activationRate }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

export default router;