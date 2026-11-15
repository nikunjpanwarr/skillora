const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();

const { testConnection } = require('./db/connection');
const { authenticateUser } = require('./middleware/auth');
const { 
  helmetMiddleware, 
  apiLimiter, 
  authLimiter, 
  orderLimiter, 
  inputSanitizer, 
  csrfProtection 
} = require('./middleware/security');

const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/categories');
const serviceRoutes = require('./routes/services');
const orderRoutes = require('./routes/orders');
const producerRoutes = require('./routes/producer');
const favoriteRoutes = require('./routes/favorites');
const reviewRoutes = require('./routes/reviews');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payments');
const messageRoutes = require('./routes/messages');
const reportRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware (Phase 12)
app.use(helmetMiddleware);
app.use(inputSanitizer);
app.use(csrfProtection);

// Standard Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Global session authentication parser (attaches req.user)
app.use(authenticateUser);

// Apply Rate Limiters
app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/orders', orderLimiter);
app.use('/api/payments', orderLimiter);

// API Health Check
app.get('/api/health', async (req, res) => {
  const dbStatus = await testConnection();
  res.json({
    status: 'ok',
    service: 'Skillora API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: dbStatus
  });
});

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/producer', producerRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/reports', reportRoutes);

// Serve uploads and static frontend files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(__dirname));

// Custom 404 for API routes
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum allowed size is 5MB.' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }

  if (err.message && err.message.includes('Only JPEG, PNG, and WebP')) {
    return res.status(400).json({ error: err.message });
  }

  console.error('Unhandled server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start Express Server
app.listen(PORT, async () => {
  console.log(`===============================================`);
  console.log(`  Skillora Server running at http://localhost:${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`===============================================`);

  // Check database connectivity on boot
  const dbStatus = await testConnection();
  if (dbStatus.connected) {
    console.log(`✓ MySQL Database connection verified.`);
  } else {
    console.warn(`! MySQL Database not connected: ${dbStatus.message}`);
    console.warn(`  (Ensure MySQL service is running and configure credentials in .env)`);
  }
});

module.exports = app;
