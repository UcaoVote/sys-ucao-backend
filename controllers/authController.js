import authService from '../services/authService.js';
import userService from '../services/userService.js';
import pool from '../dbconfig.js'; // Import ajouté

class AuthController {
    constructor() {
        // Lier toutes les méthodes au contexte de la classe
        this.login = this.login.bind(this);
        this.handleTemporaryLogin = this.handleTemporaryLogin.bind(this);
        this.changePassword = this.changePassword.bind(this);
        this.forgotPassword = this.forgotPassword.bind(this);
        this.resetPassword = this.resetPassword.bind(this);
    }

    async login(req, res) {
        try {
            const identifier = req.body.identifier || req.body.email || null;
            const { password, identifiantTemporaire } = req.body;

            if (identifiantTemporaire) {
                return this.handleTemporaryLogin(req, res);
            }

            if (!identifier || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Identifiant et mot de passe requis'
                });
            }

            const user = await authService.findUser(identifier);

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Identifiants invalides'
                });
            }

            // NOUVELLE LOGIQUE : Si l'utilisateur existe mais n'a pas de password
            if (user.id && !user.password) {
                const hashedPassword = await authService.hashPassword(password);

                let connection;
                try {
                    connection = await pool.getConnection();
                    await connection.execute(
                        'UPDATE users SET password = ?, requirePasswordChange = FALSE WHERE id = ?',
                        [hashedPassword, user.id]
                    );

                    const updatedUser = await authService.findUser(identifier);
                    if (!updatedUser) {
                        throw new Error('Erreur lors de la mise à jour du mot de passe');
                    }
                    Object.assign(user, updatedUser);
                } finally {
                    if (connection) await connection.release();
                }
            }

            // Ancienne logique (pour les étudiants sans user)
            if (user.student && !user.id) {
                const emailToUse = user.student.email || `${user.student.matricule || user.student.codeInscription || user.student.identifiantTemporaire}@no-email.local`;
                const newUserId = await userService.createUser({
                    email: emailToUse,
                    password
                });
                await userService.updateStudent({
                    ...user.student,
                    tempId: user.student.identifiantTemporaire
                }, user.student.id, newUserId);
                const createdUser = await authService.findUser(emailToUse);
                if (!createdUser) {
                    return res.status(500).json({ success: false, message: 'Impossible de créer le compte utilisateur' });
                }
                Object.assign(user, createdUser);
            }

            if (!user.actif) {
                return res.status(401).json({
                    success: false,
                    message: 'Votre compte est désactivé. Contactez l\'administration.'
                });
            }

            // CORRECTION ICI : S'assurer que requirePasswordChange est un boolean
            const requirePasswordChange = Boolean(user.requirePasswordChange || user.tempPassword);
            console.log('🔐 DEBUG requirePasswordChange:', {
                userRequirePasswordChange: user.requirePasswordChange,
                userTempPassword: user.tempPassword,
                finalValue: requirePasswordChange
            });

            if (user.tempPassword) {
                const validTempPassword = await authService.verifyPassword(password, user.tempPassword);
                if (validTempPassword) {
                    const tempToken = authService.generateToken(
                        {
                            id: user.id,
                            role: user.role,
                            requirePasswordChange: true
                        },
                        '1h'
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
            const validPassword = await authService.verifyPassword(password, user.password);
            if (!validPassword) {
                return res.status(401).json({
                    success: false,
                    message: 'Identifiants invalides'
                });
            }

            // Si requirePasswordChange est TRUE, générer un token spécial
            let token;
            if (requirePasswordChange) {
                token = authService.generateToken(
                    {
                        id: user.id,
                        role: user.role,
                        requirePasswordChange: true
                    },
                    '1h'
                );
            } else {
                token = authService.generateToken({
                    id: user.id,
                    role: user.role,
                    requirePasswordChange: false
                });
            }

            let studentInfo = {};
            if (user.role === 'ETUDIANT') {
                studentInfo = await authService.getStudentInfo(user.id);
            }

            res.json({
                success: true,
                message: requirePasswordChange
                    ? 'Connexion réussie - Changement de mot de passe requis'
                    : 'Connexion réussie',
                data: {
                    token,
                    requirePasswordChange: requirePasswordChange, // Boolean garanti
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
        }
    }

    async handleTemporaryLogin(req, res) {
        try {
            const { identifiantTemporaire, password } = req.body;

            if (!identifiantTemporaire || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Identifiant temporaire et mot de passe requis'
                });
            }

            const student = await authService.findStudentByTempId(identifiantTemporaire);

            if (!student) {
                return res.status(401).json({
                    success: false,
                    message: 'Identifiants temporaires invalides'
                });
            }

            if (!student.tempPassword) {
                return res.status(401).json({
                    success: false,
                    message: 'Aucun mot de passe temporaire défini'
                });
            }

            const validPassword = await authService.verifyPassword(password, student.tempPassword);
            if (!validPassword) {
                return res.status(401).json({
                    success: false,
                    message: 'Identifiants temporaires invalides'
                });
            }

            const token = authService.generateToken(
                {
                    id: student.userId,
                    role: student.role,
                    requirePasswordChange: true
                },
                '1h'
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
        }
    }

    async changePassword(req, res) {
        try {
            const { currentPassword, newPassword, confirmPassword } = req.body;
            const userId = req.user.id;

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

            // Récupérer l'utilisateur
            let connection;
            try {
                connection = await pool.getConnection();
                const [userRows] = await connection.execute(
                    'SELECT id, password, tempPassword, requirePasswordChange FROM users WHERE id = ?',
                    [userId]
                );

                if (userRows.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'Utilisateur introuvable'
                    });
                }

                const user = userRows[0];

                // Si changement de mot de passe requis
                if (user.requirePasswordChange) {
                    if (!user.tempPassword) {
                        return res.status(400).json({
                            success: false,
                            message: 'Aucun mot de passe temporaire défini'
                        });
                    }

                    const validTempPassword = await authService.verifyPassword(currentPassword, user.tempPassword);
                    if (!validTempPassword) {
                        return res.status(401).json({
                            success: false,
                            message: 'Mot de passe temporaire incorrect'
                        });
                    }
                } else {
                    const isCurrentPasswordValid = await authService.verifyPassword(currentPassword, user.password);
                    if (!isCurrentPasswordValid) {
                        return res.status(401).json({
                            success: false,
                            message: 'Mot de passe actuel incorrect'
                        });
                    }

                    const isSamePassword = await authService.verifyPassword(newPassword, user.password);
                    if (isSamePassword) {
                        return res.status(400).json({
                            success: false,
                            message: 'Le nouveau mot de passe doit être différent de l\'ancien'
                        });
                    }
                }

                await authService.updatePassword(userId, newPassword);

                const newToken = authService.generateToken({
                    id: userId,
                    role: req.user.role,
                    requirePasswordChange: false
                });

                return res.json({
                    success: true,
                    message: 'Mot de passe changé avec succès',
                    data: {
                        token: newToken,
                        requirePasswordChange: false
                    }
                });
            } finally {
                if (connection) await connection.release();
            }
        } catch (error) {
            console.error('Erreur changement mot de passe:', error);
            return res.status(500).json({
                success: false,
                message: 'Erreur lors du changement de mot de passe',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    async forgotPassword(req, res) {
        try {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({
                    success: false,
                    message: 'Email requis'
                });
            }

            // Rechercher l'utilisateur
            let connection;
            try {
                connection = await pool.getConnection();
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

                const resetToken = authService.generateToken(
                    { userId: user.id, type: 'password_reset' },
                    '1h'
                );

                await authService.sendPasswordResetEmail(email, resetToken);

                return res.json({
                    success: true,
                    message: 'Si cet email existe dans notre système, un lien de réinitialisation a été envoyé'
                });
            } finally {
                if (connection) await connection.release();
            }
        } catch (error) {
            console.error('Erreur envoi email réinitialisation:', error);
            return res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'envoi des instructions de réinitialisation',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    async resetPassword(req, res) {
        try {
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
                decoded = authService.verifyToken(token);
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

            await authService.updatePassword(decoded.userId, newPassword);

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
        }
    }
}

export default new AuthController();