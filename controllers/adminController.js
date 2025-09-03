import adminService from '../services/adminService.js';
import jwt from 'jsonwebtoken';

class AdminController {

    // Connexion administrateur
    async login(req, res) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Email et mot de passe requis'
                });
            }

            // Trouver l'admin par email
            const admin = await adminService.findAdminByEmail(email);

            if (!admin) {
                return res.status(400).json({
                    success: false,
                    message: 'Administrateur non trouvé ou rôle invalide'
                });
            }

            // Vérifier le mot de passe
            const validPassword = await adminService.verifyPassword(password, admin.password);
            if (!validPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Mot de passe incorrect'
                });
            }

            // Génération du token JWT
            const token = jwt.sign(
                {
                    id: admin.id,
                    role: admin.role,
                    requirePasswordChange: admin.requirePasswordChange || false
                },
                process.env.JWT_SECRET,
                { expiresIn: '8h' }
            );

            res.json({
                success: true,
                message: 'Connexion réussie',
                data: {
                    token,
                    admin: {
                        id: admin.id,
                        email: admin.email,
                        nom: admin.nom,
                        prenom: admin.prenom,
                        poste: admin.poste,
                        role: admin.role
                    }
                }
            });
        } catch (error) {
            console.error('Erreur connexion admin:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // Création d'un administrateur
    async register(req, res) {
        try {
            const { email, password, nom, prenom, poste } = req.body;

            if (!email || !password || !nom || !prenom) {
                return res.status(400).json({
                    success: false,
                    message: 'Tous les champs obligatoires sont requis'
                });
            }

            // Vérifier si l'email existe déjà
            const emailExists = await adminService.checkEmailExists(email);
            if (emailExists) {
                return res.status(400).json({
                    success: false,
                    message: 'Email déjà utilisé'
                });
            }

            // Créer l'admin
            const result = await adminService.createAdmin({
                email,
                password,
                nom,
                prenom,
                poste
            });

            res.status(201).json({
                success: true,
                message: 'Administrateur créé avec succès',
                data: {
                    adminId: result.adminId,
                    userId: result.userId
                }
            });
        } catch (error) {
            console.error('Erreur création admin:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
}

export default new AdminController();