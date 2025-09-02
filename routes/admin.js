const express = require('express');
const Admin = require('../models/Admin');
const User = require('../models/User');
const { authenticateToken } = require('../middlewares/auth');

const router = express.Router();

/**
 * GET /admin/me
 * Récupère les informations de l'admin connecté
 */
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const admin = await Admin.findWithUser(req.user.id);

        if (!admin) {
            return res.status(404).json({ message: "Admin introuvable" });
        }

        res.json({
            nom: admin.nom,
            prenom: admin.prenom,
            poste: admin.poste,
            email: admin.email,
            role: admin.role,
            photoUrl: admin.photoUrl || null
        });
    } catch (err) {
        console.error("Erreur admin/me:", err);
        res.status(500).json({ message: "Erreur serveur" });
    }
});

/**
 * PUT /admin/update
 * Met à jour le profil admin
 */
router.put('/update', authenticateToken, async (req, res) => {
    try {
        const { nom, prenom, email } = req.body;

        // Mettre à jour l'admin
        await Admin.update(req.user.id, { nom, prenom });

        // Mettre à jour l'email de l'user si fourni
        if (email) {
            await User.update(req.user.id, { email });
        }

        // Récupérer les données mises à jour
        const updatedAdmin = await Admin.findWithUser(req.user.id);

        res.json({
            message: "Profil mis à jour avec succès",
            admin: {
                nom: updatedAdmin.nom,
                prenom: updatedAdmin.prenom,
                email: updatedAdmin.email,
                photoUrl: updatedAdmin.photoUrl
            }
        });
    } catch (err) {
        console.error("Erreur admin/update:", err);
        res.status(500).json({ message: "Erreur lors de la mise à jour" });
    }
});

module.exports = router;