import express from 'express';
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerPricing
} from '../controllers/customerController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, getCustomers)
  .post(protect, createCustomer);

router.route('/:id')
  .put(protect, updateCustomer)
  .delete(protect, deleteCustomer);

router.route('/:id/pricing')
  .get(protect, getCustomerPricing);

export default router;
