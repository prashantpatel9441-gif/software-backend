import Product from '../models/Product.js';
import Inventory from '../models/Inventory.js';
import mongoose from 'mongoose';

// @desc    Get all products (with pagination & filters)
// @route   GET /api/products
// @access  Public
export const getProducts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(1000, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const query = {};

    if (req.query.search) {
      const escaped = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { sku: { $regex: escaped, $options: 'i' } }
      ];
    }
    if (req.query.category && req.query.category !== 'All' && req.query.category !== '') {
      query.category = req.query.category;
    }
    if (req.query.status && req.query.status !== 'All' && req.query.status !== '') {
      query.status = req.query.status;
    }

    const totalItems = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort({ srNo: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      products,
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit) || 1,
      totalItems
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a product
// @route   POST /api/products
// @access  Public
export const createProduct = async (req, res, next) => {
  try {
    let {
      name, image, category, variants, variantDetails, unit, sku,
      vendor, qty, wholesalePrice, retailPrice, status, srNo,
      height, width, sqftPerPcs
    } = req.body;

    if (!name || !name.trim()) {
      res.status(400);
      throw new Error('Product name is required');
    }

    if (!sku || !sku.trim()) {
      res.status(400);
      throw new Error('Product SKU is required');
    }

    const h = parseFloat(height) || 0;
    const w = parseFloat(width) || 0;
    const computedSqft = (h > 0 && w > 0) ? (h * w) / 144 : (parseFloat(sqftPerPcs) || 0);

    // Compute sqft & total qty for variantDetails if present
    let processedVariantDetails = [];
    if (Array.isArray(variantDetails) && variantDetails.length > 0) {
      processedVariantDetails = variantDetails.map(vd => {
        const vh = parseFloat(vd.height) || 0;
        const vw = parseFloat(vd.width) || 0;
        const vSqft = (vh > 0 && vw > 0) ? (vh * vw) / 144 : (parseFloat(vd.sqftPerPcs) || 0);
        return {
          ...vd,
          height: vh,
          width: vw,
          sqftPerPcs: vSqft,
          qty: parseInt(vd.qty) || 0,
          retailPrice: parseFloat(vd.retailPrice) || 0,
          wholesalePrice: parseFloat(vd.wholesalePrice) || 0,
        };
      });
      qty = processedVariantDetails.reduce((sum, v) => sum + v.qty, 0);
    } else {
      qty = parseInt(qty) || 0;
    }

    // Auto-update status based on qty
    if (qty <= 0) {
      status = 'Out of Stock';
    } else if (!status || status === 'Out of Stock') {
      status = 'Active';
    }

    // Check if srNo is unique
    if (srNo && Number(srNo) !== 999999) {
      const existingProduct = await Product.findOne({ srNo: Number(srNo) });
      if (existingProduct) {
        res.status(400);
        throw new Error(`Serial Number ${srNo} is already in use by product: ${existingProduct.name}`);
      }
    }

    const product = await Product.create({
      name: name.trim(),
      image: image || '',
      category: category || '',
      variants: Array.isArray(variants) ? variants : [],
      variantDetails: processedVariantDetails,
      unit: unit || 'Pcs',
      sku: sku.trim(),
      vendor: vendor ? vendor.trim() : 'General',
      qty,
      wholesalePrice: parseFloat(wholesalePrice) || 0,
      retailPrice: parseFloat(retailPrice) || 0,
      height: h,
      width: w,
      sqftPerPcs: computedSqft,
      status,
      srNo: srNo ? Number(srNo) : 999999,
    });

    // Auto-create initial inventory items
    try {
      if (processedVariantDetails.length > 0) {
        for (const detail of processedVariantDetails) {
          await Inventory.create({
            sku: detail.sku,
            name: product.name,
            category: product.category || 'General',
            warehouse: 'Main WH - A1',
            quantity: detail.qty || 0,
            unitPrice: detail.retailPrice || 0,
            status: detail.qty > 10 ? 'In Stock' : detail.qty > 0 ? 'Low Stock' : 'Out of Stock',
            variant: detail.variantName || '',
            srNo: product.srNo || 999999,
          });
        }
      } else {
        await Inventory.create({
          sku: product.sku,
          name: product.name,
          category: product.category || 'General',
          warehouse: 'Main WH - A1',
          quantity: product.qty || 0,
          unitPrice: product.retailPrice || 0,
          status: product.qty > 10 ? 'In Stock' : product.qty > 0 ? 'Low Stock' : 'Out of Stock',
          variant: '',
          srNo: product.srNo || 999999,
        });
      }
    } catch (invErr) {
      console.error('Failed to auto-create inventory item for product:', invErr.message);
    }

    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Public
export const updateProduct = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error('Invalid product ID format');
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      res.status(404);
      throw new Error('Product not found');
    }

    product.name = req.body.name ? req.body.name.trim() : product.name;
    product.image = req.body.image !== undefined ? req.body.image : product.image;
    product.category = req.body.category !== undefined ? req.body.category : product.category;
    product.variants = req.body.variants !== undefined ? req.body.variants : product.variants;
    product.unit = req.body.unit || product.unit;
    product.sku = req.body.sku ? req.body.sku.trim() : product.sku;
    product.vendor = req.body.vendor !== undefined ? req.body.vendor : product.vendor;
    product.wholesalePrice = req.body.wholesalePrice !== undefined ? (parseFloat(req.body.wholesalePrice) || 0) : product.wholesalePrice;
    product.retailPrice = req.body.retailPrice !== undefined ? (parseFloat(req.body.retailPrice) || 0) : product.retailPrice;

    // Handle dimensions and sqft
    product.height = req.body.height !== undefined ? (parseFloat(req.body.height) || 0) : product.height;
    product.width = req.body.width !== undefined ? (parseFloat(req.body.width) || 0) : product.width;
    if (product.height > 0 && product.width > 0) {
      product.sqftPerPcs = (product.height * product.width) / 144;
    } else if (req.body.sqftPerPcs !== undefined) {
      product.sqftPerPcs = parseFloat(req.body.sqftPerPcs) || 0;
    }

    // Check srNo uniqueness
    if (req.body.srNo !== undefined && Number(req.body.srNo) !== 999999 && Number(req.body.srNo) !== product.srNo) {
      const existingProduct = await Product.findOne({ srNo: Number(req.body.srNo), _id: { $ne: product._id } });
      if (existingProduct) {
        res.status(400);
        throw new Error(`Serial Number ${req.body.srNo} is already in use by product: ${existingProduct.name}`);
      }
      product.srNo = Number(req.body.srNo);
    }

    // Handle variant details and calculate qty
    if (req.body.variantDetails !== undefined && Array.isArray(req.body.variantDetails)) {
      product.variantDetails = req.body.variantDetails.map(vd => {
        const vh = parseFloat(vd.height) || 0;
        const vw = parseFloat(vd.width) || 0;
        const vSqft = (vh > 0 && vw > 0) ? (vh * vw) / 144 : (parseFloat(vd.sqftPerPcs) || 0);
        return {
          ...vd,
          height: vh,
          width: vw,
          sqftPerPcs: vSqft,
          qty: parseInt(vd.qty) || 0,
          retailPrice: parseFloat(vd.retailPrice) || 0,
          wholesalePrice: parseFloat(vd.wholesalePrice) || 0,
        };
      });
      product.qty = product.variantDetails.reduce((sum, v) => sum + v.qty, 0);
    } else if (req.body.qty !== undefined) {
      product.qty = parseInt(req.body.qty) || 0;
    }

    // Status logic
    if (product.qty <= 0) {
      product.status = 'Out of Stock';
    } else if (req.body.status) {
      product.status = req.body.status;
    } else if (product.status === 'Out of Stock') {
      product.status = 'Active';
    }

    const updatedProduct = await product.save();

    // Sync inventory for variant details updates
    try {
      if (product.variantDetails && product.variantDetails.length > 0) {
        for (const detail of product.variantDetails) {
          await Inventory.updateOne(
            { sku: detail.sku },
            {
              $set: {
                name: updatedProduct.name,
                category: updatedProduct.category || 'General',
                quantity: detail.qty,
                unitPrice: detail.retailPrice,
                status: detail.qty > 10 ? 'In Stock' : detail.qty > 0 ? 'Low Stock' : 'Out of Stock',
                variant: detail.variantName || '',
                srNo: updatedProduct.srNo || 999999,
              }
            },
            { upsert: true }
          );
        }
      } else if (updatedProduct.sku) {
        await Inventory.updateOne(
          { sku: updatedProduct.sku },
          {
            $set: {
              name: updatedProduct.name,
              category: updatedProduct.category || 'General',
              quantity: updatedProduct.qty,
              unitPrice: updatedProduct.retailPrice,
              status: updatedProduct.qty > 10 ? 'In Stock' : updatedProduct.qty > 0 ? 'Low Stock' : 'Out of Stock',
              srNo: updatedProduct.srNo || 999999,
            }
          },
          { upsert: true }
        );
      }
    } catch (invErr) {
      console.error('Failed to update inventory items:', invErr.message);
    }

    res.status(200).json(updatedProduct);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Public
export const deleteProduct = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error('Invalid product ID format');
    }

    const product = await Product.findById(req.params.id);

    if (product) {
      const productSku = product.sku;
      const variantSkus = product.variantDetails ? product.variantDetails.map(vd => vd.sku) : [];
      await Product.deleteOne({ _id: req.params.id });

      // Auto-cleanup inventory mappings
      try {
        if (variantSkus.length > 0) {
          await Inventory.deleteMany({ sku: { $in: variantSkus } });
        }
        await Inventory.deleteMany({ sku: productSku });
      } catch (invErr) {
        console.error('Failed to auto-delete inventory items:', invErr.message);
      }

      res.status(200).json({ message: 'Product removed' });
    } else {
      res.status(404);
      throw new Error('Product not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Add a variant to a product
// @route   POST /api/products/:id/variants
// @access  Public
export const addVariantToProduct = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error('Invalid product ID format');
    }

    const { variantName, sku, qty, retailPrice, wholesalePrice, image, height, width, sqftPerPcs } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) {
      res.status(404);
      throw new Error('Product not found');
    }

    if (!sku || !sku.trim()) {
      res.status(400);
      throw new Error('Variant SKU is required');
    }

    // Check duplicate variant SKU
    if (product.variantDetails && product.variantDetails.some(v => v.sku.toLowerCase() === sku.trim().toLowerCase())) {
      res.status(400);
      throw new Error(`Variant SKU "${sku}" already exists on this product`);
    }

    const h = parseFloat(height) || 0;
    const w = parseFloat(width) || 0;
    const sq = (h > 0 && w > 0) ? (h * w) / 144 : (parseFloat(sqftPerPcs) || 0);

    const newVariant = {
      variantName: variantName || '',
      sku: sku.trim(),
      qty: parseInt(qty) || 0,
      retailPrice: parseFloat(retailPrice) || 0,
      wholesalePrice: parseFloat(wholesalePrice) || 0,
      height: h,
      width: w,
      sqftPerPcs: sq,
      image: image || ''
    };

    product.variantDetails.push(newVariant);

    // Update overall qty based on variants
    product.qty = product.variantDetails.reduce((sum, v) => sum + (parseInt(v.qty) || 0), 0);

    // Auto-update status based on new qty
    if (product.qty <= 0) {
      product.status = 'Out of Stock';
    } else if (product.status === 'Out of Stock') {
      product.status = 'Active';
    }

    const updatedProduct = await product.save();

    // Auto-create/update inventory item for the variant
    try {
      await Inventory.create({
        sku: newVariant.sku,
        name: product.name,
        category: product.category || 'General',
        warehouse: 'Main WH - A1',
        quantity: newVariant.qty,
        unitPrice: newVariant.retailPrice,
        status: newVariant.qty > 10 ? 'In Stock' : newVariant.qty > 0 ? 'Low Stock' : 'Out of Stock',
        variant: newVariant.variantName,
        srNo: product.srNo || 999999,
      });
    } catch (invErr) {
      console.error('Failed to auto-create inventory item for variant:', invErr.message);
    }

    res.status(201).json(updatedProduct);
  } catch (error) {
    next(error);
  }
};
