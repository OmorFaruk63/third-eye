package com.thirdeye.app.uploader

import android.content.Context
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.api.client.googleapis.extensions.android.gms.auth.GoogleAccountCredential
import com.google.api.client.http.FileContent
import com.google.api.client.http.javanet.NetHttpTransport
import com.google.api.client.json.gson.GsonFactory
import com.google.api.services.drive.Drive
import com.google.api.services.drive.DriveScopes
import com.google.api.services.drive.model.File as DriveFile
import java.io.File
import java.util.Collections

class GoogleDriveManager(private val context: Context) {

    private fun getDriveService(): Drive? {
        val account: GoogleSignInAccount = GoogleSignIn.getLastSignedInAccount(context) ?: return null
        val credential = GoogleAccountCredential.usingOAuth2(
            context, Collections.singleton(DriveScopes.DRIVE_FILE)
        ).apply {
            selectedAccount = account.account
        }

        return Drive.Builder(
            NetHttpTransport(),
            GsonFactory.getDefaultInstance(),
            credential
        ).setApplicationName("Third Eye").build()
    }

    /**
     * Uploads an MP4 video file to a 'Third Eye Vault' folder on user's Google Drive.
     * Returns the Drive File ID if successful, or null on failure.
     */
    fun uploadVideo(videoFile: File): String? {
        val driveService = getDriveService() ?: return null

        try {
            // Find or create 'Third Eye Vault' folder
            val folderId = getOrCreateFolder(driveService, "Third Eye Vault")

            val fileMetadata = DriveFile().apply {
                name = videoFile.name
                mimeType = "video/mp4"
                if (folderId != null) {
                    parents = listOf(folderId)
                }
            }

            val mediaContent = FileContent("video/mp4", videoFile)
            val uploadedFile = driveService.files().create(fileMetadata, mediaContent)
                .setFields("id, name")
                .execute()

            return uploadedFile.id
        } catch (e: Exception) {
            e.printStackTrace()
            return null
        }
    }

    private fun getOrCreateFolder(driveService: Drive, folderName: String): String? {
        try {
            val query = "mimeType = 'application/vnd.google-apps.folder' and name = '$folderName' and trashed = false"
            val result = driveService.files().list()
                .setQ(query)
                .setSpaces("drive")
                .setFields("files(id, name)")
                .execute()

            if (!result.files.isNullOrEmpty()) {
                return result.files[0].id
            }

            // Create folder
            val folderMetadata = DriveFile().apply {
                name = folderName
                mimeType = "application/vnd.google-apps.folder"
            }
            val created = driveService.files().create(folderMetadata)
                .setFields("id")
                .execute()
            return created.id
        } catch (e: Exception) {
            e.printStackTrace()
            return null
        }
    }
}
