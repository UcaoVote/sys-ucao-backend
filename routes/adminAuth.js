import express from 'express';
import adminController from '../controllers/adminController.js';

const router = express.Router();

// Connexion administrateur
router.post('/login', adminController.login);

// Création administrateur
router.post('/register', adminController.register);

export default router;