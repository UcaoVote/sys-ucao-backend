import express from 'express';
import pool from '../dbconfig.js';
import voteController from '../controllers/voteController.js';
import { authenticateToken, requireRole } from '../middlewares/auth.js';
import { validateVoting } from '../middlewares/electionValidation.js';

const router = express.Router();

// Routes utilisateur authentifié
router.get('/token/:electionId', authenticateToken, voteController.getVoteToken);
router.post('/', authenticateToken, validateVoting, voteController.submitVote);
router.get('/status/:electionId', authenticateToken, voteController.getVoteStatus);
router.post('/validate-token', authenticateToken, voteController.validateToken);

// Routes publiques 
router.get('/results/:electionId', authenticateToken, voteController.getResults);
// Routes admin (résultats détaillés)
router.get('/results-detailed/:electionId', authenticateToken, requireRole('ADMIN'), voteController.getDetailedResults);
// GET /api/votes/my-votes - Récupérer tous les votes de l'utilisateur
router.get('/my-votes', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        const userId = req.user.id;

        // Récupérer tous les votes de l'utilisateur avec les détails
        const [votes] = await connection.execute(`
            SELECT 
                v.*,
                e.titre AS election_titre,
                e.type AS election_type,
                e.dateDebut,
                e.dateFin,
                c.prenom AS candidat_prenom,
                c.nom AS candidat_nom,
                c.programme AS candidat_programme
            FROM votes v
            INNER JOIN elections e ON v.electionId = e.id
            INNER JOIN candidates c ON v.candidateId = c.id
            WHERE v.userId = ?
            ORDER BY v.createdAt DESC
        `, [userId]);

        res.json({
            success: true,
            data: votes,
            count: votes.length
        });

    } catch (error) {
        console.error('Erreur récupération votes:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });
    } finally {
        if (connection) await connection.release();
    }
});
// GET /api/votes/my-votes/election/:electionId - Vérifier si l'utilisateur a voté à une élection spécifique
router.get('/my-votes/election/:electionId', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        const userId = req.user.id;
        const electionId = req.params.electionId;

        // Vérifier si l'utilisateur a déjà voté pour cette élection
        const [votes] = await connection.execute(`
            SELECT 
                v.*,
                c.prenom AS candidat_prenom,
                c.nom AS candidat_nom
            FROM votes v
            INNER JOIN candidates c ON v.candidateId = c.id
            WHERE v.userId = ? AND v.electionId = ?
        `, [userId, electionId]);

        res.json({
            success: true,
            hasVoted: votes.length > 0,
            vote: votes.length > 0 ? votes[0] : null
        });

    } catch (error) {
        console.error('Erreur vérification vote:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });
    } finally {
        if (connection) await connection.release();
    }
});
// GET /api/votes/my-votes/stats - Statistiques des votes de l'utilisateur
router.get('/my-votes/stats', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        const userId = req.user.id;

        // Statistiques des votes
        const [stats] = await connection.execute(`
            SELECT 
                COUNT(*) as total_votes,
                COUNT(DISTINCT electionId) as elections_participated,
                SUM(poidsVote) as total_poids
            FROM votes 
            WHERE userId = ?
        `, [userId]);

        res.json({
            success: true,
            data: stats[0]
        });

    } catch (error) {
        console.error('Erreur stats votes:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });
    } finally {
        if (connection) await connection.release();
    }
});

// Routes pour la publication des résultats
router.post('/publish/:electionId', authenticateToken, requireRole('ADMIN'), voteController.publishResults);
router.post('/unpublish/:electionId', authenticateToken, requireRole('ADMIN'), voteController.unpublishResults);
router.get('/elections/completed', authenticateToken, voteController.getCompletedElections);
router.get('/elections/:electionId/stats', authenticateToken, requireRole('ADMIN'), voteController.getElectionStats);
router.get('/:electionId/visibility', authenticateToken, voteController.getResultsVisibility);


export default router;