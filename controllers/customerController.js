import Customer from '../models/Customer.js';
import CustomerPricing from '../models/CustomerPricing.js';
import Invoice from '../models/Invoice.js';
import mongoose from 'mongoose';

// @desc    Get all customers (with optional search)
// @route   GET /api/customers
// @access  Private
export const getCustomers = async (req, res) => {
  try {
    const search = req.query.search ? String(req.query.search).trim() : '';
    let query = {};

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { code: { $regex: escaped, $options: 'i' } },
        { mobile: { $regex: escaped, $options: 'i' } },
        { company: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
      ];
    }

    const customers = await Customer.find(query).sort({ createdAt: -1 });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch customers', error: error.message });
  }
};

// @desc    Create new customer
// @route   POST /api/customers
// @access  Private
export const createCustomer = async (req, res) => {
  try {
    const {
      name, company, mobile, altMobile, email, gst, pan,
      address, city, state, pincode, type, status, labels, notes
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Customer name is required' });
    }

    if (!mobile || !mobile.trim()) {
      return res.status(400).json({ message: 'Mobile number is required' });
    }

    const cleanMobile = mobile.trim();
    const cleanEmail = email ? email.trim().toLowerCase() : '';
    const cleanGst = gst ? gst.trim().toUpperCase() : '';

    // Check duplicate mobile
    const mobileExists = await Customer.findOne({ mobile: cleanMobile });
    if (mobileExists) {
      return res.status(400).json({ message: 'Mobile Number already exists' });
    }

    // Check duplicate email
    if (cleanEmail) {
      const emailExists = await Customer.findOne({ email: cleanEmail });
      if (emailExists) {
        return res.status(400).json({ message: 'Email already exists' });
      }
    }

    // Check duplicate GST
    if (cleanGst) {
      const gstExists = await Customer.findOne({ gst: cleanGst });
      if (gstExists) {
        return res.status(400).json({ message: 'GST Number already exists' });
      }
    }

    // Collision-free code generation
    let count = await Customer.countDocuments();
    let code = `CUST-${String(count + 1).padStart(3, '0')}`;
    let codeExists = await Customer.findOne({ code });
    let inc = 1;
    while (codeExists) {
      code = `CUST-${String(count + 1 + inc).padStart(3, '0')}`;
      codeExists = await Customer.findOne({ code });
      inc++;
    }

    const customer = await Customer.create({
      code,
      name: name.trim(),
      company: company ? company.trim() : '',
      mobile: cleanMobile,
      altMobile: altMobile ? altMobile.trim() : '',
      email: cleanEmail,
      gst: cleanGst,
      pan: pan ? pan.trim().toUpperCase() : '',
      address: address ? address.trim() : '',
      city: city ? city.trim() : '',
      state: state ? state.trim() : '',
      pincode: pincode ? pincode.trim() : '',
      type: type || 'Retail',
      status: status || 'Active',
      labels: Array.isArray(labels) ? labels : [],
      notes: notes ? notes.trim() : '',
    });

    res.status(201).json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create customer', error: error.message });
  }
};

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Private
export const updateCustomer = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid customer ID format' });
    }

    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Check duplicate mobile if updated
    if (req.body.mobile) {
      const cleanMobile = req.body.mobile.trim();
      if (cleanMobile !== customer.mobile) {
        const mobileExists = await Customer.findOne({ mobile: cleanMobile, _id: { $ne: customer._id } });
        if (mobileExists) {
          return res.status(400).json({ message: 'Mobile Number is already used by another customer' });
        }
        customer.mobile = cleanMobile;
      }
    }

    // Check duplicate email if updated
    if (req.body.email !== undefined) {
      const cleanEmail = req.body.email ? req.body.email.trim().toLowerCase() : '';
      if (cleanEmail && cleanEmail !== customer.email) {
        const emailExists = await Customer.findOne({ email: cleanEmail, _id: { $ne: customer._id } });
        if (emailExists) {
          return res.status(400).json({ message: 'Email is already used by another customer' });
        }
      }
      customer.email = cleanEmail;
    }

    // Check duplicate GST if updated
    if (req.body.gst !== undefined) {
      const cleanGst = req.body.gst ? req.body.gst.trim().toUpperCase() : '';
      if (cleanGst && cleanGst !== customer.gst) {
        const gstExists = await Customer.findOne({ gst: cleanGst, _id: { $ne: customer._id } });
        if (gstExists) {
          return res.status(400).json({ message: 'GST Number is already used by another customer' });
        }
      }
      customer.gst = cleanGst;
    }

    const otherFields = [
      'name', 'company', 'altMobile', 'pan',
      'address', 'city', 'state', 'pincode', 'type', 'status', 'labels', 'notes'
    ];

    otherFields.forEach(field => {
      if (req.body[field] !== undefined) {
        customer[field] = req.body[field];
      }
    });

    const updatedCustomer = await customer.save();
    res.json(updatedCustomer);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update customer', error: error.message });
  }
};

// @desc    Delete customer
// @route   DELETE /api/customers/:id
// @access  Private
export const deleteCustomer = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid customer ID format' });
    }

    const customer = await Customer.findById(req.params.id);

    if (customer) {
      await customer.deleteOne();
      await CustomerPricing.deleteMany({ customer: customer._id });
      res.json({ message: 'Customer removed' });
    } else {
      res.status(404).json({ message: 'Customer not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete customer', error: error.message });
  }
};

// @desc    Get customer pricing
// @route   GET /api/customers/:id/pricing
// @access  Private
export const getCustomerPricing = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid customer ID format' });
    }

    const pricing = await CustomerPricing.find({ customer: req.params.id });
    res.json(pricing);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch pricing', error: error.message });
  }
};
