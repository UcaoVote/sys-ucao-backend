import express from 'express';
import { authenticateToken } from '../middlewares/auth.js';
import studentManager from '../controllers/studentManager.js';
import { paginateResults } from '../helpers/paginate.js';
import { searchEtudiantsByKeyword } from '../helpers/searchEtudiants.js';
import pool from '../dbconfig.js';


const router = express.Router();

// Liste de tous les etudiants
router.get('/', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 50;

        const students = await studentManager.getAllStudents();
        const paginated = paginateResults(students, page, limit);

        res.json(paginated);
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

export default router;