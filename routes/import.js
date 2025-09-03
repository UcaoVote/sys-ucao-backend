// routes/import.js
import express from 'express';
import { authenticateToken } from '../middlewares/auth.js';
import { importController } from '../controllers/importController.js';

const router = express.Router();

router.post('/import', authenticateToken, importController.importMatricules);

export default router;