import Category from '../models/Category.js';
import Product from '../models/Product.js';
import mongoose from 'mongoose';

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
export const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({}).sort({ createdAt: -1 });
    res.status(200).json(categories);
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new category
// @route   POST /api/categories
// @access  Public
export const createCategory = async (req, res, next) => {
  try {
    const { name, status } = req.body;
    const trimmedName = name ? name.trim() : '';

    if (!trimmedName) {
      res.status(400);
      throw new Error('Category name is required');
    }

    const existing = await Category.findOne({
      name: { $regex: new RegExp(`^${trimmedName}$`, 'i') }
    });
    if (existing) {
      res.status(400);
      throw new Error(`Category "${trimmedName}" already exists`);
    }

    const category = await Category.create({
      name: trimmedName,
      status: status || 'Active',
    });
    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
};

// @desc    Update a category
// @route   PUT /api/categories/:id
// @access  Public
export const updateCategory = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error('Invalid category ID format');
    }

    const category = await Category.findById(req.params.id);

    if (category) {
      if (req.body.name) {
        const trimmedName = req.body.name.trim();
        if (trimmedName.toLowerCase() !== category.name.toLowerCase()) {
          const duplicate = await Category.findOne({
            name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
            _id: { $ne: category._id }
          });
          if (duplicate) {
            res.status(400);
            throw new Error(`Category "${trimmedName}" already exists`);
          }
        }
        category.name = trimmedName;
      }

      category.status = req.body.status || category.status;

      const updatedCategory = await category.save();
      res.status(200).json(updatedCategory);
    } else {
      res.status(404);
      throw new Error('Category not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a category
// @route   DELETE /api/categories/:id
// @access  Public
export const deleteCategory = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error('Invalid category ID format');
    }

    const category = await Category.findById(req.params.id);

    if (category) {
      // Cascade check: prevent deletion if assigned to any products
      const productCount = await Product.countDocuments({
        category: { $regex: new RegExp(`^${category.name}$`, 'i') }
      });

      if (productCount > 0) {
        res.status(400);
        throw new Error(`Cannot delete category "${category.name}": it is assigned to ${productCount} product(s). Please reassign or delete those products first.`);
      }

      await Category.deleteOne({ _id: req.params.id });
      res.status(200).json({ message: 'Category removed' });
    } else {
      res.status(404);
      throw new Error('Category not found');
    }
  } catch (error) {
    next(error);
  }
};
