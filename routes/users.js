import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../middlewares/auth.js';
import userProfileController from '../controllers/userProfileController.js';

const router = express.Router();

// Configuration de Multer pour les avatars
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'public/uploads/avatars';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `avatar-${req.user.id}-${Date.now()}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Type de fichier non supporté (JPEG, PNG, GIF uniquement)'));
        }
    }
});

// Middleware pour gérer les erreurs de Multer
const handleUploadError = (error, req, res, next) => {
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

// Routes du profil utilisateur
router.get('/profile', authenticateToken, userProfileController.getProfile);
router.put('/profile', authenticateToken, userProfileController.updateProfile);
router.post('/avatar', authenticateToken, upload.single('avatar'), handleUploadError, userProfileController.uploadAvatar);
router.post('/change-password', authenticateToken, userProfileController.changePassword);

export default router;