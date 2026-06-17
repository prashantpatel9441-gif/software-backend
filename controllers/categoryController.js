import Category from '../models/Category.js';

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
    const { name, subCategories, productsCount, status } = req.body;
    const category = await Category.create({
      name,
      subCategories,
      productsCount,
      status,
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
    const category = await Category.findById(req.params.id);

    if (category) {
      category.name = req.body.name || category.name;
      category.subCategories = req.body.subCategories !== undefined ? req.body.subCategories : category.subCategories;
      category.productsCount = req.body.productsCount !== undefined ? req.body.productsCount : category.productsCount;
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
    const category = await Category.findById(req.params.id);

    if (category) {
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
