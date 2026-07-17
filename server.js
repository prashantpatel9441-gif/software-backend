import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import http from 'http';
import https from 'https';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import collectionRoutes from './routes/collectionRoutes.js';
import productRoutes from './routes/productRoutes.js';
import variantRoutes from './routes/variantRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import userRoutes from './routes/userRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import path from 'path';

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/products', productRoutes);
app.use('/api/variants', variantRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);

const __dirname = path.resolve();
app.use('/uploads', express.static(path.join(__dirname, '/uploads')));

app.get('/', (req, res) => {
  res.send('Admin Panel API is running...');
});

// Error handling middleware
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  
  // Keep-alive ping to prevent Render from sleeping
  // Render populates RENDER_EXTERNAL_URL automatically in production
  const url = process.env.RENDER_EXTERNAL_URL;
  if (url) {
    setInterval(() => {
      const client = url.startsWith('https') ? https : http;
      client.get(url, (res) => {
        console.log(`[Keep-Alive] Pinged ${url} to stay awake - Status: ${res.statusCode}`);
      }).on('error', (err) => {
        console.error(`[Keep-Alive] Ping failed: ${err.message}`);
      });
    }, 14 * 60 * 1000); // 14 minutes
  }
});
