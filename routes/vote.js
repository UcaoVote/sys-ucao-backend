import express from 'express';
import voteController from '../controllers/voteController.js';
import { authenticateToken, requireRole } from '../middlewares/auth.js';
import { validateVoting } from '../middlewares/electionValidation.js';

const router = express.Router();

// Routes utilisateur authentifié
router.get('/token/:electionId', authenticateToken, voteController.getVoteToken);
router.post('/', authenticateToken, voteController.submitVote);
router.get('/status/:electionId', authenticateToken, voteController.getVoteStatus);
router.post('/validate-token', authenticateToken, voteController.validateToken);

// Routes publiques (résultats)
router.get('/results/:electionId', voteController.getResults);
router.post('/', authenticateToken, validateVoting, voteController.submitVote);
// Routes admin (résultats détaillés)
router.get('/results-detailed/:electionId', requireRole('ADMIN'), voteController.getDetailedResults);

export default router;