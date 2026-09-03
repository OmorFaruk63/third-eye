const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const Recording = require('../models/Recording');

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

module.exports = router;
