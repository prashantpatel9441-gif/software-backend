import Variant from '../models/Variant.js';
import mongoose from 'mongoose';

// @desc    Get all variants
// @route   GET /api/variants
// @access  Public
export const getVariants = async (req, res, next) => {
  try {
    const variants = await Variant.find({}).sort({ createdAt: -1 });
    res.status(200).json(variants);
  } catch (error) {
    next(error);
  }
};

// @desc    Create a variant
// @route   POST /api/variants
// @access  Public
export const createVariant = async (req, res, next) => {
  try {
    const { name, options } = req.body;
    const trimmedName = name ? name.trim() : '';

    if (!trimmedName) {
      res.status(400);
      throw new Error('Variant group name is required');
    }

    const existing = await Variant.findOne({
      name: { $regex: new RegExp(`^${trimmedName}$`, 'i') }
    });
    if (existing) {
      res.status(400);
      throw new Error(`Variant "${trimmedName}" already exists`);
    }

    const cleanOptions = Array.isArray(options)
      ? options.map(o => (typeof o === 'string' ? o.trim() : String(o))).filter(Boolean)
      : [];

    const variant = await Variant.create({
      name: trimmedName,
      options: cleanOptions,
    });
    res.status(201).json(variant);
  } catch (error) {
    next(error);
  }
};

// @desc    Update a variant
// @route   PUT /api/variants/:id
// @access  Public
export const updateVariant = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error('Invalid variant ID format');
    }

    const variant = await Variant.findById(req.params.id);

    if (variant) {
      if (req.body.name) {
        const trimmedName = req.body.name.trim();
        if (trimmedName.toLowerCase() !== variant.name.toLowerCase()) {
          const duplicate = await Variant.findOne({
            name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
            _id: { $ne: variant._id }
          });
          if (duplicate) {
            res.status(400);
            throw new Error(`Variant "${trimmedName}" already exists`);
          }
        }
        variant.name = trimmedName;
      }

      if (req.body.options !== undefined) {
        variant.options = Array.isArray(req.body.options)
          ? req.body.options.map(o => (typeof o === 'string' ? o.trim() : String(o))).filter(Boolean)
          : variant.options;
      }

      const updatedVariant = await variant.save();
      res.status(200).json(updatedVariant);
    } else {
      res.status(404);
      throw new Error('Variant not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a variant
// @route   DELETE /api/variants/:id
// @access  Public
export const deleteVariant = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error('Invalid variant ID format');
    }

    const variant = await Variant.findById(req.params.id);

    if (variant) {
      await Variant.deleteOne({ _id: req.params.id });
      res.status(200).json({ message: 'Variant removed' });
    } else {
      res.status(404);
      throw new Error('Variant not found');
    }
  } catch (error) {
    next(error);
  }
};
