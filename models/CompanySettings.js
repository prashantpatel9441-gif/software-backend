import mongoose from 'mongoose';

const companySettingsSchema = new mongoose.Schema(
  {
    companyName: { type: String, default: '' },
    address: { type: String, default: '' },
    state: { type: String, default: '' },
    telephone: { type: String, default: '' },
    email: { type: String, default: '' },
    bankName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    branchIfsc: { type: String, default: '' },
    termsAndConditions: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

const CompanySettings = mongoose.model('CompanySettings', companySettingsSchema);
export default CompanySettings;
