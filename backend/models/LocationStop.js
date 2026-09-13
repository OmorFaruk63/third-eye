const mongoose = require('mongoose');

const LocationStopSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, index: true },
  areaName: { type: String, required: true }, // e.g. "Kazi Alauddin Road, Bangshal" or "কাজী আলাউদ্দিন রোড, বংশাল"
  fullAddress: { type: String, default: '' },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  arrivalTime: { type: Date, required: true, index: true },
  departureTime: { type: Date, default: null },
  stayDurationMinutes: { type: Number, default: 0 },
  accuracy: { type: Number, default: 10 },
  pingsCount: { type: Number, default: 1 },
  isCurrentlyHere: { type: Boolean, default: true, index: true },
}, { timestamps: true });

LocationStopSchema.index({ deviceId: 1, arrivalTime: -1 });

module.exports = mongoose.model('LocationStop', LocationStopSchema);
