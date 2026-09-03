require('dotenv').config();
const fs = require('fs');
if (fs.existsSync('/etc/secrets/.env')) {
  require('dotenv').config({ path: '/etc/secrets/.env' });
}
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const mongoose = require('mongoose');

const deviceRoutes = require('./routes/deviceRoutes');
const videoRoutes = require('./routes/videoRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/thirdeye';

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date(),
    mongoConnected: mongoose.connection.readyState === 1,
  });
});

// API Routes
app.use('/api/device', deviceRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/admin', adminRoutes);

// Connect to MongoDB & Start Server
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB successfully.');
  })
  .catch((err) => {
    console.error('⚠️ MongoDB connection error:', err.message);
    console.log('💡 Tip: Ensure MongoDB service is running (brew services start mongodb-community@7.0)');
  });

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Third Eye Server running on http://0.0.0.0:${PORT}`);
  console.log(`📡 Ready to receive video uploads and device heartbeats.`);
});
