import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    options: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const Variant = mongoose.model('Variant', variantSchema);

export default Variant;
