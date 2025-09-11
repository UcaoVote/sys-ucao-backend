import express from 'express'

const router = express.Router();
import statsController from '../controllers/statsManager.js'

// Routes pour les statistiques
router.get('/general', statsController.getGeneralStats);
router.get('/votes', statsController.getVotesEvolution);
router.get('/distribution', statsController.getVotesDistribution);
router.get('/hourly', statsController.getHourlyParticipation);
router.get('/comparison', statsController.getElectionsComparison);
router.get('/export', statsController.exportStats);

export default router;