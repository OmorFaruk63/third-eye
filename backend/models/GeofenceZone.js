const mongoose = require('mongoose');

const GeofenceZoneSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  centerLat: { type: Number, required: true },
  centerLon: { type: Number, required: true },
  radiusMeters: { type: Number, default: 300 },
  alertOnEnter: { type: Boolean, default: true },
  alertOnExit: { type: Boolean, default: true },
  targetDevices: [{ type: String }], // empty means all devices
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('GeofenceZone', GeofenceZoneSchema);
