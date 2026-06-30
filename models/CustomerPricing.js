import mongoose from 'mongoose';

const customerPricingSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  lastPrice: {
    type: Number,
    required: true
  },
  averagePrice: {
    type: Number,
    required: true
  },
  highestPrice: {
    type: Number,
    required: true
  },
  lowestPrice: {
    type: Number,
    required: true
  },
  lastInvoiceId: {
    type: String
  },
  lastPurchaseDate: {
    type: Date
  },
  totalQuantity: {
    type: Number,
    default: 0
  },
  totalOrders: {
    type: Number,
    default: 0
  },
  allPrices: [{
    type: Number
  }]
}, {
  timestamps: true
});

// Ensure a customer only has one pricing record per product
customerPricingSchema.index({ customer: 1, productName: 1 }, { unique: true });

const CustomerPricing = mongoose.model('CustomerPricing', customerPricingSchema);
export default CustomerPricing;
