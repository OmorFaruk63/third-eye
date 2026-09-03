package com.thirdeye.app

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.view.LayoutInflater
import android.view.View
import android.widget.Button
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.Scope
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.switchmaterial.SwitchMaterial
import com.google.api.services.drive.DriveScopes
import com.thirdeye.app.databinding.ActivityMainBinding
import com.thirdeye.app.service.CameraRecordingService
import com.thirdeye.app.utils.AppPreferences
import com.thirdeye.app.utils.StorageUtil

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var prefs: AppPreferences

    private var timerHandler: Handler? = null
    private var recordingSeconds = 0

    // Google Sign-In launcher
    private val googleSignInLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
        try {
            val account = task.result
            if (account != null) {
                prefs.googleAccountEmail = account.email
                Toast.makeText(this, "Google Drive Connected: ${account.email}", Toast.LENGTH_SHORT).show()
                updateStatusBadges()
            }
        } catch (e: Exception) {
            Toast.makeText(this, "Sign-in failed: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
        }
    }

    // Permission launcher
    private val requestPermissionsLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val cameraGranted = permissions[Manifest.permission.CAMERA] ?: false
        val audioGranted = permissions[Manifest.permission.RECORD_AUDIO] ?: false

        if (!cameraGranted || !audioGranted) {
            Toast.makeText(this, "Camera & Audio permissions are required.", Toast.LENGTH_LONG).show()
        } else {
            requestBatteryOptimizationExemption()
        }
    }

    // BroadcastReceiver for recording state updates from service
    private val recordingStatusReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == CameraRecordingService.ACTION_RECORDING_STATUS_CHANGED) {
                val isRecording = intent.getBooleanExtra(CameraRecordingService.EXTRA_IS_RECORDING, false)
                updateRecordingUI(isRecording)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        prefs = AppPreferences(this)
        timerHandler = Handler(Looper.getMainLooper())

        setupViews()
        checkPermissions()
        updateStatusBadges()
        updateRecordingUI(prefs.isRecording)

        val filter = IntentFilter(CameraRecordingService.ACTION_RECORDING_STATUS_CHANGED)
        ContextCompat.registerReceiver(
            this,
            recordingStatusReceiver,
            filter,
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
    }

    override fun onResume() {
        super.onResume()
        updateStatusBadges()
        updateRecordingUI(prefs.isRecording)
    }

    private fun setupViews() {
        binding.btnToggleRecord.setOnClickListener {
            if (prefs.isRecording) {
                CameraRecordingService.stopService(this)
            } else {
                if (hasRequiredPermissions()) {
                    CameraRecordingService.startService(this)
                } else {
                    checkPermissions()
                }
            }
        }

        binding.btnOpenSettings.setOnClickListener {
            showSettingsDialog()
        }

        binding.btnOpenVault.setOnClickListener {
            showVaultDialog()
        }

        binding.btnConnectDrive.setOnClickListener {
            initiateGoogleSignIn()
        }

        binding.btnEnableShortcut.setOnClickListener {
            // Open Accessibility Settings
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            startActivity(intent)
            Toast.makeText(this, "Enable 'Third Eye' in Accessibility to activate Volume shortcut", Toast.LENGTH_LONG).show()
        }
    }

    private fun updateStatusBadges() {
        // Lens badge
        binding.tvLensBadge.text = "CAM: ${prefs.cameraLens} (${prefs.videoQuality})"

        // Storage badge
        val freeMb = StorageUtil.getAvailableStorageMB(this)
        val freeGb = freeMb.toDouble() / 1024
        binding.tvStorageBadge.text = String.format("FREE: %.1f GB", freeGb)

        // Cloud badge
        if (prefs.googleAccountEmail != null) {
            binding.tvCloudBadge.text = "DRIVE: ON"
            binding.tvCloudBadge.setTextColor(ContextCompat.getColor(this, R.color.neon_emerald))
        } else {
            binding.tvCloudBadge.text = "DRIVE: OFF"
            binding.tvCloudBadge.setTextColor(ContextCompat.getColor(this, R.color.text_muted))
        }
    }

    private fun updateRecordingUI(isRecording: Boolean) {
        if (isRecording) {
            binding.btnToggleRecord.setBackgroundResource(R.drawable.bg_record_button_recording)
            binding.btnToggleRecord.setImageResource(R.drawable.ic_stop)
            binding.btnToggleRecord.setColorFilter(ContextCompat.getColor(this, R.color.recording_red))
            binding.tvRecordStatus.text = "RECORDING IN BACKGROUND..."
            binding.tvRecordStatus.setTextColor(ContextCompat.getColor(this, R.color.recording_red))
            startLiveTimer()
        } else {
            binding.btnToggleRecord.setBackgroundResource(R.drawable.bg_record_button)
            binding.btnToggleRecord.setImageResource(R.drawable.ic_video_cam)
            binding.btnToggleRecord.setColorFilter(ContextCompat.getColor(this, R.color.neon_cyan))
            binding.tvRecordStatus.text = "TAP TO RECORD"
            binding.tvRecordStatus.setTextColor(ContextCompat.getColor(this, R.color.neon_cyan))
            stopLiveTimer()
            binding.tvTimerCounter.text = "00:00 / ${prefs.maxDurationMinutes}:00"
        }
    }

    private val timerRunnable = object : Runnable {
        override fun run() {
            recordingSeconds++
            val minutes = recordingSeconds / 60
            val seconds = recordingSeconds % 60
            binding.tvTimerCounter.text = String.format("%02d:%02d / %02d:00", minutes, seconds, prefs.maxDurationMinutes)
            timerHandler?.postDelayed(this, 1000)
        }
    }

    private fun startLiveTimer() {
        recordingSeconds = 0
        timerHandler?.removeCallbacks(timerRunnable)
        timerHandler?.post(timerRunnable)
    }

    private fun stopLiveTimer() {
        timerHandler?.removeCallbacks(timerRunnable)
        recordingSeconds = 0
    }

    private fun checkPermissions() {
        val permissions = mutableListOf(
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        val neededPermissions = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (neededPermissions.isNotEmpty()) {
            requestPermissionsLauncher.launch(neededPermissions.toTypedArray())
        } else {
            requestBatteryOptimizationExemption()
        }
    }

    private fun hasRequiredPermissions(): Boolean {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED &&
                ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
    }

    private fun requestBatteryOptimizationExemption() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                try {
                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:$packageName")
                    }
                    startActivity(intent)
                } catch (e: Exception) {
                    // Fallback to battery optimization settings
                }
            }
        }
    }

    private fun initiateGoogleSignIn() {
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .requestScopes(Scope(DriveScopes.DRIVE_FILE))
            .build()

        val googleSignInClient = GoogleSignIn.getClient(this, gso)
        googleSignInLauncher.launch(googleSignInClient.signInIntent)
    }

    private fun showSettingsDialog() {
        val dialog = BottomSheetDialog(this)
        val view = LayoutInflater.from(this).inflate(R.layout.dialog_settings, null)
        dialog.setContentView(view)

        val rgLens = view.findViewById<RadioGroup>(R.id.rgCameraLens)
        val rbBack = view.findViewById<RadioButton>(R.id.rbBackCamera)
        val rbFront = view.findViewById<RadioButton>(R.id.rbFrontCamera)
        if (prefs.cameraLens == "FRONT") rbFront.isChecked = true else rbBack.isChecked = true

        val rgQuality = view.findViewById<RadioGroup>(R.id.rgQuality)
        val rb480 = view.findViewById<RadioButton>(R.id.rb480p)
        val rb720 = view.findViewById<RadioButton>(R.id.rb720p)
        val rb1080 = view.findViewById<RadioButton>(R.id.rb1080p)
        when (prefs.videoQuality) {
            "480p" -> rb480.isChecked = true
            "1080p" -> rb1080.isChecked = true
            else -> rb720.isChecked = true
        }

        val rgDuration = view.findViewById<RadioGroup>(R.id.rgDuration)
        val rb5 = view.findViewById<RadioButton>(R.id.rb5min)
        val rb15 = view.findViewById<RadioButton>(R.id.rb15min)
        val rb30 = view.findViewById<RadioButton>(R.id.rb30min)
        when (prefs.maxDurationMinutes) {
            5 -> rb5.isChecked = true
            15 -> rb15.isChecked = true
            else -> rb30.isChecked = true
        }

        val switchHaptic = view.findViewById<SwitchMaterial>(R.id.switchHaptic)
        switchHaptic.isChecked = prefs.isHapticFeedbackEnabled

        val switchAutoDelete = view.findViewById<SwitchMaterial>(R.id.switchAutoDelete)
        switchAutoDelete.isChecked = prefs.isAutoDeleteAfterUpload

        view.findViewById<Button>(R.id.btnHideNotifications).setOnClickListener {
            // Open App Notification settings to easily hide notifications
            val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
            }
            startActivity(intent)
        }

        view.findViewById<Button>(R.id.btnSaveSettings).setOnClickListener {
            prefs.cameraLens = if (rbFront.isChecked) "FRONT" else "BACK"
            prefs.videoQuality = when {
                rb480.isChecked -> "480p"
                rb1080.isChecked -> "1080p"
                else -> "720p"
            }
            prefs.maxDurationMinutes = when {
                rb5.isChecked -> 5
                rb15.isChecked -> 15
                else -> 30
            }
            prefs.isHapticFeedbackEnabled = switchHaptic.isChecked
            prefs.isAutoDeleteAfterUpload = switchAutoDelete.isChecked

            updateStatusBadges()
            dialog.dismiss()
            Toast.makeText(this, "Settings Saved", Toast.LENGTH_SHORT).show()
        }

        dialog.show()
    }

    private fun showVaultDialog() {
        val dialog = BottomSheetDialog(this)
        val view = LayoutInflater.from(this).inflate(R.layout.dialog_vault, null)
        dialog.setContentView(view)

        val rv = view.findViewById<RecyclerView>(R.id.rvRecordings)
        val tvEmpty = view.findViewById<View>(R.id.tvEmptyVault)
        val btnClose = view.findViewById<Button>(R.id.btnCloseVault)
        val btnDeleteAll = view.findViewById<Button>(R.id.btnDeleteAll)

        var videos = StorageUtil.getRecordedVideos(this).toMutableList()
        lateinit var adapter: VaultAdapter

        fun refreshVaultView() {
            videos = StorageUtil.getRecordedVideos(this).toMutableList()
            if (videos.isEmpty()) {
                tvEmpty.visibility = View.VISIBLE
                rv.visibility = View.GONE
                btnDeleteAll.visibility = View.GONE
            } else {
                tvEmpty.visibility = View.GONE
                rv.visibility = View.VISIBLE
                btnDeleteAll.visibility = View.VISIBLE
                adapter.updateList(videos)
            }
            updateStatusBadges()
        }

        adapter = VaultAdapter(this, videos) { fileToDelete ->
            // Delete clicked file
            if (fileToDelete.exists()) {
                fileToDelete.delete()
                Toast.makeText(this, "Video deleted", Toast.LENGTH_SHORT).show()
                refreshVaultView()
            }
        }

        rv.layoutManager = LinearLayoutManager(this)
        rv.adapter = adapter

        if (videos.isEmpty()) {
            tvEmpty.visibility = View.VISIBLE
            rv.visibility = View.GONE
            btnDeleteAll.visibility = View.GONE
        } else {
            tvEmpty.visibility = View.GONE
            rv.visibility = View.VISIBLE
            btnDeleteAll.visibility = View.VISIBLE
        }

        btnDeleteAll.setOnClickListener {
            androidx.appcompat.app.AlertDialog.Builder(this)
                .setTitle("Delete All Videos?")
                .setMessage("Are you sure you want to permanently delete all recorded videos?")
                .setPositiveButton("Delete All") { _, _ ->
                    val allVideos = StorageUtil.getRecordedVideos(this)
                    for (file in allVideos) {
                        file.delete()
                    }
                    Toast.makeText(this, "All videos deleted", Toast.LENGTH_SHORT).show()
                    refreshVaultView()
                }
                .setNegativeButton("Cancel", null)
                .show()
        }

        btnClose.setOnClickListener {
            dialog.dismiss()
        }

        dialog.show()
    }

    override fun onDestroy() {
        timerHandler?.removeCallbacks(timerRunnable)
        try {
            unregisterReceiver(recordingStatusReceiver)
        } catch (e: Exception) {
            // Ignored
        }
        super.onDestroy()
    }
}
