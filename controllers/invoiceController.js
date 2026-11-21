import Invoice from '../models/Invoice.js';
import Product from '../models/Product.js';
import Inventory from '../models/Inventory.js';

// Helper function to restore stock when invoice is deleted or cancelled
const restoreInvoiceStock = async (items) => {
  if (!Array.isArray(items)) return;

  for (const item of items) {
    const qty = Math.max(0, parseInt(item.qty) || 0);
    if (qty === 0) continue;

    // 1. Restore Product stock
    const product = await Product.findOne({
      $or: [
        { name: item.product },
        { sku: item.product },
        { 'variantDetails.sku': item.product }
      ]
    });

    if (product) {
      if (item.variant && product.variantDetails && product.variantDetails.length > 0) {
        const vd = product.variantDetails.find(v => v.variantName === item.variant || v.sku === item.product);
        if (vd) {
          vd.qty = (vd.qty || 0) + qty;
        }
        product.qty = product.variantDetails.reduce((sum, v) => sum + (parseInt(v.qty) || 0), 0);
      } else {
        product.qty = (product.qty || 0) + qty;
      }

      if (product.qty > 0 && product.status === 'Out of Stock') {
        product.status = 'Active';
      }
      await product.save();
    }

    // 2. Restore Inventory stock
    const invQuery = {
      $or: [
        { sku: item.product },
        { name: item.product }
      ]
    };
    if (item.variant) invQuery.variant = item.variant;

    const invItem = await Inventory.findOne(invQuery);
    if (invItem) {
      invItem.quantity = (invItem.quantity || 0) + qty;
      if (invItem.quantity > 10) invItem.status = 'In Stock';
      else if (invItem.quantity > 0) invItem.status = 'Low Stock';
      await invItem.save();
    }
  }
};

