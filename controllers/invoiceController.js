import Invoice from '../models/Invoice.js';
import Product from '../models/Product.js';
import Inventory from '../models/Inventory.js';

// @desc    Get all invoices
// @route   GET /api/invoices
// @access  Public
export const getInvoices = async (req, res, next) => {
  try {
    const invoices = await Invoice.find({}).sort({ issueDate: -1 });
    res.status(200).json(invoices);
  } catch (error) {
    next(error);
  }
};

// @desc    Get single invoice by invoiceId
// @route   GET /api/invoices/:invoiceId
// @access  Public
export const getInvoiceById = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ invoiceId: req.params.invoiceId });
    if (invoice) {
      res.status(200).json(invoice);
    } else {
      res.status(404);
      throw new Error('Invoice not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new invoice
// @route   POST /api/invoices
// @access  Public
export const createInvoice = async (req, res, next) => {
  try {
    const {
      invoiceId,
      client,
      phone,
      address,
      issueDate,
      dueDate,
      payment,
      delivery,
      items,
      subtotal,
      discount,
      tax,
      grandTotal,
      amountReceived,
      paymentStatus,
      paymentMethod,
      invoiceType,
      documentNumber,
      notes,
    } = req.body;

    const exists = await Invoice.findOne({ invoiceId });
    if (exists) {
      res.status(400);
      throw new Error('An invoice with this ID already exists');
    }

    const invoice = await Invoice.create({
      invoiceId,
      client,
      phone,
      address,
      issueDate,
      dueDate,
      payment,
      delivery,
      items,
      subtotal,
      discount,
      tax,
      grandTotal,
      amountReceived,
      paymentStatus,
      paymentMethod,
      invoiceType,
      documentNumber,
      notes,
    });

    // Decrement quantities from Product and Inventory collections
    if (Array.isArray(items)) {
      for (const item of items) {
        // 1. Decrement from Product collection (search by name, barcode, or sku)
        const product = await Product.findOne({
          $or: [
            { name: item.product },
            { barcode: item.product },
            { sku: item.product }
          ]
        });

        if (product) {
          if (item.variant && product.variantDetails) {
            const vDetail = product.variantDetails.find(v => v.variantName === item.variant);
            if (vDetail) {
              vDetail.qty = Math.max(0, vDetail.qty - item.qty);
            }
          }
          product.qty = Math.max(0, product.qty - item.qty);
          if (product.qty === 0) {
            product.status = 'Out of Stock';
          }
          await product.save();
        }

        // 2. Decrement from Inventory collection (search by SKU or name, and match variant if present)
        const invQuery = {
          $or: [
            { sku: item.product },
            { name: item.product }
          ]
        };
        
        if (item.variant) {
          invQuery.variant = item.variant;
        }

        const invItem = await Inventory.findOne(invQuery);

        if (invItem) {
          invItem.quantity = Math.max(0, invItem.quantity - item.qty);
          if (invItem.quantity === 0) {
            invItem.status = 'Out of Stock';
          } else if (invItem.quantity <= 15) {
            invItem.status = 'Low Stock';
          }
          await invItem.save();
        }
      }
    }

    res.status(201).json(invoice);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete an invoice by invoiceId
// @route   DELETE /api/invoices/:invoiceId
// @access  Public
export const deleteInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ invoiceId: req.params.invoiceId });

    if (invoice) {
      await Invoice.deleteOne({ invoiceId: req.params.invoiceId });
      res.status(200).json({ message: 'Invoice removed' });
    } else {
      res.status(404);
      throw new Error('Invoice not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Update an invoice (delivery status, payment, notes etc)
// @route   PUT /api/invoices/:invoiceId
// @access  Public
export const updateInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ invoiceId: req.params.invoiceId });

    if (!invoice) {
      res.status(404);
      throw new Error('Invoice not found');
    }

    // Only update fields that are provided in the request body
    const allowedFields = [
      'delivery', 'payment', 'paymentStatus', 'paymentMethod',
      'amountReceived', 'notes', 'dueDate', 'client', 'phone', 'address',
      'invoiceType', 'documentNumber'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        invoice[field] = req.body[field];
      }
    });

    const updated = await invoice.save();
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};
