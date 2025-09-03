// controllers/uploadController.js
import { uploadService } from '../services/uploadService.js';

export const uploadController = {
    async uploadImage(req, res) {
        console.log('=== UPLOAD START ===');

        try {
            if (!req.file) {
                console.log('No file received');
                return res.status(400).json({
                    success: false,
                    message: 'Aucun fichier image fourni'
                });
            }

            console.log('File received:', {
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                bufferLength: req.file.buffer?.length
            });

            console.log('Sending to ImgBB...');
            const imgbbUrl = await uploadService.uploadImageToImgBB(
                req.file.buffer,
                req.file.originalname,
                req.file.mimetype
            );

            console.log('Upload successful:', imgbbUrl);

            res.json({
                success: true,
                url: imgbbUrl,
                message: 'Image uploadée avec succès'
            });

        } catch (error) {
            console.error('Upload error details:', error);

            let errorMessage = 'Erreur lors de l\'upload';
            let statusCode = 500;

            if (error.message.includes('Type de fichier non supporté')) {
                errorMessage = 'Type de fichier non supporté';
                statusCode = 400;
            } else if (error.message.includes('File too large')) {
                errorMessage = 'Fichier trop volumineux (max 2MB)';
                statusCode = 400;
            } else if (error.response?.data?.error?.message) {
                errorMessage = error.response.data.error.message;
            }

            res.status(statusCode).json({
                success: false,
                message: errorMessage,
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
};