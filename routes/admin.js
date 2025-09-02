import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

/**
 * GET /admin/me
 * Récupère les informations de l'admin connecté
 */
router.get('/me', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        const [adminRows] = await connection.execute(
            `SELECT a.*, u.email, u.role 
             FROM admins a 
             INNER JOIN users u ON a.userId = u.id 
             WHERE a.userId = ?`,
            [req.user.id]
        );

        if (adminRows.length === 0) {
            return res.status(404).json({ message: "Admin introuvable" });
        }

        const admin = adminRows[0];

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
    } finally {
        if (connection) connection.release();
    }
});

/**
 * PUT /admin/update
 * Met à jour le profil admin
 */
router.put('/update', authenticateToken, async (req, res) => {
    let connection;
    try {
        const { nom, prenom, email } = req.body;
        connection = await pool.getConnection();

        // Commencer une transaction
        await connection.beginTransaction();

        // Mettre à jour l'admin
        await connection.execute(
            `UPDATE admins SET nom = ?, prenom = ?, email = ? WHERE userId = ?`,
            [nom, prenom, email, req.user.id]
        );

        // Mettre à jour l'email de l'utilisateur
        await connection.execute(
            `UPDATE users SET email = ? WHERE id = ?`,
            [email, req.user.id]
        );

        // Récupérer les données mises à jour
        const [updatedRows] = await connection.execute(
            `SELECT a.*, u.email 
             FROM admins a 
             INNER JOIN users u ON a.userId = u.id 
             WHERE a.userId = ?`,
            [req.user.id]
        );

        await connection.commit();

        const updatedAdmin = updatedRows[0];

        res.json({
            message: "Profil mis à jour avec succès",
            admin: {
                nom: updatedAdmin.nom,
                prenom: updatedAdmin.prenom,
                email: updatedAdmin.email
            }
        });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Erreur admin/update:", err);
        res.status(500).json({ message: "Erreur lors de la mise à jour" });
    } finally {
        if (connection) connection.release();
    }
});

export default router;