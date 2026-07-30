import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      default: '',
    },
    variants: [
      {
        group: { type: String, required: true },
        options: { type: [String], default: [] },
      }
    ],
    variantDetails: [
      {
        variantName: { type: String, required: true },
        image: { type: String, default: '' },
        sku: { type: String, required: true },
        qty: { type: Number, default: 0 },
        retailPrice: { type: Number, default: 0 },
        wholesalePrice: { type: Number, default: 0 },
        height: { type: Number, default: 0 },
        width: { type: Number, default: 0 },
        sqftPerPcs: { type: Number, default: 0 },
      }
    ],

    unit: {
      type: String,
      default: 'Pcs',
    },
    sku: {
      type: String,
      required: true,
      trim: true,
    },
    vendor: {
      type: String,
      required: true,
      trim: true,
    },
    qty: {
      type: Number,
      default: 0,
    },
    wholesalePrice: {
      type: Number,
      default: 0,
    },
    retailPrice: {
      type: Number,
      default: 0,
    },
    height: {
      type: Number,
      default: 0,
    },
    width: {
      type: Number,
      default: 0,
    },
    sqftPerPcs: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['Active', 'Out of Stock', 'Inactive'],
      default: 'Active',
    },
    srNo: {
      type: Number,
      default: 999999,
    },
  },

  {
    timestamps: true,
  }
);

const Product = mongoose.model('Product', productSchema);

export default Product;
