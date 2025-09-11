// routes/codes.js
import express from 'express';
import { codeController } from '../controllers/codeController.js';
import { authenticateToken, requireAdmin } from '../middlewares/auth.js';
const router = express.Router();

router.get('/list', authenticateToken, requireAdmin, codeController.getCodeList);
router.post('/generate', authenticateToken, requireAdmin, codeController.generateCodes);

export default router;