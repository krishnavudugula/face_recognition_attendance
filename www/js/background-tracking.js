/**
 * 🔧 Background Tracking — STUB
 * ================================
 * This file previously contained a conflicting JS-based background geolocation
 * tracker using @capacitor-community/background-geolocation.
 * 
 * It has been REPLACED with a thin stub that delegates entirely to the native
 * Android Kotlin LocationTrackingService (via location-tracking-plugin.js).
 * 
 * WHY: The JS plugin used navigator.onLine which is UNRELIABLE in background.
 * The native Android service uses ConnectivityManager which is ACCURATE.
 * Having both running caused race conditions and false NETWORK_OFF reports.
 * 
 * All existing callers of startLocationTracking() / stopLocationTracking()
 * will now transparently use the native service instead.
 */

(function() {
    'use strict';

    const TAG = '[BackgroundTracking]';

    /**
     * Start location tracking — delegates to native Android service
     */
    window.startLocationTracking = async function() {
        console.log(TAG, '📍 Delegating to native Android tracking service...');
        
        if (window.startNativeTracking) {
            try {
                const user = JSON.parse(localStorage.getItem('user') || 'null');
                if (user && user.role === 'faculty') {
                    await window.startNativeTracking(
                        user.user_id || user.id,
                        user.name
                    );
                    console.log(TAG, '✅ Native tracking started via delegation');
                } else {
                    console.log(TAG, 'ℹ️ User is not faculty — skipping tracking');
                }
            } catch (e) {
                console.warn(TAG, '⚠️ Native tracking delegation failed:', e);
            }
        } else {
            console.log(TAG, '⚠️ startNativeTracking not available (web mode or plugin not loaded)');
        }
    };

    /**
     * Stop location tracking — delegates to native Android service
     */
    window.stopLocationTracking = async function() {
        console.log(TAG, '🛑 Stopping native tracking...');
        
        if (window.stopNativeTracking) {
            try {
                await window.stopNativeTracking();
                console.log(TAG, '✅ Native tracking stopped');
            } catch (e) {
                console.warn(TAG, '⚠️ Failed to stop native tracking:', e);
            }
        }
    };

    /**
     * Auto-start if user was logged in (for app restart scenarios)
     * The native service handles its own persistence via SharedPreferences,
     * but this ensures the WebView is aware of the tracking state.
     */
    window.autoStartTrackingIfLoggedIn = async function() {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (user && user.role === 'faculty') {
            console.log(TAG, '🔄 Auto-starting tracking for logged-in faculty...');
            await window.startLocationTracking();
        }
    };

    // Legacy no-op functions for backward compatibility
    window.verifyNotificationPersistence = function() {
        console.log(TAG, '✅ Notification persistence handled by native service');
    };

    console.log(TAG, '✅ Stub loaded — all tracking delegated to native Android service');
})();
