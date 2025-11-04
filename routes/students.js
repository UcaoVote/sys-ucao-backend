import express from 'express';
import { authenticateToken } from '../middlewares/auth.js';
import studentManager from '../controllers/studentManager.js';
import { paginateResults } from '../helpers/paginate.js';
import { searchEtudiantsByKeyword } from '../helpers/searchEtudiants.js';
import pool from '../database/dbconfig.js';


const router = express.Router();

// Liste de tous les etudiants
router.get('/', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 50;

        // Plus besoin d'import dynamique avec le Proxy dans dbconfig.js
        const [students] = await pool.execute(`
            SELECT 
                e.id, e.userId, e.matricule, e.identifiantTemporaire, 
                e.nom, e.prenom, e.annee, e.photoUrl, 
                e.ecoleId, e.filiereId, e.whatsapp, e.additional_info,
                ec.nom as ecole_nom,
                f.nom as filiere_nom,
                u.email, u.actif, u.tempPassword
            FROM etudiants e
            LEFT JOIN users u ON e.userId = u.id
            LEFT JOIN ecoles ec ON e.ecoleId = ec.id
            LEFT JOIN filieres f ON e.filiereId = f.id
            ORDER BY e.id DESC
        `);

        const paginated = paginateResults(students, page, limit);
        // Retourner au format attendu par le frontend: { data: [...] }
        res.json({
            success: true,
            total: paginated.total,
            page: paginated.page,
            limit: paginated.limit,
            pages: paginated.pages,
            data: paginated.results
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/search', authenticateToken, async (req, res) => {
    const { q } = req.query;

    if (!q || typeof q !== 'string' || q.trim() === '') {
        return res.status(400).json({ error: 'Le paramètre "q" est requis et doit être une chaîne non vide.' });
    }

    try {
        const results = await searchEtudiantsByKeyword(q);
        res.status(200).json({ total: results.length, results });
    } catch (error) {
        console.error('❌ Erreur SQL :', error.message);
        res.status(500).json({ error: 'Erreur interne lors de la recherche des étudiants.' });
    }
});

router.post('/', authenticateToken, async (req, res) => {
    try {
        const result = await studentManager.addStudent(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const result = await studentManager.updateStudent(req.params.id, req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.patch('/:id/status', authenticateToken, async (req, res) => {
    try {
        const { actif } = req.body;
        const result = await studentManager.toggleStudentStatus(req.params.id, actif);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const result = await studentManager.deleteStudent(req.params.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Filtrage
router.get('/filter', authenticateToken, async (req, res) => {
    const { filiere, annee, ecole } = req.query;

    try {
        const students = await studentManager.getFilteredStudents({ filiere, annee, ecole });
        res.status(200).json({ data: students });
    } catch (error) {
        console.error('Erreur SQL:', error.message);
        res.status(500).json({ error: 'Erreur interne lors du filtrage des étudiants.' });
    }
});

router.get('/ecoles', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute(`
      SELECT DISTINCT ecole FROM etudiants
      WHERE ecole IS NOT NULL AND ecole != ''
      ORDER BY ecole
    `);
        res.json({ data: rows });
    } catch (err) {
        console.error('Erreur chargement écoles:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.get('/filieres', authenticateToken, async (req, res) => {
    const { ecole } = req.query;
    if (!ecole) return res.status(400).json({ error: 'École requise' });

    try {
        const [rows] = await pool.execute(`
      SELECT DISTINCT filiere FROM etudiants
      WHERE ecole = ? AND filiere IS NOT NULL AND filiere != ''
      ORDER BY filiere
    `, [ecole]);
        res.json({ data: rows });
    } catch (err) {
        console.error('Erreur chargement filières:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});


router.get('/stats-by-filiere-annee', authenticateToken, async (req, res) => {
    try {
        const stats = await studentManager.getStatsByFiliereAndAnnee();
        res.status(200).json({ data: stats });
    } catch (error) {
        console.error('Erreur dans /stats-by-filiere-annee :', error.message);
        res.status(500).json({ error: 'Erreur interne lors de la récupération des statistiques.' });
    }
});

// Vérifier si étudiant est responsable de salle pour une école
router.get('/:studentId/status/responsable-salle', authenticateToken, async (req, res) => {
    const { studentId } = req.params;
    const { ecoleId } = req.query;

    if (!ecoleId) {
        return res.status(400).json({
            success: false,
            error: 'Le paramètre ecoleId est requis'
        });
    }

    let connection;
    try {
        connection = await pool.getConnection();

        const [rows] = await connection.execute(`
            SELECT 
                rs.id,
                rs.salle,
                rs.niveau,
                rs.createdAt,
                e.nom AS ecole_nom
            FROM responsables_salle rs
            INNER JOIN ecoles e ON rs.ecoleId = e.id
            WHERE rs.etudiantId = ? AND rs.ecoleId = ?
        `, [studentId, ecoleId]);

        res.status(200).json({
            success: true,
            isResponsable: rows.length > 0,
            salles: rows
        });

    } catch (error) {
        console.error('❌ Erreur vérification responsable salle:', error.message);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur lors de la vérification du statut de responsable de salle'
        });
    } finally {
        if (connection) connection.release();
    }
});

// Vérifier si étudiant est délégué d'école
router.get('/:studentId/status/school-delegate', authenticateToken, async (req, res) => {
    const { studentId } = req.params;

    let connection;
    try {
        connection = await pool.getConnection();

        const [rows] = await connection.execute(`
            SELECT 
                de.id,
                de.type,
                de.mandatDebut,
                de.mandatFin,
                de.createdAt,
                e.id AS ecoleId,
                e.nom AS ecole_nom,
                et.nom AS etudiant_nom,
                et.prenom AS etudiant_prenom,
                et.photoUrl
            FROM delegues_ecole de
            INNER JOIN ecoles e ON de.ecoleId = e.id
            INNER JOIN etudiants et ON de.etudiantId = et.id
            WHERE de.etudiantId = ?
        `, [studentId]);

        const isDelegate = rows.length > 0;
        const delegateInfo = isDelegate ? rows[0] : null;

        res.status(200).json({
            success: true,
            isDelegate,
            ecole: delegateInfo ? {
                id: delegateInfo.ecoleId,
                nom: delegateInfo.ecole_nom
            } : null,
            type: delegateInfo ? delegateInfo.type : null,
            mandat: delegateInfo ? {
                debut: delegateInfo.mandatDebut,
                fin: delegateInfo.mandatFin
            } : null
        });

    } catch (error) {
        console.error('❌ Erreur vérification délégué école:', error.message);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur lors de la vérification du statut de délégué d\'école'
        });
    } finally {
        if (connection) connection.release();
    }
});

// Récupérer le type de délégué d'école (premier ou deuxième)
router.get('/:studentId/status/school-delegate-type', authenticateToken, async (req, res) => {
    const { studentId } = req.params;

    let connection;
    try {
        connection = await pool.getConnection();

        const [rows] = await connection.execute(`
            SELECT type
            FROM delegues_ecole
            WHERE etudiantId = ?
            LIMIT 1
        `, [studentId]);

        res.status(200).json({
            success: true,
            type: rows.length > 0 ? rows[0].type : null
        });

    } catch (error) {
        console.error('❌ Erreur récupération type délégué:', error.message);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur lors de la récupération du type de délégué'
        });
    } finally {
        if (connection) connection.release();
    }
});

// Récupérer les délégués universitaires actuels
router.get('/university-delegates/current', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        const [rows] = await connection.execute(`
            SELECT 
                du.id,
                du.mandatDebut,
                du.mandatFin,
                du.createdAt,
                et.id AS etudiantId,
                et.nom,
                et.prenom,
                et.photoUrl,
                et.email,
                e.nom AS ecole_nom,
                f.nom AS filiere_nom
            FROM delegues_universite du
            INNER JOIN etudiants et ON du.etudiantId = et.id
            LEFT JOIN ecoles e ON et.ecoleId = e.id
            LEFT JOIN filieres f ON et.filiereId = f.id
            WHERE NOW() BETWEEN du.mandatDebut AND du.mandatFin
            ORDER BY du.createdAt DESC
        `);

        res.status(200).json({
            success: true,
            total: rows.length,
            delegates: rows.map(row => ({
                id: row.id,
                etudiantId: row.etudiantId,
                nom: row.nom,
                prenom: row.prenom,
                photo: row.photoUrl,
                email: row.email,
                ecole: row.ecole_nom,
                filiere: row.filiere_nom,
                mandat: {
                    debut: row.mandatDebut,
                    fin: row.mandatFin
                }
            }))
        });

    } catch (error) {
        console.error('❌ Erreur récupération délégués universitaires:', error.message);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur lors de la récupération des délégués universitaires'
        });
    } finally {
        if (connection) connection.release();
    }
});

export default router;