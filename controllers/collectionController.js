import Collection from '../models/Collection.js';

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
    const collection = await Collection.create({
      name,
      description,
      status,
      theme,
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
    const collection = await Collection.findById(req.params.id);

    if (collection) {
      collection.name = req.body.name || collection.name;
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
