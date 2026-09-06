package com.thirdeye.app.service

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.util.Log
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent
import com.thirdeye.app.utils.AppPreferences

class KeyShortcutAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "KeyAccessibility"
        private const val DOUBLE_CLICK_TIME_DELTA = 850L // 850ms double-press window
        private const val MIN_CLICK_INTERVAL = 50L // 50ms debounce
        private const val TOGGLE_COOLDOWN = 1200L // 1.2s cooldown between toggles
    }

    private var lastVolumeDownTime = 0L
    private var lastVolumeUpTime = 0L
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

    override fun onKeyEvent(event: KeyEvent?): Boolean {
        if (event == null || !prefs.isVolumeTriggerEnabled) {
            return super.onKeyEvent(event)
        }

        val action = event.action
        val keyCode = event.keyCode

        // Detect Volume Up or Volume Down double press (filter out repeat events)
        if (action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
            val currentTime = System.currentTimeMillis()

            if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
                val diff = currentTime - lastVolumeUpTime
                Log.d(TAG, "Volume UP pressed. Diff since last press: ${diff}ms")
                if (diff in MIN_CLICK_INTERVAL..DOUBLE_CLICK_TIME_DELTA) {
                    Log.i(TAG, "Double press on Volume UP detected! Toggling recording with vibration.")
                    lastVolumeUpTime = 0L
                    toggleRecording()
                } else {
                    lastVolumeUpTime = currentTime
                }
            } else if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
                val diff = currentTime - lastVolumeDownTime
                Log.d(TAG, "Volume DOWN pressed. Diff since last press: ${diff}ms")
                if (diff in MIN_CLICK_INTERVAL..DOUBLE_CLICK_TIME_DELTA) {
                    Log.i(TAG, "Double press on Volume DOWN detected! Toggling recording with vibration.")
                    lastVolumeDownTime = 0L
                    toggleRecording()
                } else {
                    lastVolumeDownTime = currentTime
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
            CameraRecordingService.startService(this, enableVibration = true)
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Not used
    }

    override fun onInterrupt() {
        Log.w(TAG, "Accessibility service interrupted.")
    }
}
