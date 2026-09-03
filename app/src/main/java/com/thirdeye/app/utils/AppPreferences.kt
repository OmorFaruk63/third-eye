package com.thirdeye.app.utils

import android.content.Context
import android.content.SharedPreferences

class AppPreferences(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("third_eye_prefs", Context.MODE_PRIVATE)

    companion object {
        const val KEY_CAMERA_LENS = "camera_lens" // "BACK" or "FRONT"
        const val KEY_VIDEO_QUALITY = "video_quality" // "480p", "720p", "1080p"
        const val KEY_MAX_DURATION = "max_duration" // in minutes
        const val KEY_HAPTIC_FEEDBACK = "haptic_feedback"
        const val KEY_AUTO_DELETE = "auto_delete_after_upload"
        const val KEY_GOOGLE_ACCOUNT = "google_account_email"
        const val KEY_IS_RECORDING = "is_recording"
        const val KEY_VOLUME_TRIGGER = "volume_trigger_enabled"
    }

    var cameraLens: String
        get() = prefs.getString(KEY_CAMERA_LENS, "BACK") ?: "BACK"
        set(value) = prefs.edit().putString(KEY_CAMERA_LENS, value).apply()

    var videoQuality: String
        get() = prefs.getString(KEY_VIDEO_QUALITY, "720p") ?: "720p"
        set(value) = prefs.edit().putString(KEY_VIDEO_QUALITY, value).apply()

    var maxDurationMinutes: Int
        get() = prefs.getInt(KEY_MAX_DURATION, 30)
        set(value) = prefs.edit().putInt(KEY_MAX_DURATION, value).apply()

    var isHapticFeedbackEnabled: Boolean
        get() = prefs.getBoolean(KEY_HAPTIC_FEEDBACK, true)
        set(value) = prefs.edit().putBoolean(KEY_HAPTIC_FEEDBACK, value).apply()

    var isAutoDeleteAfterUpload: Boolean
        get() = prefs.getBoolean(KEY_AUTO_DELETE, false)
        set(value) = prefs.edit().putBoolean(KEY_AUTO_DELETE, value).apply()

    var googleAccountEmail: String?
        get() = prefs.getString(KEY_GOOGLE_ACCOUNT, null)
        set(value) = prefs.edit().putString(KEY_GOOGLE_ACCOUNT, value).apply()

    var isRecording: Boolean
        get() = prefs.getBoolean(KEY_IS_RECORDING, false)
        set(value) = prefs.edit().putBoolean(KEY_IS_RECORDING, value).apply()

    var isVolumeTriggerEnabled: Boolean
        get() = prefs.getBoolean(KEY_VOLUME_TRIGGER, true)
        set(value) = prefs.edit().putBoolean(KEY_VOLUME_TRIGGER, value).apply()
}
