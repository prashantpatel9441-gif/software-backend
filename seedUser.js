import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const seedAdminUser = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected for seeding.');

    const existingAdmin = await User.findOne({ email: 'admin@example.com' });
    if (existingAdmin) {
      existingAdmin.email = 'admin@gmail.com';
      await existingAdmin.save();
      console.log('Admin email updated to admin@gmail.com!');
      process.exit();
    }

    const adminExists = await User.findOne({ email: 'admin@gmail.com' });
    if (adminExists) {
      console.log('Admin user already exists with admin@gmail.com!');
      process.exit();
    }

    const adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@gmail.com',
      password: 'admin123',
      role: 'Admin',
    });

    if (adminUser) {
      console.log('Admin user created successfully!');
      console.log('Email: admin@gmail.com');
      console.log('Password: admin123');
    } else {
      console.log('Failed to create admin user.');
    }

    process.exit();
  } catch (error) {
    console.error('Error seeding admin user:', error);
    process.exit(1);
  }
};

seedAdminUser();
