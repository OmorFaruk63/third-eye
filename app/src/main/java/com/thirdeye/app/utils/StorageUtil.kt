package com.thirdeye.app.utils

import android.content.Context
import android.os.Environment
import android.os.StatFs
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object StorageUtil {

    /**
     * Returns the private hidden directory for recorded videos.
     * Contains a .nomedia file so standard Android gallery/photos won't index it.
     */
    fun getSecretVideoDirectory(context: Context): File {
        val baseDir = context.getExternalFilesDir(Environment.DIRECTORY_MOVIES) ?: context.filesDir
        val secretFolder = File(baseDir, ".vault")
        if (!secretFolder.exists()) {
            secretFolder.mkdirs()
        }

        // Place .nomedia file inside to hide from gallery scanners
        val noMedia = File(secretFolder, ".nomedia")
        if (!noMedia.exists()) {
            try {
                noMedia.createNewFile()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        return secretFolder
    }

    /**
     * Creates a new output MP4 file with timestamp.
     */
    fun createOutputFile(context: Context): File {
        val dir = getSecretVideoDirectory(context)
        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        return File(dir, "REC_${timestamp}.mp4")
    }

    /**
     * Returns available storage in Megabytes.
     */
    fun getAvailableStorageMB(context: Context): Long {
        val dir = getSecretVideoDirectory(context)
        val stat = StatFs(dir.path)
        val bytesAvailable = stat.availableBlocksLong * stat.blockSizeLong
        return bytesAvailable / (1024 * 1024)
    }

    /**
     * Returns list of all secretly recorded videos, sorted newest first.
     */
    fun getRecordedVideos(context: Context): List<File> {
        val dir = getSecretVideoDirectory(context)
        return dir.listFiles { file ->
            file.isFile && file.name.endsWith(".mp4") && file.length() > 0
        }?.sortedByDescending { it.lastModified() } ?: emptyList()
    }
}
