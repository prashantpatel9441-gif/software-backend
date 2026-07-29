import mongoose from 'mongoose';
import Product from './models/Product.js';

async function run() {
  await mongoose.connect('mongodb+srv://prashantpatel9441_db_user:prashant@cluster0.ejaa8iw.mongodb.net/?appName=Cluster0');
  const res = await Product.updateMany(
    { $or: [{ srNo: { $exists: false } }, { srNo: null }, { srNo: 0 }, { srNo: '' }] },
    { $set: { srNo: 999999 } }
  );
  console.log(res);
  process.exit();
}
run();
