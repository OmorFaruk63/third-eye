package com.thirdeye.app.service

import android.accessibilityservice.AccessibilityService
import android.util.Log
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent
import com.thirdeye.app.utils.AppPreferences

class KeyShortcutAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "KeyAccessibility"
        private const val DOUBLE_CLICK_TIME_DELTA = 1200L // 1.2 seconds window
    }

    private var lastVolumeDownTime = 0L
    private var lastVolumeUpTime = 0L
    private lateinit var prefs: AppPreferences

    override fun onServiceConnected() {
        super.onServiceConnected()
        prefs = AppPreferences(this)
        Log.i(TAG, "Accessibility Service connected and ready for volume triggers.")
    }

    override fun onKeyEvent(event: KeyEvent?): Boolean {
        if (event == null || !prefs.isVolumeTriggerEnabled) {
            return super.onKeyEvent(event)
        }

        val action = event.action
        val keyCode = event.keyCode

        // Detect Volume Up or Volume Down double press
        if (action == KeyEvent.ACTION_DOWN) {
            val currentTime = System.currentTimeMillis()

            if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
                if (currentTime - lastVolumeUpTime < DOUBLE_CLICK_TIME_DELTA) {
                    Log.i(TAG, "Double press on Volume UP detected! Toggling recording.")
                    toggleRecording()
                    lastVolumeUpTime = 0L
                } else {
                    lastVolumeUpTime = currentTime
                }
            } else if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
                if (currentTime - lastVolumeDownTime < DOUBLE_CLICK_TIME_DELTA) {
                    Log.i(TAG, "Double press on Volume DOWN detected! Toggling recording.")
                    toggleRecording()
                    lastVolumeDownTime = 0L
                } else {
                    lastVolumeDownTime = currentTime
                }
            }
        }

        return super.onKeyEvent(event)
    }

    private fun toggleRecording() {
        if (prefs.isRecording) {
            CameraRecordingService.stopService(this)
        } else {
            CameraRecordingService.startService(this)
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Not used
    }

    override fun onInterrupt() {
        Log.w(TAG, "Accessibility service interrupted.")
    }
}
