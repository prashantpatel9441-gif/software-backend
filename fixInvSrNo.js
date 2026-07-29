import mongoose from 'mongoose';
import Product from './models/Product.js';
import Inventory from './models/Inventory.js';

async function run() {
  await mongoose.connect('mongodb+srv://prashantpatel9441_db_user:prashant@cluster0.ejaa8iw.mongodb.net/?appName=Cluster0');
  
  // Update missing srNo to 999999 first
  await Inventory.updateMany(
    { $or: [{ srNo: { $exists: false } }, { srNo: null }, { srNo: 0 }, { srNo: '' }] },
    { $set: { srNo: 999999 } }
  );

  // Now sync from products
  const products = await Product.find({ srNo: { $ne: 999999 } });
  let count = 0;
  for (const p of products) {
    if (p.srNo && p.srNo !== 999999) {
      // Inventory items are linked by product name mostly or SKU prefix.
      // But products can have variants.
      // It's safer to just run the sync endpoint.
      // We will just do a simple name match or find based on baseSku if we had it,
      // but matching by name is an easy way.
      const res = await Inventory.updateMany({ name: p.name }, { $set: { srNo: p.srNo } });
      count += res.modifiedCount;
    }
  }

  console.log(`Updated ${count} inventory items with product srNo.`);
  process.exit();
}
run();
