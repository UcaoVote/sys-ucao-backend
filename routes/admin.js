// routes/admin.js
import express from 'express';
import { authenticateToken, requireAdmin } from '../middlewares/auth.js';
import { PasswordResetService } from '../services/passwordResetService.js';

const router = express.Router();


router.get('/me', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const admin = await adminService.getAdminProfile(req.user.id);

        if (!admin) {
            return res.status(404).json({ message: "Admin introuvable" });
        }

        res.json({
            nom: admin.nom,
            prenom: admin.prenom,
            poste: admin.poste,
            email: admin.email,
            role: admin.role
        });
    } catch (err) {
        console.error("Erreur admin/me:", err);
        res.status(500).json({ message: "Erreur serveur" });
    }
});


router.put('/update', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { nom, prenom, email } = req.body;
        const updatedAdmin = await adminService.updateAdminProfile(req.user.id, nom, prenom, email);

        res.json({
            message: "Profil mis à jour avec succès",
            admin: {
                nom: updatedAdmin.nom,
                prenom: updatedAdmin.prenom,
                email: updatedAdmin.email
            }
        });
    } catch (err) {
        console.error("Erreur admin/update:", err);
        res.status(500).json({ message: "Erreur lors de la mise à jour" });
    }
}
);

// POST /api/admin/students/:studentId/reset-access
router.post('/students/:studentId/reset-access', authenticateToken, async (req, res) => {
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