import Inventory from '../models/Inventory.js';
import Product from '../models/Product.js';

// @desc    Get all inventory items (paginated)
// @route   GET /api/inventory
// @access  Public
export const getInventory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const category = req.query.category || 'All';
    const warehouse = req.query.warehouse || 'All';

    let query = {};

    if (search) {
      query.$or = [
        { sku: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }
    if (category && category !== 'All') {
      query.category = category;
    }
    if (warehouse && warehouse !== 'All') {
      query.warehouse = warehouse;
    }

    const total = await Inventory.countDocuments(query);
    const inventory = await Inventory.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Using aggregations for metrics
    const metricsAgg = await Inventory.aggregate([
      {
        $group: {
          _id: null,
          totalInventoryValue: { $sum: { $multiply: ["$quantity", "$unitPrice"] } },
          totalItemsInStock: { $sum: "$quantity" },
          lowStockAlerts: { 
            $sum: { 
              $cond: [ { $and: [ { $lt: ["$quantity", 10] }, { $gt: ["$quantity", 0] } ] }, 1, 0 ] 
            } 
          },
          deadStockItems: { 
            $sum: { $cond: [ { $eq: ["$status", "Dead Stock"] }, 1, 0 ] } 
          }
        }
      }
    ]);

    const metrics = metricsAgg.length > 0 ? metricsAgg[0] : {
      totalInventoryValue: 0,
      totalItemsInStock: 0,
      lowStockAlerts: 0,
      deadStockItems: 0
    };

    const categoryStatsAgg = await Inventory.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: "$quantity" },
          value: { $sum: { $multiply: ["$quantity", "$unitPrice"] } }
        }
      },
      {
        $project: {
          name: { $cond: [ { $eq: ["$_id", ""] }, "Uncategorized", "$_id" ] },
          count: 1,
          value: 1,
          _id: 0
        }
      },
      { $sort: { name: 1 } }
    ]);

    const uniqueCategories = ['All', ...(await Inventory.distinct('category')).filter(Boolean)];
    const uniqueWarehouses = ['All', ...(await Inventory.distinct('warehouse')).filter(Boolean)];
    
    // Low stock items for the banner
    const lowStockItems = await Inventory.find({ quantity: { $lt: 10, $gt: 0 } }).select('sku name variant quantity');

    res.status(200).json({
      inventory,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalItems: total,
      metrics: {
        totalInventoryValue: metrics.totalInventoryValue,
        totalItemsInStock: metrics.totalItemsInStock,
        lowStockAlerts: metrics.lowStockAlerts,
        deadStockItems: metrics.deadStockItems,
        uniqueCategories,
        uniqueWarehouses,
        lowStockItems,
        categoryStats: categoryStatsAgg
      }
    });
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
          let currentSku = vd.sku;
          let existing = await Inventory.findOne({ sku: currentSku });
          if (existing && existing.name !== product.name) {
             currentSku = `${vd.sku}-${product._id.toString().slice(-4)}`;
             existing = await Inventory.findOne({ sku: currentSku });
          }
          if (!existing) {
            const qty = vd.qty || 0;
            try {
              const inv = await Inventory.create({
                sku: currentSku,
                name: product.name,
                category: product.category || 'General',
                warehouse: 'Main WH - A1',
                quantity: qty,
                unitPrice: vd.retailPrice || product.retailPrice || 0,
                status: qty > 10 ? 'In Stock' : qty > 0 ? 'Low Stock' : 'Out of Stock',
                variant: vd.variantName,
              });
              created.push(inv);
            } catch (err) {
              if (err.code === 11000) {
                 const fallbackSku = `${currentSku}-${Math.floor(Math.random()*10000)}`;
                 const inv = await Inventory.create({ ...err.keyValue, sku: fallbackSku, name: product.name, category: product.category || 'General', warehouse: 'Main WH - A1', quantity: qty, unitPrice: vd.retailPrice || product.retailPrice || 0, status: qty > 10 ? 'In Stock' : qty > 0 ? 'Low Stock' : 'Out of Stock', variant: vd.variantName });
                 created.push(inv);
              } else throw err;
            }
          }
        }
      } else if (product.variants && product.variants.length > 0) {
        // Product with legacy variants (group/options format)
        for (const vGroup of product.variants) {
          for (const opt of vGroup.options) {
            const variantName = `${vGroup.group}: ${opt}`;
            const cleanV = variantName.replace(/[^a-zA-Z0-9]/g, '');
            let currentSku = `${product.sku}-${cleanV}`;
            let existing = await Inventory.findOne({ sku: currentSku });
            if (existing && existing.name !== product.name) {
               currentSku = `${currentSku}-${product._id.toString().slice(-4)}`;
               existing = await Inventory.findOne({ sku: currentSku });
            }
            if (!existing) {
              try {
                const inv = await Inventory.create({
                  sku: currentSku,
                  name: product.name,
                  category: product.category || 'General',
                  warehouse: 'Main WH - A1',
                  quantity: 0,
                  unitPrice: product.retailPrice || 0,
                  status: 'Out of Stock',
                  variant: variantName,
                });
                created.push(inv);
              } catch(err) {
                if (err.code === 11000) {
                  const fallbackSku = `${currentSku}-${Math.floor(Math.random()*10000)}`;
                  const inv = await Inventory.create({ sku: fallbackSku, name: product.name, category: product.category || 'General', warehouse: 'Main WH - A1', quantity: 0, unitPrice: product.retailPrice || 0, status: 'Out of Stock', variant: variantName });
                  created.push(inv);
                } else throw err;
              }
            }
          }
        }
      } else {
        // Product with no variants — create single inventory entry
        let currentSku = product.sku;
        let existing = await Inventory.findOne({ sku: currentSku });
        
        // If SKU exists but for a totally different product name, append a suffix to avoid uniqueness error
        if (existing && existing.name !== product.name) {
          currentSku = `${product.sku}-${product._id.toString().slice(-4)}`;
          existing = await Inventory.findOne({ sku: currentSku });
        }

        if (!existing) {
          const qty = product.qty || 0;
          try {
            const inv = await Inventory.create({
              sku: currentSku,
              name: product.name,
              category: product.category || 'General',
              warehouse: 'Main WH - A1',
              quantity: qty,
              unitPrice: product.retailPrice || 0,
              status: qty > 10 ? 'In Stock' : qty > 0 ? 'Low Stock' : 'Out of Stock',
              variant: '',
            });
            created.push(inv);
          } catch (err) {
             if (err.code === 11000) {
               const fallbackSku = `${currentSku}-${Math.floor(Math.random()*10000)}`;
               const inv = await Inventory.create({ sku: fallbackSku, name: product.name, category: product.category || 'General', warehouse: 'Main WH - A1', quantity: qty, unitPrice: product.retailPrice || 0, status: qty > 10 ? 'In Stock' : qty > 0 ? 'Low Stock' : 'Out of Stock', variant: '' });
               created.push(inv);
             } else throw err;
          }
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
