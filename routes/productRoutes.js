import express from 'express';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  addVariantToProduct,
} from '../controllers/productController.js';

const router = express.Router();

router.route('/')
  .get(getProducts)
  .post(createProduct);

router.route('/:id')
  .put(updateProduct)
  .delete(deleteProduct);

router.route('/:id/variants')
  .post(addVariantToProduct);

export default router;
