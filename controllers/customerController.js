import Customer from '../models/Customer.js';
import CustomerPricing from '../models/CustomerPricing.js';
import Invoice from '../models/Invoice.js';

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private
export const getCustomers = async (req, res) => {
  try {
    const customers = await Customer.find({}).sort({ createdAt: -1 });
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

    // Check duplicates
    const mobileExists = await Customer.findOne({ mobile });
    if (mobileExists) return res.status(400).json({ message: 'Mobile Number already exists' });

    if (email) {
      const emailExists = await Customer.findOne({ email });
      if (emailExists) return res.status(400).json({ message: 'Email already exists' });
    }

    if (gst) {
      const gstExists = await Customer.findOne({ gst });
      if (gstExists) return res.status(400).json({ message: 'GST Number already exists' });
    }

    // Generate Code
    const count = await Customer.countDocuments();
    const code = `CUST-${String(count + 1).padStart(3, '0')}`;

    const customer = await Customer.create({
      code, name, company, mobile, altMobile, email, gst, pan,
      address, city, state, pincode, type, status, labels, notes
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
    const customer = await Customer.findById(req.params.id);

    if (customer) {
      const fields = [
        'name', 'company', 'mobile', 'altMobile', 'email', 'gst', 'pan',
        'address', 'city', 'state', 'pincode', 'type', 'status', 'labels', 'notes'
      ];
      
      fields.forEach(field => {
        if (req.body[field] !== undefined) {
          customer[field] = req.body[field];
        }
      });

      const updatedCustomer = await customer.save();
      res.json(updatedCustomer);
    } else {
      res.status(404).json({ message: 'Customer not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Failed to update customer', error: error.message });
  }
};

// @desc    Delete customer
// @route   DELETE /api/customers/:id
// @access  Private
export const deleteCustomer = async (req, res) => {
  try {
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
    const pricing = await CustomerPricing.find({ customer: req.params.id });
    res.json(pricing);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch pricing', error: error.message });
  }
};
