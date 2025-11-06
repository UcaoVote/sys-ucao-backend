import express from 'express';
import electionManager from '../controllers/electionManager.js';
import { authenticateToken, requireAdmin } from '../middlewares/auth.js';

const router = express.Router();

// Route pour récupérer les élections spécifiques à un étudiant
router.get('/voting', authenticateToken, async (req, res) => {
    try {
        const studentId = req.user.id;

        // Utiliser le manager pour récupérer les infos de l'étudiant
        const studentInfo = await electionManager.getStudentInfo(studentId);

        if (!studentInfo) {
            return res.status(404).json({ error: 'Informations étudiant non trouvées' });
        }

        const { filiere, annee, ecole } = studentInfo;

        // Récupérer les élections correspondantes
        const elections = await electionManager.getElectionsForStudent(filiere, annee, ecole);

        res.status(200).json({ data: elections });
    } catch (error) {
        console.error('Erreur dans getElectionsForStudent :', error.message);
        res.status(500).json({ error: 'Erreur interne lors de la récupération des élections.' });
    }
});


// Recuperer  toues les elections
router.get('/', async (req, res) => {
    try {
        // ✅ Utilisation du manager maintenant que le Proxy est en place
        const elections = await electionManager.getAllElections();
        res.status(200).json({ data: elections });
    } catch (error) {
        console.error('Erreur dans getAllElections :', error.message);
        res.status(500).json({ error: 'Erreur interne lors de la récupération des élections.' });
    }
});

// Recuperer des elections actives
router.get('/active', async (req, res) => {
    try {
        const elections = await electionManager.getActiveElections();
        res.status(200).json({ data: elections });
    } catch (error) {
        console.error('Erreur dans getActiveElections :', error.message);
        res.status(500).json({ error: 'Erreur interne lors de la récupération des élections actives.' });
    }
});

// Recuperer une election specifique

router.get('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const election = await electionManager.getElectionById(id);

        if (!election) {
            return res.status(404).json({ error: 'Élection non trouvée' });
        }

        res.status(200).json({ data: election });
    } catch (error) {
        console.error('Erreur dans getElectionById :', error.message);
        res.status(500).json({ error: 'Erreur interne lors de la récupération de l\'élection.' });
    }
});

// Crée une election
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await electionManager.createElection(req, res);
    } catch (error) {
        console.error('Erreur dans createElection :', error.message);
        res.status(500).json({ error: 'Erreur interne lors de la création de l\'élection.' });
    }
});


// Modifier une election
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const affectedRows = await electionManager.updateElection(id, req.body, req.user?.id);

        if (affectedRows === 0) {
            return res.status(404).json({ error: 'Élection non trouvée' });
        }

        res.status(200).json({ message: 'Élection modifiée avec succès' });
    } catch (error) {
        console.error('Erreur dans updateElection :', error.message);
        res.status(500).json({ error: 'Erreur interne lors de la modification de l\'élection.' });
    }
}
);

// Supprimer une election
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const affectedRows = await electionManager.deleteElection(id);

        if (affectedRows === 0) {
            return res.status(404).json({ error: 'Élection non trouvée' });
        }

        res.status(200).json({ message: 'Élection supprimée avec succès' });
    } catch (error) {
        console.error('Erreur dans deleteElection :', error.message);

        if (error.message.includes('Impossible de supprimer')) {
            return res.status(400).json({ error: error.message });
        }

        res.status(500).json({ error: 'Erreur interne lors de la suppression de l\'élection.' });
    }
}
);


// Route pour filtrer les élections
router.get('/filters', authenticateToken, async (req, res) => {
    try {
        const {
            type,
            ecole,
            filiere,
            annee,
            niveau,
            statut,
            page = 1,
            limit = 10
        } = req.query;

        const filters = {
            type: type || null,
            ecole: ecole || null,
            filiere: filiere || null,
            annee: annee ? parseInt(annee) : null,
            niveau: niveau || null,
            statut: statut || null,
            page: parseInt(page),
            limit: parseInt(limit)
        };

        const result = await electionManager.getElectionsWithFilters(filters);
        res.status(200).json({ data: result });
    } catch (error) {
        console.error('Erreur dans getElectionsWithFilters :', error.message);
        res.status(500).json({ error: 'Erreur interne lors de la récupération des élections filtrées.' });
    }
}
);



export default router;