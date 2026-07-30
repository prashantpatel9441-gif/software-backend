import CompanySettings from '../models/CompanySettings.js';

// @desc    Get company settings
// @route   GET /api/settings
// @access  Public
export const getSettings = async (req, res) => {
  try {
    let settings = await CompanySettings.findOne();
    if (!settings) {
      // Create default settings if none exist
      settings = await CompanySettings.create({});
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update company settings
// @route   PUT /api/settings
// @access  Public
export const updateSettings = async (req, res) => {
  try {
    let settings = await CompanySettings.findOne();
    
    if (settings) {
      settings.companyName = req.body.companyName !== undefined ? req.body.companyName : settings.companyName;
      settings.address = req.body.address !== undefined ? req.body.address : settings.address;
      settings.state = req.body.state !== undefined ? req.body.state : settings.state;
      settings.telephone = req.body.telephone !== undefined ? req.body.telephone : settings.telephone;
      settings.email = req.body.email !== undefined ? req.body.email : settings.email;
      settings.gstNumber = req.body.gstNumber !== undefined ? req.body.gstNumber : settings.gstNumber;
      settings.logo = req.body.logo !== undefined ? req.body.logo : settings.logo;
      settings.bankName = req.body.bankName !== undefined ? req.body.bankName : settings.bankName;
      settings.accountNumber = req.body.accountNumber !== undefined ? req.body.accountNumber : settings.accountNumber;
      settings.branchIfsc = req.body.branchIfsc !== undefined ? req.body.branchIfsc : settings.branchIfsc;
      settings.termsAndConditions = req.body.termsAndConditions !== undefined ? req.body.termsAndConditions : settings.termsAndConditions;
      settings.notes = req.body.notes !== undefined ? req.body.notes : settings.notes;

      const updatedSettings = await settings.save();
      res.json(updatedSettings);
    } else {
      const newSettings = await CompanySettings.create(req.body);
      res.status(201).json(newSettings);
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

