// routes/activity.js
import { authenticateToken } from '../middlewares/auth.js';
import express from 'express';
import activityManager from '../controllers/activityManager.js';


const router = express.Router();

router.get('/', authenticateToken, activityManager.getActivityLogs);
router.post('/', activityManager.createActivityLog);
router.get('/stats', authenticateToken, activityManager.getActivityStats);
router.get('/recent', authenticateToken, activityManager.getRecentActivitiesByStudent);

export default router;