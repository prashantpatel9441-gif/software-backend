import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './models/Product.js';
import Inventory from './models/Inventory.js';

dotenv.config();

const migrate = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const products = await Product.find({});
    let added = 0;

    for (const prod of products) {
      // check if it exists in inventory by baseSku or sku
      const exists = await Inventory.findOne({ $or: [{ baseSku: prod.sku }, { sku: prod.sku }] });
      if (!exists) {
        await Inventory.create({
          sku: prod.sku,
          baseSku: prod.sku,
          name: prod.name,
          category: prod.category || 'General',
          warehouse: 'Main WH - A1',
          quantity: prod.qty || 0,
          unitPrice: prod.retailPrice || 0,
          status: (prod.qty || 0) > 0 ? 'In Stock' : 'Out of Stock',
          variant: ''
        });
        added++;
        console.log(`Added missing inventory for: ${prod.name}`);
      }
    }

    console.log(`Done! Added ${added} missing inventory items.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

migrate();
