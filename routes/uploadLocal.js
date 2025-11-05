// routes/uploadLocal.js
// NOUVEAU système d'upload LOCAL - Route de test
import express from 'express';
import { authenticateToken } from '../middlewares/auth.js';
import uploadLocal, { getPublicUrl, deleteOldFile } from '../middlewares/uploadLocal.js';
import multer from 'multer';
import pool from '../database/dbconfig.js';

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
 * Envoie le fichier vers le serveur LWS pour stockage permanent
 */
router.post('/image',
    authenticateToken,
    debugUpload,
    (req, res, next) => {
        uploadLocal.single('image')(req, res, (err) => {
            if (err) {
                return handleUploadError(err, req, res, next);
            }
            next();
        });
    },
    async (req, res, next) => {
        const FormData = (await import('form-data')).default;
        const fs = (await import('fs')).default;
        const axios = (await import('axios')).default;

        try {
            console.log('🔍 Route handler - req.file:', req.file ? 'EXISTS' : 'NULL');

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Aucun fichier reçu'
                });
            }

            console.log('✅ Fichier reçu localement:', {
                filename: req.file.filename,
                size: req.file.size,
                mimetype: req.file.mimetype,
                path: req.file.path
            });

            // Envoyer le fichier vers le serveur LWS
            console.log('📤 Envoi du fichier vers serveur LWS...');

            const formData = new FormData();
            formData.append('file', fs.createReadStream(req.file.path));
            formData.append('type', 'photos');
            formData.append('filename', req.file.filename);

            const lwsResponse = await axios.post(
                'https://oeuvreuniversitaire.ucaobenin.org/api/upload-handler.php',
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                        'Authorization': `Bearer ${process.env.MYSQL_PROXY_SECRET}`
                    },
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity
                }
            );

            console.log('✅ Fichier uploadé sur LWS:', lwsResponse.data);

            // Supprimer le fichier temporaire de Render
            fs.unlinkSync(req.file.path);
            console.log('🗑️ Fichier temporaire supprimé de Render');

            // Mettre à jour la base de données
            const photoUrl = lwsResponse.data.data.url;
            const userId = req.user.id || req.user.userId;

            try {
                // Vérifier si c'est un étudiant ou un admin
                const [students] = await pool.execute(
                    'SELECT userId FROM etudiants WHERE userId = ?',
                    [userId]
                );

                if (students.length > 0) {
                    // Mettre à jour la photo de l'étudiant
                    await pool.execute(
                        'UPDATE etudiants SET photoUrl = ? WHERE userId = ?',
                        [photoUrl, userId]
                    );
                    console.log('✅ Photo étudiant mise à jour dans la BDD');
                } else {
                    // Vérifier si c'est un admin
                    const [admins] = await pool.execute(
                        'SELECT adminId FROM admins WHERE adminId = ?',
                        [userId]
                    );

                    if (admins.length > 0) {
                        await pool.execute(
                            'UPDATE admins SET photoUrl = ? WHERE adminId = ?',
                            [photoUrl, userId]
                        );
                        console.log('✅ Photo admin mise à jour dans la BDD');
                    }
                }
            } catch (dbError) {
                console.error('⚠️ Erreur mise à jour BDD (photo uploadée mais non enregistrée):', dbError.message);
                // On ne bloque pas la réponse, le fichier est déjà uploadé
            }

            return res.status(200).json(lwsResponse.data);

        } catch (error) {
            console.error('❌ Erreur upload vers LWS:', error.message);
            if (error.response) {
                console.error('❌ Réponse LWS:', error.response.data);
            }

            // Nettoyer le fichier temporaire en cas d'erreur
            try {
                if (req.file?.path) {
                    const fs = (await import('fs')).default;
                    fs.unlinkSync(req.file.path);
                }
            } catch (cleanupError) {
                console.error('⚠️ Erreur nettoyage:', cleanupError.message);
            }

            return res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'upload vers le serveur',
                error: error.message
            });
        }
    }
);// ==========================================
// ROUTES - Photos de candidats
// ==========================================

/**
 * POST /api/upload-local/candidats/image
 * Upload d'une photo de candidat vers serveur LWS
 */
router.post('/candidats/image',
    authenticateToken,
    debugUpload,
    (req, res, next) => {
        uploadLocal.single('image')(req, res, (err) => {
            if (err) {
                return handleUploadError(err, req, res, next);
            }
            next();
        });
    },
    async (req, res) => {
        const FormData = (await import('form-data')).default;
        const fs = (await import('fs')).default;
        const axios = (await import('axios')).default;

        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Aucun fichier reçu'
                });
            }

            console.log('✅ Photo candidat reçue:', req.file.filename);

            const formData = new FormData();
            formData.append('file', fs.createReadStream(req.file.path));
            formData.append('type', 'candidats');
            formData.append('filename', req.file.filename);

            const lwsResponse = await axios.post(
                'https://oeuvreuniversitaire.ucaobenin.org/api/upload-handler.php',
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                        'Authorization': `Bearer ${process.env.MYSQL_PROXY_SECRET}`
                    },
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity
                }
            );

            fs.unlinkSync(req.file.path);
            console.log('✅ Photo candidat uploadée sur LWS');

            // Mettre à jour la base de données
            const photoUrl = lwsResponse.data.data.url;
            const userId = req.user.id || req.user.userId;

            try {
                await pool.execute(
                    'UPDATE candidates SET photoUrl = ? WHERE userId = ?',
                    [photoUrl, userId]
                );
                console.log('✅ Photo candidat mise à jour dans la BDD');
            } catch (dbError) {
                console.error('⚠️ Erreur mise à jour BDD candidat:', dbError.message);
            }

            return res.status(200).json(lwsResponse.data);

        } catch (error) {
            console.error('❌ Erreur upload candidat:', error.message);
            try {
                if (req.file?.path) fs.unlinkSync(req.file.path);
            } catch (e) { }
            return res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'upload',
                error: error.message
            });
        }
    }
);

