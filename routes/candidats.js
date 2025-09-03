import express from 'express';
import candidatController from '../controllers/candidatController.js';
import { authenticateToken, requireRole } from '../middlewares/auth.js';
import { validateCandidature } from '../middlewares/electionValidation.js';

const router = express.Router();

// Routes publiques
router.get('/election/:electionId', candidatController.getCandidatesByElection);
router.get('/:id', candidatController.getCandidate);

// Routes utilisateur authentifié
router.get('/is-candidate/:electionId', authenticateToken, candidatController.isUserCandidate);
router.get('/mes-candidatures', authenticateToken, candidatController.getUserCandidatures);
router.post('/', authenticateToken, candidatController.createCandidature);
router.put('/:candidateId/programme', authenticateToken, candidatController.updateProgramme);
router.post('/', authenticateToken, validateCandidature, candidatController.createCandidature);
// Routes admin
router.get('/admin/list', authenticateToken, requireRole('ADMIN'), candidatController.listCandidates);
router.get('/admin/stats', authenticateToken, requireRole('ADMIN'), candidatController.getCandidateStats);
router.get('/admin/:id', authenticateToken, requireRole('ADMIN'), candidatController.getCandidateDetails);
router.put('/:id', authenticateToken, requireRole('ADMIN'), candidatController.updateCandidate);
router.patch('/:id/status', authenticateToken, requireRole('ADMIN'), candidatController.updateCandidateStatus);
router.delete('/:id', authenticateToken, requireRole('ADMIN'), candidatController.deleteCandidate);

export default router;