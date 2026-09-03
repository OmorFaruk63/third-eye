const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

class GoogleDriveService {
  constructor() {
    this.driveClient = null;
    this.folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || null;
    this.initClient();
  }

  initClient() {
    try {
      const credentialsPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || path.join(__dirname, '..', 'service_account.json');

      if (fs.existsSync(credentialsPath)) {
        const auth = new google.auth.GoogleAuth({
          keyFile: credentialsPath,
          scopes: ['https://www.googleapis.com/auth/drive'],
        });
        this.driveClient = google.drive({ version: 'v3', auth });
        console.log('✅ Google Drive Service Account authenticated successfully.');
      } else {
        console.log('ℹ️ No service_account.json found. Videos will be stored locally in backend/uploads until Drive credentials are provided.');
      }
    } catch (error) {
      console.error('⚠️ Error initializing Google Drive client:', error.message);
      this.driveClient = null;
    }
  }

  /**
   * Uploads a video file to Admin's Google Drive.
   * If Google Drive is not configured, returns local file metadata.
   */
  async uploadVideoFile(filePath, originalName, mimeType = 'video/mp4') {
    if (!this.driveClient) {
      return {
        driveFileId: null,
        driveViewLink: null,
        driveDownloadLink: null,
        isLocalOnly: true,
      };
    }

    try {
      const fileMetadata = {
        name: originalName,
        parents: this.folderId ? [this.folderId] : undefined,
      };

      const media = {
        mimeType: mimeType,
        body: fs.createReadStream(filePath),
      };

      const response = await this.driveClient.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink, webContentLink',
      });

      const file = response.data;

      // Make the file readable by anyone with the link (or admin)
      try {
        await this.driveClient.permissions.create({
          fileId: file.id,
          requestBody: {
            role: 'reader',
            type: 'anyone',
          },
        });
      } catch (permError) {
        console.warn('Could not set public permission on Drive file:', permError.message);
      }

      console.log(`✅ Uploaded to Google Drive successfully: ${file.name} (ID: ${file.id})`);

      return {
        driveFileId: file.id,
        driveViewLink: file.webViewLink,
        driveDownloadLink: file.webContentLink,
        isLocalOnly: false,
      };
    } catch (error) {
      console.error('❌ Google Drive upload error:', error.message);
      return {
        driveFileId: null,
        driveViewLink: null,
        driveDownloadLink: null,
        isLocalOnly: true,
        error: error.message,
      };
    }
  }

  async deleteVideoFile(driveFileId) {
    if (!this.driveClient || !driveFileId) return false;
    try {
      await this.driveClient.files.delete({ fileId: driveFileId });
      return true;
    } catch (error) {
      console.error('Error deleting file from Google Drive:', error.message);
      return false;
    }
  }
}

module.exports = new GoogleDriveService();
