package com.thirdeye.app.uploader

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.location.Geocoder
import android.location.Location
import android.location.LocationManager
import android.os.BatteryManager
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.core.content.ContextCompat
import com.thirdeye.app.service.CameraRecordingService
import com.thirdeye.app.utils.AppPreferences
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale

object BackendClient {
    private const val TAG = "BackendClient"

    data class DeviceLocation(
        val latitude: Double,
        val longitude: Double,
        val villageOrPara: String = "",
        val districtAndCountry: String = "",
        val address: String = "",
        val speedKmh: Float = 0f,
        val accuracy: Float = 10f
    )

    fun getDeviceId(context: Context): String {
        return Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
            ?: "device_${Build.SERIAL}"
    }

    fun getDeviceName(): String {
        val manufacturer = Build.MANUFACTURER.replaceFirstChar { it.uppercase() }
        val model = Build.MODEL
        return if (model.startsWith(manufacturer, ignoreCase = true)) {
            model
        } else {
            "$manufacturer $model"
        }
    }

    fun getBatteryLevel(context: Context): Int {
        val batteryIntent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = batteryIntent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = batteryIntent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        return if (level >= 0 && scale > 0) {
            (level * 100) / scale
        } else {
            100
        }
    }

    fun getLocation(context: Context): DeviceLocation? {
        val loc = com.thirdeye.app.utils.LocationTracker.getLiveLocation(context) ?: return null
        return DeviceLocation(
            latitude = loc.latitude,
            longitude = loc.longitude,
            villageOrPara = loc.villageOrPara,
            districtAndCountry = loc.districtAndCountry,
            address = loc.fullAddress,
            speedKmh = loc.speedKmh,
            accuracy = loc.accuracy
        )
    }

