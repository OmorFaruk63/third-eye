const mongoose = require('mongoose');

const BreadcrumbPointSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, index: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  speedKmh: { type: Number, default: 0 },
  accuracy: { type: Number, default: 10 },
  timestamp: { type: Date, default: Date.now, index: true },
});

BreadcrumbPointSchema.index({ deviceId: 1, timestamp: 1 });

module.exports = mongoose.model('BreadcrumbPoint', BreadcrumbPointSchema);
