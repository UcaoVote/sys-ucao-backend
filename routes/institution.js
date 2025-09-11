import express from 'express';
import {
    addEcole,
    updateEcole,
    toggleEcoleActif,
    getAllEcoles,
    getEcoleById,
    addFiliere,
    updateFiliere,
    toggleFiliereActif,
    getAllFilieres,
    getFilieresByEcole,
    getFiliereById
} from '../controllers/institutionManager.js';

import { authenticateToken, requireAdmin } from '../middlewares/auth.js';

const router = express.Router();

// Création
router.post('/ecoles', authenticateToken, requireAdmin, addEcole);
router.post('/filieres', authenticateToken, requireAdmin, addFiliere);

// Modification
router.put('/ecoles/:id', updateEcole);
router.put('/filieres/:id', updateFiliere);

// Désactivation / Réactivation
router.patch('/ecoles/:id/actif', authenticateToken, requireAdmin, toggleEcoleActif);
router.patch('/filieres/:id/actif', authenticateToken, requireAdmin, toggleFiliereActif);

// Listing
router.get('/ecoles', getAllEcoles);
router.get('/filieres', getAllFilieres);
router.get('/filieres/ecole/:ecoleId', getFilieresByEcole);

// Consultation par ID
router.get('/ecoles/:id', getEcoleById);
router.get('/filieres/:id', getFiliereById);

export default router;
