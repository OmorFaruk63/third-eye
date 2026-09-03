const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const Recording = require('../models/Recording');
const googleDriveService = require('../services/googleDriveService');

router.get('/stats', async (req, res) => {
  try {
    const totalDevices = await Device.countDocuments();
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const activeDevices = await Device.countDocuments({ lastSeen: { $gte: tenMinutesAgo } });
    const recordingNow = await Device.countDocuments({ isRecording: true });

    const totalRecordings = await Recording.countDocuments();

    const storageAggregation = await Recording.aggregate([
      { $group: { _id: null, totalBytes: { $sum: '$fileSizeBytes' } } },
    ]);

    const totalBytes = storageAggregation.length > 0 ? storageAggregation[0].totalBytes : 0;
    const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
    const totalGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(2);

    res.json({
      success: true,
      stats: {
        totalDevices,
        activeDevices,
        recordingNow,
        totalRecordings,
        storageUsedMB: Number(totalMB),
        storageUsedGB: Number(totalGB),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate Google OAuth URL
router.get('/auth/google', (req, res) => {
  const host = req.get('host');
  const authUrl = googleDriveService.getAuthUrl(host);
  if (!authUrl) {
    return res.status(500).json({ error: 'OAuth credentials not configured' });
  }
  res.redirect(authUrl);
});

// Handle OAuth Callback
router.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send('Authorization code missing.');
    }

    const host = req.get('host');
    const isRender = host && host.includes('onrender.com');
    const redirectUri = isRender
      ? `https://${host}/api/admin/auth/google/callback`
      : 'http://localhost:5000/api/admin/auth/google/callback';

    await googleDriveService.handleAuthCallback(code, redirectUri);

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Google Drive Connected - Third Eye</title>
          <style>
            body { background: #0b0f19; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #131b2e; padding: 48px; border-radius: 20px; border: 1px solid #1e293b; text-align: center; max-width: 500px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
            .icon { font-size: 54px; margin-bottom: 16px; }
            h1 { color: #00e5ff; font-size: 24px; margin: 0 0 12px 0; }
            p { color: #94a3b8; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0; }
            .btn { display: inline-block; padding: 14px 28px; background: #00e5ff; color: #000; font-weight: 700; text-decoration: none; border-radius: 10px; transition: transform 0.2s; }
            .btn:hover { transform: scale(1.03); }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">🎉</div>
            <h1>Google Drive Connected!</h1>
            <p>Your Google Drive (omor.faruk.furkan.3@gmail.com) has been successfully authenticated.</p>
            <p>All background videos uploaded by users will now automatically save directly into your Google Drive folder (<strong>Third Eye Recordings</strong>)!</p>
            <a href="http://localhost:5173" class="btn">Return to Command Center</a>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.status(500).send(`Authentication failed: ${error.message}`);
  }
});

// Google Drive Status
router.get('/drive/status', (req, res) => {
  res.json({
    connected: Boolean(googleDriveService.driveClient),
    folderId: googleDriveService.folderId,
    mode: process.env.GOOGLE_REFRESH_TOKEN ? 'oauth' : (googleDriveService.driveClient ? 'service_account' : 'none'),
  });
});

module.exports = router;
