import mongoose from 'mongoose';
import User from '../models/User.js';

let mongodInstance = null;

const connectDB = async () => {
  try {
    const defaultUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/admin-panel';
    let connected = false;

    // Try connecting to specified / local MONGO_URI
    try {
      console.log(`Attempting connection to MongoDB at: ${defaultUri.replace(/:([^@]+)@/, ':****@')}`);
      const conn = await mongoose.connect(defaultUri, {
        serverSelectionTimeoutMS: 10000,
      });
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      connected = true;
    } catch (connErr) {
      console.log(`Configured MongoDB connection failed (${connErr.message}). Starting in-memory MongoDB runner...`);
      const { MongoMemoryServer } = await import('mongodb-memory-server');

      try {
        mongodInstance = await MongoMemoryServer.create({
          instance: { port: 27017, dbName: 'admin-panel' },
        });
      } catch (portErr) {
        console.log('Port 27017 in use for in-memory server, using dynamic port');
        mongodInstance = await MongoMemoryServer.create({
          instance: { dbName: 'admin-panel' },
        });
      }

      const memoryUri = mongodInstance.getUri();
      console.log(`In-memory MongoDB started at: ${memoryUri}`);
      const conn = await mongoose.connect(memoryUri);
      console.log(`MongoDB Connected (in-memory): ${conn.connection.host}`);
      connected = true;
    }

    if (connected) {
      // Auto-seed initial admin user if not present
      try {
        const adminExists = await User.findOne({ email: 'admin@gmail.com' });
        if (!adminExists) {
          await User.create({
            name: 'Admin User',
            email: 'admin@gmail.com',
            password: 'admin123',
            role: 'Admin',
          });
          console.log('Default admin seeded: admin@gmail.com / admin123');
        }
      } catch (seedErr) {
        console.warn('Could not auto-seed admin user:', seedErr.message);
      }
    }
  } catch (error) {
    console.error(`Database connection error: ${error.message}`);
    process.exit(1);
  }
};

process.on('SIGINT', async () => {
  if (mongodInstance) await mongodInstance.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (mongodInstance) await mongodInstance.stop();
  process.exit(0);
});

export default connectDB;
