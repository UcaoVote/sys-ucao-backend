import express from 'express';
import candidatManager from '../controllers/candidatManager.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// Mes candidatures
router.get('/my-candidature', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await candidatManager.getMyCandidatures(userId);
        res.json(result);
    } catch (error) {
        console.error('Erreur récupération candidatures:', error);
        res.status(500).json({
            error: 'Erreur serveur',
            message: error.message
        });
    }
});

// Liste des candidats pour une élection spécifique
router.get('/election/:id', authenticateToken, async (req, res) => {
    try {
        const electionId = req.params.id;
        const result = await candidatManager.getCandidatesByElection(electionId);
        res.json(result);
    } catch (error) {
        console.error('Erreur récupération candidats:', error);
        res.status(500).json({
            error: 'Erreur serveur',
            message: error.message
        });
    }
});

router.post('/', authenticateToken, async (req, res) => {
    try {
        const result = await candidatManager.addCandidature(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Modifier une candidature
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const result = await candidatManager.updateCandidature(req.params.id, req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Supprimer une candidature
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const result = await candidatManager.deleteCandidature(req.params.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Admin gestion
// Changer le statut d'une candidature
router.put('/admin/:id/statut', authenticateToken, async (req, res) => {
    try {
        const result = await candidatManager.updateCandidatureStatus(req.params.id, req.body.statut);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Statistiques
router.get('/admin/stats', authenticateToken, async (req, res) => {
    try {
        const filters = {
            electionId: req.query.electionId,
            ecole: req.query.ecole,
            filiere: req.query.filiere
        };

        const result = await candidatManager.getCandidatureStats(filters);
        res.json(result);
    } catch (error) {
        console.error('❌ Erreur SQL :', error.message);
        res.status(500).json({ error: 'Erreur serveur lors de la récupération des statistiques' });
    }
});

// Lister toutes les candidatures
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await candidatManager.getAllCandidatures();
        res.json(result);
    } catch (error) {
        console.error('Erreur SQL:', error.message);
        res.status(500).json({ error: error.message });
    }

});

// Rechercher parmi ses candidatures
router.get('/admin/search', authenticateToken, async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || typeof q !== 'string' || q.trim() === '') {
            return res.status(400).json({ error: 'Le paramètre "q" est requis et doit être une chaîne non vide.' });
        }

        const result = await candidatManager.searchCandidatures(q);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Filtrer ses candidatures
router.post('/admin/filter', authenticateToken, async (req, res) => {
    try {
        const result = await candidatManager.getFilteredCandidatures(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});


export default router;