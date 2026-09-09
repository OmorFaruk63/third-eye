# 👁️ Third Eye — Intelligent Surveillance & Stealth Recording Ecosystem

[![Download APK](https://img.shields.io/badge/Download-Latest%20APK-2ea44f?style=for-the-badge&logo=android&logoColor=white)](https://github.com/OmorFaruk63/third-eye/releases/latest)
[![Releases](https://img.shields.io/badge/GitHub-Releases-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/OmorFaruk63/third-eye/releases)
[![Platform](https://img.shields.io/badge/Platform-Android%208.0%2B-blue?style=for-the-badge&logo=android&logoColor=white)](https://github.com/OmorFaruk63/third-eye)

A full-stack background video recording, telemetry, and surveillance ecosystem consisting of a native **Android Client App**, a **Node.js + Express + MongoDB Central Backend**, and a modern **React Web Admin Command Center**.

---

## 📥 Download Android App (APK)

Get the latest version of the **Third Eye** client app directly on your Android device:

| Action | Link | Description |
| :--- | :--- | :--- |
| 🚀 **Direct Download** | [**Download ThirdEye APK (`app-prod-release.apk`)**](https://github.com/OmorFaruk63/third-eye/releases/latest/download/app-prod-release.apk) | Latest production build APK |
| 📦 **All Releases** | [**GitHub Releases Page**](https://github.com/OmorFaruk63/third-eye/releases) | View changelogs, versions, and assets |

---

### 📲 Quick Installation Guide (Android)

1. **Download APK**: Tap on [Download ThirdEye APK](https://github.com/OmorFaruk63/third-eye/releases/latest/download/app-prod-release.apk) using your mobile browser (Chrome, Samsung Internet, etc.).
2. **Allow Unknown Sources**: When prompted by Android, enable **"Allow from this source"** for your browser to proceed with the installation.
3. **Install & Launch**: Tap **Install** and open **Third Eye**.
4. **Grant Required Permissions**:
   * 📷 **Camera & Microphone**: Required for background stealth video and audio capture.
   * 🔔 **Notifications**: Required to keep the background recording service persistent.
   * ♿ **Accessibility Service** *(Recommended)*: Open Settings inside the app and enable **"Third Eye Shortcut"** in Android Accessibility settings. This enables hardware **Volume Key** triggers.
5. **Configure Trigger Preference (Settings)**:
   * **2-Click Trigger**: Double-tap `Volume Up` to start/stop.
   * **3-Click Trigger (Recommended)**: Triple-tap `Volume Up` to start/stop — prevents accidental triggers.
   * 🛡️ **Smart Call & Movie Protection**: Built-in audio detection automatically ignores volume clicks while you are on a phone call or watching videos/movies!

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

---

## 📦 How to Publish an APK to GitHub Releases

To make the direct download links above work for anyone downloading from GitHub:

1. **Build the APK**:
   * In Android Studio: Go to **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**.
   * Or via terminal: `./gradlew assembleRelease` (or `./gradlew assembleDebug`).
   * Rename the resulting `.apk` file to **`app-release.apk`**.
2. **Create a Release on GitHub**:
   * Open [https://github.com/OmorFaruk63/third-eye/releases/new](https://github.com/OmorFaruk63/third-eye/releases/new).
   * Enter a tag version (e.g., `v1.0.0`) and title (e.g., `Third Eye v1.0.0`).
   * Drag and drop `app-release.apk` into the **"Attach binaries by dropping them here or selecting them"** area.
   * Click **Publish release**.
3. Once published, the link `https://github.com/OmorFaruk63/third-eye/releases/latest/download/app-release.apk` will automatically download the APK!
