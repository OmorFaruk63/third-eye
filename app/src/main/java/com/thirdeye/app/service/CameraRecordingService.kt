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
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.camera.core.CameraSelector
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
import com.thirdeye.app.uploader.DriveUploaderWorker
import com.thirdeye.app.utils.AppPreferences
import com.thirdeye.app.utils.HapticUtil
import com.thirdeye.app.utils.StorageUtil
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.File

class CameraRecordingService : LifecycleService() {

    companion object {
        private const val TAG = "CameraRecService"
        const val CHANNEL_ID = "thirdeye_silent_service_channel"
        const val NOTIFICATION_ID = 1001

        const val ACTION_START_RECORDING = "com.thirdeye.app.ACTION_START"
        const val ACTION_STOP_RECORDING = "com.thirdeye.app.ACTION_STOP"
        const val ACTION_RECORDING_STATUS_CHANGED = "com.thirdeye.app.STATUS_CHANGED"
        const val EXTRA_IS_RECORDING = "extra_is_recording"

        fun startService(context: Context) {
            val intent = Intent(context, CameraRecordingService::class.java).apply {
                action = ACTION_START_RECORDING
            }
            ContextCompat.startForegroundService(context, intent)
        }

        fun stopService(context: Context) {
            val intent = Intent(context, CameraRecordingService::class.java).apply {
                action = ACTION_STOP_RECORDING
            }
            context.startService(intent)
        }
    }

    private var activeRecording: Recording? = null
    private var currentOutputFile: File? = null
    private var timerJob: Job? = null
    private lateinit var prefs: AppPreferences

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
        prefs = AppPreferences(this)
        createSilentNotificationChannel()

        val filter = IntentFilter(Intent.ACTION_BATTERY_LOW)
        registerReceiver(batteryReceiver, filter)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)

        when (intent?.action) {
            ACTION_START_RECORDING -> {
                if (activeRecording == null && !prefs.isRecording) {
                    startForegroundWithNotification()
                    initAndStartCameraRecording()
                }
            }
            ACTION_STOP_RECORDING -> {
                stopRecording()
            }
        }

        return START_STICKY
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
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setSilent(true)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
                )
            } else {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
                )
            }
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    @SuppressLint("MissingPermission")
    private fun initAndStartCameraRecording() {
        // Storage safety check
        if (StorageUtil.getAvailableStorageMB(this) < 200) {
            Log.e(TAG, "Storage too low to record")
            stopSelf()
            return
        }

        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            try {
                val cameraProvider = cameraProviderFuture.get()
                bindRecordingUseCase(cameraProvider)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to get camera provider", e)
                stopSelf()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    @SuppressLint("MissingPermission")
    private fun bindRecordingUseCase(cameraProvider: ProcessCameraProvider) {
        cameraProvider.unbindAll()

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

        val recorder = Recorder.Builder()
            .setQualitySelector(qualitySelector)
            .build()

        val videoCapture = VideoCapture.withOutput(recorder)

        try {
            // Bind video capture to service lifecycle (without any UI preview required)
            cameraProvider.bindToLifecycle(this, cameraSelector, videoCapture)

            currentOutputFile = StorageUtil.createOutputFile(this)
            val fileOutputOptions = FileOutputOptions.Builder(currentOutputFile!!).build()

            val pendingRecording = videoCapture.output
                .prepareRecording(this, fileOutputOptions)
                .withAudioEnabled()

            activeRecording = pendingRecording.start(ContextCompat.getMainExecutor(this)) { recordEvent ->
                when (recordEvent) {
                    is VideoRecordEvent.Start -> {
                        Log.i(TAG, "Video recording started.")
                        prefs.isRecording = true
                        HapticUtil.vibrateStart(this)
                        notifyStatusChanged(true)
                        startCountdownTimer()
                    }
                    is VideoRecordEvent.Finalize -> {
                        Log.i(TAG, "Video recording finalized.")
                        handleRecordingFinalized(recordEvent)
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Binding camera use cases failed", e)
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
        activeRecording?.stop()
        activeRecording = null
    }

    private fun handleRecordingFinalized(event: VideoRecordEvent.Finalize) {
        prefs.isRecording = false
        HapticUtil.vibrateStop(this)
        notifyStatusChanged(false)

        if (!event.hasError()) {
            val savedFile = currentOutputFile
            if (savedFile != null && savedFile.exists() && savedFile.length() > 0L) {
                Log.i(TAG, "Video saved successfully to: ${savedFile.absolutePath}")
                // Enqueue background upload to Google Drive
                DriveUploaderWorker.enqueue(applicationContext, savedFile.absolutePath)
            }
        } else {
            Log.e(TAG, "Recording error: ${event.error}")
        }

        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun notifyStatusChanged(isRecording: Boolean) {
        val intent = Intent(ACTION_RECORDING_STATUS_CHANGED).apply {
            putExtra(EXTRA_IS_RECORDING, isRecording)
            setPackage(packageName)
        }
        sendBroadcast(intent)
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        // If recording is running and user swipes away app from Recents, keep recording running!
        if (prefs.isRecording && activeRecording != null) {
            Log.i(TAG, "Task removed from recents, keeping foreground recording alive.")
        }
    }

    override fun onDestroy() {
        timerJob?.cancel()
        try {
            unregisterReceiver(batteryReceiver)
        } catch (e: Exception) {
            // Ignored
        }
        activeRecording?.stop()
        prefs.isRecording = false
        super.onDestroy()
    }

    override fun onBind(intent: Intent): IBinder? {
        super.onBind(intent)
        return null
    }
}
