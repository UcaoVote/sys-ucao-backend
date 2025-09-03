// routes/stats.js
import express from 'express';
import { authenticateToken, requireRole } from '../middlewares/auth.js';
import { statsController } from '../controllers/statsController.js';

const router = express.Router();

router.get('/general', authenticateToken, statsController.getGeneralStats);
router.get('/votes', authenticateToken, statsController.getVotesStats);
router.get('/distribution', authenticateToken, statsController.getDistributionStats);
router.get('/hourly', authenticateToken, statsController.getHourlyStats);
router.get('/comparison', authenticateToken, requireRole('ADMIN'), statsController.getComparisonStats);
router.get('/participation', authenticateToken, requireRole('ADMIN'), statsController.getParticipationStats);

export default router;