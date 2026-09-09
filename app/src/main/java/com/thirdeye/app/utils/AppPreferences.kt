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
        const val KEY_VOLUME_TRIGGER_CLICKS = "volume_trigger_clicks"
        const val KEY_SERVER_URL = "server_url"
        const val KEY_DISGUISE_ENABLED = "disguise_enabled"
        const val KEY_DISGUISE_PIN = "disguise_pin"
    }

    var isDisguiseEnabled: Boolean
        get() = prefs.getBoolean(KEY_DISGUISE_ENABLED, false)
        set(value) = prefs.edit().putBoolean(KEY_DISGUISE_ENABLED, value).apply()

    var disguisePin: String
        get() = prefs.getString(KEY_DISGUISE_PIN, "7777") ?: "7777"
        set(value) = prefs.edit().putString(KEY_DISGUISE_PIN, value).apply()

    var serverUrl: String
        get() {
            val saved = prefs.getString(KEY_SERVER_URL, null)
            if (saved.isNullOrEmpty()) {
                return com.thirdeye.app.BuildConfig.DEFAULT_SERVER_URL
            }
            // If in DEV flavor but saved URL is outdated, auto-migrate to local dev URL
            if (com.thirdeye.app.BuildConfig.IS_DEV_ENVIRONMENT && (saved.contains("onrender.com") || saved.contains("192.168.10.196"))) {
                val devUrl = com.thirdeye.app.BuildConfig.DEFAULT_SERVER_URL
                serverUrl = devUrl
                return devUrl
            }
            return saved
        }
        set(value) = prefs.edit().putString(KEY_SERVER_URL, value).apply()

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

    var volumeTriggerClicks: Int
        get() = prefs.getInt(KEY_VOLUME_TRIGGER_CLICKS, 3)
        set(value) = prefs.edit().putInt(KEY_VOLUME_TRIGGER_CLICKS, value).apply()
}
