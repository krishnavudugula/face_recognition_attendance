/**
 * ?? Location Tracking Plugin Bridge
 * ==================================
 * JS-to-Native bridge for managing the persistent LocationTrackingService
 * on Android, called from faculty_dashboard.html on login
 *
 * Usage:
 *   window.startLocationTracking(userId, userName, apiBase)
 *   window.stopLocationTracking()
 */

let locationTrackingActive = false;
let currentTrackingUserId = null;

async function startLocationTracking(userId = null, userName = null, apiBase = null) {
    console.log('[LocationTracking] Starting tracking...');

    if (!userId) {
        const user = JSON.parse(localStorage.getItem('user'));
        userId = user?.id;
        userName = user?.name || 'Faculty';
    }

    if (!userId) {
        console.error('[LocationTracking] ? No userId available');
        return Promise.reject(new Error('User ID required'));
    }

    if (!apiBase && window.API_BASE_URL) {
        apiBase = window.API_BASE_URL;
    }
    apiBase = apiBase || 'http://192.168.1.100:5000';

    console.log('[LocationTracking] ?? Attempting to start for user:', userId);

    return new Promise((resolve) => {
        if (!window.Capacitor) {
            console.warn('[LocationTracking] ?? Capacitor not available - skipping native tracking');
            // Try fallback to background tracking JS if imported
            if (window.backgroundGeolocation && typeof window.backgroundGeolocation.start === 'function') {
                 window.backgroundGeolocation.start();
            }
            resolve();
            return;
        }

        try {
            if (window.Capacitor.Plugins && window.Capacitor.Plugins.LocationTracking) {
                console.log('[LocationTracking] ?? Invoking native service...');
                window.Capacitor.Plugins.LocationTracking.startTracking({
                    userId: userId.toString(),
                    userName: userName,
                    apiBase: apiBase
                });

                locationTrackingActive = true;
                currentTrackingUserId = userId;

                console.log('[LocationTracking] ? Service start command sent to native layer');
            } else {
                console.warn('[LocationTracking] ?? Native plugin LocationTracking not configured.');
            }
            resolve();
        } catch (error) {
            console.error('[LocationTracking] ? Error starting tracking:', error);
            resolve();
        }
    });
}

async function stopLocationTracking() {
    console.log('[LocationTracking] ?? Stopping tracking...');

    return new Promise((resolve) => {
        try {
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocationTracking) {
                window.Capacitor.Plugins.LocationTracking.stopTracking();
                console.log('[LocationTracking] ? Service stop command sent');
            }

            locationTrackingActive = false;
            currentTrackingUserId = null;
            resolve();
        } catch (error) {
            console.error('[LocationTracking] ? Error stopping tracking:', error);
            resolve();
        }
    });
}

// Check for existing tracking on boot
document.addEventListener('deviceready', () => {
    let storedUser = localStorage.getItem('user');
    if (storedUser) {
        startLocationTracking();
    }
});

// Map to window
window.startLocationTracking = startLocationTracking;
window.stopLocationTracking = stopLocationTracking;
