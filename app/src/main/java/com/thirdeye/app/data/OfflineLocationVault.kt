package com.thirdeye.app.data

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.util.Log

class OfflineLocationVault(context: Context) :
    SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    companion object {
        private const val TAG = "OfflineLocationVault"
        private const val DATABASE_NAME = "thirdeye_location_vault.db"
        private const val DATABASE_VERSION = 1

        private const val TABLE_NAME = "offline_locations"
        private const val COL_ID = "id"
        private const val COL_LAT = "latitude"
        private const val COL_LON = "longitude"
        private const val COL_SPEED = "speed_kmh"
        private const val COL_ACCURACY = "accuracy"
        private const val COL_TIMESTAMP = "timestamp"

        @Volatile
        private var instance: OfflineLocationVault? = null

        fun getInstance(context: Context): OfflineLocationVault {
            return instance ?: synchronized(this) {
                instance ?: OfflineLocationVault(context.applicationContext).also { instance = it }
            }
        }
    }

    data class OfflinePoint(
        val id: Long,
        val latitude: Double,
        val longitude: Double,
        val speedKmh: Float,
        val accuracy: Float,
        val timestamp: Long
    )

    override fun onCreate(db: SQLiteDatabase) {
        val createTable = """
            CREATE TABLE $TABLE_NAME (
                $COL_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                $COL_LAT REAL NOT NULL,
                $COL_LON REAL NOT NULL,
                $COL_SPEED REAL DEFAULT 0,
                $COL_ACCURACY REAL DEFAULT 10,
                $COL_TIMESTAMP INTEGER NOT NULL
            )
        """.trimIndent()
        db.execSQL(createTable)
        db.execSQL("CREATE INDEX idx_offline_timestamp ON $TABLE_NAME($COL_TIMESTAMP)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS $TABLE_NAME")
        onCreate(db)
    }

    fun saveLocation(latitude: Double, longitude: Double, speedKmh: Float, accuracy: Float, timestamp: Long = System.currentTimeMillis()) {
        try {
            val db = writableDatabase
            val values = ContentValues().apply {
                put(COL_LAT, latitude)
                put(COL_LON, longitude)
                put(COL_SPEED, speedKmh)
                put(COL_ACCURACY, accuracy)
                put(COL_TIMESTAMP, timestamp)
            }
            db.insert(TABLE_NAME, null, values)
            Log.d(TAG, "📦 Cached location offline: ($latitude, $longitude) at $timestamp")
        } catch (e: Exception) {
            Log.w(TAG, "Error caching offline location: ${e.message}")
        }
    }

    fun getUnsynced(limit: Int = 100): List<OfflinePoint> {
        val list = mutableListOf<OfflinePoint>()
        try {
            val db = readableDatabase
            val cursor = db.query(
                TABLE_NAME,
                null,
                null,
                null,
                null,
                null,
                "$COL_TIMESTAMP ASC",
                limit.toString()
            )
            cursor.use { c ->
                val idIdx = c.getColumnIndexOrThrow(COL_ID)
                val latIdx = c.getColumnIndexOrThrow(COL_LAT)
                val lonIdx = c.getColumnIndexOrThrow(COL_LON)
                val spdIdx = c.getColumnIndexOrThrow(COL_SPEED)
                val accIdx = c.getColumnIndexOrThrow(COL_ACCURACY)
                val timeIdx = c.getColumnIndexOrThrow(COL_TIMESTAMP)

                while (c.moveToNext()) {
                    list.add(
                        OfflinePoint(
                            id = c.getLong(idIdx),
                            latitude = c.getDouble(latIdx),
                            longitude = c.getDouble(lonIdx),
                            speedKmh = c.getFloat(spdIdx),
                            accuracy = c.getFloat(accIdx),
                            timestamp = c.getLong(timeIdx)
                        )
                    )
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error reading unsynced locations: ${e.message}")
        }
        return list
    }

    fun deleteSynced(ids: List<Long>) {
        if (ids.isEmpty()) return
        try {
            val db = writableDatabase
            val idStrings = ids.joinToString(",")
            db.delete(TABLE_NAME, "$COL_ID IN ($idStrings)", null)
            Log.d(TAG, "🧹 Cleared ${ids.size} synced offline points from local vault")
        } catch (e: Exception) {
            Log.w(TAG, "Error deleting synced points: ${e.message}")
        }
    }

    fun getCount(): Int {
        try {
            val db = readableDatabase
            val cursor = db.rawQuery("SELECT COUNT(*) FROM $TABLE_NAME", null)
            cursor.use {
                if (it.moveToFirst()) return it.getInt(0)
            }
        } catch (e: Exception) {
            // Ignore
        }
        return 0
    }
}
