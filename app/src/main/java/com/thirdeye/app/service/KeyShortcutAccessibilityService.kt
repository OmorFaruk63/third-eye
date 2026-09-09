package com.thirdeye.app.service

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.media.AudioManager
import android.util.Log
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent
import com.thirdeye.app.utils.AppPreferences

class KeyShortcutAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "KeyAccessibility"
        private const val MAX_CLICK_INTERVAL = 600L // 600ms window between consecutive clicks
        private const val MIN_CLICK_INTERVAL = 50L // 50ms debounce for hardware jitter
        private const val TOGGLE_COOLDOWN = 1500L // 1.5s cooldown between toggles
    }

    private var volumeUpCount = 0
    private var lastVolumeUpTime = 0L

    private var volumeDownCount = 0
    private var lastVolumeDownTime = 0L

    private var lastToggleTime = 0L
    private val prefs by lazy { AppPreferences(this) }

    override fun onServiceConnected() {
        super.onServiceConnected()
        try {
            val info = serviceInfo ?: AccessibilityServiceInfo()
            info.flags = info.flags or AccessibilityServiceInfo.FLAG_REQUEST_FILTER_KEY_EVENTS
            serviceInfo = info
        } catch (e: Exception) {
            Log.e(TAG, "Error applying AccessibilityServiceInfo flags", e)
        }
        com.thirdeye.app.uploader.SocketManager.initAndConnect(this)
        Log.i(TAG, "Accessibility Service connected and ready for volume triggers.")
    }

    /**
     * Checks if a phone call or media (movie, music, video) is currently active.
     * Prevents accidental recording start/stop when adjusting volume during calls or movies.
     */
    private fun isCallOrMediaActive(): Boolean {
        return try {
            val audioManager = getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return false
            val isCall = audioManager.mode != AudioManager.MODE_NORMAL
            val isMedia = audioManager.isMusicActive
            isCall || isMedia
        } catch (e: Exception) {
            Log.e(TAG, "Error checking audio state", e)
            false
        }
    }

    override fun onKeyEvent(event: KeyEvent?): Boolean {
        if (event == null || !prefs.isVolumeTriggerEnabled) {
            return super.onKeyEvent(event)
        }

        val action = event.action
        val keyCode = event.keyCode

        // Detect Volume Up or Volume Down clicks (filter out repeat events from long-pressing)
        if (action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
            // If user is on a call or watching a movie/listening to audio:
            // Do NOT start recording if stopped, and do NOT stop recording if already running!
            if (isCallOrMediaActive()) {
                Log.d(TAG, "Call or Media is currently active. Bypassing volume shortcut.")
                volumeUpCount = 0
                volumeDownCount = 0
                return super.onKeyEvent(event)
            }

            val currentTime = System.currentTimeMillis()
            val requiredClicks = prefs.volumeTriggerClicks.coerceIn(2, 3)

            if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
                volumeDownCount = 0
                val diff = currentTime - lastVolumeUpTime
                Log.d(TAG, "Volume UP pressed. Diff: ${diff}ms, prev count: $volumeUpCount")
                if (diff in MIN_CLICK_INTERVAL..MAX_CLICK_INTERVAL) {
                    volumeUpCount++
                } else {
                    volumeUpCount = 1
                }
                lastVolumeUpTime = currentTime

                if (volumeUpCount >= requiredClicks) {
                    Log.i(TAG, "$requiredClicks presses on Volume UP detected! Toggling recording.")
                    volumeUpCount = 0
                    lastVolumeUpTime = 0L
                    toggleRecording()
                }
            } else if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
                volumeUpCount = 0
                val diff = currentTime - lastVolumeDownTime
                Log.d(TAG, "Volume DOWN pressed. Diff: ${diff}ms, prev count: $volumeDownCount")
                if (diff in MIN_CLICK_INTERVAL..MAX_CLICK_INTERVAL) {
                    volumeDownCount++
                } else {
                    volumeDownCount = 1
                }
                lastVolumeDownTime = currentTime

                if (volumeDownCount >= requiredClicks) {
                    Log.i(TAG, "$requiredClicks presses on Volume DOWN detected! Toggling recording.")
                    volumeDownCount = 0
                    lastVolumeDownTime = 0L
                    toggleRecording()
                }
            }
        }

        return super.onKeyEvent(event)
    }

    private fun toggleRecording() {
        val currentTime = System.currentTimeMillis()
        if (currentTime - lastToggleTime < TOGGLE_COOLDOWN) {
            Log.d(TAG, "Toggle cooldown active, ignoring trigger.")
            return
        }
        lastToggleTime = currentTime

        if (prefs.isRecording || CameraRecordingService.isServiceRunning) {
            Log.i(TAG, "Stopping recording via shortcut")
            CameraRecordingService.stopService(this, enableVibration = true)
        } else {
            Log.i(TAG, "Starting recording via shortcut")
            CameraRecordingService.startService(this, enableVibration = true, cameraLens = prefs.cameraLens)
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Not used
    }

    override fun onInterrupt() {
        Log.w(TAG, "Accessibility service interrupted.")
    }
}
