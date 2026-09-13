const { initializeApp, cert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const path = require('path');
const fs = require('fs');

let isInitialized = false;

try {
  let serviceAccount = null;

  // 1. Check environment variable (e.g. Render Environment Secret)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      serviceAccount = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
    } catch (e) {
      console.warn('Failed parsing FIREBASE_SERVICE_ACCOUNT env var:', e.message);
    }
  }

  // 2. Check candidate file paths (Render Secret File, backend directory, project root)
  if (!serviceAccount) {
    const candidatePaths = [
      '/etc/secrets/firebase_admin_key.json',
      path.join(__dirname, '..', 'firebase_admin_key.json'),
      path.join(__dirname, 'firebase_admin_key.json'),
      path.join(process.cwd(), 'firebase_admin_key.json'),
      path.join(process.cwd(), 'backend', 'firebase_admin_key.json'),
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        serviceAccount = JSON.parse(fs.readFileSync(p, 'utf8'));
        break;
      }
    }
  }

  if (serviceAccount) {
    initializeApp({
      credential: cert(serviceAccount),
    });
    isInitialized = true;
    console.log('🔥 Firebase Admin SDK initialized successfully for project:', serviceAccount.project_id);
  } else {
    console.warn('⚠️ firebase_admin_key.json not found. Firebase push will be disabled.');
  }
} catch (e) {
  console.error('❌ Failed initializing Firebase Admin SDK:', e.message);
}

/**
 * Dispatches a high-priority silent wake-up push message to the device via FCM
 * @param {string} fcmToken - The FCM registration token of target Android device
 * @param {string} action - Action command ('start-live-stream', 'stop-live-stream', 'record-video', 'stop-recording', 'request-location', 'wake-up')
 * @param {Object} extraData - Additional key-value payload
 */
async function sendWakeUpPush(fcmToken, action, extraData = {}) {
  if (!isInitialized) {
    console.warn(`[FCM] Firebase not initialized. Cannot send wake-up push for action: ${action}`);
    return { success: false, error: 'Firebase not initialized' };
  }

  if (!fcmToken || typeof fcmToken !== 'string' || fcmToken.trim() === '') {
    console.warn(`[FCM] No valid FCM token provided for action: ${action}`);
    return { success: false, error: 'No FCM token' };
  }

  // Convert all payload values to strings (FCM data payload requirement)
  const stringData = {
    action: String(action),
    timestamp: String(Date.now()),
  };

  for (const [key, val] of Object.entries(extraData)) {
    if (val !== undefined && val !== null) {
      stringData[key] = typeof val === 'object' ? JSON.stringify(val) : String(val);
    }
  }

  const message = {
    token: fcmToken.trim(),
    data: stringData,
    android: {
      priority: 'high',
      ttl: 60 * 1000, // 60 seconds time-to-live
    },
  };

  try {
    const messaging = getMessaging();
    const response = await messaging.send(message);
    console.log(`🚀 [FCM Wake-Up Sent] Action: ${action} | MessageId: ${response}`);
    return { success: true, messageId: response };
  } catch (error) {
    console.error(`❌ [FCM Wake-Up Error] Action: ${action} | Error:`, error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  isInitialized: () => isInitialized,
  sendWakeUpPush,
};
