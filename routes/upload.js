// routes/upload.js
import express from 'express';
import { authenticateToken } from '../middlewares/auth.js';
import upload from '../middlewares/upload.js';
import userProfileController from '../controllers/userProfileController.js';
import multer from 'multer';

const router = express.Router();

// Middleware pour gérer les erreurs de Multer
const handleUploadError = (error, req, res, next) => {
    console.error('Multer error:', error);

    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'Fichier trop volumineux (max 2MB)'
            });
        }
    }

    if (error.message.includes('Type de fichier non supporté')) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }

    next(error);
};

// Middleware de débogage
const debugUpload = (req, res, next) => {
    console.log('=== UPLOAD DEBUG ===');
    console.log('Headers:', req.headers);
    console.log('User:', req.user);
    console.log('File field exists:', !!req.file);
    next();
};

// Route pour l'upload de l'image de profil
router.post('/image',
    authenticateToken,
    debugUpload,
    upload.single('image'),
    handleUploadError,
    userProfileController.uploadAvatar
);

export default router;