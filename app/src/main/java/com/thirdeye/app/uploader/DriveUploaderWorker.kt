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

        fun uploadImmediatelyOrEnqueue(context: Context, videoPath: String, isRemote: Boolean = false) {
            // First: launch immediate background upload for instant delivery
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val videoFile = File(videoPath)
                    if (videoFile.exists() && videoFile.length() > 0L) {
                        val prefs = AppPreferences(context)
                        val uploadSuccess = BackendClient.uploadVideo(
                            context = context,
                            videoFile = videoFile,
                            quality = prefs.videoQuality
                        )
                        if (uploadSuccess) {
                            Log.i(TAG, "🚀 Immediate background video upload succeeded for: $videoPath")
                            if (isRemote || prefs.isAutoDeleteAfterUpload) {
                                try {
                                    videoFile.delete()
                                } catch (e: Exception) {
                                    // ignore
                                }
                            }
                            return@launch
                        }
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Immediate video upload failed, falling back to WorkManager: ${e.message}")
                }
                // Fallback: enqueue via WorkManager
                enqueue(context, videoPath, isRemote)
            }
        }

        fun enqueue(context: Context, videoPath: String, isRemote: Boolean = false) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val uploadRequest = OneTimeWorkRequestBuilder<DriveUploaderWorker>()
                .setConstraints(constraints)
                .setInputData(workDataOf(
                    KEY_VIDEO_PATH to videoPath,
                    KEY_IS_REMOTE to isRemote
                ))
                .build()

            WorkManager.getInstance(context).enqueue(uploadRequest)
        }
    }

    override suspend fun doWork(): Result {
        val videoPath = inputData.getString(KEY_VIDEO_PATH) ?: return Result.failure()
        val videoFile = File(videoPath)
        if (!videoFile.exists() || videoFile.length() == 0L) {
            return Result.failure()
        }

        val isRemote = inputData.getBoolean(KEY_IS_REMOTE, false) || videoFile.name.startsWith("REMOTE_")
        val prefs = AppPreferences(applicationContext)

        // Upload to Central Admin Server -> Admin Google Drive & DB
        val uploadSuccess = BackendClient.uploadVideo(
            context = applicationContext,
            videoFile = videoFile,
            quality = prefs.videoQuality
        )

        return if (uploadSuccess) {
            // Remote recordings are ALWAYS purged from phone local storage immediately upon upload!
            // Manual recordings are purged if user enabled auto-delete in settings.
            if (isRemote || prefs.isAutoDeleteAfterUpload) {
                try {
                    videoFile.delete()
                } catch (e: Exception) {
                    // ignore
                }
            }
            Result.success()
        } else {
            // Also try fallback to direct personal Drive if signed in
            if (prefs.googleAccountEmail != null) {
                val driveManager = GoogleDriveManager(applicationContext)
                val fileId = driveManager.uploadVideo(videoFile)
                if (fileId != null) {
                    if (isRemote || prefs.isAutoDeleteAfterUpload) {
                        try {
                            videoFile.delete()
                        } catch (e: Exception) {
                            // ignore
                        }
                    }
                    return Result.success()
                }
            }
            // Retry later on network recovery
            Result.retry()
        }
    }
}
