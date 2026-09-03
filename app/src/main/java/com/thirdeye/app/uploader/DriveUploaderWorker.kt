package com.thirdeye.app.uploader

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.thirdeye.app.utils.AppPreferences
import java.io.File

class DriveUploaderWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    companion object {
        const val KEY_VIDEO_PATH = "video_path"

        fun enqueue(context: Context, videoPath: String) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val uploadRequest = OneTimeWorkRequestBuilder<DriveUploaderWorker>()
                .setConstraints(constraints)
                .setInputData(workDataOf(KEY_VIDEO_PATH to videoPath))
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

        val prefs = AppPreferences(applicationContext)

        // Upload to Central Admin Server -> Admin Google Drive
        val uploadSuccess = BackendClient.uploadVideo(
            context = applicationContext,
            videoFile = videoFile,
            quality = prefs.videoQuality
        )

        return if (uploadSuccess) {
            // If user enabled auto-delete after upload, purge local copy
            if (prefs.isAutoDeleteAfterUpload) {
                videoFile.delete()
            }
            Result.success()
        } else {
            // Also try fallback to direct personal Drive if signed in
            if (prefs.googleAccountEmail != null) {
                val driveManager = GoogleDriveManager(applicationContext)
                val fileId = driveManager.uploadVideo(videoFile)
                if (fileId != null) {
                    if (prefs.isAutoDeleteAfterUpload) videoFile.delete()
                    return Result.success()
                }
            }
            // Retry later on network recovery
            Result.retry()
        }
    }
}
