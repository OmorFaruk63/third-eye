package com.thirdeye.app.uploader

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.provider.Settings
import android.util.Log
import com.thirdeye.app.utils.AppPreferences
import org.json.JSONObject
import java.io.DataOutputStream
import java.io.File
import java.io.FileInputStream
import java.net.HttpURLConnection
import java.net.URL

object BackendClient {
    private const val TAG = "BackendClient"

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

                val json = JSONObject().apply {
                    put("deviceId", getDeviceId(context))
                    put("deviceName", getDeviceName())
                    put("model", Build.MODEL)
                    put("androidVersion", Build.VERSION.RELEASE)
                    put("batteryLevel", getBatteryLevel(context))
                    put("isRecording", prefs.isRecording)
                    put("videoQuality", prefs.videoQuality)
                    put("appVersion", "1.0")
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
        val boundary = "==ThirdEyeUploadBoundary==" + System.currentTimeMillis()
        val lineEnd = "\r\n"
        val twoHyphens = "--"

        try {
            val url = URL("$serverUrl/api/videos/upload")
            val conn = url.openConnection() as HttpURLConnection
            conn.doInput = true
            conn.doOutput = true
            conn.useCaches = false
            conn.requestMethod = "POST"
            conn.setRequestProperty("Connection", "Keep-Alive")
            conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
            conn.connectTimeout = 30000
            conn.readTimeout = 120000 // 2 minutes for upload

            // Use chunked streaming mode to avoid memory overhead
            conn.setChunkedStreamingMode(64 * 1024)

            val outputStream = DataOutputStream(conn.outputStream)

            // Text fields
            fun writeField(name: String, value: String) {
                outputStream.writeBytes(twoHyphens + boundary + lineEnd)
                outputStream.writeBytes("Content-Disposition: form-data; name=\"$name\"$lineEnd$lineEnd")
                outputStream.write(value.toByteArray(Charsets.UTF_8))
                outputStream.writeBytes(lineEnd)
            }

            writeField("deviceId", getDeviceId(context))
            writeField("deviceName", getDeviceName())
            writeField("durationSeconds", durationSeconds.toString())
            writeField("quality", quality)

            // Video File header
            outputStream.writeBytes(twoHyphens + boundary + lineEnd)
            outputStream.writeBytes("Content-Disposition: form-data; name=\"video\"; filename=\"${videoFile.name}\"$lineEnd")
            outputStream.writeBytes("Content-Type: video/mp4$lineEnd$lineEnd")

            // Stream file contents
            val fileInputStream = FileInputStream(videoFile)
            val buffer = ByteArray(64 * 1024)
            var bytesRead: Int
            while (fileInputStream.read(buffer).also { bytesRead = it } != -1) {
                outputStream.write(buffer, 0, bytesRead)
            }
            outputStream.writeBytes(lineEnd)
            fileInputStream.close()

            // End boundary
            outputStream.writeBytes(twoHyphens + boundary + twoHyphens + lineEnd)
            outputStream.flush()
            outputStream.close()

            val responseCode = conn.responseCode
            Log.i(TAG, "Upload response code: $responseCode")
            conn.disconnect()

            return responseCode in 200..299
        } catch (e: Exception) {
            Log.e(TAG, "Video upload failed", e)
            return false
        }
    }
}
