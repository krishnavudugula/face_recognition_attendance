package com.bits.faceattend

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    companion object {
        private const val TAG = "MainActivity"
        private const val REQUEST_CODE_BACKGROUND_LOCATION = 1002
        private const val PREF_OEM_PROMPT_SHOWN = "oem_exemption_prompt_shown"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        registerPlugin(LocationTrackingPlugin::class.java)

        // 🔴 REQUEST "ALWAYS ALLOW" LOCATION: Critical for backgrounded GPS tracking
        // Without this, location stops when screen is locked
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            requestBackgroundLocationPermission()
        }

        // Request battery optimization exemption so the service survives Doze mode
        requestBatteryOptimizationExemption()
        
        // Also request OEM-specific battery exemptions (Xiaomi, Samsung, Realme, etc.)
        requestOemBatteryExemption()
    }

    /**
     * 🔴 Called from JavaScript after faculty login
     * Shows a critical user guidance dialog for AutoStart + Locking app in recents
     */
    fun showFirstLoginGuidance() {
        try {
            val prefs = getSharedPreferences("FaceAttendPrefs", MODE_PRIVATE)
            val userId = prefs.getString("userId", "")
            val guidanceKey = "guidance_shown_for_$userId"
            val guidanceShown = prefs.getBoolean(guidanceKey, false)
            if (guidanceShown) {
                Log.d(TAG, "Guidance already shown for user $userId, skipping")
                return
            }
            
            android.app.AlertDialog.Builder(this)
                .setTitle("🔴 CRITICAL: Enable AutoStart")
                .setMessage(
                    "For FaceAttend to track your location when the screen is locked:\n\n" +
                    "1️⃣ Tap 'Open AutoStart'\n" +
                    "2️⃣ Find 'FaceAttend' → Toggle ON\n" +
                    "3️⃣ Go to Recents → Long-press FaceAttend → Tap Lock 🔒\n\n" +
                    "Without these, tracking STOPS on screen lock/swipe."
                )
                .setPositiveButton("Open AutoStart Settings") { _, _ ->
                    openAutoStartSettings()
                    prefs.edit().putBoolean(guidanceKey, true).apply()
                }
                .setNegativeButton("Skip") { _, _ ->
                    prefs.edit().putBoolean(guidanceKey, true).apply()
                }
                .setCancelable(false)
                .show()
        } catch (e: Exception) {
            Log.w(TAG, "Could not show first login guidance: ${e.message}")
        }
    }

    /**
     * Direct user to AutoStart settings for their specific manufacturer
     */
    private fun openAutoStartSettings() {
        val manufacturer = Build.MANUFACTURER.lowercase()
        val intent = when {
            manufacturer.contains("xiaomi") || manufacturer.contains("redmi") -> {
                Intent().apply {
                    component = android.content.ComponentName(
                        "com.miui.securitycenter",
                        "com.miui.permcenter.autostart.AutoStartManagementActivity"
                    )
                }
            }
            manufacturer.contains("oppo") || manufacturer.contains("realme") -> {
                Intent().apply {
                    component = android.content.ComponentName(
                        "com.coloros.safecenter",
                        "com.coloros.safecenter.permission.startup.StartupAppListActivity"
                    )
                }
            }
            manufacturer.contains("vivo") -> {
                Intent().apply {
                    component = android.content.ComponentName(
                        "com.vivo.permissionmanager",
                        "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"
                    )
                }
            }
            manufacturer.contains("samsung") -> {
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.parse("package:$packageName")
                }
            }
            else -> Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:$packageName")
            }
        }
        try {
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            startActivity(intent)
        } catch (e: Exception) {
            Log.w(TAG, "Could not open AutoStart settings: ${e.message}")
        }
    }

    /**
     * 🔴 CRITICAL: Request "Allow all the time" background location permission.
     * This is what stops GPS when screen locks on Android 10+.
     * Without this: GPS tracking only works while app is in foreground.
     */
    private fun requestBackgroundLocationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (checkSelfPermission(android.Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                
                // Show explanation dialog FIRST (Google Play requires this)
                android.app.AlertDialog.Builder(this)
                    .setTitle("Background Location Required")
                    .setMessage(
                        "FaceAttend needs to track your location even when the app " +
                        "is in the background to monitor your attendance accurately.\n\n" +
                        "On the next screen, select 'Allow all the time'.\n\n" +
                        "Without this, location tracking stops when your screen is locked."
                    )
                    .setPositiveButton("Continue") { _, _ ->
                        requestPermissions(
                            arrayOf(android.Manifest.permission.ACCESS_BACKGROUND_LOCATION),
                            REQUEST_CODE_BACKGROUND_LOCATION
                        )
                    }
                    .setCancelable(false)
                    .show()
            }
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        
        when (requestCode) {
            REQUEST_CODE_BACKGROUND_LOCATION -> {
                if (grantResults.isNotEmpty() &&
                    grantResults[0] == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    Log.d(TAG, "✅ Background location permission granted")
                } else {
                    Log.w(TAG, "⚠️ Background location permission denied - tracking will stop when screen locks")
                }
            }
        }
    }

    /**
     * Prompts the user to disable battery optimization for this app.
     * Without this, Android will kill the foreground service when the screen is locked.
     */
    private fun requestBatteryOptimizationExemption() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = getSystemService(POWER_SERVICE) as PowerManager
            if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                Log.d(TAG, "🔋 Requesting battery optimization exemption...")
                try {
                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:$packageName")
                    }
                    startActivity(intent)
                } catch (e: Exception) {
                    Log.w(TAG, "⚠️ Could not request battery optimization exemption: ${e.message}")
                }
            } else {
                Log.d(TAG, "✅ Battery optimization already disabled for this app")
            }
        }
    }

    /**
     * 🔴 CRITICAL FIX: Handle OEM-specific battery killers (Xiaomi, Samsung, Realme, Vivo, Oppo, Huawei)
     * These devices ignore standard Doze exemptions; you must open their custom battery optimization settings.
     * Call this after requestBatteryOptimizationExemption() to handle both Google's Doze AND OEM restrictions.
     */
    private fun requestOemBatteryExemption() {
        // Show OEM battery prompt only once to avoid spamming users on every app start.
        try {
            val prefs = getSharedPreferences("FaceAttendPrefs", MODE_PRIVATE)
            val alreadyShown = prefs.getBoolean(PREF_OEM_PROMPT_SHOWN, false)
            if (alreadyShown) {
                Log.d(TAG, "OEM exemption prompt already shown previously — skipping")
                return
            }
        } catch (e: Exception) {
            Log.w(TAG, "Could not read prefs for OEM prompt: ${e.message}")
            // proceed without blocking — we'll still try to show the prompt
        }

        val manufacturer = Build.MANUFACTURER.lowercase()
        Log.d(TAG, "🔍 Device manufacturer: $manufacturer")
        
        try {
            val intent = when {
                // Xiaomi/MIUI: Auto-start Manager
                manufacturer.contains("xiaomi") || manufacturer.contains("redmi") -> {
                    Log.d(TAG, "🔴 Xiaomi device detected - Opening MIUI Auto-start Manager...")
                    android.content.Intent().apply {
                        component = android.content.ComponentName(
                            "com.miui.securitycenter",
                            "com.miui.permcenter.autostart.AutoStartManagementActivity"
                        )
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                }
                
                // Oppo/Realme: ColorOS Battery Optimization
                manufacturer.contains("oppo") || manufacturer.contains("realme") -> {
                    Log.d(TAG, "🔴 Oppo/Realme device detected - Opening ColorOS App Power Management...")
                    android.content.Intent().apply {
                        component = android.content.ComponentName(
                            "com.coloros.safecenter",
                            "com.coloros.safecenter.permission.startup.StartupAppListActivity"
                        )
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                }
                
                // Vivo: FunTouchOS Background App Management
                manufacturer.contains("vivo") -> {
                    Log.d(TAG, "🔴 Vivo device detected - Opening FunTouchOS Background Management...")
                    android.content.Intent().apply {
                        component = android.content.ComponentName(
                            "com.vivo.permissionmanager",
                            "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"
                        )
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                }
                
                // Huawei: EMUI Startup Manager
                manufacturer.contains("huawei") -> {
                    Log.d(TAG, "🔴 Huawei device detected - Opening EMUI Startup Manager...")
                    android.content.Intent().apply {
                        component = android.content.ComponentName(
                            "com.huawei.systemmanager",
                            "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"
                        )
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                }
                
                // Samsung: Device Care > Battery > App Power Management
                manufacturer.contains("samsung") -> {
                    Log.d(TAG, "🔴 Samsung device detected - Opening Device Care App Power Management...")
                    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.parse("package:$packageName")
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                }
                
                else -> null
            }
            
            if (intent != null) {
                try {
                    startActivity(intent)
                    Log.d(TAG, "✅ OEM battery settings opened successfully")
                    // Mark that we've shown the prompt so we don't spam the user repeatedly
                    try {
                        val prefs = getSharedPreferences("FaceAttendPrefs", MODE_PRIVATE)
                        prefs.edit().putBoolean(PREF_OEM_PROMPT_SHOWN, true).apply()
                    } catch (ex: Exception) {
                        Log.w(TAG, "Could not set OEM prompt flag: ${ex.message}")
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "⚠️ OEM settings activity not found: ${e.message}")
                    // Fallback: Open standard app info page
                    try {
                        val fallback = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                            data = Uri.parse("package:$packageName")
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK
                        }
                        startActivity(fallback)
                        Log.d(TAG, "✅ Fallback to app info settings opened")
                        try {
                            val prefs = getSharedPreferences("FaceAttendPrefs", MODE_PRIVATE)
                            prefs.edit().putBoolean(PREF_OEM_PROMPT_SHOWN, true).apply()
                        } catch (ex: Exception) {
                            Log.w(TAG, "Could not set OEM prompt flag: ${ex.message}")
                        }
                    } catch (ex: Exception) {
                        Log.w(TAG, "⚠️ Could not open any settings: ${ex.message}")
                    }
                }
            } else {
                Log.d(TAG, "ℹ️ Device manufacturer $manufacturer has no known OEM battery killer")
            }
        } catch (e: Exception) {
            Log.w(TAG, "⚠️ OEM battery exemption error: ${e.message}")
        }
    }

    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        Log.d(TAG, "🔙 Back button pressed")
        val jsCode = "window.handleAndroidBackButton && window.handleAndroidBackButton()"
        bridge.webView.evaluateJavascript(jsCode, null)
        // Do NOT call super.onBackPressed() — let the JS handler control navigation
    }
}
