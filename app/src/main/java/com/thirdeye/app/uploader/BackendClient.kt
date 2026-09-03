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
import com.thirdeye.app.utils.AppPreferences
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale

object BackendClient {
    private const val TAG = "BackendClient"

    data class DeviceLocation(val latitude: Double, val longitude: Double, val address: String = "")

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

    @SuppressLint("MissingPermission")
    fun getLocation(context: Context): DeviceLocation? {
        val fineGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarseGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

        if (!fineGranted && !coarseGranted) return null

        try {
            val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return null
            val providers = locationManager.getProviders(true)
            var bestLocation: Location? = null

            for (provider in providers) {
                val l = locationManager.getLastKnownLocation(provider) ?: continue
                if (bestLocation == null || l.accuracy < bestLocation.accuracy) {
                    bestLocation = l
                }
            }

            if (bestLocation != null) {
                var addressText = ""
                try {
                    val geocoder = Geocoder(context, Locale.getDefault())
                    val addresses = geocoder.getFromLocation(bestLocation.latitude, bestLocation.longitude, 1)
                    if (!addresses.isNullOrEmpty()) {
                        val addr = addresses[0]
                        addressText = listOfNotNull(addr.locality, addr.subAdminArea, addr.countryName).joinToString(", ")
                    }
                } catch (e: Exception) {
                    // Geocoder failed or offline, coordinates still valid
                }
                return DeviceLocation(bestLocation.latitude, bestLocation.longitude, addressText)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to get location: ${e.message}")
        }
        return null
    }

    /**
     * Send device status & battery heartbeat to Admin Server
     */
    fun sendPing(context: Context) {
        Thread {
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
                    put("isRecording", prefs.isRecording)
                    put("videoQuality", prefs.videoQuality)
                    put("appVersion", "1.0")
                    if (loc != null) {
                        put("latitude", loc.latitude)
                        put("longitude", loc.longitude)
                        put("locationName", loc.address)
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
        }
    }
}
