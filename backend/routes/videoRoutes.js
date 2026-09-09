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

    // 2. Delete local temp file immediately after uploading to Google Drive
    if (driveResult.driveFileId && fs.existsSync(localFilePath)) {
      try {
        fs.unlinkSync(localFilePath);
        console.log(`🗑️ Successfully deleted local temp video from backend: ${req.file.filename}`);
      } catch (delErr) {
        console.warn('⚠️ Could not delete local temp file:', delErr.message);
      }
    }

    // 3. Create database record
    const recording = new Recording({
      deviceId,
      deviceName,
      fileName: req.file.filename,
      driveFileId: driveResult.driveFileId,
      driveViewLink: driveResult.driveViewLink,
      driveDownloadLink: driveResult.driveDownloadLink,
      localFilePath: null,
      fileSizeBytes,
      durationSeconds: Number(durationSeconds) || 0,
      quality,
      uploadedAt: new Date(),
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      locationName: locationName || '',
    });

    await recording.save();

    // 4. Update device total recordings count & lastSeen
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

// Admin: Stream video directly from Google Drive (supports HTTP 206 Range for seeking)
router.get('/stream/:id', async (req, res) => {
  try {
    const recording = await Recording.findById(req.params.id);
    if (!recording) {
      return res.status(404).send('Recording not found');
    }

    if (!recording.driveFileId) {
      if (recording.driveViewLink) {
        return res.redirect(recording.driveViewLink);
      }
      return res.status(404).send('Google Drive video not found for this recording');
    }

    // Stream directly from Google Drive API
    await googleDriveService.streamVideo(recording.driveFileId, req, res);
  } catch (error) {
    console.error('Stream error:', error);
    if (!res.headersSent) {
      res.status(500).send('Streaming error: ' + error.message);
    }
  }
});

// Admin: Download video directly from Google Drive
router.get('/download/:id', async (req, res) => {
  try {
    const recording = await Recording.findById(req.params.id);
    if (!recording) return res.status(404).send('Recording not found');

    if (recording.driveFileId) {
      res.setHeader('Content-Disposition', `attachment; filename="${recording.fileName || 'video.mp4'}"`);
      return await googleDriveService.streamVideo(recording.driveFileId, req, res);
    } else if (recording.driveDownloadLink) {
      return res.redirect(recording.driveDownloadLink);
    }
    res.status(404).send('Google Drive file not found');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Delete ALL recordings
router.delete('/all', async (req, res) => {
  try {
    const recordings = await Recording.find();

    // Delete all from Google Drive
    await Promise.allSettled(
      recordings.map(async (rec) => {
        if (rec.driveFileId) {
          try {
            await googleDriveService.deleteVideoFile(rec.driveFileId);
          } catch (e) {
            console.error('Failed to delete Google Drive file:', rec.driveFileId, e.message);
          }
        }
        if (rec.localFilePath) {
          const filePath = path.join(uploadsDir, rec.localFilePath);
          if (fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch (e) {}
          }
        }
      })
    );

    const result = await Recording.deleteMany({});
    await Device.updateMany({}, { totalRecordings: 0 });

    res.json({
      success: true,
      message: `Deleted all ${result.deletedCount} recordings successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('Delete all error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Batch delete multiple recordings by IDs
router.post('/batch-delete', async (req, res) => {
  try {
    const ids = req.body.ids || req.body.videoIds;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids or videoIds array is required' });
    }

    const recordings = await Recording.find({ _id: { $in: ids } });

    await Promise.allSettled(
      recordings.map(async (rec) => {
        if (rec.driveFileId) {
          try {
            await googleDriveService.deleteVideoFile(rec.driveFileId);
          } catch (e) {
            console.error('Failed to delete Google Drive file:', rec.driveFileId, e.message);
          }
        }
        if (rec.localFilePath) {
          const filePath = path.join(uploadsDir, rec.localFilePath);
          if (fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch (e) {}
          }
        }
      })
    );

    const result = await Recording.deleteMany({ _id: { $in: ids } });

    for (const rec of recordings) {
      if (rec.deviceId) {
        await Device.updateOne(
          { deviceId: rec.deviceId, totalRecordings: { $gt: 0 } },
          { $inc: { totalRecordings: -1 } }
        ).catch(() => {});
      }
    }

    res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} recordings`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('Batch delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Delete single recording
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

    // Delete local file if any leftover exists
    if (recording.localFilePath) {
      const filePath = path.join(uploadsDir, recording.localFilePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    if (recording.deviceId) {
      await Device.updateOne(
        { deviceId: recording.deviceId, totalRecordings: { $gt: 0 } },
        { $inc: { totalRecordings: -1 } }
      ).catch(() => {});
    }

    await Recording.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Recording deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
