// routes/uploadLocal.js
// NOUVEAU système d'upload LOCAL - Route de test
import express from 'express';
import { authenticateToken } from '../middlewares/auth.js';
import uploadLocal, { getPublicUrl, deleteOldFile } from '../middlewares/uploadLocal.js';
import multer from 'multer';

const router = express.Router();

// Middleware pour gérer les erreurs de Multer
const handleUploadError = (error, req, res, next) => {
    console.error('❌ Multer error:', error);

    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'Fichier trop volumineux (max 10MB)'
            });
        }
        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                success: false,
                message: 'Trop de fichiers envoyés'
            });
        }
    }

    if (error.message.includes('Type de fichier non supporté')) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }

    return res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'upload du fichier'
    });
};

// Middleware de débogage
const debugUpload = (req, res, next) => {
    console.log('\n=== 📤 UPLOAD LOCAL DEBUG ===');
    console.log('Path:', req.path);
    console.log('Method:', req.method);
    console.log('User:', req.user?.userId || req.user?.id);
    console.log('Content-Type:', req.headers['content-type']);
    next();
};

// ==========================================
// ROUTES DE TEST - Photos de profil
// ==========================================

/**
 * POST /api/upload-local/image
 * Upload d'une photo de profil (étudiant/admin)
 */
router.post('/image',
    authenticateToken,
    debugUpload,
    uploadLocal.single('image'),
    handleUploadError,
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Aucun fichier reçu'
                });
            }

            console.log('✅ Fichier reçu:', req.file);

            // Générer l'URL publique
            const publicUrl = getPublicUrl(req.file.filename, 'photos');

            res.json({
                success: true,
                message: 'Image uploadée avec succès',
                data: {
                    url: publicUrl,
                    filename: req.file.filename,
                    size: req.file.size,
                    mimetype: req.file.mimetype,
                    path: req.file.path
                }
            });

        } catch (error) {
            console.error('❌ Erreur upload image:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'upload',
                error: error.message
            });
        }
    }
);

// ==========================================
// ROUTES DE TEST - Photos de candidats
// ==========================================

/**
 * POST /api/upload-local/candidats/image
 * Upload d'une photo de candidat
 */
router.post('/candidats/image',
    authenticateToken,
    debugUpload,
    uploadLocal.single('image'),
    handleUploadError,
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Aucun fichier reçu'
                });
            }

            console.log('✅ Photo candidat reçue:', req.file);

            const publicUrl = getPublicUrl(req.file.filename, 'candidats');

            res.json({
                success: true,
                message: 'Photo de candidat uploadée avec succès',
                data: {
                    url: publicUrl,
                    filename: req.file.filename,
                    size: req.file.size,
                    mimetype: req.file.mimetype
                }
            });

        } catch (error) {
            console.error('❌ Erreur upload photo candidat:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'upload',
                error: error.message
            });
        }
    }
);

// ==========================================
// ROUTES DE TEST - Documents
// ==========================================

/**
 * POST /api/upload-local/documents
 * Upload d'un document (PDF, Word, Excel)
 */
router.post('/documents',
    authenticateToken,
    debugUpload,
    uploadLocal.single('document'),
    handleUploadError,
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Aucun fichier reçu'
                });
            }

            console.log('✅ Document reçu:', req.file);

            const publicUrl = getPublicUrl(req.file.filename, 'documents');

            res.json({
                success: true,
                message: 'Document uploadé avec succès',
                data: {
                    url: publicUrl,
                    filename: req.file.filename,
                    size: req.file.size,
                    mimetype: req.file.mimetype
                }
            });

        } catch (error) {
            console.error('❌ Erreur upload document:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'upload',
                error: error.message
            });
        }
    }
);

// ==========================================
// ROUTES DE TEST - Images d'élections
// ==========================================

/**
 * POST /api/upload-local/elections/image
 * Upload d'une image/bannière d'élection
 */
router.post('/elections/image',
    authenticateToken,
    debugUpload,
    uploadLocal.single('image'),
    handleUploadError,
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Aucun fichier reçu'
                });
            }

            console.log('✅ Image élection reçue:', req.file);

            const publicUrl = getPublicUrl(req.file.filename, 'elections');

            res.json({
                success: true,
                message: 'Image d\'élection uploadée avec succès',
                data: {
                    url: publicUrl,
                    filename: req.file.filename,
                    size: req.file.size,
                    mimetype: req.file.mimetype
                }
            });

        } catch (error) {
            console.error('❌ Erreur upload image élection:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'upload',
                error: error.message
            });
        }
    }
);

// ==========================================
// ROUTE DE TEST - Info système
// ==========================================

/**
 * GET /api/upload-local/info
 * Informations sur le système d'upload
 */
router.get('/info',
    authenticateToken,
    (req, res) => {
        res.json({
            success: true,
            message: 'Système d\'upload local actif',
            info: {
                maxFileSize: '10 MB',
                allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
                allowedDocTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
                uploadFolders: ['photos', 'candidats', 'elections', 'documents'],
                baseUrl: process.env.FRONTEND_URL || 'https://oeuvreuniversitaire.ucaobenin.org'
            }
        });
    }
);

export default router;
