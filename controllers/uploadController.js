// controllers/uploadController.js
import { uploadService } from '../services/uploadService.js';

export const uploadController = {
    async uploadImage(req, res) {
        console.log('=== UPLOAD START ===');
        console.log('Headers:', req.headers);
        console.log('User:', req.user);
        console.log('File field:', req.file);

        try {
            if (!req.file) {
                console.log('No file received in request');
                console.log('Request body:', req.body);
                console.log('Request files:', req.files);
                return res.status(400).json({
                    success: false,
                    message: 'Aucun fichier image fourni'
                });
            }

            console.log('File details:', {
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                bufferLength: req.file.buffer?.length,
                fieldname: req.file.fieldname
            });

            console.log('Starting ImgBB upload...');
            const imgbbUrl = await uploadService.uploadImageToImgBB(
                req.file.buffer,
                req.file.originalname,
                req.file.mimetype
            );

            console.log('Upload successful. URL:', imgbbUrl);

            res.json({
                success: true,
                url: imgbbUrl,
                message: 'Image uploadée avec succès'
            });

        } catch (error) {
            console.error('Upload error:', error);
            console.error('Error stack:', error.stack);

            let errorMessage = 'Erreur lors de l\'upload';
            let statusCode = 500;

            if (error.message.includes('Type de fichier non supporté')) {
                errorMessage = 'Type de fichier non supporté';
                statusCode = 400;
            } else if (error.message.includes('File too large')) {
                errorMessage = 'Fichier trop volumineux (max 2MB)';
                statusCode = 400;
            } else if (error.message.includes('ImgBB')) {
                errorMessage = 'Erreur du service d\'upload';
            }

            res.status(statusCode).json({
                success: false,
                message: errorMessage,
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
};