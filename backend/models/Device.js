const mongoose = require('mongoose');

const DeviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  deviceName: {
    type: String,
    default: 'Unknown Device',
  },
  model: {
    type: String,
    default: 'Android',
  },
  androidVersion: {
    type: String,
    default: '',
  },
  batteryLevel: {
    type: Number,
    default: 100,
  },
  isRecording: {
    type: Boolean,
    default: false,
  },
  videoQuality: {
    type: String,
    default: '720p',
  },
  appVersion: {
    type: String,
    default: '1.0',
  },
  lastSeen: {
    type: Date,
    default: Date.now,
  },
  ipAddress: {
    type: String,
    default: '',
  },
  totalRecordings: {
    type: Number,
    default: 0,
  },
  latitude: {
    type: Number,
    default: null,
  },
  longitude: {
    type: Number,
    default: null,
  },
  locationName: {
    type: String,
    default: '',
  },
}, { timestamps: true });

module.exports = mongoose.model('Device', DeviceSchema);
