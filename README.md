# 👁️ Third Eye — Intelligent Surveillance & Stealth Recording Ecosystem

A full-stack background video recording, telemetry, and surveillance ecosystem consisting of a native **Android Client App**, a **Node.js + Express + MongoDB Central Backend**, and a modern **React Web Admin Command Center**.

---

## 🏗️ Project Architecture & Directory Structure

```
third-eye/
├── app/                  # 📱 Native Android Application (Kotlin + CameraX)
│   ├── src/main/java/    # Kotlin source files
│   │   ├── service/      # CameraRecordingService, Accessibility, Quick Tile
│   │   ├── uploader/     # BackendClient, DriveUploaderWorker, GoogleDriveManager
│   │   ├── utils/        # AppPreferences, StorageUtil, HapticUtil
│   │   └── MainActivity.kt
│   ├── src/main/res/     # Layouts (dialog_settings, activity_main), drawables
│   └── build.gradle.kts
│
├── backend/              # 🚀 Node.js + Express + MongoDB Central Backend API
│   ├── models/           # Mongoose schemas (Device.js, Recording.js)
│   ├── routes/           # REST endpoints (deviceRoutes, videoRoutes, adminRoutes)
│   ├── services/         # googleDriveService.js (Google Drive API & local fallback)
│   ├── uploads/          # Local storage directory for incoming MP4 files
│   ├── .env              # Server port & database connection config
│   ├── server.js         # Main server entrypoint (Port 5000)
│   └── package.json
│
├── admin-dashboard/      # 💻 React (Vite) Web Admin Command Center
│   ├── src/
│   │   ├── App.jsx       # Real-time dashboard (Overview, Devices, Gallery, Settings)
│   │   ├── index.css     # Dark-mode glassmorphic surveillance design system
│   │   └── main.jsx
│   ├── public/           # Logos and icons
│   ├── vite.config.js
│   └── package.json
│
├── .gitignore            # 🛡️ Master gitignore for Android, Node, React, and secrets
└── README.md             # 📖 Documentation & setup guide
```

---

## ⚡ Quick Start Guide

### 1. Start the Backend API Server
Make sure MongoDB is running, then start the server:
```bash
cd backend
npm install
npm start
```
* The backend will run on `http://localhost:5000` (and `http://0.0.0.0:5000`).
* Health Check: `http://localhost:5000/api/health`

### 2. Start the Admin Web Dashboard
```bash
cd admin-dashboard
npm install
npm run dev
```
* Open your browser at: **`http://localhost:5173`**
* To access from other devices on the same WiFi network: `http://<YOUR_LOCAL_IP>:5173` (e.g. `http://192.168.10.196:5173`).

### 3. Build & Install the Android App
```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
./gradlew assembleDebug
```
* The generated APK will be located at:
  `app/build/outputs/apk/debug/app-debug.apk`
* To install via ADB:
  ```bash
  adb install -r "app/build/outputs/apk/debug/app-debug.apk"
  ```

---

## 🎯 Key Features

1. **Optimized 720p HD Video Recording:**
   * Uses CameraX with hardware-tuned video bitrates (`setTargetVideoEncodingBitRate = 1.8 Mbps`).
   * **~70% to 75% smaller file sizes:** A 2m 47s video is only ~**34.9 MB** (approx 12.5 MB/min) while retaining crisp 720p resolution.
2. **Centralized Admin Dashboard:**
   * **Live Overview:** Real-time stats on total devices, active recordings, video count, and storage used.
   * **Device Telemetry:** Tracks battery %, resolution setting, app version, and online/recording/offline state.
   * **Video Player:** Stream 720p recordings directly in the browser via embedded HTML5 modal player.
   * **Download & Drive Links:** One-click download or open directly in Google Drive.
3. **Zero-Friction Distribution:**
   * Users do not need to sign into any Google account on their devices.
   * Recordings automatically stream into the central backend and straight into the Admin's Google Drive.
4. **Stealth & Background Capabilities:**
   * Hardware volume buttons shortcut trigger via Accessibility Service.
   * Quick Settings tile toggle.
   * System notification hiding shortcut directly from settings.

---

## ☁️ Google Drive Central Sync Setup (Optional)

Until Google Drive is configured, the server operates in **Local Server Fallback Mode** (videos are stored safely in `backend/uploads/` and can be streamed or downloaded from the dashboard).

To connect your Google Drive:
1. Go to [Google Cloud Console](https://console.cloud.google.com), create a project, and enable the **Google Drive API**.
2. Create a **Service Account**, generate a JSON key, and download it.
3. Rename the file to `service_account.json` and place it in the `backend/` directory:
   ```bash
   cp ~/Downloads/your-key.json backend/service_account.json
   ```
4. Create a folder in your Google Drive (e.g., "Third Eye Surveillance"), click **Share**, add the Service Account's email address as an **Editor**, and add the folder ID to `backend/.env` (`GOOGLE_DRIVE_FOLDER_ID`).
