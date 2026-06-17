import Variant from '../models/Variant.js';

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
    const variant = await Variant.create({
      name,
      options,
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
    const variant = await Variant.findById(req.params.id);

    if (variant) {
      variant.name = req.body.name || variant.name;
      variant.options = req.body.options !== undefined ? req.body.options : variant.options;

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
