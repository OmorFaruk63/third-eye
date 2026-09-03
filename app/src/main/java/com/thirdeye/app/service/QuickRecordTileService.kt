package com.thirdeye.app.service

import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import androidx.annotation.RequiresApi
import com.thirdeye.app.utils.AppPreferences

@RequiresApi(Build.VERSION_CODES.N)
class QuickRecordTileService : TileService() {

    override fun onStartListening() {
        super.onStartListening()
        updateTileState()
    }

    override fun onClick() {
        super.onClick()
        val prefs = AppPreferences(this)
        if (prefs.isRecording) {
            CameraRecordingService.stopService(this)
        } else {
            CameraRecordingService.startService(this)
        }
        updateTileState()
    }

    private fun updateTileState() {
        val tile = qsTile ?: return
        val prefs = AppPreferences(this)

        if (prefs.isRecording) {
            tile.state = Tile.STATE_ACTIVE
            tile.label = "Recording..."
        } else {
            tile.state = Tile.STATE_INACTIVE
            tile.label = "Third Eye"
        }
        tile.updateTile()
    }
}
