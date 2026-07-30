import Product from '../models/Product.js';
import Inventory from '../models/Inventory.js';

// @desc    Get all products (with pagination & filters)
// @route   GET /api/products
// @access  Public
export const getProducts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = {};

    if (req.query.search) {
      query.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { sku: { $regex: req.query.search, $options: 'i' } }
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
      totalPages: Math.ceil(totalItems / limit),
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
    let { name, image, category, variants, variantDetails, unit, sku, vendor, qty, wholesalePrice, retailPrice, status, srNo, height, width, sqftPerPcs } = req.body;
    
    const h = parseFloat(height) || 0;
    const w = parseFloat(width) || 0;
    const computedSqft = (h > 0 && w > 0) ? (h * w) / 144 : (parseFloat(sqftPerPcs) || 0);

    // Auto-update status based on qty
    if (qty === 0 || qty === '0') {
      status = 'Out of Stock';
    } else if (status === 'Out of Stock') {
      status = 'Active';
    }
    // Check if srNo is unique
    if (srNo && srNo !== 999999) {
      const existingProduct = await Product.findOne({ srNo });
      if (existingProduct) {
        res.status(400);
        throw new Error(`Serial Number ${srNo} is already in use by product: ${existingProduct.name}`);
      }
    }

    const product = await Product.create({
      name,
      image,
      category,
      variants,
      variantDetails,
      unit,
      sku,
      vendor,
      qty,
      wholesalePrice,
      retailPrice,
      height: h,
      width: w,
      sqftPerPcs: computedSqft,
      status,
      srNo,
    });

    // Auto-create initial inventory items
    try {
      if (variantDetails && variantDetails.length > 0) {
        for (const detail of variantDetails) {
          await Inventory.create({
            sku: detail.sku,
            name: product.name,
            category: product.category || 'General',
            warehouse: 'Main WH - A1',
            quantity: detail.qty || 0,
            unitPrice: detail.retailPrice || 0,
            status: (detail.qty || 0) > 0 ? 'In Stock' : 'Out of Stock',
            variant: detail.variantName
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
          status: (product.qty || 0) > 0 ? 'In Stock' : 'Out of Stock',
          variant: ''
        });
      }
    } catch (invErr) {
      console.error('Failed to auto-create inventory item for product:', invErr);
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
    const product = await Product.findById(req.params.id);

    if (product) {
      product.name = req.body.name || product.name;
      product.image = req.body.image !== undefined ? req.body.image : product.image;
      product.category = req.body.category || product.category;
      product.variants = req.body.variants !== undefined ? req.body.variants : product.variants;
      product.variantDetails = req.body.variantDetails !== undefined ? req.body.variantDetails : product.variantDetails;
      product.unit = req.body.unit || product.unit;
      product.sku = req.body.sku || product.sku;
      product.vendor = req.body.vendor || product.vendor;
      product.qty = req.body.qty !== undefined ? req.body.qty : product.qty;
      product.wholesalePrice = req.body.wholesalePrice !== undefined ? req.body.wholesalePrice : product.wholesalePrice;
      product.height = req.body.height !== undefined ? parseFloat(req.body.height) || 0 : product.height;
      product.width = req.body.width !== undefined ? parseFloat(req.body.width) || 0 : product.width;
      if (product.height > 0 && product.width > 0) {
        product.sqftPerPcs = (product.height * product.width) / 144;
      } else if (req.body.sqftPerPcs !== undefined) {
        product.sqftPerPcs = parseFloat(req.body.sqftPerPcs) || 0;
      }
      if (req.body.srNo !== undefined && req.body.srNo !== 999999 && req.body.srNo !== product.srNo) {
        const existingProduct = await Product.findOne({ srNo: req.body.srNo, _id: { $ne: product._id } });
        if (existingProduct) {
          res.status(400);
          throw new Error(`Serial Number ${req.body.srNo} is already in use by product: ${existingProduct.name}`);
        }
      }

      product.retailPrice = req.body.retailPrice !== undefined ? req.body.retailPrice : product.retailPrice;
      product.srNo = req.body.srNo !== undefined ? req.body.srNo : product.srNo;

      
      let incomingStatus = req.body.status || product.status;
      if (product.qty === 0 || product.qty === '0') {
        incomingStatus = 'Out of Stock';
      } else if (incomingStatus === 'Out of Stock') {
        incomingStatus = 'Active';
      }
      product.status = incomingStatus;

      const updatedProduct = await product.save();

      // Sync inventory for variant details updates (simple approach)
      try {
        if (req.body.variantDetails && req.body.variantDetails.length > 0) {
          for (const detail of req.body.variantDetails) {
            await Inventory.updateOne(
              { sku: detail.sku },
              {
                $set: {
                  name: updatedProduct.name,
                  category: updatedProduct.category || 'General',
                  quantity: detail.qty,
                  unitPrice: detail.retailPrice,
                  status: detail.qty > 0 ? 'In Stock' : 'Out of Stock',
                  variant: detail.variantName
                }
              },
              { upsert: true }
            );
          }
        } else if (req.body.sku) {
          await Inventory.updateOne(
            { sku: updatedProduct.sku },
            {
              $set: {
                name: updatedProduct.name,
                category: updatedProduct.category || 'General',
                quantity: updatedProduct.qty,
                unitPrice: updatedProduct.retailPrice,
                status: updatedProduct.qty > 0 ? 'In Stock' : 'Out of Stock'
              }
            },
            { upsert: true }
          );
        }
      } catch (invErr) {
        console.error('Failed to update inventory items:', invErr);
      }

      res.status(200).json(updatedProduct);
    } else {
      res.status(404);
      throw new Error('Product not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Public
export const deleteProduct = async (req, res, next) => {
  try {
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
        console.error('Failed to auto-delete inventory items:', invErr);
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
    const { variantName, sku, qty, retailPrice, wholesalePrice, image, height, width, sqftPerPcs } = req.body;
    const product = await Product.findById(req.params.id);

    if (product) {
      const h = parseFloat(height) || 0;
      const w = parseFloat(width) || 0;
      const sq = (h > 0 && w > 0) ? (h * w) / 144 : (parseFloat(sqftPerPcs) || 0);

      const newVariant = {
        variantName,
        sku,
        qty: qty || 0,
        retailPrice: retailPrice || 0,
        wholesalePrice: wholesalePrice || 0,
        height: h,
        width: w,
        sqftPerPcs: sq,
        image: image || ''
      };

      product.variantDetails.push(newVariant);

      
      // Update overall qty based on variants
      product.qty = product.variantDetails.reduce((sum, v) => sum + (parseInt(v.qty) || 0), 0);

      // Auto-update status based on new qty
      if (product.qty === 0 || product.qty === '0') {
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
          status: newVariant.qty > 0 ? 'In Stock' : 'Out of Stock',
          variant: newVariant.variantName
        });
      } catch (invErr) {
        console.error('Failed to auto-create inventory item for variant:', invErr);
      }

      res.status(201).json(updatedProduct);
    } else {
      res.status(404);
      throw new Error('Product not found');
    }
  } catch (error) {
    next(error);
  }
};