// @desc    Get all invoices
// @route   GET /api/invoices
// @access  Public
export const getInvoices = async (req, res, next) => {
  try {
    const invoices = await Invoice.find({}).sort({ issueDate: -1, createdAt: -1 });
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
      throw new Error(`Invoice with ID "${req.params.invoiceId}" not found`);
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
      otherCharge,
      roundOff,
      grandTotal,
      previousBalance,
      netPayable,
      amountReceived,
      paymentStatus,
      paymentMethod,
      invoiceType,
      documentNumber,
      notes,
    } = req.body;

    if (!invoiceId || !invoiceId.trim()) {
      res.status(400);
      throw new Error('Invoice ID is required');
    }

    if (!client || !client.trim()) {
      res.status(400);
      throw new Error('Client name is required');
    }

    const cleanInvoiceId = invoiceId.trim();
    const exists = await Invoice.findOne({ invoiceId: cleanInvoiceId });
    if (exists) {
      res.status(400);
      throw new Error(`An invoice with ID "${cleanInvoiceId}" already exists`);
    }

    const numSubtotal = parseFloat(subtotal) || 0;
    const numDiscount = parseFloat(discount) || 0;
    const numTax = parseFloat(tax) || 0;
    const numOtherCharge = parseFloat(otherCharge) || 0;
    const numRoundOff = parseFloat(roundOff) || 0;
    const numGrandTotal = parseFloat(grandTotal) || (numSubtotal - numDiscount + numTax + numOtherCharge + numRoundOff);
    const numPrevBalance = parseFloat(previousBalance) || 0;
    const numNetPayable = netPayable !== undefined ? (parseFloat(netPayable) || 0) : (numGrandTotal + numPrevBalance);
    const numAmountReceived = parseFloat(amountReceived) || 0;

    // Determine payment status cleanly
    let finalPayment = payment;
    let finalPaymentStatus = paymentStatus;

    if (!finalPayment || finalPayment === 'Pending' || finalPayment === 'Partial' || finalPayment === 'Paid') {
      if (numAmountReceived >= numNetPayable && numNetPayable > 0) {
        finalPayment = 'Paid';
        finalPaymentStatus = 'Paid';
      } else if (numAmountReceived > 0) {
        finalPayment = 'Partial';
        finalPaymentStatus = 'Partial';
      } else {
        finalPayment = 'Pending';
        finalPaymentStatus = 'Pending';
      }
    }

    const invoice = await Invoice.create({
      invoiceId: cleanInvoiceId,
      client: client.trim(),
      phone: phone ? phone.trim() : '',
      address: address ? address.trim() : '',
      issueDate: issueDate || new Date(),
      dueDate,
      payment: finalPayment,
      delivery: delivery || 'Processing',
      items: Array.isArray(items) ? items : [],
      subtotal: numSubtotal,
      discount: numDiscount,
      tax: numTax,
      otherCharge: numOtherCharge,
      roundOff: numRoundOff,
      grandTotal: numGrandTotal,
      previousBalance: numPrevBalance,
      netPayable: numNetPayable,
      amountReceived: numAmountReceived,
      paymentStatus: finalPaymentStatus,
      paymentMethod: paymentMethod ? paymentMethod.trim() : '',
      invoiceType: invoiceType ? invoiceType.trim() : '',
      documentNumber: documentNumber ? documentNumber.trim() : '',
      notes: notes ? notes.trim() : '',
    });

    // Decrement quantities from Product and Inventory collections
    if (Array.isArray(items)) {
      for (const item of items) {
        const itemQty = Math.max(0, parseInt(item.qty) || 0);
        if (itemQty === 0) continue;

        // 1. Decrement from Product collection
        const product = await Product.findOne({
          $or: [
            { name: item.product },
            { sku: item.product },
            { 'variantDetails.sku': item.product }
          ]
        });

        if (product) {
          if (item.variant && product.variantDetails && product.variantDetails.length > 0) {
            const vDetail = product.variantDetails.find(v => v.variantName === item.variant || v.sku === item.product);
            if (vDetail) {
              vDetail.qty = Math.max(0, (vDetail.qty || 0) - itemQty);
            }
            product.qty = product.variantDetails.reduce((sum, v) => sum + (parseInt(v.qty) || 0), 0);
          } else {
            product.qty = Math.max(0, (product.qty || 0) - itemQty);
          }

          if (product.qty === 0) {
            product.status = 'Out of Stock';
          }
          await product.save();
        }

        // 2. Decrement from Inventory collection
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
          invItem.quantity = Math.max(0, (invItem.quantity || 0) - itemQty);
          if (invItem.quantity === 0) {
            invItem.status = 'Out of Stock';
          } else if (invItem.quantity <= 10) {
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

    if (!invoice) {
      res.status(404);
      throw new Error(`Invoice with ID "${req.params.invoiceId}" not found`);
    }

    // Restore stock if invoice was not cancelled
    if (invoice.delivery !== 'Cancelled' && invoice.payment !== 'Cancelled') {
      try {
        await restoreInvoiceStock(invoice.items);
      } catch (stockErr) {
        console.error('Failed to restore stock on invoice deletion:', stockErr.message);
      }
    }

    await Invoice.deleteOne({ invoiceId: req.params.invoiceId });
    res.status(200).json({ message: 'Invoice removed and stock restored' });
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
      throw new Error(`Invoice with ID "${req.params.invoiceId}" not found`);
    }

    // Check if transitioning to Cancelled: restore stock
    const wasCancelled = invoice.delivery === 'Cancelled' || invoice.payment === 'Cancelled';
    const isNowCancelled = req.body.delivery === 'Cancelled' || req.body.payment === 'Cancelled';

    if (!wasCancelled && isNowCancelled) {
      try {
        await restoreInvoiceStock(invoice.items);
      } catch (stockErr) {
        console.error('Failed to restore stock on invoice cancellation:', stockErr.message);
      }
    }

    const allowedFields = [
      'delivery', 'payment', 'paymentStatus', 'paymentMethod',
      'amountReceived', 'notes', 'dueDate', 'client', 'phone', 'address',
      'invoiceType', 'documentNumber', 'previousBalance', 'netPayable',
      'otherCharge', 'roundOff', 'subtotal', 'discount', 'tax', 'grandTotal'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        invoice[field] = req.body[field];
      }
    });

    // Auto-update payment status if amountReceived changed and not cancelled
    if (req.body.amountReceived !== undefined && !isNowCancelled) {
      const received = parseFloat(invoice.amountReceived) || 0;
      const totalDue = parseFloat(invoice.netPayable || invoice.grandTotal) || 0;
      if (received >= totalDue && totalDue > 0) {
        invoice.payment = 'Paid';
        invoice.paymentStatus = 'Paid';
      } else if (received > 0) {
        invoice.payment = 'Partial';
        invoice.paymentStatus = 'Partial';
      } else {
        invoice.payment = 'Pending';
        invoice.paymentStatus = 'Pending';
      }
    }

    const updated = await invoice.save();
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};
