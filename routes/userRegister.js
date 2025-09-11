import express from 'express';
import userController from '../controllers/userController.js';
import { rateLimit } from '../middlewares/rateLimit.js';

const router = express.Router();

// Rate limiting
router.post('/', rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }), userController.register.bind(userController));

export default router;