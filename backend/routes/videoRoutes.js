const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Recording = require('../models/Recording');
const Device = require('../models/Device');
const googleDriveService = require('../services/googleDriveService');

// Configure Multer storage
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'rec-' + uniqueSuffix + path.extname(file.originalname || '.mp4'));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
});

// Endpoint for Android app to upload recorded video
router.post('/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const {
      deviceId = 'unknown_device',
      deviceName = 'Android Device',
      durationSeconds = 0,
      quality = '720p',
      latitude,
      longitude,
      locationName,
    } = req.body;

    const localFilePath = req.file.path;
    const fileSizeBytes = req.file.size;
    const originalName = req.file.originalname || `REC_${Date.now()}.mp4`;

    // 1. Upload to Admin's Google Drive (if configured)
    const driveResult = await googleDriveService.uploadVideoFile(
      localFilePath,
      originalName,
      req.file.mimetype || 'video/mp4'
    );

    // 2. Create database record
    const recording = new Recording({
      deviceId,
      deviceName,
      fileName: req.file.filename,
      driveFileId: driveResult.driveFileId,
      driveViewLink: driveResult.driveViewLink,
      driveDownloadLink: driveResult.driveDownloadLink,
      localFilePath: req.file.filename,
      fileSizeBytes,
      durationSeconds: Number(durationSeconds) || 0,
      quality,
      uploadedAt: new Date(),
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      locationName: locationName || '',
    });

    await recording.save();

    // 3. Update device total recordings count & lastSeen
    const deviceUpdate = {
      $inc: { totalRecordings: 1 },
      lastSeen: new Date(),
      deviceName,
    };
    if (latitude) deviceUpdate.latitude = Number(latitude);
    if (longitude) deviceUpdate.longitude = Number(longitude);
    if (locationName) deviceUpdate.locationName = locationName;

    await Device.findOneAndUpdate(
      { deviceId },
      deviceUpdate,
      { upsert: true }
    );

    res.status(201).json({
      success: true,
      message: 'Video uploaded successfully',
      recording,
    });
  } catch (error) {
    console.error('Video upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Get all recordings
router.get('/', async (req, res) => {
  try {
    const { deviceId } = req.query;
    const query = deviceId ? { deviceId } : {};

    const recordings = await Recording.find(query).sort({ uploadedAt: -1 });
    res.json({ success: true, count: recordings.length, recordings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Stream video directly (supports HTTP 206 Range for seeking)
router.get('/stream/:id', async (req, res) => {
  try {
    const recording = await Recording.findById(req.params.id);
    if (!recording) {
      return res.status(404).send('Recording not found');
    }

    // Check if local file exists
    const filePath = path.join(uploadsDir, recording.localFilePath);
    if (!fs.existsSync(filePath)) {
      if (recording.driveViewLink) {
        return res.redirect(recording.driveViewLink);
      }
      return res.status(404).send('Video file not found on server');
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      const chunksize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      };

      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    console.error('Stream error:', error);
    res.status(500).send('Streaming error');
  }
});

// Admin: Download video
router.get('/download/:id', async (req, res) => {
  try {
    const recording = await Recording.findById(req.params.id);
    if (!recording) return res.status(404).send('Recording not found');

    const filePath = path.join(uploadsDir, recording.localFilePath);
    if (fs.existsSync(filePath)) {
      return res.download(filePath, recording.fileName);
    } else if (recording.driveDownloadLink) {
      return res.redirect(recording.driveDownloadLink);
    }
    res.status(404).send('File not found');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Delete recording
router.delete('/:id', async (req, res) => {
  try {
    const recording = await Recording.findById(req.params.id);
    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    // Delete from Google Drive
    if (recording.driveFileId) {
      await googleDriveService.deleteVideoFile(recording.driveFileId);
    }

    // Delete local file
    const filePath = path.join(uploadsDir, recording.localFilePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await Recording.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Recording deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
