import express from 'express';
import electionController from '../controllers/electionController.js';
import { authenticateToken, requireRole } from '../middlewares/auth.js';

const router = express.Router();

// Routes publiques
router.get('/active', electionController.getActiveElection);
router.get('/', electionController.getElections);
router.get('/:id', electionController.getElection);
router.get('/stats/by-type/:type', electionController.getStatsByType);

// Routes étudiant
router.get('/vote/my-elections', authenticateToken, electionController.getMyElections);

// Routes admin
router.post('/', authenticateToken, requireRole('ADMIN'), electionController.createElection);
router.put('/:id/close', authenticateToken, requireRole('ADMIN'), electionController.closeElection);
router.delete('/:id', authenticateToken, requireRole('ADMIN'), electionController.deleteElection);

export default router;