import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import pool from '../config/database.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// Configuration de nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const JWT_EXPIRES_NORMAL = '8h';
const JWT_EXPIRES_TEMP = '1h';

// POST /auth/login
router.post('/login', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const identifier = req.body.identifier || req.body.email || null;
        const { password, identifiantTemporaire } = req.body;

        if (identifiantTemporaire) {
            return handleTemporaryLogin(req, res);
        }

        if (!identifier || !password) {
            return res.status(400).json({
                success: false,
                message: 'Identifiant et mot de passe requis'
            });
        }

        let user = null;

        if (identifier.includes('@')) {
            // Recherche par email
            const [userRows] = await connection.execute(
                'SELECT * FROM users WHERE email = ?',
                [identifier]
            );
            user = userRows[0];
        } else {
            // Recherche par identifiant temporaire
            const [studentRows] = await connection.execute(
                `SELECT u.* FROM users u 
                 JOIN etudiants e ON u.id = e.userId 
                 WHERE e.identifiantTemporaire = ?`,
                [identifier]
            );
            user = studentRows[0];
        }

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Identifiants invalides'
            });
        }

        // Vérifier si le compte est actif
        if (!user.actif) {
            return res.status(401).json({
                success: false,
                message: 'Votre compte est désactivé. Contactez l\'administration.'
            });
        }

        // Vérifier mot de passe temporaire
        if (user.tempPassword) {
            const validTempPassword = await bcrypt.compare(password, user.tempPassword);
            if (validTempPassword) {
                // Générer un token temporaire pour forcer le changement de mot de passe
                const tempToken = jwt.sign(
                    {
                        id: user.id,
                        role: user.role,
                        requirePasswordChange: true
                    },
                    JWT_SECRET,
                    { expiresIn: JWT_EXPIRES_TEMP }
                );

                return res.json({
                    success: true,
                    message: 'Connexion temporaire réussie - Changement de mot de passe requis',
                    data: {
                        token: tempToken,
                        requirePasswordChange: true,
                        user: {
                            id: user.id,
                            email: user.email,
                            role: user.role
                        }
                    }
                });
            }
        }

        // Vérifier mot de passe normal
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: 'Identifiants invalides'
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                role: user.role,
                requirePasswordChange: user.requirePasswordChange || false
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_NORMAL }
        );

        // Récupérer les informations de l'étudiant si applicable
        let studentInfo = {};
        if (user.role === 'ETUDIANT') {
            const [studentRows] = await connection.execute(
                'SELECT * FROM etudiants WHERE userId = ?',
                [user.id]
            );
            if (studentRows.length > 0) {
                studentInfo = {
                    nom: studentRows[0].nom,
                    prenom: studentRows[0].prenom,
                    filiere: studentRows[0].filiere,
                    annee: studentRows[0].annee,
                    ecole: studentRows[0].ecole
                };
            }
        }

        res.json({
            success: true,
            message: 'Connexion réussie',
            data: {
                token,
                requirePasswordChange: user.requirePasswordChange || false,
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    ...studentInfo
                }
            }
        });
    } catch (error) {
        console.error('ERREUR LOGIN:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la connexion',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// Gestionnaire de connexion temporaire simplifié
const handleTemporaryLogin = async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { identifiantTemporaire, password } = req.body;

        if (!identifiantTemporaire || !password) {
            return res.status(400).json({
                success: false,
                message: 'Identifiant temporaire et mot de passe requis'
            });
        }

        // Rechercher l'étudiant par identifiant temporaire
        const [studentRows] = await connection.execute(
            `SELECT e.*, u.* FROM etudiants e 
             JOIN users u ON e.userId = u.id 
             WHERE e.identifiantTemporaire = ?`,
            [identifiantTemporaire]
        );

        if (studentRows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Identifiants temporaires invalides'
            });
        }

        const student = studentRows[0];

        // Vérifier le mot de passe temporaire
        if (!student.tempPassword) {
            return res.status(401).json({
                success: false,
                message: 'Aucun mot de passe temporaire défini'
            });
        }

        const validPassword = await bcrypt.compare(password, student.tempPassword);
        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: 'Identifiants temporaires invalides'
            });
        }

        const token = jwt.sign(
            {
                id: student.userId,
                role: student.role,
                requirePasswordChange: true
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_TEMP }
        );

        return res.json({
            success: true,
            message: 'Connexion temporaire réussie - Changement de mot de passe requis',
            data: {
                token,
                requirePasswordChange: true,
                user: {
                    id: student.userId,
                    email: student.email,
                    role: student.role,
                    etudiant: {
                        id: student.id,
                        nom: student.nom,
                        prenom: student.prenom,
                        matricule: student.matricule,
                        filiere: student.filiere,
                        annee: student.annee,
                        identifiantTemporaire: student.identifiantTemporaire
                    }
                }
            }
        });
    } catch (error) {
        console.error('Temporary login error:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la connexion temporaire',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
};

// POST /auth/change-password
router.post('/change-password', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Tous les champs sont requis'
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Les mots de passe ne correspondent pas'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Le mot de passe doit contenir au moins 8 caractères'
            });
        }

        const [userRows] = await connection.execute(
            'SELECT id, password, tempPassword, requirePasswordChange FROM users WHERE id = ?',
            [req.user.id]
        );

        if (userRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur introuvable'
            });
        }

        const user = userRows[0];

        // Si changement de mot de passe requis (après réinitialisation)
        if (user.requirePasswordChange) {
            // Vérifier que le mot de passe temporaire est fourni
            if (!currentPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Mot de passe temporaire requis'
                });
            }

            // Vérifier le mot de passe temporaire
            if (!user.tempPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Aucun mot de passe temporaire défini'
                });
            }

            const validTempPassword = await bcrypt.compare(currentPassword, user.tempPassword);
            if (!validTempPassword) {
                return res.status(401).json({
                    success: false,
                    message: 'Mot de passe temporaire incorrect'
                });
            }
        } else {
            // Changement de mot de passe normal
            if (!currentPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Mot de passe actuel requis'
                });
            }

            const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
            if (!isCurrentPasswordValid) {
                return res.status(401).json({
                    success: false,
                    message: 'Mot de passe actuel incorrect'
                });
            }

            const isSamePassword = await bcrypt.compare(newPassword, user.password);
            if (isSamePassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Le nouveau mot de passe doit être différent de l\'ancien'
                });
            }
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await connection.execute(
            'UPDATE users SET password = ?, tempPassword = NULL, requirePasswordChange = FALSE WHERE id = ?',
            [hashedPassword, req.user.id]
        );

        // Générer un nouveau token sans requirePasswordChange
        const newToken = jwt.sign(
            {
                id: req.user.id,
                role: req.user.role,
                requirePasswordChange: false
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_NORMAL }
        );

        return res.json({
            success: true,
            message: 'Mot de passe changé avec succès',
            data: {
                token: newToken,
                requirePasswordChange: false
            }
        });
    } catch (error) {
        console.error('Erreur changement mot de passe:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur lors du changement de mot de passe',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// POST /auth/forgot-password
router.post('/forgot-password', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email requis'
            });
        }

        const [userRows] = await connection.execute(
            'SELECT u.*, e.nom, e.prenom FROM users u LEFT JOIN etudiants e ON u.id = e.userId WHERE u.email = ?',
            [email]
        );

        // Toujours retourner success=true pour des raisons de sécurité
        if (userRows.length === 0) {
            return res.json({
                success: true,
                message: 'Si cet email existe dans notre système, un lien de réinitialisation a été envoyé'
            });
        }

        const user = userRows[0];

        // Vérifier que c'est un étudiant
        if (user.role !== 'ETUDIANT') {
            return res.json({
                success: true,
                message: 'Si cet email existe dans notre système, un lien de réinitialisation a été envoyé'
            });
        }

        const resetToken = jwt.sign(
            { userId: user.id, type: 'password_reset' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

        const mailOptions = {
            from: process.env.EMAIL_FROM || 'no-reply@ucao-uuc.com',
            to: email,
            subject: 'Réinitialisation de votre mot de passe - UCAO-UUC',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color:#800020;">Réinitialisation de mot de passe</h2>
                    <p>Bonjour ${user.prenom || 'Étudiant'},</p>
                    <p>Pour créer un nouveau mot de passe, cliquez sur le bouton ci-dessous :</p>
                    <div style="text-align:center; margin:30px 0;">
                        <a href="${resetLink}" style="background-color:#800020;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Réinitialiser mon mot de passe</a>
                    </div>
                    <p>Ce lien est valable pendant <strong>1 heure</strong>.</p>
                    <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
                </div>`
        };

        await transporter.sendMail(mailOptions);

        return res.json({
            success: true,
            message: 'Si cet email existe dans notre système, un lien de réinitialisation a été envoyé'
        });
    } catch (error) {
        console.error('Erreur envoi email réinitialisation:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'envoi des instructions de réinitialisation',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

// POST /auth/reset-password
router.post('/reset-password', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { token, newPassword, confirmPassword } = req.body;

        if (!token || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Tous les champs sont requis'
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Les mots de passe ne correspondent pas'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Le mot de passe doit contenir au moins 8 caractères'
            });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            return res.status(401).json({
                success: false,
                message: 'Lien de réinitialisation invalide ou expiré'
            });
        }

        if (decoded.type !== 'password_reset') {
            return res.status(401).json({
                success: false,
                message: 'Token invalide'
            });
        }

        const [userRows] = await connection.execute(
            'SELECT * FROM users WHERE id = ?',
            [decoded.userId]
        );

        if (userRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }

        const user = userRows[0];
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await connection.execute(
            'UPDATE users SET password = ?, tempPassword = NULL, requirePasswordChange = FALSE, passwordResetExpires = NULL WHERE id = ?',
            [hashedPassword, user.id]
        );

        return res.json({
            success: true,
            message: 'Mot de passe réinitialisé avec succès'
        });
    } catch (error) {
        console.error('Erreur réinitialisation mot de passe:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur lors de la réinitialisation du mot de passe',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) await connection.release();
    }
});

export default router;