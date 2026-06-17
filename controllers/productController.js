import Product from '../models/Product.js';
import Inventory from '../models/Inventory.js';

// @desc    Get all products
// @route   GET /api/products
// @access  Public
export const getProducts = async (req, res, next) => {
  try {
    const products = await Product.find({}).sort({ createdAt: -1 });
    res.status(200).json(products);
  } catch (error) {
    next(error);
  }
};

// @desc    Create a product
// @route   POST /api/products
// @access  Public
export const createProduct = async (req, res, next) => {
  try {
    const { name, image, category, variants, variantDetails, unit, sku, vendor, qty, wholesalePrice, retailPrice, status } = req.body;
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
      status,
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
      product.retailPrice = req.body.retailPrice !== undefined ? req.body.retailPrice : product.retailPrice;
      product.status = req.body.status || product.status;

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
