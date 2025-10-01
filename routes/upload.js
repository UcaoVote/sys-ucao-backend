// routes/upload.js
import express from 'express';
import { authenticateToken } from '../middlewares/auth.js';
import upload from '../middlewares/upload.js';
import userProfileController from '../controllers/userProfileController.js';
const router = express.Router();

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
//import { uploadController } from '../controllers/uploadController.js';


//router.post('/imag', authenticateToken, upload.single('image'), uploadController.uploadImage);
router.post('/image', authenticateToken, upload.single('image'), handleUploadError, userProfileController.uploadAvatar);

export default router;