import Inventory from '../models/Inventory.js';
import Product from '../models/Product.js';

// @desc    Get all inventory items
// @route   GET /api/inventory
// @access  Public
export const getInventory = async (req, res, next) => {
  try {
    const inventory = await Inventory.find({}).sort({ createdAt: -1 });
    res.status(200).json(inventory);
  } catch (error) {
    next(error);
  }
};

// @desc    Sync all products into inventory (creates missing entries)
// @route   POST /api/inventory/sync
// @access  Public
export const syncProductsToInventory = async (req, res, next) => {
  try {
    const products = await Product.find({});
    const created = [];

    for (const product of products) {
      if (product.variantDetails && product.variantDetails.length > 0) {
        // Product with variantDetails — create one inventory entry per variant
        for (const vd of product.variantDetails) {
          const existing = await Inventory.findOne({ sku: vd.sku });
          if (!existing) {
            const qty = vd.qty || 0;
            const inv = await Inventory.create({
              sku: vd.sku,
              name: product.name,
              category: product.category || 'General',
              warehouse: 'Main WH - A1',
              quantity: qty,
              unitPrice: vd.retailPrice || product.retailPrice || 0,
              status: qty > 10 ? 'In Stock' : qty > 0 ? 'Low Stock' : 'Out of Stock',
              variant: vd.variantName,
            });
            created.push(inv);
          }
        }
      } else if (product.variants && product.variants.length > 0) {
        // Product with legacy variants (group/options format)
        for (const vGroup of product.variants) {
          for (const opt of vGroup.options) {
            const variantName = `${vGroup.group}: ${opt}`;
            const cleanV = variantName.replace(/[^a-zA-Z0-9]/g, '');
            const variantSku = `${product.sku}-${cleanV}`;
            const existing = await Inventory.findOne({ sku: variantSku });
            if (!existing) {
              const inv = await Inventory.create({
                sku: variantSku,
                name: product.name,
                category: product.category || 'General',
                warehouse: 'Main WH - A1',
                quantity: 0,
                unitPrice: product.retailPrice || 0,
                status: 'Out of Stock',
                variant: variantName,
              });
              created.push(inv);
            }
          }
        }
      } else {
        // Product with no variants — create single inventory entry
        const existing = await Inventory.findOne({ sku: product.sku });
        if (!existing) {
          const qty = product.qty || 0;
          const inv = await Inventory.create({
            sku: product.sku,
            name: product.name,
            category: product.category || 'General',
            warehouse: 'Main WH - A1',
            quantity: qty,
            unitPrice: product.retailPrice || 0,
            status: qty > 10 ? 'In Stock' : qty > 0 ? 'Low Stock' : 'Out of Stock',
            variant: '',
          });
          created.push(inv);
        }
      }
    }

    res.status(200).json({ message: `Synced. ${created.length} new entries created.`, created });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new inventory item
// @route   POST /api/inventory
// @access  Public
export const createInventoryItem = async (req, res, next) => {
  try {
    const { sku, name, category, warehouse, quantity, unitPrice, status, variant } = req.body;

    const exists = await Inventory.findOne({ sku });
    if (exists) {
      res.status(400);
      throw new Error('An item with this SKU already exists');
    }

    const item = await Inventory.create({
      sku,
      name,
      category,
      variant,
      warehouse,
      quantity,
      unitPrice,
      status,
    });

    // Also increment the base Product quantity if product exists by SKU
    const product = await Product.findOne({ sku });
    if (product) {
      product.qty += Number(quantity);
      await product.save();
    }

    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
};

// @desc    Create/Update multiple inventory items at once
// @route   POST /api/inventory/bulk
// @access  Public
export const createBulkInventoryItems = async (req, res, next) => {
  try {
    const { items } = req.body;
    const baseSkuSet = new Set();
    const updatedItems = [];

    for (const itemData of items) {
      const { sku, baseSku, name, category, warehouse, quantity, unitPrice, status, variant } = itemData;
      const existing = await Inventory.findOne({ sku });
      if (existing) {
        if (baseSku) baseSkuSet.add(baseSku);
        existing.quantity = Number(quantity);
        existing.status = status;
        existing.warehouse = warehouse || existing.warehouse;
        existing.unitPrice = unitPrice !== undefined ? unitPrice : existing.unitPrice;
        await existing.save();
        updatedItems.push(existing);
      } else {
        if (baseSku) baseSkuSet.add(baseSku);
        const newItem = await Inventory.create({
          sku, baseSku, name, category, variant, warehouse,
          quantity: Number(quantity), unitPrice, status,
        });
        updatedItems.push(newItem);
      }
    }

    for (const bSku of baseSkuSet) {
      const allInventoryForProduct = await Inventory.find({ baseSku: bSku });
      const newTotalQty = allInventoryForProduct.reduce((sum, inv) => sum + inv.quantity, 0);
      const product = await Product.findOne({ sku: bSku });
      if (product) {
        product.qty = newTotalQty;
        await product.save();
      }
    }

    res.status(200).json(updatedItems);
  } catch (error) {
    next(error);
  }
};

// @desc    Update an inventory item by SKU
// @route   PUT /api/inventory/:sku
// @access  Public
export const updateInventoryItem = async (req, res, next) => {
  try {
    const item = await Inventory.findOne({ sku: req.params.sku });

    if (item) {
      const diff = (req.body.quantity !== undefined ? Number(req.body.quantity) : item.quantity) - item.quantity;

      item.name = req.body.name || item.name;
      item.category = req.body.category || item.category;
      item.variant = req.body.variant !== undefined ? req.body.variant : item.variant;
      item.warehouse = req.body.warehouse || item.warehouse;
      item.quantity = req.body.quantity !== undefined ? req.body.quantity : item.quantity;
      item.unitPrice = req.body.unitPrice !== undefined ? req.body.unitPrice : item.unitPrice;
      item.status = req.body.status || item.status;

      const updatedItem = await item.save();

      if (diff !== 0) {
        const product = await Product.findOne({ sku: item.sku });
        if (product) {
          product.qty += diff;
          await product.save();
        }
      }

      res.status(200).json(updatedItem);
    } else {
      res.status(404);
      throw new Error('Inventory item not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Delete an inventory item by SKU
// @route   DELETE /api/inventory/:sku
// @access  Public
export const deleteInventoryItem = async (req, res, next) => {
  try {
    const item = await Inventory.findOne({ sku: req.params.sku });

    if (item) {
      await Inventory.deleteOne({ sku: req.params.sku });
      res.status(200).json({ message: 'Inventory item removed' });
    } else {
      res.status(404);
      throw new Error('Inventory item not found');
    }
  } catch (error) {
    next(error);
  }
};
