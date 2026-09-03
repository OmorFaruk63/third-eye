package com.thirdeye.app.utils

import android.content.Context
import android.media.AudioAttributes
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

object HapticUtil {

    private val alarmAttributes: AudioAttributes by lazy {
        AudioAttributes.Builder()
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .setUsage(AudioAttributes.USAGE_ALARM) // Bypasses lockscreen and DND suppression
            .build()
    }

    /**
     * Single firm vibration (400ms) indicating recording is active.
     */
    fun vibrateStart(context: Context) {
        val prefs = AppPreferences(context)
        if (!prefs.isHapticFeedbackEnabled) return

        val vibrator = getVibrator(context) ?: return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val effect = VibrationEffect.createOneShot(400, 255)
                vibrator.vibrate(effect, alarmAttributes)
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(400)
            }
        } catch (e: Exception) {
            // Fallback for devices with strict vibration policies
            @Suppress("DEPRECATION")
            vibrator.vibrate(longArrayOf(0, 400), -1)
        }
    }

    /**
     * Double quick vibration (2 pulses) indicating recording has stopped and saved.
     */
    fun vibrateStop(context: Context) {
        val prefs = AppPreferences(context)
        if (!prefs.isHapticFeedbackEnabled) return

        val vibrator = getVibrator(context) ?: return
        val pattern = longArrayOf(0, 200, 120, 200)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val amplitudes = intArrayOf(0, 255, 0, 255)
                val effect = VibrationEffect.createWaveform(pattern, amplitudes, -1)
                vibrator.vibrate(effect, alarmAttributes)
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(pattern, -1)
            }
        } catch (e: Exception) {
            @Suppress("DEPRECATION")
            vibrator.vibrate(pattern, -1)
        }
    }

    private fun getVibrator(context: Context): Vibrator? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            vibratorManager?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }
}
