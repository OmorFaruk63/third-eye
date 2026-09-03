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

        val driveManager = GoogleDriveManager(applicationContext)
        val fileId = driveManager.uploadVideo(videoFile)

        return if (fileId != null) {
            val prefs = AppPreferences(applicationContext)
            // If user enabled auto-delete after upload, purge local copy
            if (prefs.isAutoDeleteAfterUpload) {
                videoFile.delete()
            }
            Result.success()
        } else {
            // Retry later if upload failed due to network glitch
            Result.retry()
        }
    }
}
