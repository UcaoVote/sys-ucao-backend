// routes/students.js
import express from 'express';
import { authenticateToken, requireRole } from '../middlewares/auth.js';
import { studentController } from '../controllers/studentController.js';

const router = express.Router();

router.put('/:id/status', authenticateToken, requireRole('ADMIN'), studentController.updateStudentStatus);
router.post('/:studentId/reset-access', authenticateToken, requireRole('ADMIN'), studentController.resetStudentAccess);
router.get('/matricule/:matricule', authenticateToken, requireRole('ADMIN'), studentController.findStudentByMatricule);
router.get('/code/:code', authenticateToken, requireRole('ADMIN'), studentController.findStudentByCode);
router.get('/', authenticateToken, requireRole('ADMIN'), studentController.getStudents);
router.get('/stats', authenticateToken, requireRole('ADMIN'), studentController.getStudentStats);

export default router;