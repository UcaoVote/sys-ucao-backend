// routes/upload.js
import express from 'express';
import { authenticateToken } from '../middlewares/auth.js';
import upload from '../middlewares/upload.js';
import { uploadController } from '../controllers/uploadController.js';

const router = express.Router();

router.post('/image', authenticateToken, upload.single('image'), uploadController.uploadImage);

export default router;