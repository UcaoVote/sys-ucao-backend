import userProfileService from '../services/userProfileService.js';

class UserProfileController {

    // Récupérer le profil étudiant
    async getProfile(req, res) {
        try {
            const profile = await userProfileService.getStudentProfile(req.user.id);

            res.json({
                success: true,
                data: profile
            });
        } catch (error) {
            console.error('Erreur récupération profil:', error);

            if (error.message === 'Accès réservé aux étudiants') {
                return res.status(403).json({
                    success: false,
                    message: error.message
                });
            }

            if (error.message === 'Profil étudiant non trouvé') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Erreur serveur lors de la récupération du profil',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // Mettre à jour le profil étudiant
    async updateProfile(req, res) {
        try {
            const updatedProfile = await userProfileService.updateStudentProfile(req.user.id, req.body);

            res.json({
                success: true,
                message: 'Profil mis à jour avec succès',
                data: updatedProfile
            });
        } catch (error) {
            console.error('Erreur mise à jour profil:', error);

            if (error.message === 'Accès réservé aux étudiants') {
                return res.status(403).json({
                    success: false,
                    message: error.message
                });
            }

            if (error.message === 'Email déjà utilisé') {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Erreur serveur lors de la mise à jour du profil',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // Changer l'avatar
    async uploadAvatar(req, res) {
        try {
            console.log('=== UPLOAD AVATAR START ===');
            console.log('User:', req.user);
            console.log('File received:', req.file ? {
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                bufferLength: req.file.buffer?.length
            } : 'No file');

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Aucun fichier téléchargé'
                });
            }

            // Utiliser le buffer directement au lieu de file.path
            const photoUrl = await userProfileService.uploadAvatar(
                req.file.buffer,
                req.file.originalname,
                req.file.mimetype,
                req.user.id
            );

            res.json({
                success: true,
                data: {
                    photoUrl: photoUrl
                },
                message: 'Photo mise à jour avec succès'
            });

        } catch (error) {
            console.error('Erreur upload photo:', error);

            let errorMessage = 'Erreur lors de l\'upload de l\'avatar';
            let statusCode = 500;

            if (error.message.includes('Type de fichier non supporté')) {
                errorMessage = 'Type de fichier non supporté';
                statusCode = 400;
            } else if (error.message.includes('File too large')) {
                errorMessage = 'Fichier trop volumineux (max 2MB)';
                statusCode = 400;
            } else if (error.message.includes('ImgBB')) {
                errorMessage = 'Erreur du service d\'upload d\'images';
            }

            res.status(statusCode).json({
                success: false,
                message: errorMessage,
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // Changer le mot de passe
    async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;

            if (!currentPassword || !newPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Tous les champs sont requis'
                });
            }

            if (newPassword.length < 8) {
                return res.status(400).json({
                    success: false,
                    message: 'Le mot de passe doit contenir au moins 8 caractères'
                });
            }

            await userProfileService.changePassword(req.user.id, currentPassword, newPassword);

            res.json({
                success: true,
                message: 'Mot de passe changé avec succès'
            });
        } catch (error) {
            console.error('Erreur changement mot de passe:', error);

            if (error.message === 'Utilisateur non trouvé') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }

            if (error.message === 'Mot de passe actuel incorrect') {
                return res.status(401).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Erreur serveur lors du changement de mot de passe',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
}

export default new UserProfileController();