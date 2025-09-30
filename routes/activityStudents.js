import express from 'express';
import activityController from '../controllers/activityController.js';

const router = express.Router();

router.get('/', activityController.getCategories);
router.get('/:activityId/subactivities', activityController.getSubactivities);
router.get('/all/with-subactivities', activityController.getAllWithSubactivities);

export default router;