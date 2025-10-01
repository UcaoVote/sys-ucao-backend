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
    (req, res, next) => {
        // Si le paramètre unreadOnly=true est présent, rediriger vers la logique des notifications non lues
        if (req.query.unreadOnly === 'true') {
            return notificationsController.getUnreadNotifications(req, res, next);
        }
        return notificationsController.getUserNotifications(req, res, next);
    }
);

// Récupérer uniquement les notifications non lues
router.get(
    '/unread/count',
    authenticateToken,
    requireRole('ETUDIANT'),
    notificationsController.getUnreadCount
);

// Étudiant : marquer une notification comme lue
router.put(
    '/read/:id',
    authenticateToken,
    requireRole('ETUDIANT'),
    notificationsController.markAsRead
);

// Marquer toutes les notifications comme lues
router.put(
    '/read-all',
    authenticateToken,
    requireRole('ETUDIANT'),
    notificationsController.markAllAsRead
);

// Effacer toutes les notifications
router.delete(
    '/clear-all',
    authenticateToken,
    requireRole('ETUDIANT'),
    notificationsController.clearAll
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