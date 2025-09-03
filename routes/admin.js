// routes/admin.js
import express from 'express';
import { authenticateToken } from '../middlewares/auth.js';
import adminController from '../controllers/adminController.js';

const router = express.Router();

router.get('/me', authenticateToken, adminController.getAdminProfile);
router.put('/update', authenticateToken, adminController.updateAdminProfile);

export default router;