import Inventory from '../models/Inventory.js';
import Product from '../models/Product.js';

// @desc    Get all inventory items (paginated)
// @route   GET /api/inventory
// @access  Public
export const getInventory = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(1000, parseInt(req.query.limit) || 10));
    const search = req.query.search ? String(req.query.search).trim() : '';
    const category = req.query.category || 'All';
    const warehouse = req.query.warehouse || 'All';

    let query = {};

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { sku: { $regex: escaped, $options: 'i' } },
        { name: { $regex: escaped, $options: 'i' } }
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
      .sort({ srNo: 1, createdAt: -1 })
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
      totalPages: Math.ceil(total / limit) || 1,
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
            const qty = parseInt(vd.qty) || 0;
            try {
              const inv = await Inventory.create({
                sku: currentSku,
                name: product.name,
                category: product.category || 'General',
                warehouse: 'Main WH - A1',
                quantity: qty,
                unitPrice: parseFloat(vd.retailPrice) || parseFloat(product.retailPrice) || 0,
                status: qty > 10 ? 'In Stock' : qty > 0 ? 'Low Stock' : 'Out of Stock',
                variant: vd.variantName,
                srNo: product.srNo || 999999,
              });
              created.push(inv);
            } catch (err) {
              if (err.code === 11000) {
                const fallbackSku = `${currentSku}-${Math.floor(Math.random() * 10000)}`;
                const inv = await Inventory.create({
                  sku: fallbackSku,
                  name: product.name,
                  category: product.category || 'General',
                  warehouse: 'Main WH - A1',
                  quantity: qty,
                  unitPrice: parseFloat(vd.retailPrice) || parseFloat(product.retailPrice) || 0,
                  status: qty > 10 ? 'In Stock' : qty > 0 ? 'Low Stock' : 'Out of Stock',
                  variant: vd.variantName,
                  srNo: product.srNo || 999999,
                });
                created.push(inv);
              } else {
                throw err;
              }
            }
          }
        }
      } else {
        // Product with no variants — create single inventory entry
        let currentSku = product.sku;
        let existing = await Inventory.findOne({ sku: currentSku });
        
        if (existing && existing.name !== product.name) {
          currentSku = `${product.sku}-${product._id.toString().slice(-4)}`;
          existing = await Inventory.findOne({ sku: currentSku });
        }

        if (!existing) {
          const qty = parseInt(product.qty) || 0;
          try {
            const inv = await Inventory.create({
              sku: currentSku,
              name: product.name,
              category: product.category || 'General',
              warehouse: 'Main WH - A1',
              quantity: qty,
              unitPrice: parseFloat(product.retailPrice) || 0,
              status: qty > 10 ? 'In Stock' : qty > 0 ? 'Low Stock' : 'Out of Stock',
              variant: '',
              srNo: product.srNo || 999999,
            });
            created.push(inv);
          } catch (err) {
            if (err.code === 11000) {
              const fallbackSku = `${currentSku}-${Math.floor(Math.random() * 10000)}`;
              const inv = await Inventory.create({
                sku: fallbackSku,
                name: product.name,
                category: product.category || 'General',
                warehouse: 'Main WH - A1',
                quantity: qty,
                unitPrice: parseFloat(product.retailPrice) || 0,
                status: qty > 10 ? 'In Stock' : qty > 0 ? 'Low Stock' : 'Out of Stock',
                variant: '',
                srNo: product.srNo || 999999,
              });
              created.push(inv);
            } else {
              throw err;
            }
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

    if (!sku || !sku.trim()) {
      res.status(400);
      throw new Error('SKU is required');
    }

    if (!name || !name.trim()) {
      res.status(400);
      throw new Error('Name is required');
    }

    const cleanSku = sku.trim();
    const exists = await Inventory.findOne({ sku: cleanSku });
    if (exists) {
      res.status(400);
      throw new Error(`An inventory item with SKU "${cleanSku}" already exists`);
    }

    const qty = parseInt(quantity) || 0;
    const computedStatus = status || (qty > 10 ? 'In Stock' : qty > 0 ? 'Low Stock' : 'Out of Stock');

    const item = await Inventory.create({
      sku: cleanSku,
      name: name.trim(),
      category: category ? category.trim() : 'General',
      variant: variant ? variant.trim() : '',
      warehouse: warehouse ? warehouse.trim() : 'Main WH - A1',
      quantity: qty,
      unitPrice: parseFloat(unitPrice) || 0,
      status: computedStatus,
    });

    // Also update matching Product if exists by SKU or variantDetails.sku
    const product = await Product.findOne({
      $or: [{ sku: cleanSku }, { 'variantDetails.sku': cleanSku }]
    });

    if (product) {
      if (product.variantDetails && product.variantDetails.length > 0) {
        const vd = product.variantDetails.find(v => v.sku.toLowerCase() === cleanSku.toLowerCase());
        if (vd) {
          vd.qty = qty;
        }
        product.qty = product.variantDetails.reduce((sum, v) => sum + (parseInt(v.qty) || 0), 0);
      } else {
        product.qty += qty;
      }
      if (product.qty <= 0) product.status = 'Out of Stock';
      else if (product.status === 'Out of Stock') product.status = 'Active';
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
    const rawItems = req.body.items || req.body;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      res.status(400);
      throw new Error('Request body must contain an array of items');
    }

    const baseSkuSet = new Set();
    const updatedItems = [];

    for (const itemData of rawItems) {
      if (!itemData || !itemData.sku) continue;

      const { sku, baseSku, name, category, warehouse, quantity, unitPrice, status, variant } = itemData;
      const cleanSku = sku.trim();
      const qty = parseInt(quantity) || 0;
      const existing = await Inventory.findOne({ sku: cleanSku });

      if (existing) {
        if (baseSku) baseSkuSet.add(baseSku);
        existing.quantity = qty;
        existing.status = status || (qty > 10 ? 'In Stock' : qty > 0 ? 'Low Stock' : 'Out of Stock');
        existing.warehouse = warehouse || existing.warehouse;
        existing.unitPrice = unitPrice !== undefined ? (parseFloat(unitPrice) || 0) : existing.unitPrice;
        await existing.save();
        updatedItems.push(existing);
      } else {
        if (baseSku) baseSkuSet.add(baseSku);
        const newItem = await Inventory.create({
          sku: cleanSku,
          name: name ? name.trim() : 'Unnamed Item',
          category: category ? category.trim() : 'General',
          variant: variant ? variant.trim() : '',
          warehouse: warehouse ? warehouse.trim() : 'Main WH - A1',
          quantity: qty,
          unitPrice: parseFloat(unitPrice) || 0,
          status: status || (qty > 10 ? 'In Stock' : qty > 0 ? 'Low Stock' : 'Out of Stock'),
        });
        updatedItems.push(newItem);
      }
    }

    // Sync base products if baseSkuSet was populated
    for (const bSku of baseSkuSet) {
      const allInventoryForProduct = await Inventory.find({ sku: { $regex: new RegExp(`^${bSku}`, 'i') } });
      const newTotalQty = allInventoryForProduct.reduce((sum, inv) => sum + (inv.quantity || 0), 0);
      const product = await Product.findOne({ sku: bSku });
      if (product) {
        product.qty = newTotalQty;
        if (product.qty <= 0) product.status = 'Out of Stock';
        else if (product.status === 'Out of Stock') product.status = 'Active';
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

    if (!item) {
      res.status(404);
      throw new Error(`Inventory item with SKU "${req.params.sku}" not found`);
    }

    const oldQty = item.quantity;
    const newQty = req.body.quantity !== undefined ? (parseInt(req.body.quantity) || 0) : oldQty;
    const diff = newQty - oldQty;

    item.name = req.body.name ? req.body.name.trim() : item.name;
    item.category = req.body.category ? req.body.category.trim() : item.category;
    item.variant = req.body.variant !== undefined ? req.body.variant.trim() : item.variant;
    item.warehouse = req.body.warehouse ? req.body.warehouse.trim() : item.warehouse;
    item.quantity = newQty;
    item.unitPrice = req.body.unitPrice !== undefined ? (parseFloat(req.body.unitPrice) || 0) : item.unitPrice;

    // Auto-update status if not explicitly given or if quantity changed
    if (req.body.status) {
      item.status = req.body.status;
    } else {
      item.status = newQty > 10 ? 'In Stock' : newQty > 0 ? 'Low Stock' : 'Out of Stock';
    }

    const updatedItem = await item.save();

    // Sync product qty
    if (diff !== 0) {
      const product = await Product.findOne({
        $or: [{ sku: item.sku }, { 'variantDetails.sku': item.sku }]
      });

      if (product) {
        if (product.variantDetails && product.variantDetails.length > 0) {
          const vd = product.variantDetails.find(v => v.sku.toLowerCase() === item.sku.toLowerCase());
          if (vd) {
            vd.qty = newQty;
          }
          product.qty = product.variantDetails.reduce((sum, v) => sum + (parseInt(v.qty) || 0), 0);
        } else {
          product.qty = Math.max(0, product.qty + diff);
        }

        if (product.qty <= 0) product.status = 'Out of Stock';
        else if (product.status === 'Out of Stock') product.status = 'Active';
        await product.save();
      }
    }

    res.status(200).json(updatedItem);
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

    if (!item) {
      res.status(404);
      throw new Error(`Inventory item with SKU "${req.params.sku}" not found`);
    }

    await Inventory.deleteOne({ sku: req.params.sku });
    res.status(200).json({ message: 'Inventory item removed' });
  } catch (error) {
    next(error);
  }
};