    /**
     * Batch Sync Offline Location Vault to Backend
     */
    fun syncOfflineLocations(context: Context): Int {
        val vault = com.thirdeye.app.data.OfflineLocationVault.getInstance(context)
        val points = vault.getUnsynced(100)
        if (points.isEmpty()) return 0

        try {
            val prefs = AppPreferences(context)
            val serverUrl = prefs.serverUrl.trimEnd('/')
            val deviceId = getDeviceId(context)
            val url = URL("$serverUrl/api/devices/$deviceId/sync-offline-locations")

            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json; utf-8")
                setRequestProperty("Accept", "application/json")
                doOutput = true
                connectTimeout = 10000
                readTimeout = 15000
            }

            val jsonArray = org.json.JSONArray()
            val ids = mutableListOf<Long>()
            for (p in points) {
                ids.add(p.id)
                val item = JSONObject().apply {
                    put("latitude", p.latitude)
                    put("longitude", p.longitude)
                    put("speedKmh", p.speedKmh)
                    put("accuracy", p.accuracy)
                    put("timestamp", p.timestamp)
                }
                jsonArray.put(item)
            }

            val body = JSONObject().apply {
                put("deviceId", deviceId)
                put("locations", jsonArray)
            }

            conn.outputStream.use { os ->
                val input = body.toString().toByteArray(Charsets.UTF_8)
                os.write(input, 0, input.size)
            }

            val code = conn.responseCode
            if (code in 200..299) {
                vault.deleteSynced(ids)
                Log.i(TAG, "✅ Successfully synced ${ids.size} offline locations via HTTP")
                conn.disconnect()
                return ids.size
            }
            conn.disconnect()
        } catch (e: Exception) {
            Log.w(TAG, "Error syncing offline locations: ${e.message}")
        }
        return 0
    }

    /**
     * Send device status & battery heartbeat to Admin Server
     */
    fun sendPing(context: Context) {
        Thread {
            com.thirdeye.app.service.DeviceTelemetryService.acquireBriefWakeLock(context, 10000L)
            try {
                val prefs = AppPreferences(context)
                val serverUrl = prefs.serverUrl.trimEnd('/')
                val url = URL("$serverUrl/api/device/ping")

                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json; utf-8")
                conn.setRequestProperty("Accept", "application/json")
                conn.doOutput = true
                conn.connectTimeout = 8000
                conn.readTimeout = 8000

                val loc = getLocation(context)

                val json = JSONObject().apply {
                    put("deviceId", getDeviceId(context))
                    put("deviceName", getDeviceName())
                    put("model", Build.MODEL)
                    put("androidVersion", Build.VERSION.RELEASE)
                    put("batteryLevel", getBatteryLevel(context))
                    put("isRecording", CameraRecordingService.isServiceRunning || prefs.isRecording)
                    put("videoQuality", prefs.videoQuality)
                    put("cameraLens", prefs.cameraLens)
                    put("appVersion", "1.0")
                    val fcmToken = prefs.fcmToken
                    if (!fcmToken.isNullOrEmpty()) {
                        put("fcmToken", fcmToken)
                    }
                    if (loc != null) {
                        put("latitude", loc.latitude)
                        put("longitude", loc.longitude)
                        put("locationName", loc.address)
                        put("villageOrPara", loc.villageOrPara)
                        put("districtAndCountry", loc.districtAndCountry)
                        put("speedKmh", loc.speedKmh)
                        put("accuracy", loc.accuracy)
                    }
                }

                conn.outputStream.use { os ->
                    val input = json.toString().toByteArray(Charsets.UTF_8)
                    os.write(input, 0, input.size)
                }

                val responseCode = conn.responseCode
                Log.d(TAG, "Heartbeat response code: $responseCode")
                conn.disconnect()
            } catch (e: Exception) {
                Log.w(TAG, "Could not ping backend: ${e.message}")
            } finally {
                com.thirdeye.app.service.DeviceTelemetryService.releaseBriefWakeLock()
            }
        }.start()
    }

    /**
     * Upload recorded video directly to Central Backend -> Google Drive
     */
    fun uploadVideo(
        context: Context,
        videoFile: File,
        durationSeconds: Int = 0,
        quality: String = "720p"
    ): Boolean {
        com.thirdeye.app.service.DeviceTelemetryService.acquireBriefWakeLock(context, 180000L)
        val prefs = AppPreferences(context)
        val serverUrl = prefs.serverUrl.trimEnd('/')
        val boundary = "ThirdEyeBoundary" + System.currentTimeMillis()
        val lineEnd = "\r\n"
        val twoHyphens = "--"

        try {
            val headerBuilder = StringBuilder()

            fun appendField(name: String, value: String) {
                headerBuilder.append(twoHyphens).append(boundary).append(lineEnd)
                headerBuilder.append("Content-Disposition: form-data; name=\"$name\"").append(lineEnd).append(lineEnd)
                headerBuilder.append(value).append(lineEnd)
            }

            appendField("deviceId", getDeviceId(context))
            appendField("deviceName", getDeviceName())
            appendField("durationSeconds", durationSeconds.toString())
            appendField("quality", quality)

            val loc = getLocation(context)
            if (loc != null) {
                appendField("latitude", loc.latitude.toString())
                appendField("longitude", loc.longitude.toString())
                appendField("locationName", loc.address)
            }

            // Video file part header
            headerBuilder.append(twoHyphens).append(boundary).append(lineEnd)
            headerBuilder.append("Content-Disposition: form-data; name=\"video\"; filename=\"${videoFile.name}\"").append(lineEnd)
            headerBuilder.append("Content-Type: video/mp4").append(lineEnd).append(lineEnd)

            val headerBytes = headerBuilder.toString().toByteArray(Charsets.UTF_8)
            val footerBytes = (lineEnd + twoHyphens + boundary + twoHyphens + lineEnd).toByteArray(Charsets.UTF_8)
            val totalLength = headerBytes.size.toLong() + videoFile.length() + footerBytes.size.toLong()

            val url = URL("$serverUrl/api/videos/upload")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                doInput = true
                doOutput = true
                useCaches = false
                requestMethod = "POST"
                setRequestProperty("Connection", "Keep-Alive")
                setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
                setRequestProperty("User-Agent", "ThirdEyeAndroid/1.0")
                connectTimeout = 30000
                readTimeout = 180000 // 3 minutes timeout for upload
                setFixedLengthStreamingMode(totalLength)
            }

            conn.outputStream.use { os ->
                os.write(headerBytes)
                FileInputStream(videoFile).use { fis ->
                    val buffer = ByteArray(64 * 1024)
                    var bytesRead: Int
                    while (fis.read(buffer).also { bytesRead = it } != -1) {
                        os.write(buffer, 0, bytesRead)
                    }
                }
                os.write(footerBytes)
                os.flush()
            }

            val responseCode = conn.responseCode
            val responseBody = if (responseCode in 200..299) {
                conn.inputStream.bufferedReader().readText()
            } else {
                conn.errorStream?.bufferedReader()?.readText() ?: ""
            }
            Log.i(TAG, "Upload response code: $responseCode - $responseBody")
            conn.disconnect()

            return responseCode in 200..299
        } catch (e: Exception) {
            Log.e(TAG, "Video upload failed", e)
            return false
        } finally {
            com.thirdeye.app.service.DeviceTelemetryService.releaseBriefWakeLock()
        }
    }

    /**
     * Registers or updates the device's FCM push wake-up token on the central backend
     */
    fun registerFcmToken(context: Context, token: String) {
        Thread {
            try {
                val prefs = AppPreferences(context)
                val serverUrl = prefs.serverUrl.trimEnd('/')
                val url = URL("$serverUrl/api/devices/fcm-token")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json; utf-8")
                conn.setRequestProperty("Accept", "application/json")
                conn.doOutput = true
                conn.connectTimeout = 8000
                conn.readTimeout = 8000

                val json = JSONObject().apply {
                    put("deviceId", getDeviceId(context))
                    put("fcmToken", token)
                }

                conn.outputStream.use { os ->
                    val input = json.toString().toByteArray(Charsets.UTF_8)
                    os.write(input, 0, input.size)
                }

                val responseCode = conn.responseCode
                Log.d(TAG, "FCM token register HTTP response: $responseCode")
                conn.disconnect()
            } catch (e: Exception) {
                Log.w(TAG, "Could not register FCM token to backend: ${e.message}")
            }
        }.start()
    }
}
