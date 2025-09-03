// routes/activity.js
import express from 'express';
import { authenticateToken } from '../middlewares/auth.js';
import { activityController } from '../controllers/activityController.js';

const router = express.Router();

router.get('/', authenticateToken, activityController.getActivities);

export default router;