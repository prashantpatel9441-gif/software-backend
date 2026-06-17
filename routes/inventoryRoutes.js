import express from 'express';
import {
  getInventory,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  createBulkInventoryItems,
  syncProductsToInventory,
} from '../controllers/inventoryController.js';

const router = express.Router();

router.route('/sync')
  .post(syncProductsToInventory);

router.route('/bulk')
  .post(createBulkInventoryItems);

router.route('/')
  .get(getInventory)
  .post(createInventoryItem);

router.route('/:sku')
  .put(updateInventoryItem)
  .delete(deleteInventoryItem);

export default router;
