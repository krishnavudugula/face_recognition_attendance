package com.bits.faceattend

import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.work.Worker
import androidx.work.WorkerParameters

/**
 * WorkManager-based watchdog that periodically checks if the
 * LocationTrackingService is alive and restarts it if not.
 * 
 * WorkManager is the ONLY Android mechanism that is 100% guaranteed
 * to execute even through Doze mode, app kills, and OEM battery optimization.
 */
class ServiceWatchdogWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

    companion object {
        private const val TAG = "ServiceWatchdog"
        const val WORK_NAME = "FaceAttend_ServiceWatchdog"
    }

    override fun doWork(): Result {
        val prefs = applicationContext.getSharedPreferences("FaceAttendPrefs", Context.MODE_PRIVATE)
        val userId = prefs.getString("userId", "") ?: ""

        if (userId.isEmpty()) {
            Log.d(TAG, "No userId — user logged out. Skipping restart.")
            return Result.success()
        }

        Log.d(TAG, "🔄 Watchdog firing! Ensuring service is alive for user: $userId")

        try {
            val intent = Intent(applicationContext, LocationTrackingService::class.java)
            intent.setPackage(applicationContext.packageName)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                applicationContext.startForegroundService(intent)
            } else {
                applicationContext.startService(intent)
            }
            Log.d(TAG, "✅ Service start command sent successfully")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to restart service: ${e.message}")
        }

        return Result.success()
    }
}
