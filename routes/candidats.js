import express from 'express';
import candidatManager from '../controllers/candidatManager.js';
import { authenticateToken } from '../middlewares/auth.js';
import pool from '../dbconfig.js';

const router = express.Router();

// Vérifier l'éligibilité avant de soumettre la candidature
router.get('/check-eligibility/:electionId', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const userId = req.user.id;
        const electionId = req.params.electionId;

        // Récupérer les informations de l'étudiant
        const [etudiant] = await connection.execute(`
            SELECT e.*, ec.id AS ecoleId, f.id AS filiereId 
            FROM etudiants e
            LEFT JOIN ecoles ec ON e.ecole = ec.nom
            LEFT JOIN filieres f ON e.filiere = f.nom
            WHERE e.userId = ?
        `, [userId]);

        if (etudiant.length === 0) {
            return res.json({
                success: true,
                eligible: false,
                message: 'Profil étudiant non trouvé'
            });
        }

        const student = etudiant[0];

        // Récupérer les informations de l'élection
        const [election] = await connection.execute(
            `SELECT * FROM elections WHERE id = ?`,
            [electionId]
        );

        if (election.length === 0) {
            return res.json({
                success: true,
                eligible: false,
                message: 'Élection non trouvée'
            });
        }

        const el = election[0];

        // Vérifier l'éligibilité
        let eligible = true;
        let message = '';

        if (el.type === 'ECOLE' && student.ecoleId !== el.ecoleId) {
            eligible = false;
            message = 'Cette élection est réservée aux étudiants d\'une autre école';
        } else if (el.type === 'SALLE') {
            if (student.ecoleId !== el.ecoleId) {
                eligible = false;
                message = 'Cette élection est réservée aux étudiants d\'une autre école';
            } else if (student.filiereId !== el.filiereId) {
                eligible = false;
                message = 'Cette élection est réservée aux étudiants d\'une autre filière';
            } else if (student.annee !== el.annee) {
                eligible = false;
                message = 'Cette élection est réservée aux étudiants d\'une autre année';
            }
        }

        res.json({
            success: true,
            eligible: eligible,
            message: message
        });

    } catch (error) {
        console.error('Erreur vérification éligibilité:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la vérification d\'éligibilité'
        });
    } finally {
        if (connection) await connection.release();
    }
});

// Vérifier si l'utilisateur est déjà candidat à une élection
router.get('/is-candidate/:electionId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const electionId = req.params.electionId;

        const [rows] = await pool.execute(
            `SELECT id FROM candidates WHERE userId = ? AND electionId = ?`,
            [userId, electionId]
        );

        res.json({
            success: true,
            isCandidate: rows.length > 0
        });
    } catch (error) {
        console.error('Erreur vérification candidature:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });
    }
});

// Mes candidatures
router.get('/my-candidature', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const userId = req.user.id;

        const [candidatures] = await connection.execute(`
            SELECT 
                c.*,
                e.titre AS election_titre,
                e.type AS election_type,
                e.dateDebut,
                e.dateFin,
                e.dateDebutCandidature,
                e.dateFinCandidature
            FROM candidates c
            INNER JOIN elections e ON c.electionId = e.id
            WHERE c.userId = ?
            ORDER BY c.createdAt DESC
        `, [userId]);

        res.json({
            success: true,
            candidatures: candidatures
        });

    } catch (error) {
        console.error('Erreur récupération candidatures:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la récupération des candidatures'
        });
    } finally {
        if (connection) await connection.release();
    }
});

// Liste des candidats pour une élection spécifique
router.get('/elections/:electionId', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const electionId = req.params.electionId;

        const [candidates] = await connection.execute(`
            SELECT 
                c.*,
                u.email,
                u.matricule,
                e.nom AS ecole_nom,
                f.nom AS filiere_nom
            FROM candidates c
            LEFT JOIN users u ON c.userId = u.id
            LEFT JOIN etudiants et ON u.id = et.userId
            LEFT JOIN ecoles e ON et.ecoleId = e.id
            LEFT JOIN filieres f ON et.filiereId = f.id
            WHERE c.electionId = ? AND c.statut = 'APPROUVE'
            ORDER BY c.createdAt DESC
        `, [electionId]);

        res.json({
            success: true,
            candidates: candidates
        });

    } catch (error) {
        console.error('Erreur récupération candidats:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la récupération des candidats'
        });
    } finally {
        if (connection) await connection.release();
    }
});

router.post('/', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        const { nom, prenom, slogan, programme, motivation, photoUrl, electionId } = req.body;
        const userId = req.user.id;

        // Vérifier que tous les champs requis sont présents
        if (!nom || !prenom || !slogan || !programme || !motivation || !photoUrl || !electionId) {
            return res.status(400).json({
                success: false,
                message: 'Tous les champs obligatoires doivent être remplis'
            });
        }

        // Vérifier que l'utilisateur n'est pas déjà candidat
        const [existing] = await connection.execute(
            `SELECT id FROM candidates WHERE userId = ? AND electionId = ?`,
            [userId, electionId]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Vous êtes déjà candidat à cette élection'
            });
        }

        // Vérifier que l'élection existe et est ouverte aux candidatures
        const [election] = await connection.execute(
            `SELECT * FROM elections 
             WHERE id = ? 
             AND NOW() BETWEEN dateDebutCandidature AND dateFinCandidature`,
            [electionId]
        );

        if (election.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Cette élection n\'est pas ouverte aux candidatures'
            });
        }

        // Ajouter la candidature
        const [result] = await connection.execute(
            `INSERT INTO candidates 
             (nom, prenom, slogan, programme, motivation, photoUrl, userId, electionId, statut) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'EN_ATTENTE')`,
            [nom, prenom, slogan, programme, motivation, photoUrl, userId, electionId]
        );

        res.json({
            success: true,
            message: 'Candidature soumise avec succès',
            candidatureId: result.insertId
        });

    } catch (error) {
        console.error('Erreur soumission candidature:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la soumission de la candidature'
        });
    } finally {
        if (connection) await connection.release();
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