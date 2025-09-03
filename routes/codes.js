// routes/codes.js
import express from 'express';
import { authenticateToken, requireRole } from '../middlewares/auth.js';
import { codeController } from '../controllers/codeController.js';

const router = express.Router();

router.get('/list', authenticateToken, requireRole('ADMIN'), codeController.getCodeList);
router.post('/generate', authenticateToken, requireRole('ADMIN'), codeController.generateCodes);

export default router;