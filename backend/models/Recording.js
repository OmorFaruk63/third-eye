const mongoose = require('mongoose');

const RecordingSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    index: true,
  },
  deviceName: {
    type: String,
    default: 'Unknown Device',
  },
  fileName: {
    type: String,
    required: true,
  },
  driveFileId: {
    type: String,
    default: null,
  },
  driveViewLink: {
    type: String,
    default: null,
  },
  driveDownloadLink: {
    type: String,
    default: null,
  },
  localFilePath: {
    type: String,
    default: null,
  },
  fileSizeBytes: {
    type: Number,
    default: 0,
  },
  durationSeconds: {
    type: Number,
    default: 0,
  },
  quality: {
    type: String,
    default: '720p',
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
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

module.exports = mongoose.model('Recording', RecordingSchema);
