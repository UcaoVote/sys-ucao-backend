import express from 'express';
import concoursController from '../controllers/concoursController.js';

const router = express.Router();

// Routes publiques - Concours
router.get('/concours', concoursController.getActiveConcours);
router.get('/concours/:id', concoursController.getConcoursById);
router.get('/concours/:id/candidates', concoursController.getCandidates);
router.get('/concours/:id/stats', concoursController.getStats);
router.get('/concours/:id/results', concoursController.getResults);

// Routes publiques - Vote
router.post('/vote/initiate', concoursController.initiateVote);
router.post('/vote/confirm', concoursController.confirmVote);

// Webhooks paiement
router.post('/webhooks/fedapay', concoursController.webhookFedapay);
router.post('/webhooks/cinetpay', concoursController.webhookCinetpay);

export default router;
