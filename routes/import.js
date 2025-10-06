import express from 'express';
import { authenticateToken } from '../middlewares/auth.js';
import { importController } from '../controllers/importController.js';

const router = express.Router();

// Route mise à jour pour l'importation d'étudiants
router.post('/import/etudiants', authenticateToken, importController.importEtudiants);

export default router;