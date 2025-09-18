// routes/admin.js
import express from 'express';
import { authenticateToken } from '../middlewares/auth.js';
import adminController from '../controllers/adminController.js';
import { PasswordResetService } from '../services/passwordResetService.js';

const router = express.Router();

router.get('/me', authenticateToken, adminController.getAdminProfile);
router.put('/update', authenticateToken, adminController.updateAdminProfile);

// POST /api/admin/students/:studentId/reset-access
router.post('/students/:studentId/reset-access', authenticateAdmin, async (req, res) => {
    try {
        const adminId = req.user.id;
        const studentId = req.params.studentId;

        const result = await PasswordResetService.resetStudentAccess(adminId, studentId);

        res.json({
            success: true,
            message: 'Accès réinitialisé avec succès',
            data: result
        });

    } catch (error) {
        console.error('Reset access error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});



export default router;