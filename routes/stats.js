import express from 'express'

const router = express.Router();
import statsController from '../controllers/statsManager.js'
import { authenticateToken, requireAdmin } from '../middlewares/auth.js'

// Routes pour les statistiques - toutes nécessitent une authentification admin
router.get('/general', authenticateToken, requireAdmin, statsController.getGeneralStats);
router.get('/votes', authenticateToken, requireAdmin, statsController.getVotesEvolution);
router.get('/distribution', authenticateToken, requireAdmin, statsController.getVotesDistribution);
router.get('/hourly', authenticateToken, requireAdmin, statsController.getHourlyParticipation);
router.get('/comparison', authenticateToken, requireAdmin, statsController.getElectionsComparison);
router.get('/export', authenticateToken, requireAdmin, statsController.exportStats);

export default router;