const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

class GoogleDriveService {
  constructor() {
    this.driveClient = null;
    this.oauth2Client = null;
    this.folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1thS0Co1WaK8rboJXRJWI86o3A-rmGmKO';
    this.initOAuthClient();
    this.initClient();
  }

  initOAuthClient(redirectUri) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const uri = redirectUri || process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/admin/auth/google/callback';

    if (clientId && clientSecret) {
      this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, uri);
    }
  }

  getAuthUrl(host) {
    let currentRedirect = 'http://localhost:5000/api/admin/auth/google/callback';
    if (host && host.includes('onrender.com')) {
      currentRedirect = `https://${host}/api/admin/auth/google/callback`;
    }
    this.initOAuthClient(currentRedirect);

    if (!this.oauth2Client) return null;

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive',
      ],
    });
  }

  async handleAuthCallback(code, redirectUri) {
    this.initOAuthClient(redirectUri);

    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);

    if (tokens.refresh_token) {
      this.saveRefreshToken(tokens.refresh_token);
    }

    this.driveClient = google.drive({ version: 'v3', auth: this.oauth2Client });
    console.log('✅ Google Drive OAuth authenticated successfully with Admin account!');
    return tokens;
  }

  saveRefreshToken(refreshToken) {
    process.env.GOOGLE_REFRESH_TOKEN = refreshToken;
    try {
      const envPath = path.join(__dirname, '..', '.env');
      let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
      if (content.includes('GOOGLE_REFRESH_TOKEN=')) {
        content = content.replace(/GOOGLE_REFRESH_TOKEN=.*/, `GOOGLE_REFRESH_TOKEN=${refreshToken}`);
      } else {
        content += `\nGOOGLE_REFRESH_TOKEN=${refreshToken}\n`;
      }
      fs.writeFileSync(envPath, content);
      console.log('💾 Persisted GOOGLE_REFRESH_TOKEN to .env');
    } catch (e) {
      console.warn('Could not persist refresh token to .env:', e.message);
    }
  }

  initClient() {
    try {
      this.folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1thS0Co1WaK8rboJXRJWI86o3A-rmGmKO';

      const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
      if (refreshToken && this.oauth2Client) {
        this.oauth2Client.setCredentials({ refresh_token: refreshToken });
        this.driveClient = google.drive({ version: 'v3', auth: this.oauth2Client });
        console.log('✅ Google Drive OAuth authenticated using saved Refresh Token.');
        return;
      }

      // Fallback: Check service account credentials
      const credentialsPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || path.join(__dirname, '..', 'service_account.json');
      if (fs.existsSync(credentialsPath)) {
        const auth = new google.auth.GoogleAuth({
          keyFile: credentialsPath,
          scopes: ['https://www.googleapis.com/auth/drive'],
        });
        this.driveClient = google.drive({ version: 'v3', auth });
        console.log('✅ Google Drive Service Account authenticated successfully.');
      } else {
        console.log('ℹ️ Google Drive awaiting authentication.');
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

      // Make the file readable with link
      try {
        await this.driveClient.permissions.create({
          fileId: file.id,
          requestBody: {
            role: 'reader',
            type: 'anyone',
          },
        });
      } catch (permError) {
        // Continue even if permission set is restricted
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
