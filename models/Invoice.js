import mongoose from 'mongoose';

const invoiceItemSchema = new mongoose.Schema({
  product: {
    type: String,
    required: true,
  },
  variant: {
    type: String,
    default: '',
  },
  unit: {
    type: String,
    default: 'Pcs',
  },
  qty: {
    type: Number,
    required: true,
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
  totalSqft: {
    type: Number,
    default: 0,
  },
  pricePerSqft: {
    type: Number,
    default: 0,
  },
  price: {
    type: Number,
    required: true,
  },
  disc: {
    type: Number,
    default: 0,
  },
  tax: {
    type: Number,
    default: 0,
  },
  total: {
    type: Number,
    required: true,
  },
});


const invoiceSchema = new mongoose.Schema(
  {
    invoiceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    client: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    issueDate: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
    },
    payment: {
      type: String,
      enum: ['Paid', 'Pending', 'Partial', 'Overdue', 'Draft'],
      default: 'Pending',
    },
    delivery: {
      type: String,
      enum: ['Delivered', 'Dispatched', 'Processing', 'Cancelled'],
      default: 'Processing',
    },
    items: [invoiceItemSchema],
    subtotal: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    tax: {
      type: Number,
      default: 0,
    },
    otherCharge: {
      type: Number,
      default: 0,
    },
    roundOff: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
    },
    amountReceived: {
      type: Number,
      default: 0,
    },
    paymentStatus: {
      type: String,
      trim: true,
    },
    paymentMethod: {
      type: String,
      trim: true,
    },
    invoiceType: {
      type: String,
      trim: true,
    },
    documentNumber: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Invoice = mongoose.model('Invoice', invoiceSchema);

export default Invoice;