// ==========================================
// ROUTES - Documents
// ==========================================

/**
 * POST /api/upload-local/documents
 * Upload d'un document (PDF, Word, Excel) vers serveur LWS
 */
router.post('/documents',
    authenticateToken,
    debugUpload,
    (req, res, next) => {
        uploadLocal.single('document')(req, res, (err) => {
            if (err) {
                return handleUploadError(err, req, res, next);
            }
            next();
        });
    },
    async (req, res) => {
        const FormData = (await import('form-data')).default;
        const fs = (await import('fs')).default;
        const axios = (await import('axios')).default;

        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Aucun fichier reçu'
                });
            }

            console.log('✅ Document reçu:', req.file.filename);

            const formData = new FormData();
            formData.append('file', fs.createReadStream(req.file.path));
            formData.append('type', 'documents');
            formData.append('filename', req.file.filename);

            const lwsResponse = await axios.post(
                'https://oeuvreuniversitaire.ucaobenin.org/api/upload-handler.php',
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                        'Authorization': `Bearer ${process.env.MYSQL_PROXY_SECRET}`
                    },
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity
                }
            );

            fs.unlinkSync(req.file.path);
            console.log('✅ Document uploadé sur LWS');

            return res.status(200).json(lwsResponse.data);

        } catch (error) {
            console.error('❌ Erreur upload document:', error.message);
            try {
                if (req.file?.path) fs.unlinkSync(req.file.path);
            } catch (e) { }
            return res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'upload',
                error: error.message
            });
        }
    }
);

// ==========================================
// ROUTES - Images d'élections
// ==========================================

/**
 * POST /api/upload-local/elections/image
 * Upload d'une image/bannière d'élection vers serveur LWS
 */
router.post('/elections/image',
    authenticateToken,
    debugUpload,
    (req, res, next) => {
        uploadLocal.single('image')(req, res, (err) => {
            if (err) {
                return handleUploadError(err, req, res, next);
            }
            next();
        });
    },
    async (req, res) => {
        const FormData = (await import('form-data')).default;
        const fs = (await import('fs')).default;
        const axios = (await import('axios')).default;

        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Aucun fichier reçu'
                });
            }

            // Récupérer l'electionId depuis le body ou query
            const electionId = req.body.electionId || req.query.electionId;
            if (!electionId) {
                // Cleanup du fichier temporaire
                fs.unlinkSync(req.file.path);
                return res.status(400).json({
                    success: false,
                    message: 'electionId requis pour l\'upload d\'image d\'élection'
                });
            }

            console.log('✅ Image élection reçue:', req.file.filename, 'pour élection:', electionId);

            const formData = new FormData();
            formData.append('file', fs.createReadStream(req.file.path));
            formData.append('type', 'elections');
            formData.append('filename', req.file.filename);

            const lwsResponse = await axios.post(
                'https://oeuvreuniversitaire.ucaobenin.org/api/upload-handler.php',
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                        'Authorization': `Bearer ${process.env.MYSQL_PROXY_SECRET}`
                    },
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity
                }
            );

            fs.unlinkSync(req.file.path);
            console.log('✅ Image élection uploadée sur LWS');

            // Mettre à jour la base de données
            const imageUrl = lwsResponse.data.data.url;

            try {
                await pool.execute(
                    'UPDATE elections SET imageUrl = ? WHERE electionId = ?',
                    [imageUrl, electionId]
                );
                console.log('✅ Image élection mise à jour dans la BDD');
            } catch (dbError) {
                console.error('⚠️ Erreur mise à jour BDD élection:', dbError.message);
            }

            return res.status(200).json(lwsResponse.data);

        } catch (error) {
            console.error('❌ Erreur upload élection:', error.message);
            try {
                if (req.file?.path) fs.unlinkSync(req.file.path);
            } catch (e) { }
            return res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'upload',
                error: error.message
            });
        }
    }
);

// ==========================================
// ROUTE - Info système
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
            message: 'Système d\'upload vers serveur LWS actif',
            info: {
                maxFileSize: '10 MB',
                allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
                allowedDocTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
                uploadFolders: ['photos', 'candidats', 'elections', 'documents'],
                storageServer: 'https://oeuvreuniversitaire.ucaobenin.org',
                proxyEndpoint: '/api/upload-handler.php'
            }
        });
    }
);

export default router;
