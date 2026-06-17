import express from 'express';
import {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
} from '../controllers/invoiceController.js';

const router = express.Router();

router.route('/')
  .get(getInvoices)
  .post(createInvoice);

router.route('/:invoiceId')
  .get(getInvoiceById)
  .put(updateInvoice)
  .delete(deleteInvoice);

export default router;
