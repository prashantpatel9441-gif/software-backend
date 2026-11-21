import Collection from '../models/Collection.js';
import mongoose from 'mongoose';

// @desc    Get all collections
// @route   GET /api/collections
// @access  Public
export const getCollections = async (req, res, next) => {
  try {
    const collections = await Collection.find({}).sort({ createdAt: -1 });
    res.status(200).json(collections);
  } catch (error) {
    next(error);
  }
};

// @desc    Create a collection
// @route   POST /api/collections
// @access  Public
export const createCollection = async (req, res, next) => {
  try {
    const { name, description, status, theme } = req.body;
    const trimmedName = name ? name.trim() : '';

    if (!trimmedName) {
      res.status(400);
      throw new Error('Collection name is required');
    }

    const existing = await Collection.findOne({
      name: { $regex: new RegExp(`^${trimmedName}$`, 'i') }
    });
    if (existing) {
      res.status(400);
      throw new Error(`Collection "${trimmedName}" already exists`);
    }

    const collection = await Collection.create({
      name: trimmedName,
      description: description ? description.trim() : '',
      status: status || 'Active',
      theme: theme || 'pink',
    });
    res.status(201).json(collection);
  } catch (error) {
    next(error);
  }
};

// @desc    Update a collection
// @route   PUT /api/collections/:id
// @access  Public
export const updateCollection = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error('Invalid collection ID format');
    }

    const collection = await Collection.findById(req.params.id);

    if (collection) {
      if (req.body.name) {
        const trimmedName = req.body.name.trim();
        if (trimmedName.toLowerCase() !== collection.name.toLowerCase()) {
          const duplicate = await Collection.findOne({
            name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
            _id: { $ne: collection._id }
          });
          if (duplicate) {
            res.status(400);
            throw new Error(`Collection "${trimmedName}" already exists`);
          }
        }
        collection.name = trimmedName;
      }

      collection.description = req.body.description !== undefined ? req.body.description : collection.description;
      collection.status = req.body.status || collection.status;
      collection.theme = req.body.theme || collection.theme;

      const updatedCollection = await collection.save();
      res.status(200).json(updatedCollection);
    } else {
      res.status(404);
      throw new Error('Collection not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a collection
// @route   DELETE /api/collections/:id
// @access  Public
export const deleteCollection = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error('Invalid collection ID format');
    }

    const collection = await Collection.findById(req.params.id);

    if (collection) {
      await Collection.deleteOne({ _id: req.params.id });
      res.status(200).json({ message: 'Collection removed' });
    } else {
      res.status(404);
      throw new Error('Collection not found');
    }
  } catch (error) {
    next(error);
  }
};
