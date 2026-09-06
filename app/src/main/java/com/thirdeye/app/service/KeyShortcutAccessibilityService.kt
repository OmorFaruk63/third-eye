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
        private const val DOUBLE_CLICK_TIME_DELTA = 1200L // 1.2 seconds window
        private const val MIN_CLICK_INTERVAL = 150L // 150ms debounce
    }

    private var lastVolumeDownTime = 0L
    private var lastVolumeUpTime = 0L
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
                if (diff in MIN_CLICK_INTERVAL..DOUBLE_CLICK_TIME_DELTA) {
                    Log.i(TAG, "Double press on Volume UP detected! Toggling recording with vibration.")
                    toggleRecording()
                    lastVolumeUpTime = 0L
                } else if (diff > DOUBLE_CLICK_TIME_DELTA) {
                    lastVolumeUpTime = currentTime
                }
            } else if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
                val diff = currentTime - lastVolumeDownTime
                if (diff in MIN_CLICK_INTERVAL..DOUBLE_CLICK_TIME_DELTA) {
                    Log.i(TAG, "Double press on Volume DOWN detected! Toggling recording with vibration.")
                    toggleRecording()
                    lastVolumeDownTime = 0L
                } else if (diff > DOUBLE_CLICK_TIME_DELTA) {
                    lastVolumeDownTime = currentTime
                }
            }
        }

        return super.onKeyEvent(event)
    }

    private fun toggleRecording() {
        if (prefs.isRecording) {
            CameraRecordingService.stopService(this, enableVibration = true)
        } else {
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
