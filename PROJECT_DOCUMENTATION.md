# 👁️ Third Eye — Complete System Architecture & Codebase Documentation

> **Purpose of this document:**  
> This document provides an exhaustive, file-by-file breakdown of the entire **Third Eye** project (Android App, Backend Server, and Admin Dashboard). Any developer or AI starting a new conversation can read this single file to understand 100% of the project architecture, data flows, communication protocols, and known operational issues.

---

## 📑 Table of Contents
1. [Project Overview & Architecture](#1-project-overview--architecture)
2. [Ecosystem Architecture & Flow Diagram](#2-ecosystem-architecture--flow-diagram)
3. [Android Application (`app/`) — Complete File Breakdown](#3-android-application-app--complete-file-breakdown)
4. [Backend API & Socket Server (`backend/`) — Complete File Breakdown](#4-backend-api--socket-server-backend--complete-file-breakdown)
5. [Admin Web Command Center (`admin-dashboard/`) — Complete File Breakdown](#5-admin-web-command-center-admin-dashboard--complete-file-breakdown)
6. [Deep Root Cause Analysis of User's Bugs](#6-deep-root-cause-analysis-of-users-bugs)
   - Bug 1: "Auto Record Hoitese" (Automatic / Unintended Recording)
   - Bug 2: "2 Click Korle Off Hoy Na" (Fails to Stop on Double Press / Clicks)
7. [Step-by-Step Solution & Implementation Plan](#7-step-by-step-solution--implementation-plan)

---

## 1. Project Overview & Architecture

**Third Eye** is an intelligent stealth background recording, surveillance, and telemetry ecosystem designed for remote security, hardware diagnostics, and cloud archiving.

The ecosystem is made of three independent yet tightly integrated components:
1. **Native Android Application (`app/`)**: Built with **Kotlin, Android Jetpack, CameraX, WorkManager, and Socket.io Client**. Operates silently in the background, records 720p/480p/1080p video without an on-screen preview, streams real-time MJPEG frames + PCM audio over WebSockets, captures GPS and battery telemetry, and uploads completed recordings to the central server and Google Drive.
2. **Central Backend Relay Server (`backend/`)**: Built with **Node.js, Express, Socket.io v4, MongoDB (Mongoose), and Google Drive API v3**. Deployed on Render (`https://third-eye-backend-a319.onrender.com`). Acts as the command relay for live camera feeds, stores device heartbeats in MongoDB, receives MP4 video uploads from client phones, automatically transfers videos to the admin's Google Drive, and streams video with HTTP 206 Partial Content (range requests) to the admin web dashboard.
3. **Admin Web Command Center (`admin-dashboard/`)**: Built with **React 18, Vite, Material UI (MUI v6), Lucide Icons, and Socket.io Client**. Displays real-time device telemetry (battery %, charging state, GPS location on Google Maps, resolution, online status), provides a silent **Live Camera & Audio Stream** viewer with front/back lens toggle and snapshot capture, and a **Surveillance Video Archive** to play, download, and batch-delete recordings.

---

## 2. Ecosystem Architecture & Flow Diagram

```mermaid
graph TD
    subgraph "Android Client Device"
        MA[MainActivity.kt] --> CRS[CameraRecordingService.kt]
        KSAS[KeyShortcutAccessibilityService.kt] -->|Volume Double-Click| CRS
        QRTS[QuickRecordTileService.kt] -->|QS Tile Tap| CRS
        SM[SocketManager.kt] -->|start-remote-recording| CRS
        CRS -->|Video Record Event| SP[AppPreferences.kt]
        CRS -->|MP4 File Saved| DUW[DriveUploaderWorker.kt]
        DUW --> BC[BackendClient.kt]
        DTS[DeviceTelemetryService.kt] -->|20s Heartbeat| SM
        DTS -->|60s Telemetry Ping| BC
        SM -->|Live Frames / Audio| LSS[LiveStreamService.kt]
    end

    subgraph "Central Cloud Backend (Render)"
        SERVER[server.js (Port 5000 / WebSocket)]
        DEV_ROUTE[routes/deviceRoutes.js]
        VID_ROUTE[routes/videoRoutes.js]
        G_DRIVE[services/googleDriveService.js]
        MONGO[(MongoDB Atlas / Local)]
        SERVER --- DEV_ROUTE
        SERVER --- VID_ROUTE
        VID_ROUTE --> G_DRIVE
        DEV_ROUTE --> MONGO
        VID_ROUTE --> MONGO
    end

    subgraph "Admin Command Center (React)"
        DASH[App.jsx & DashboardContext.jsx]
        DASH --> OVERVIEW[Overview.jsx]
        DASH --> DEVICES[Devices.jsx]
        DASH --> RECORDINGS[Recordings.jsx]
        DASH --> SETTINGS[Settings.jsx]
    end

    subgraph "Google Cloud Storage"
        GDRIVE_API[(Google Drive Folder: Third Eye Vault)]
    end

    BC -->|POST /api/device/ping| DEV_ROUTE
    BC -->|POST /api/videos/upload| VID_ROUTE
    SM <-->|WebSocket bi-directional| SERVER
    SERVER <-->|WebSocket bi-directional| DASH
    DASH -->|REST API /api/admin/stats| SERVER
    G_DRIVE -->|Upload MP4 & Stream| GDRIVE_API
```

---

## 3. Android Application (`app/`) — Complete File Breakdown

All Android code resides under `app/src/main/java/com/thirdeye/app/`.

### 1. `MainActivity.kt` (`com.thirdeye.app.MainActivity`)
- **Primary Function**: The main UI entrypoint for user interaction.
- **Key Responsibilities**:
  - Checks if the disguise mode is enabled (`prefs.isDisguiseEnabled`). If enabled and not launched with `FROM_DISGUISE` intent flag, redirects immediately to `CalculatorActivity` and finishes.
  - Handles runtime permissions: `CAMERA`, `RECORD_AUDIO`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `POST_NOTIFICATIONS`.
  - Prompts for battery optimization exemption (`ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`).
  - Initializes `DeviceTelemetryService` and connects `SocketManager` to keep the device online.
  - Registers a dynamic `BroadcastReceiver` for `CameraRecordingService.ACTION_RECORDING_STATUS_CHANGED` to update recording buttons and timer in real time.
  - Contains `updateRecordingUI(isRecording)`: switches between red pulsating stop button and cyan record button, and runs the live second timer (`00:00 / 30:00`).
  - Launches the Google Drive sign-in picker (`GoogleSignInOptions`) and bottom sheets for Settings (`showSettingsDialog()`) and Vault (`showVaultDialog()`).

### 2. `service/CameraRecordingService.kt` (`com.thirdeye.app.service.CameraRecordingService`)
- **Primary Function**: The Android `LifecycleService` and `ForegroundService` responsible for silent background video recording using CameraX.
- **Key Responsibilities**:
  - Runs in the foreground with a persistent `Notification` on `thirdeye_silent_service_channel` (priority `MIN`, completely silent) with `foregroundServiceType="camera|microphone"`.
  - Binds CameraX `VideoCapture<Recorder>` directly to the service lifecycle without needing any visible `Preview` or UI layout on screen.
  - Supports front or back lens (`prefs.cameraLens`) and configurable video resolutions (`480p`, `720p`, `1080p`).
  - **Offline Bitrate Tuning**: Sets `targetVideoEncodingBitRate` (480p: 900 kbps, 720p: 1.8 Mbps, 1080p: 4.0 Mbps) to shrink video file sizes by ~70% without quality loss.
  - Manages countdown auto-stop timer via `timerJob` based on `prefs.maxDurationMinutes` (e.g. 5, 15, 30 min).
  - Listens to `Intent.ACTION_BATTERY_LOW` to gracefully finalize and save video before the phone dies.
  - Upon finalize (`VideoRecordEvent.Finalize`), delegates the saved MP4 file path to `DriveUploaderWorker.enqueue(...)` for cloud upload, notifies receivers, stops foreground, and terminates.

### 3. `service/KeyShortcutAccessibilityService.kt` (`com.thirdeye.app.service.KeyShortcutAccessibilityService`)
- **Primary Function**: Hardware key interceptor that listens for physical volume button events while screen is locked or another app is open.
- **Key Responsibilities**:
  - Intercepts `KeyEvent` via accessibility filter (`FLAG_REQUEST_FILTER_KEY_EVENTS`).
  - Tracks `lastVolumeUpTime` and `lastVolumeDownTime`.
  - Intended to detect double-clicks within a time window (`MIN_CLICK_INTERVAL` to `DOUBLE_CLICK_TIME_DELTA`).
  - Calls `toggleRecording()` which triggers `CameraRecordingService.startService` or `stopService` with vibration feedback.

### 4. `service/DeviceTelemetryService.kt` (`com.thirdeye.app.service.DeviceTelemetryService`)
- **Primary Function**: 24/7 persistent background daemon maintaining constant connectivity to the backend.
- **Key Responsibilities**:
  - Runs as `FOREGROUND_SERVICE_TYPE_DATA_SYNC` with a low-importance notification.
  - Holds a `PowerManager.PARTIAL_WAKE_LOCK` to prevent Android Doze Mode from severing network sockets during deep sleep.
  - Registers `ConnectivityManager.NetworkCallback` to detect Wi-Fi/Cellular switches and immediately reconnect.
  - Spawns `TelemetryHeartbeatThread` which executes every 20 seconds: checks Socket connection, sends socket heartbeat, and sends full HTTP `/api/device/ping` every 60 seconds.

### 5. `service/LiveStreamService.kt` (`com.thirdeye.app.service.LiveStreamService`)
- **Primary Function**: Remote real-time camera and microphone streaming engine.
- **Key Responsibilities**:
  - Triggered remotely by admin clicking **"Watch Live"** on dashboard.
  - Binds CameraX `ImageAnalysis` (640x480 resolution, rate-limited to ~15 FPS / every 65ms).
  - Converts camera `ImageProxy` bitmaps to compressed JPEG byte arrays and calls `SocketManager.sendFrame(...)`.
  - Concurrently captures raw 16kHz 16-bit Mono PCM audio chunks via `AudioRecord` and calls `SocketManager.sendAudio(...)`.
  - Supports live camera switching (`FRONT` <-> `BACK`) without dropping the WebSocket connection.

### 6. `service/BootCompletedReceiver.kt` (`com.thirdeye.app.service.BootCompletedReceiver`)
- **Primary Function**: Auto-restart receiver for device boot and package updates.
- **Listens For**: `BOOT_COMPLETED`, `LOCKED_BOOT_COMPLETED`, `MY_PACKAGE_REPLACED`, `QUICKBOOT_POWERON`.
- **Action**: Immediately launches `DeviceTelemetryService.startService(context)` to restore surveillance readiness upon reboot.

### 7. `service/QuickRecordTileService.kt` (`com.thirdeye.app.service.QuickRecordTileService`)
- **Primary Function**: Android Quick Settings notification shade toggle tile.
- **Key Responsibilities**: Toggles `CameraRecordingService` on/off and updates the tile state (`STATE_ACTIVE` vs `STATE_INACTIVE`).

### 8. `uploader/SocketManager.kt` (`com.thirdeye.app.uploader.SocketManager`)
- **Primary Function**: Singleton managing the Socket.io WebSocket connection to the backend.
- **Key Responsibilities**:
  - Connects to `prefs.serverUrl`.
  - Emits `register-device`, `device-heartbeat`, `stream-frame`, `stream-audio`.
  - Receives and handles remote commands:
    - `start-live-stream`: launches `LiveStreamService`.
    - `stop-live-stream`: stops `LiveStreamService`.
    - `switch-camera`: switches active lens.
    - `start-remote-recording`: starts `CameraRecordingService`.
    - `stop-remote-recording`: stops `CameraRecordingService`.

### 9. `uploader/BackendClient.kt` (`com.thirdeye.app.uploader.BackendClient`)
- **Primary Function**: HTTP networking and device hardware queries.
- **Key Responsibilities**:
  - `getDeviceId(context)`: Fetches persistent `Settings.Secure.ANDROID_ID`.
  - `getDeviceName()`: Retrieves manufacturer and model.
  - `getBatteryLevel(context)`: Queries `BatteryManager` broadcast.
  - `getLocation(context)`: Queries `LocationManager` for GPS coordinates and reverse-geocodes with `Geocoder`.
  - `sendPing(context)`: Sends JSON telemetry to `POST /api/device/ping`.
  - `uploadVideo(...)`: Streams multi-part form-data MP4 files to `POST /api/videos/upload` using chunked byte streaming (64KB buffer).

### 10. `uploader/DriveUploaderWorker.kt` (`com.thirdeye.app.uploader.DriveUploaderWorker`)
- **Primary Function**: Jetpack `CoroutineWorker` handling background video uploads.
- **Key Responsibilities**:
  - Enqueued by `CameraRecordingService` when a video file is finalized.
  - Requires `NetworkType.CONNECTED`.
  - Uploads video via `BackendClient.uploadVideo`.
  - If `prefs.isAutoDeleteAfterUpload` is true, deletes local MP4 after successful upload.
  - Falls back to direct personal Google Drive upload via `GoogleDriveManager` if logged in.
  - Retries automatically if network fails.

### 11. `uploader/GoogleDriveManager.kt` (`com.thirdeye.app.uploader.GoogleDriveManager`)
- **Primary Function**: Direct client-side Google Drive API client using user OAuth.
- **Key Responsibilities**: Authenticates with `GoogleSignInAccount` credential and uploads to a personal `Third Eye Vault` folder.

### 12. `utils/AppPreferences.kt` (`com.thirdeye.app.utils.AppPreferences`)
- **Primary Function**: SharedPreferences wrapper for persistent configuration.
- **Stored Keys**:
  - `camera_lens`: "BACK" or "FRONT" (default: "BACK")
  - `video_quality`: "480p", "720p", "1080p" (default: "720p")
  - `max_duration`: minutes (5, 15, 30; default: 30)
  - `haptic_feedback`: boolean (default: true)
  - `auto_delete_after_upload`: boolean (default: false)
  - `google_account_email`: string (default: null)
  - `is_recording`: boolean (default: false)
  - `volume_trigger_enabled`: boolean (default: true)
  - `server_url`: string (default: "https://third-eye-backend-a319.onrender.com")
  - `disguise_enabled`: boolean (default: false)
  - `disguise_pin`: string (default: "7777")

### 13. `utils/HapticUtil.kt` (`com.thirdeye.app.utils.HapticUtil`)
- **Primary Function**: Discreet tactile feedback generator using `Vibrator` and `VibratorManager`.
- **Key Methods**:
  - `vibrateStart()`: 1 firm pulse (400ms) with `USAGE_ALARM` to bypass DND.
  - `vibrateStop()`: 2 short pulses (200ms, 120ms gap, 200ms).

### 14. `utils/StorageUtil.kt` (`com.thirdeye.app.utils.StorageUtil`)
- **Primary Function**: Local hidden file management.
- **Key Methods**:
  - `getSecretVideoDirectory()`: Points to `getExternalFilesDir(DIRECTORY_MOVIES)/.vault/`. Creates a `.nomedia` file to hide recordings from Android photo galleries.
  - `createOutputFile()`: Creates `REC_yyyyMMdd_HHmmss.mp4`.
  - `getAvailableStorageMB()`: Calculates free disk space via `StatFs`.
  - `getRecordedVideos()`: Returns list of stored MP4 files sorted newest first.

### 15. `CalculatorActivity.kt` (`com.thirdeye.app.CalculatorActivity`)
- **Primary Function**: Disguise calculator interface.
- **Key Responsibilities**: Functions as a fully working arithmetic calculator. When user inputs `prefs.disguisePin` (e.g. `7777`) and presses `=`, it unlocks `MainActivity` with `FROM_DISGUISE = true`.

### 16. `VaultAdapter.kt` (`com.thirdeye.app.VaultAdapter`)
- **Primary Function**: RecyclerView adapter for the local video vault bottom sheet dialog.
- **Key Responsibilities**: Displays local MP4 clips, file sizes, play button (via `FileProvider` intent), share button, and delete button.

### 17. Android Manifest & Layouts
- `AndroidManifest.xml`: Declares permissions, activities, foreground services (`camera`, `microphone`, `dataSync`), accessibility service, quick settings tile, and `FileProvider`.
- `res/layout/activity_main.xml`: The futuristic dark-mode UI with top telemetry badges, central big toggle record button, timer display, and bottom buttons.
- `res/layout/activity_calculator.xml`: Grid calculator disguise.
- `res/layout/dialog_settings.xml`: Configuration bottom sheet.
- `res/layout/dialog_vault.xml` & `item_recording.xml`: Local recordings viewer.
- `res/xml/accessibility_service_config.xml`: Accessibility configuration requesting `flagRequestFilterKeyEvents`.

---

## 4. Backend API & Socket Server (`backend/`) — Complete File Breakdown

All backend code resides in `backend/`.

### 1. `server.js`
- **Primary Function**: Main entrypoint for the Node.js Express & Socket.io server (Port 5000 / Render environment).
- **Key Responsibilities**:
  - Loads environment variables from `.env` and `/etc/secrets/.env`.
  - Configures Express CORS, JSON body parser, and static serving for `/uploads`.
  - Initializes `Socket.io` with 5MB buffer size.
  - Manages Socket rooms: `device_{deviceId}`, `watch_{deviceId}`, `admins`.
  - Relays live streams: routes `stream-frame` and `stream-audio` from client phones to admins watching `watch_{deviceId}`.
  - Connects to MongoDB Atlas / Local via Mongoose.

### 2. `models/Device.js`
- **Mongoose Schema**:
  - `deviceId`: String (Unique, Indexed)
  - `deviceName`: String
  - `model`: String
  - `androidVersion`: String
  - `batteryLevel`: Number (0-100)
  - `isRecording`: Boolean
  - `videoQuality`: String
  - `appVersion`: String
  - `latitude`: Number
  - `longitude`: Number
  - `locationName`: String
  - `ipAddress`: String
  - `lastSeen`: Date
  - `totalRecordings`: Number

### 3. `models/Recording.js`
- **Mongoose Schema**:
  - `deviceId`: String (Indexed)
  - `deviceName`: String
  - `fileName`: String
  - `driveFileId`: String
  - `driveViewLink`: String
  - `driveDownloadLink`: String
  - `localFilePath`: String
  - `fileSizeBytes`: Number
  - `durationSeconds`: Number
  - `quality`: String
  - `uploadedAt`: Date (Indexed)
  - `latitude`, `longitude`, `locationName`: Location metadata

### 4. `routes/deviceRoutes.js` (`/api/device` and `/api/devices`)
- `POST /api/device/ping`: Receives device telemetry. Resolves public IP geolocation if GPS is unavailable. Upserts `Device` document in MongoDB.
- `GET /api/devices`: Returns all devices sorted by `lastSeen` descending.
- `DELETE /api/devices/:deviceId`: Unlinks/removes a device from the database.

### 5. `routes/videoRoutes.js` (`/api/videos`)
- `POST /api/videos/upload`: Multer multi-part upload endpoint (500MB max).
  - Receives MP4 file from Android client.
  - Forwards MP4 to Google Drive via `googleDriveService.uploadVideoFile(...)`.
  - **Auto-purges local temp file immediately** once uploaded to Google Drive to keep server disk usage at 0 MB.
  - Creates and saves a `Recording` document.
  - Increments device's `totalRecordings` count.
- `GET /api/videos`: Returns all recordings (supports `?deviceId=` filter).
- `GET /api/videos/stream/:id`: Direct video streaming endpoint supporting HTTP 206 Partial Content (range requests for timeline seeking) piped directly from Google Drive API.
- `GET /api/videos/download/:id`: Downloads video from Google Drive.
- `DELETE /api/videos/:id`: Deletes recording from Google Drive and database.
- `POST /api/videos/batch-delete`: Batch-deletes multiple recordings.
- `DELETE /api/videos/all`: Purges all recordings.

### 6. `routes/adminRoutes.js` (`/api/admin`)
- `GET /api/admin/stats`: Aggregates total devices, active devices (lastSeen within 10 min), recording devices, total recordings count, and total storage used (MB/GB).
- `GET /api/admin/auth/google`: Initiates Google OAuth consent flow.
- `GET /api/admin/auth/google/callback`: Handles OAuth token exchange and persists refresh token.
- `GET /api/admin/drive/status`: Reports Google Drive client status.

### 7. `services/googleDriveService.js`
- **Primary Function**: Google Drive API v3 wrapper.
- **Key Responsibilities**:
  - Supports both OAuth2 (`GOOGLE_REFRESH_TOKEN`) and Service Account (`service_account.json`).
  - `uploadVideoFile(filePath, originalName, mimeType)`: Uploads to target Drive folder, sets public reader permissions, returns `driveFileId`, `driveViewLink`, `driveDownloadLink`.
  - `streamVideo(driveFileId, req, res)`: Streams video chunks with Range header support for browser player seeking.
  - `deleteVideoFile(driveFileId)`: Deletes file from Google Drive.

### 8. `backend/.env`
- Contains environment keys: `PORT`, `MONGODB_URI`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_DRIVE_FOLDER_ID`, `GOOGLE_REFRESH_TOKEN`.

---

## 5. Admin Web Command Center (`admin-dashboard/`) — Complete File Breakdown

All dashboard code resides in `admin-dashboard/src/`.

### 1. `App.jsx`
- Configures `BrowserRouter`, `DashboardProvider`, and sets up routes (`/`, `/overview`, `/devices`, `/recordings`, `/settings`).

### 2. `context/DashboardContext.jsx`
- **Central State Hub**:
  - Connects to Backend Socket.io and listens for `online-devices-list`, `device-status-change`, `device-heartbeat`, `live-frame`, `live-audio`, `stream-ended`.
  - Manages Web Audio API `AudioContext` for decoding PCM audio chunks streamed from the phone.
  - Houses all API calls (`fetchData`, `handleDeleteDevice`, `handleDeleteRecording`, batch deletion).
  - Provides surveillance controls: `handleStartLiveStream`, `handleStopLiveStream`, `handleSwitchCamera`, `handleTakeSnapshot`, `handleStartRemoteRecording`, `handleStopRemoteRecording`.

### 3. `components/Layout.jsx`
- Provides the futuristic cyber/dark-mode shell (responsive drawer navigation, real-time clock, relay status badge, live polling toggle, manual sync button).
- Renders global modals:
  - **Video Player Modal**: Plays video directly via HTML5 `<video>` stream from Google Drive.
  - **Live Surveillance Modal**: Shows CCTV viewport with real-time video frames, audio level, FPS counter, lens switcher, and snapshot tool.

### 4. `pages/Overview.jsx`
- **Dashboard Overview**:
  - 4 Cyber KPI metric cards: Total Devices, Recording Live, Archive Vault, Drive Quota.
  - CCTV-style Surveillance Video Vault preview (latest 3 clips).
  - Active Telemetry Fleet summary table.

### 5. `pages/Devices.jsx`
- **Fleet Management**:
  - Filter by All, Online, Recording, Offline, or search text.
  - Detailed telemetry: Device unit, ID copy button, location with Google Maps link, battery badge, resolution, status, and last seen.
  - Action buttons: **Watch Live**, **Remote Rec / Stop Rec**, **Delete**.

### 6. `pages/Recordings.jsx`
- **Surveillance Video Gallery**:
  - Filter by All, 720p, 480p, Drive Synced, or search text.
  - Multi-select checkbox system with batch delete and "Purge All" capability.
  - Embedded player launch, direct Google Drive link, download button, and deletion.

### 7. `pages/Settings.jsx`
- **Cloud & Relay Configuration**:
  - Visual 15GB Google Drive quota bar.
  - 3-step Service Account / OAuth setup guide.
  - Connection ping latency tester.
  - Interactive API endpoint cheat sheet with copy buttons.

---

## 6. Deep Root Cause Analysis of User's Bugs

The user reported two critical issues:
1. **"auto record hoitese" (The app automatically records / appears to auto-record)**
2. **"+ 2 click korle off/ hoy na" (When clicking twice / double-clicking, it does NOT turn off)**

Through full-codebase investigation, we identified the **exact technical root causes** behind these behaviors:

---

### Root Cause 1: Why the app "Auto Records" (`auto record hoitese`)

#### A. Overly Broad Accessibility Volume Double-Click Window (`KeyShortcutAccessibilityService.kt`)
Look at lines 14-63 of `KeyShortcutAccessibilityService.kt`:
```kotlin
private const val DOUBLE_CLICK_TIME_DELTA = 1200L // 1.2 seconds!
...
if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
    val diff = currentTime - lastVolumeUpTime
    if (diff in MIN_CLICK_INTERVAL..DOUBLE_CLICK_TIME_DELTA) {
        toggleRecording()
        lastVolumeUpTime = 0L
    } else if (diff > DOUBLE_CLICK_TIME_DELTA) {
        lastVolumeUpTime = currentTime
    }
}
```
- A window of **1200ms (1.2 seconds)** is extremely wide.
- Whenever a user naturally presses Volume Up or Volume Down twice while adjusting phone volume (e.g. listening to audio, watching a video, or changing ringtone), the time difference is almost always between 200ms and 900ms.
- **The app mistakes regular volume adjustment for a stealth trigger and starts recording automatically without the user ever opening the app!**

#### B. The "Zombie" Recording State in SharedPreferences (`AppPreferences.kt` & `MainActivity.kt`)
- When recording begins, `prefs.isRecording = true` is written to persistent `SharedPreferences`.
- If the phone runs low on memory, the camera encounters a hardware error, or Android OS kills the app/service while recording:
  - **`prefs.isRecording` remains permanently `true` in disk storage!**
- When the user subsequently opens `MainActivity`:
  ```kotlin
  updateRecordingUI(prefs.isRecording)
  ```
  - Because `prefs.isRecording` is `true`, `MainActivity` immediately renders:  
    **`RECORDING IN BACKGROUND...`**  
    and starts the UI live timer: **`00:00 -> 00:01 -> 00:33...`**!
  - **To the user, the app looks like it just started recording automatically on launch**, even though the camera service is not actually recording anything!
- Furthermore, `DeviceTelemetryService` repeatedly sends `isRecording: prefs.isRecording` to the backend. The backend marks the device as `isRecording: true`, and the Admin Dashboard displays:  
  **`TECNO KL4 - Status: Recording`** and **`RECORDING LIVE: 1`**!

---

### Root Cause 2: Why it does NOT turn off on 2 clicks (`+ 2 click korle off/ hoy na`)

#### A. The Asynchronous CameraX Finalization & Null Pointer Deadlock in `CameraRecordingService.kt`
Look at `stopRecording()` in `CameraRecordingService.kt`:
```kotlin
private fun stopRecording() {
    timerJob?.cancel()
    activeRecording?.stop()
    activeRecording = null
}
```
1. When the user taps the button or double-clicks volume to STOP:
   - `CameraRecordingService.stopService(...)` is called.
   - `stopRecording()` immediately sets `activeRecording = null`.
   - `activeRecording?.stop()` instructs CameraX to finalize.
   - **CameraX finalization is asynchronous and takes 1 to 2.5 seconds** (closing the MP4 file, writing headers).
2. **`prefs.isRecording = false` is NOT set inside `stopRecording()`. It is ONLY set inside `handleRecordingFinalized`!**
3. While CameraX is finalizing (during those 1–2 seconds):
   - The UI still shows the red button and "RECORDING IN BACKGROUND...".
   - The user thinks the tap was ignored, so they tap or double-click AGAIN ("2 click").
4. On the 2nd click:
   - `prefs.isRecording` is still `true`.
   - `stopRecording()` is called again.
   - But `activeRecording` was **already set to `null`** on the first click!
   - `activeRecording?.stop()` is a no-op!
5. **Critical Zombie State**: If `CameraRecordingService` was in the "Zombie" state (Service wasn't actively recording, but `prefs.isRecording` was `true`):
   - User clicks Stop.
   - `stopRecording()` runs.
   - `activeRecording` is `null`!
   - `VideoRecordEvent.Finalize` **NEVER FIRES**!
   - **`handleRecordingFinalized` IS NEVER CALLED!**
   - **`prefs.isRecording` IS NEVER SET TO `false`!**
   - **`notifyStatusChanged(false)` IS NEVER BROADCAST!**
   - **The app is completely stuck in the "RECORDING IN BACKGROUND" state forever!** No matter how many times the user clicks, it will NEVER turn off!

#### B. Volume Key Double-Click Race Condition in `KeyShortcutAccessibilityService.kt`
- If recording is active and the user double-clicks volume to stop:
  - The stop command is sent to `CameraRecordingService`.
  - There is NO immediate haptic feedback (feedback is delayed until `handleRecordingFinalized` finishes seconds later).
  - The user, feeling no vibration, double-clicks volume again.
  - By the second double-click, `handleRecordingFinalized` may have just completed (`prefs.isRecording = false`).
  - **The second double-click immediately triggers `CameraRecordingService.startService(...)`, instantly starting a brand-new recording!**
  - To the user, it feels like double-clicking never stops the recording!

#### C. `START_STICKY` Restarts Dead Services
- `CameraRecordingService.onStartCommand` returns `START_STICKY`.
- If the service is killed by Android, the OS restarts the service with a `null` intent.
- When `intent == null`, `onStartCommand` does nothing, but the service stays alive in the background without recording, leading to mismatched states.

---

## 7. Step-by-Step Solution & Implementation Plan

To completely fix both issues, the following modifications must be applied:

### Fix 1: Service Runtime State Synchronization & Fail-Safe Stop
1. In `CameraRecordingService.kt`:
   - Introduce an in-memory companion state:
     ```kotlin
     @Volatile var isServiceRecording = false
     @Volatile var isStopping = false
     ```
   - In `onStartCommand`: Change return type from `START_STICKY` to `START_NOT_STICKY`. A camera recording service should never be auto-resurrected with a null intent.
   - In `stopRecording()`:
     - If `activeRecording == null`: **Immediately self-heal!** Set `prefs.isRecording = false`, notify status changed (`false`), stop foreground, and call `stopSelf()`.
     - If `activeRecording != null`: Mark `isStopping = true`, call `activeRecording?.stop()`, but do not set `activeRecording = null` until `handleRecordingFinalized` or a 3-second safety watchdog expires.
   - If binding camera fails or exceptions occur in `initAndStartCameraRecording()`: Ensure `prefs.isRecording = false` is always set and `notifyStatusChanged(false)` is dispatched.

### Fix 2: App Launch State Verification in `MainActivity.kt`
1. When `MainActivity` starts (`onCreate` and `onResume`):
   - Verify if `CameraRecordingService` is **actually running**.
   - If `prefs.isRecording == true` but the service is NOT alive, immediately reset `prefs.isRecording = false` and update the UI to "TAP TO RECORD".
2. In `btnToggleRecord.setOnClickListener`:
   - Add immediate UI debouncing and optimistic state transition: when clicked to stop, immediately show "STOPPING..." and disable rapid double-tapping for 1.5 seconds to prevent race conditions.

### Fix 3: Accessibility Volume Trigger Refinement
1. In `KeyShortcutAccessibilityService.kt`:
   - Reduce `DOUBLE_CLICK_TIME_DELTA` from `1200L` to `500L` (or require **Triple Click** within 800ms) so regular volume changes never trigger recordings accidentally.
   - Add an immediate haptic acknowledgment pulse as soon as a stop sequence is recognized.
   - Add a 2-second debounce cooldown after stopping before any new start command can be processed.

---
*Documentation compiled for Third Eye Surveillance Ecosystem.*
