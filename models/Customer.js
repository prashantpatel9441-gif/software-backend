import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  company: {
    type: String,
    trim: true,
    default: ''
  },
  mobile: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  altMobile: {
    type: String,
    trim: true,
    default: ''
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: ''
  },
  gst: {
    type: String,
    trim: true,
    uppercase: true,
    default: ''
  },
  pan: {
    type: String,
    trim: true,
    uppercase: true,
    default: ''
  },
  address: {
    type: String,
    trim: true,
    default: ''
  },
  city: {
    type: String,
    trim: true,
    default: ''
  },
  state: {
    type: String,
    trim: true,
    default: ''
  },
  pincode: {
    type: String,
    trim: true,
    default: ''
  },
  type: {
    type: String,
    enum: ['Retail', 'Wholesale', 'Distributor', 'Corporate'],
    default: 'Retail'
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  labels: [{
    type: String
  }],
  notes: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

const Customer = mongoose.model('Customer', customerSchema);
export default Customer;
