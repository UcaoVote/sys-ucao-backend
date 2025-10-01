import express from 'express';
import { authenticateToken } from '../middlewares/auth.js';
import userProfileController from '../controllers/userProfileController.js';

const router = express.Router();


// Routes du profil utilisateur
router.get('/profile', authenticateToken, userProfileController.getProfile);
router.put('/profile', authenticateToken, userProfileController.updateProfile);
router.post('/change-password', authenticateToken, userProfileController.changePassword);

export default router;