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

/**
 * Robust helper to resolve actual local video file on disk.
 * Handles discrepancies between client original fileName, multer rec-* generated names,
 * and environment-specific absolute paths (e.g. Render vs Local Dev).
 */
function getLocalVideoFilePath(recording) {
  if (!recording) return null;

  // 1. Direct path check if stored absolute path exists on disk
  if (recording.localFilePath && fs.existsSync(recording.localFilePath)) {
    return recording.localFilePath;
  }

  // 2. Basename of localFilePath inside current uploadsDir
  if (recording.localFilePath) {
    const baseName = path.basename(recording.localFilePath);
    const candidate = path.join(uploadsDir, baseName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // 3. Check fileName directly inside current uploadsDir
  if (recording.fileName) {
    const candidate = path.join(uploadsDir, recording.fileName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}


// ─────────────────────────────────────────────────────────────────────────────
// NEW: Step 1 – Android app registers recording METADATA only (no file upload)
// Called immediately after recording stops. Video stays on device until admin approves.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/register-pending', async (req, res) => {
  try {
    const {
      deviceId = 'unknown_device',
      deviceName = 'Android Device',
      fileName = `REC_${Date.now()}.mp4`,
      durationSeconds = 0,
      quality = '720p',
      fileSizeBytes = 0,
      latitude,
      longitude,
      locationName,
      recordedAt,
    } = req.body;

    const recording = new Recording({
      deviceId,
      deviceName,
      fileName,
      fileSizeBytes: Number(fileSizeBytes) || 0,
      durationSeconds: Number(durationSeconds) || 0,
      quality,
      status: 'pending',
      recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
      uploadedAt: new Date(),
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      locationName: locationName || '',
    });

    await recording.save();

    // Update device last seen
    await Device.findOneAndUpdate(
      { deviceId },
      {
        $inc: { totalRecordings: 1 },
        lastSeen: new Date(),
        deviceName,
        ...(latitude && { latitude: Number(latitude) }),
        ...(longitude && { longitude: Number(longitude) }),
        ...(locationName && { locationName }),
      },
      { upsert: true }
    );

    // Notify admin dashboard via Socket
    const io = req.app.get('io');
    if (io) {
      io.to('admins').emit('new-recording', recording);
      io.to('admins').emit('device-status-change', {
        deviceId,
        isOnline: true,
        isRecording: false,
        totalRecordings: await Recording.countDocuments({ deviceId }),
      });
    }

    res.status(201).json({
      success: true,
      message: 'Recording registered as pending. Awaiting admin approval to upload.',
      recordingId: recording._id,
      status: 'pending',
    });
  } catch (error) {
    console.error('Register pending recording error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Step 2 – Admin approves upload for a specific recording
// Backend emits socket event to the device → device will upload via WiFi only
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/approve', async (req, res) => {
  try {
    const recording = await Recording.findById(req.params.id);
    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    if (recording.status !== 'pending') {
      return res.status(400).json({
        error: `Recording is already ${recording.status}. Cannot approve again.`,
      });
    }

    recording.status = 'approved';
    recording.uploadApprovedAt = new Date();
    await recording.save();

    // Emit upload command to device via socket (device listens for 'upload-approved')
    const io = req.app.get('io');
    if (io) {
      io.to(`device_${recording.deviceId}`).emit('upload-approved', {
        recordingId: recording._id.toString(),
        fileName: recording.fileName,
        deviceId: recording.deviceId,
      });

      // Also notify admin dashboard about status change
      io.to('admins').emit('recording-status-changed', {
        recordingId: recording._id.toString(),
        status: 'approved',
        deviceId: recording.deviceId,
      });
    }

    res.json({
      success: true,
      message: 'Upload approved. Device will upload via WiFi when online.',
      recording,
    });
  } catch (error) {
    console.error('Approve upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Step 2b – Admin approves ALL pending uploads for a device
// ─────────────────────────────────────────────────────────────────────────────
router.post('/approve-all/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const pendingRecordings = await Recording.find({ deviceId, status: 'pending' });

    if (pendingRecordings.length === 0) {
      return res.json({ success: true, message: 'No pending recordings to approve', approvedCount: 0 });
    }

    const io = req.app.get('io');

    for (const recording of pendingRecordings) {
      recording.status = 'approved';
      recording.uploadApprovedAt = new Date();
      await recording.save();

      if (io) {
        io.to(`device_${recording.deviceId}`).emit('upload-approved', {
          recordingId: recording._id.toString(),
          fileName: recording.fileName,
          deviceId: recording.deviceId,
        });
      }
    }

    if (io) {
      io.to('admins').emit('bulk-recording-status-changed', {
        deviceId,
        status: 'approved',
        count: pendingRecordings.length,
      });
    }

    res.json({
      success: true,
      message: `Approved ${pendingRecordings.length} pending recordings. Devices will upload via WiFi.`,
      approvedCount: pendingRecordings.length,
    });
  } catch (error) {
    console.error('Approve all error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// EXISTING (modified): Step 3 – Android app uploads actual video file (WiFi only)
// Now also updates status to 'uploaded' and processes Google Drive upload
// ─────────────────────────────────────────────────────────────────────────────
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
      recordingId,   // NEW: if provided, update existing pending/approved record
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

    let recording;

    // 3a. If recordingId provided, update the existing pending/approved record
    if (recordingId) {
      recording = await Recording.findById(recordingId);
      if (recording) {
        recording.driveFileId = driveResult.driveFileId;
        recording.driveViewLink = driveResult.driveViewLink;
        recording.driveDownloadLink = driveResult.driveDownloadLink;
        recording.localFilePath = driveResult.driveFileId ? null : localFilePath;
        recording.fileSizeBytes = fileSizeBytes;
        recording.durationSeconds = Number(durationSeconds) || recording.durationSeconds;
        recording.status = 'uploaded';
        recording.uploadedAt = new Date();
        if (latitude) recording.latitude = Number(latitude);
        if (longitude) recording.longitude = Number(longitude);
        if (locationName) recording.locationName = locationName;
        await recording.save();
      }
    }

    // 3b. If no recordingId or not found, create a new record
    if (!recording) {
      recording = new Recording({
        deviceId,
        deviceName,
        fileName: req.file.filename,
        driveFileId: driveResult.driveFileId,
        driveViewLink: driveResult.driveViewLink,
        driveDownloadLink: driveResult.driveDownloadLink,
        localFilePath: driveResult.driveFileId ? null : localFilePath,
        fileSizeBytes,
        durationSeconds: Number(durationSeconds) || 0,
        quality,
        status: 'uploaded',
        uploadedAt: new Date(),
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
        locationName: locationName || '',
      });
      await recording.save();

      // Update device total recordings count only for new records
      await Device.findOneAndUpdate(
        { deviceId },
        {
          $inc: { totalRecordings: 1 },
          lastSeen: new Date(),
          deviceName,
          ...(latitude && { latitude: Number(latitude) }),
          ...(longitude && { longitude: Number(longitude) }),
          ...(locationName && { locationName }),
        },
        { upsert: true }
      );
    } else {
      // Update lastSeen for existing record device
      await Device.findOneAndUpdate(
        { deviceId },
        { lastSeen: new Date(), deviceName },
        { upsert: true }
      );
    }

    // Real-time broadcast to connected admins dashboard
    const io = req.app.get('io');
    if (io) {
      io.to('admins').emit('recording-uploaded', recording);
      io.to('admins').emit('recording-status-changed', {
        recordingId: recording._id.toString(),
        status: 'uploaded',
        deviceId,
        driveFileId: recording.driveFileId,
        driveViewLink: recording.driveViewLink,
      });
      io.to('admins').emit('device-recording-status', { deviceId, isRecording: false });
    }

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

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Get all recordings (with status filter support)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { deviceId, status } = req.query;
    const query = {};
    if (deviceId) query.deviceId = deviceId;
    if (status) query.status = status;

    const recordings = await Recording.find(query).sort({ uploadedAt: -1 });
    res.json({ success: true, count: recordings.length, recordings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Stream video directly from Google Drive or Local Disk (supports HTTP 206 Range for seeking)
router.get('/stream/:id', async (req, res) => {
  try {
    const recording = await Recording.findById(req.params.id);
    if (!recording) {
      return res.status(404).send('Recording not found');
    }

    const localFile = getLocalVideoFilePath(recording);

    // If Google Drive file exists, attempt streaming from Drive
    if (recording.driveFileId) {
      try {
        return await googleDriveService.streamVideo(recording.driveFileId, req, res);
      } catch (driveErr) {
        console.warn('⚠️ Google Drive stream failed, falling back to local if available:', driveErr.message);
        if (!localFile) {
          if (recording.driveViewLink) {
            return res.redirect(recording.driveViewLink);
          }
          return res.status(502).send('Streaming error from Google Drive: ' + driveErr.message);
        }
      }
    }

    // Stream from local backend/uploads/ storage with HTTP 206 Partial Content (Range) support
    if (localFile) {
      const stat = fs.statSync(localFile);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start >= fileSize || end >= fileSize) {
          res.setHeader('Content-Range', `bytes */${fileSize}`);
          return res.status(416).send('Requested range not satisfiable');
        }

        const chunksize = end - start + 1;
        const file = fs.createReadStream(localFile, { start, end });
        const head = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'video/mp4',
        };

        res.writeHead(206, head);
        return file.pipe(res);
      } else {
        const head = {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
          'Accept-Ranges': 'bytes',
        };
        res.writeHead(200, head);
        return fs.createReadStream(localFile).pipe(res);
      }
    }

    if (recording.driveViewLink) {
      return res.redirect(recording.driveViewLink);
    }

    // Recording is pending/approved — not yet uploaded
    if (recording.status === 'pending') {
      return res.status(202).json({
        error: 'Video not yet uploaded. Awaiting admin approval.',
        status: 'pending',
      });
    }
    if (recording.status === 'approved') {
      return res.status(202).json({
        error: 'Upload approved. Device will upload when connected to WiFi.',
        status: 'approved',
      });
    }

    return res.status(404).send('Video file not found on server or Google Drive');
  } catch (error) {
    console.error('Stream error:', error);
    if (!res.headersSent) {
      res.status(500).send('Streaming error: ' + error.message);
    }
  }
});

// Admin: Download video directly from Google Drive or local server
router.get('/download/:id', async (req, res) => {
  try {
    const recording = await Recording.findById(req.params.id);
    if (!recording) return res.status(404).send('Recording not found');

    const localFile = getLocalVideoFilePath(recording);

    if (recording.driveFileId) {
      try {
        res.setHeader('Content-Disposition', `attachment; filename="${recording.fileName || 'video.mp4'}"`);
        return await googleDriveService.streamVideo(recording.driveFileId, req, res);
      } catch (driveErr) {
        console.warn('⚠️ Google Drive download failed, falling back to local if available:', driveErr.message);
      }
    }

    if (localFile) {
      return res.download(localFile, recording.fileName || 'video.mp4');
    }

    if (recording.driveDownloadLink) {
      return res.redirect(recording.driveDownloadLink);
    }

    res.status(404).send('Video file not found for download');
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
        const localFile = getLocalVideoFilePath(rec);
        if (localFile && fs.existsSync(localFile)) {
          try { fs.unlinkSync(localFile); } catch (e) {}
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
        const localFile = getLocalVideoFilePath(rec);
        if (localFile && fs.existsSync(localFile)) {
          try { fs.unlinkSync(localFile); } catch (e) {}
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
    const localFile = getLocalVideoFilePath(recording);
    if (localFile && fs.existsSync(localFile)) {
      try {
        fs.unlinkSync(localFile);
      } catch (e) {}
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
