import express from 'express';
import concoursAdminController from '../controllers/concoursAdminController.js';
import { authenticateToken, requireAdmin } from '../middlewares/auth.js';

const router = express.Router();

// Toutes les routes admin nécessitent une authentification
router.use(authenticateToken);
router.use(requireAdmin);

// Gestion des concours
router.get('/concours', concoursAdminController.getAllConcours);
router.post('/concours', concoursAdminController.createConcours);
router.get('/concours/:id', concoursAdminController.getConcoursById);
router.put('/concours/:id', concoursAdminController.updateConcours);
router.delete('/concours/:id', concoursAdminController.deleteConcours);

// Gestion des candidates
router.get('/concours/:id/candidates', concoursAdminController.getCandidates);
router.post('/concours/:id/candidates', concoursAdminController.addCandidate);
router.put('/candidates/:id', concoursAdminController.updateCandidate);
router.put('/candidates/:id/status', concoursAdminController.updateCandidateStatus);
router.delete('/candidates/:id', concoursAdminController.deleteCandidate);

// Statistiques et rapports
router.get('/concours/:id/stats', concoursAdminController.getDetailedStats);
router.get('/concours/:id/transactions', concoursAdminController.getTransactions);
router.get('/concours/:id/export', concoursAdminController.exportResults);

export default router;
