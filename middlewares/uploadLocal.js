// middlewares/uploadLocal.js
// NOUVEAU système d'upload - Stockage LOCAL au lieu d'ImgBB
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Créer les dossiers s'ils n'existent pas
const uploadDir = path.join(__dirname, '../../htdocs/uploads');
const photosDir = path.join(uploadDir, 'photos');
const candidatsDir = path.join(uploadDir, 'candidats');
const electionsDir = path.join(uploadDir, 'elections');
const documentsDir = path.join(uploadDir, 'documents');

[uploadDir, photosDir, candidatsDir, electionsDir, documentsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Dossier créé: ${dir}`);
    }
});

// Configuration du stockage local
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Déterminer le dossier selon le type d'upload
        let folder = photosDir; // Par défaut

        if (req.path.includes('/candidats/')) {
            folder = candidatsDir;
        } else if (req.path.includes('/elections/')) {
            folder = electionsDir;
        } else if (req.path.includes('/documents/')) {
            folder = documentsDir;
        }

        console.log(`📁 Upload destination: ${folder}`);
        cb(null, folder);
    },
    filename: (req, file, cb) => {
        // Générer un nom de fichier unique
        const userId = req.user?.userId || req.user?.id || 'unknown';
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        const basename = path.basename(file.originalname, ext)
            .replace(/[^a-zA-Z0-9]/g, '_')
            .substring(0, 30);

        let prefix = 'file';
        if (req.path.includes('/candidats/')) {
            prefix = 'candidat';
        } else if (req.path.includes('/elections/')) {
            prefix = 'election';
        } else if (req.path.includes('/image')) {
            prefix = 'photo';
        }

        const filename = `${prefix}_${userId}_${timestamp}_${basename}${ext}`;
        console.log(`📝 Filename généré: ${filename}`);
        cb(null, filename);
    }
});

// Filtre pour valider les types de fichiers
const fileFilter = (req, file, cb) => {
    console.log(`🔍 Validation fichier: ${file.originalname} (${file.mimetype})`);

    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    const allowedDocTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    const allAllowedTypes = [...allowedImageTypes, ...allowedDocTypes];

    if (allAllowedTypes.includes(file.mimetype)) {
        console.log(`✅ Type de fichier accepté: ${file.mimetype}`);
        cb(null, true);
    } else {
        console.log(`❌ Type de fichier refusé: ${file.mimetype}`);
        cb(new Error(`Type de fichier non supporté: ${file.mimetype}`), false);
    }
};

// Configuration Multer avec stockage local
const uploadLocal = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB
        files: 1 // 1 fichier à la fois
    },
    fileFilter: fileFilter
});

// Fonction helper pour obtenir l'URL publique du fichier
export function getPublicUrl(filename, type = 'photos') {
    // Les fichiers sont stockés sur le serveur LWS
    const baseUrl = process.env.FRONTEND_URL || 'https://oeuvreuniversitaire.ucaobenin.org';
    return `${baseUrl}/uploads/${type}/${filename}`;
}

// Fonction helper pour supprimer un fichier
export function deleteFile(filepath) {
    return new Promise((resolve, reject) => {
        fs.unlink(filepath, (err) => {
            if (err) {
                console.error(`❌ Erreur suppression fichier: ${filepath}`, err);
                reject(err);
            } else {
                console.log(`✅ Fichier supprimé: ${filepath}`);
                resolve();
            }
        });
    });
}

// Fonction helper pour supprimer l'ancien fichier lors d'une mise à jour
export async function deleteOldFile(oldUrl) {
    try {
        if (!oldUrl || !oldUrl.includes('/uploads/')) {
            return; // Pas un fichier local ou pas d'URL
        }

        // Extraire le chemin relatif
        const urlParts = oldUrl.split('/uploads/');
        if (urlParts.length < 2) return;

        const relativePath = urlParts[1];
        const filepath = path.join(uploadDir, relativePath);

        if (fs.existsSync(filepath)) {
            await deleteFile(filepath);
        }
    } catch (error) {
        console.error('❌ Erreur lors de la suppression de l\'ancien fichier:', error);
    }
}

export default uploadLocal;
