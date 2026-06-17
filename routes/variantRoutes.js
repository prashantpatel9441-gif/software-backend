import express from 'express';
import {
  getVariants,
  createVariant,
  updateVariant,
  deleteVariant,
} from '../controllers/variantController.js';

const router = express.Router();

router.route('/')
  .get(getVariants)
  .post(createVariant);

router.route('/:id')
  .put(updateVariant)
  .delete(deleteVariant);

export default router;
