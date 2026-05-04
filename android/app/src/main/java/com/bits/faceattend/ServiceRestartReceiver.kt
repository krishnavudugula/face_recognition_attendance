package com.bits.faceattend

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * Receives BOOT_COMPLETED and custom RESTART_SERVICE broadcasts.
 * Ensures LocationTrackingService is restarted after device reboot
 * or after the system kills it during Doze mode.
 */
class ServiceRestartReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "ServiceRestartReceiver"
        const val ACTION_RESTART = "com.bits.faceattend.ACTION_RESTART_SERVICE"
    }

    override fun onReceive(context: Context, intent: Intent) {
        Log.d(TAG, "⚡ Received broadcast: ${intent.action}")

        val prefs = context.getSharedPreferences("FaceAttendPrefs", Context.MODE_PRIVATE)
        val userId = prefs.getString("userId", "") ?: ""

        if (userId.isEmpty()) {
            Log.d(TAG, "No userId in prefs — user is logged out, not restarting service.")
            return
        }

        Log.d(TAG, "🔄 Restarting LocationTrackingService for user: $userId")

        val serviceIntent = Intent(context, LocationTrackingService::class.java).apply {
            setPackage(context.packageName)
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
            Log.d(TAG, "✅ Service restart initiated successfully")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to restart service: ${e.message}")
        }
    }
}
