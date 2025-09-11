// routes/notifications.js
import express from 'express';
import notificationsController from '../controllers/notificationsManager.js';
import { authenticateToken, requireRole } from '../middlewares/auth.js';


const router = express.Router();

// Étudiant : consulter ses notifications
router.get(
    '/',
    authenticateToken,
    requireRole('ETUDIANT'),
    notificationsController.getUserNotifications
);

// Étudiant : marquer une notification comme lue
router.patch(
    '/:id/read',
    authenticateToken,
    requireRole('ETUDIANT'),
    notificationsController.markAsRead
);

// Admin : créer une notification manuelle
router.post(
    '/',
    authenticateToken,
    requireRole('ADMIN'),
    notificationsController.createNotification
);

router.get('/admin',
    authenticateToken,
    requireRole('ADMIN'),
    notificationsController.getAdminNotifications);

export default router;
