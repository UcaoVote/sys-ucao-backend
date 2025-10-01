// middlewares/upload.js
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configuration de Multer pour les avatars
const storage = multer.memoryStorage();

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

export default upload;