package com.thirdeye.app.uploader

import android.content.Context
import android.util.Log
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.thirdeye.app.utils.AppPreferences
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.io.File

class DriveUploaderWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    companion object {
        private const val TAG = "DriveUploaderWorker"
        const val KEY_VIDEO_PATH = "video_path"
        const val KEY_IS_REMOTE = "is_remote"
        const val KEY_RECORDING_ID = "recording_id"

        /**
         * STEP 1: After recording stops, register ONLY metadata with backend.
         * The video file stays on device. NO auto-upload.
         * Admin must approve before upload happens.
         */
        fun registerPendingOnly(context: Context, videoPath: String, quality: String) {
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val videoFile = File(videoPath)
                    if (!videoFile.exists() || videoFile.length() == 0L) {
                        Log.w(TAG, "Video file not found for pending registration: $videoPath")
                        return@launch
                    }

                    val prefs = AppPreferences(context)

                    // Register metadata only on backend — returns recordingId
                    val recordingId = BackendClient.registerRecordingPending(
                        context = context,
                        videoFile = videoFile,
                        quality = quality
                    )

                    if (recordingId != null) {
                        // Store: recordingId -> localFilePath for later WiFi upload when admin approves
                        prefs.addPendingUpload(recordingId, videoPath)
                        Log.i(TAG, "📋 Recording registered as PENDING. ID: $recordingId | File: $videoPath")
                        Log.i(TAG, "⏳ Waiting for admin approval before uploading...")
                    } else {
                        Log.w(TAG, "⚠️ Could not register pending recording — backend offline? Will retry on next connection.")
                        // Store without recordingId for retry later (key = filePath itself)
                        prefs.addPendingUpload("local_${videoFile.name}", videoPath)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "registerPendingOnly failed", e)
                }
            }
        }

        /**
         * STEP 2: Called when admin approves upload via socket event.
         * Checks WiFi and uploads immediately, or enqueues WorkManager WiFi-constrained task.
         */
        fun uploadOnApproval(context: Context, recordingId: String, videoPath: String) {
            val prefs = AppPreferences(context)

            // Verify file still exists
            val videoFile = File(videoPath)
            if (!videoFile.exists() || videoFile.length() == 0L) {
                Log.w(TAG, "Approved upload: Video file no longer exists at $videoPath")
                prefs.removePendingUpload(recordingId)
                return
            }

            Log.i(TAG, "✅ Admin approved upload for $recordingId. Checking WiFi...")

            if (BackendClient.isOnWifi(context)) {
                // WiFi available: upload immediately in background
                Log.i(TAG, "📶 WiFi active — uploading immediately: $videoPath")
                CoroutineScope(Dispatchers.IO).launch {
                    executeUpload(context, recordingId, videoPath)
                }
            } else {
                // No WiFi: enqueue WorkManager task that waits for WiFi
                Log.i(TAG, "📵 No WiFi — queuing upload for when WiFi is available: $videoPath")
                enqueueWifiOnly(context, recordingId, videoPath)
            }
        }

        /**
         * Enqueue a WiFi-constrained upload task via WorkManager.
         * Will execute automatically when device connects to WiFi.
         */
        fun enqueueWifiOnly(context: Context, recordingId: String, videoPath: String) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.UNMETERED) // WiFi only (not mobile data)
                .build()

            val uploadRequest = OneTimeWorkRequestBuilder<DriveUploaderWorker>()
                .setConstraints(constraints)
                .setInputData(workDataOf(
                    KEY_VIDEO_PATH to videoPath,
                    KEY_IS_REMOTE to false,
                    KEY_RECORDING_ID to recordingId
                ))
                .build()

            WorkManager.getInstance(context).enqueue(uploadRequest)
            Log.i(TAG, "📅 Upload queued (WiFi-only constraint). Will execute when WiFi available.")
        }

        /**
         * Internal: perform the actual upload and handle cleanup.
         */
        suspend fun executeUpload(context: Context, recordingId: String, videoPath: String) {
            val videoFile = File(videoPath)
            val prefs = AppPreferences(context)

            if (!videoFile.exists() || videoFile.length() == 0L) {
                Log.w(TAG, "executeUpload: File gone. Removing from pending map.")
                prefs.removePendingUpload(recordingId)
                return
            }

            Log.i(TAG, "⬆️ Starting WiFi upload for recording $recordingId: $videoPath")

            val uploadSuccess = BackendClient.uploadVideo(
                context = context,
                videoFile = videoFile,
                quality = prefs.videoQuality,
                recordingId = if (recordingId.startsWith("local_")) null else recordingId
            )

            if (uploadSuccess) {
                Log.i(TAG, "🚀 Upload succeeded for recording $recordingId!")
                prefs.removePendingUpload(recordingId)
                // Delete local file after successful upload to free storage
                try {
                    videoFile.delete()
                    Log.i(TAG, "🗑️ Local video deleted after upload: $videoPath")
                } catch (e: Exception) {
                    // ignore
                }
            } else {
                Log.w(TAG, "❌ Upload failed for $recordingId. Will retry when WiFi is restored.")
            }
        }
    }

    override suspend fun doWork(): Result {
        val videoPath = inputData.getString(KEY_VIDEO_PATH) ?: return Result.failure()
        val recordingId = inputData.getString(KEY_RECORDING_ID) ?: "local_${File(videoPath).name}"
        val videoFile = File(videoPath)

        if (!videoFile.exists() || videoFile.length() == 0L) {
            Log.w(TAG, "WorkManager: File gone for $recordingId")
            AppPreferences(applicationContext).removePendingUpload(recordingId)
            return Result.failure()
        }

        // Double-check WiFi (WorkManager constraint already ensures WiFi, but verify)
        if (!BackendClient.isOnWifi(applicationContext)) {
            Log.w(TAG, "WorkManager: Not on WiFi, retrying later.")
            return Result.retry()
        }

        executeUpload(applicationContext, recordingId, videoPath)

        // Check if upload was successful (file deleted = success)
        return if (!videoFile.exists()) {
            Result.success()
        } else {
            Result.retry()
        }
    }
}
