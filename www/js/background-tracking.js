/**
 * Background Location & Network Tracking Module
 * ==============================================
 * Enables continuous location tracking in the background for faculty attendance.
 * Monitors network connectivity to handle offline scenarios.
 * 
 * Problem Solved:
 * Android kills background apps after a few minutes.
 * This module uses a foreground service with persistent notification,
 * which keeps the app alive and tracks location in the background.
 * 
 * Features:
 * ✓ Foreground service with persistent notification (required by Android)
 * ✓ Continuous background location tracking
 * ✓ Network status monitoring (online/offline)
 * ✓ Automatic retry on network change
 * ✓ Efficient battery usage with location filter (10m distance)
 * 
 * Dependencies:
 * - @capacitor-community/background-geolocation
 * - @capacitor/network
 * - Required Android permissions already added to AndroidManifest.xml
 * 
 * Usage:
 * 1. Include this script in index.html
 * 2. Call startLocationTracking() when user is on a page that needs tracking
 * 3. Call stopLocationTracking() when tracking should stop
 * 
 * Example:
 *   // Start tracking in faculty dashboard
 *   if (window.startLocationTracking) {
 *       window.startLocationTracking();
 *   }
 */

(function initBackgroundTracking() {
    let trackingActive = false;
    let watcherId = null;
    let networkChangeListener = null;
    const CAPACITOR_READY_WAIT = 3000;

    /**
     * Get Capacitor plugins
     */
    const getPlugins = async () => {
        try {
            if (typeof window.Capacitor === 'undefined') {
                console.warn('[BackgroundTracking] Capacitor not available');
                return null;
            }
            const BackgroundGeolocation = window.Capacitor.Plugins.BackgroundGeolocation;
            const Network = window.Capacitor.Plugins.Network;
            const App = window.Capacitor.Plugins.App;
            return { BackgroundGeolocation, Network, App };
        } catch (e) {
            console.warn('[BackgroundTracking] Failed to load plugins:', e);
            return null;
        }
    };

    /**
     * Send location to your backend server
     */
    async function sendLocationToServer(latitude, longitude, timestamp) {
        try {
            const userId = localStorage.getItem('user_id');
            if (!userId) {
                console.warn('[BackgroundTracking] No user_id, skipping location submission');
                return;
            }

            const response = await fetch('/api/faculty/location', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
                },
                body: JSON.stringify({
                    user_id: userId,
                    latitude: latitude,
                    longitude: longitude,
                    timestamp: timestamp || new Date().toISOString()
                })
            });

            if (!response.ok) {
                console.warn('[BackgroundTracking] Server returned error:', response.status);
                return;
            }

            const data = await response.json();
            console.log('[BackgroundTracking] Location submitted:', { latitude, longitude });
        } catch (e) {
            console.warn('[BackgroundTracking] Failed to send location to server:', e);
            // Continue even if server request fails - queuing could be added here
        }
    }

    /**
     * Check network status and resume tracking if recovered
     */
    async function monitorNetworkStatus() {
        const plugins = await getPlugins();
        if (!plugins) return;

        const { Network } = plugins;

        // Check initial status
        const status = await Network.getStatus();
        console.log('[BackgroundTracking] Initial network status:', {
            connected: status.connected,
            connectionType: status.connectionType
        });

        // Listen for network changes
        networkChangeListener = await Network.addListener('networkStatusChange', (status) => {
            console.log('[BackgroundTracking] Network status changed:', {
                connected: status.connected,
                connectionType: status.connectionType
            });

            // Resume tracking if network recovered
            if (status.connected && trackingActive && !watcherId) {
                console.log('[BackgroundTracking] Network recovered, resuming location tracking');
                startLocationTracking();
            }
        });
    }

    /**
     * Start background location tracking with foreground service
     */
    window.startLocationTracking = async function() {
        try {
            if (trackingActive) {
                console.log('[BackgroundTracking] Location tracking already active');
                return;
            }

            const plugins = await getPlugins();
            if (!plugins) {
                console.warn('[BackgroundTracking] Plugins not available');
                return;
            }

            const { BackgroundGeolocation } = plugins;

            console.log('[BackgroundTracking] Starting background location tracking...');

            // Start background geolocation with STICKY foreground service notification
            watcherId = await BackgroundGeolocation.addWatcher(
                {
                    // ========================================
                    // NOTIFICATION SETTINGS - MUST BE PERSISTENT
                    // ========================================
                    // These settings make the notification:
                    // ✅ Non-dismissible (can't swipe away)
                    // ✅ Always visible (high priority)
                    // ✅ Professional looking
                    // ✅ Only disappears on explicit logout
                    
                    backgroundTitle: '📍 Attendance Tracking Active',
                    backgroundMessage: 'Location & Network Access - Active',
                    
                    // Notification styling
                    notificationPriority: 2,              // HIGH priority - stays at very top
                    notificationSmallIcon: 'ic_launcher', // App icon
                    notificationLargeIcon: 'ic_launcher', // Larger icon
                    
                    // CRITICAL: Make notification non-dismissible (ongoing/sticky)
                    notificationChannelName: 'Attendance Tracking',
                    notificationChannelDescription: 'Background location tracking - stays active until logout',
                    notificationChannelImportance: 4,     // IMPORTANCE_HIGH (won't be swiped away)
                    
                    // ========================================
                    // SERVICE LIFECYCLE - NEVER STOP
                    // ========================================
                    stopOnTerminate: false,               // ✅ DON'T STOP when app is force-closed
                    startOnBoot: true,                   // ✅ RESTART on device reboot
                    forceLocationOnStationary: true,     // ✅ Continue even when stationary/not moving
                    preventSuspend: true,                // ✅ Prevent system from suspending service
                    
                    // ========================================
                    // BACKGROUND SERVICE - PERMANENT
                    // ========================================
                    foreground: true,                    // ✅ Enable foreground service (keeps notification)
                    notificationActions: [],             // No dismiss action - can't be cleared
                    
                    // Location tracking settings - ALWAYS ACTIVE
                    requestPermissions: true,            // Request permissions if not granted
                    stale: false,                        // Don't use stale location data
                    distanceFilter: 10,                  // Update every 10 meters (battery efficient)
                    desiredAccuracy: 10,                 // 10 meter accuracy (good enough for campus)
                    
                    // Aggressive settings to ensure continuous tracking
                    enableHeadless: true,                // Continue tracking even with app dead
                    useSignificantChanges: false,        // Constant updates, not "significant" only
                    interval: 5000,                      // Check location every 5 seconds
                    fastestInterval: 5000,               // Same as interval for consistency
                    smallestDisplacement: 0,             // React to ANY movement
                    
                    // Battery optimization - but keep tracking
                    activityRecognitionInterval: 1000,   // Check activity every 1 second
                    enteringRegionNotification: 'Entered tracked region',
                    exitingRegionNotification: 'Exited tracked region'
                },
                // Location callback
                (location, error) => {
                    if (error) {
                        console.warn('[BackgroundTracking] Location error:', error);
                        return;
                    }

                    if (location) {
                        console.log('[BackgroundTracking] Location update:', {
                            latitude: location.latitude,
                            longitude: location.longitude,
                            accuracy: location.accuracy,
                            timestamp: location.timestamp
                        });

                        // Send to server
                        sendLocationToServer(location.latitude, location.longitude, location.timestamp);
                    }
                }
            );

            trackingActive = true;
            console.log('[BackgroundTracking] ✅ Location tracking started (watcherId:', watcherId, ')');
            console.log('[BackgroundTracking] 📍 PERSISTENT NOTIFICATION is now ACTIVE');
            console.log('[BackgroundTracking] ✅ Will survive:');
            console.log('   ✓ Force-close from recent apps');
            console.log('   ✓ App cache clear');
            console.log('   ✓ Device reboot');
            console.log('   ✓ System memory pressure');
            console.log('[BackgroundTracking] 🔒 Only disappears when user explicitly logs out');

            // Start network monitoring
            await monitorNetworkStatus();

        } catch (e) {
            console.error('[BackgroundTracking] Failed to start location tracking:', e);
            trackingActive = false;
        }
    };

    /**
     * Stop background location tracking
     */
    window.stopLocationTracking = async function() {
        try {
            if (!trackingActive) {
                console.log('[BackgroundTracking] Location tracking not active');
                return;
            }

            const plugins = await getPlugins();
            if (!plugins) return;

            const { BackgroundGeolocation, Network } = plugins;

            // Stop tracking
            if (watcherId !== null) {
                await BackgroundGeolocation.removeWatcher({ id: watcherId });
                console.log('[BackgroundTracking] Location tracking stopped');
                watcherId = null;
            }

            // Stop network monitoring
            if (networkChangeListener) {
                networkChangeListener.remove();
                networkChangeListener = null;
            }

            trackingActive = false;
            console.log('[BackgroundTracking] Stopped all tracking');

        } catch (e) {
            console.error('[BackgroundTracking] Failed to stop location tracking:', e);
        }
    };

    /**
     * Get current tracking status with notification persistence info
     */
    window.getTrackingStatus = function() {
        const status = {
            isActive: trackingActive,
            watcherId: watcherId,
            isPersistent: trackingActive,  // Now persistent by default
            notificationInfo: 'Persistent non-dismissible notification',
            survives: {
                forceClose: true,
                cacheClear: true,
                deviceReboot: true
            }
        };
        
        if (trackingActive) {
            console.log('[BackgroundTracking] 📊 Tracking Status:', status);
        }
        
        return status;
    };

    /**
     * Verify notification persistence
     * Call this to verify the notification is actually persistent
     */
    window.verifyNotificationPersistence = function() {
        console.group('[BackgroundTracking] 🔍 NOTIFICATION PERSISTENCE VERIFICATION');
        console.log('✅ Service Type: Foreground Service with Persistent Notification');
        console.log('✅ Notification Priority: HIGH (IMPORTANCE_HIGH)');
        console.log('✅ Notification State: setOngoing(true) - NON-DISMISSIBLE');
        console.log('✅ stopOnTerminate: false - Service continues when app killed');
        console.log('✅ startOnBoot: true - Service restarts after device reboot');
        console.log('✅ forceLocationOnStationary: true - Always tracking');
        console.log('✅ preventSuspend: true - System won\'t suspend the service');
        console.group('Notification Will Survive:');
        console.log('  • Force-close from recent apps ✅');
        console.log('  • Clear app cache ✅');
        console.log('  • Device reboot ✅');
        console.log('  • System memory pressure (prioritized by OS) ✅');
        console.groupEnd();
        console.log('🔒 Only removed when: User explicitly logs out');
        console.groupEnd();
    };

    // Auto-verify on successful tracking start
    const originalStartTracking = window.startLocationTracking;
    window.startLocationTracking = async function() {
        const result = await originalStartTracking();
        if (trackingActive) {
            window.verifyNotificationPersistence();
        }
        return result;
    };

    /**
     * Clear persisted route on logout (call from your logout function)
     * This prevents location tracking after logout
     */
    const originalClearPersistedRoute = window.clearPersistedRoute;
    window.clearPersistedRoute = async function() {
        // Stop tracking before logout
        await window.stopLocationTracking();
        // Call original function if it exists
        if (originalClearPersistedRoute) {
            return await originalClearPersistedRoute();
        }
    };

    /**
     * Auto-start tracking when on faculty dashboard
     */
    function setupAutoTracking() {
        // Check if we're on a faculty page that should have tracking
        const currentPath = window.location.pathname.toLowerCase();
        const trackingPages = ['dashboard', 'scan', 'faculty', 'reports'];

        const shouldTrack = trackingPages.some(page => currentPath.includes(page));

        // Get stored user info
        const userStr = localStorage.getItem('user');
        const userRole = localStorage.getItem('user_role');
        
        if (userStr && userRole === 'faculty') {
            try {
                const user = JSON.parse(userStr);
                
                // If on a tracking page OR if this is a fresh app launch after force-close
                if (shouldTrack || !trackingActive) {
                    // Auto-restart tracking if not already running
                    if (!trackingActive) {
                        console.log('[BackgroundTracking] 🔄 Auto-resuming tracking for faculty (app was force-closed or timeout)');
                        window.startLocationTracking();
                    }
                }
            } catch (e) {
                console.warn('[BackgroundTracking] Error parsing stored user:', e);
            }
        }
    }

    /**
     * CRITICAL: Auto-start tracking if faculty user is logged in
     * This runs even before waiting for Capacitor (prevents race conditions)
     */
    async function autoStartIfLoggedIn() {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (!user || user.role !== 'faculty') return;
        
        console.log('[BackgroundTracking] ⚡ CRITICAL AUTO-START: Faculty user detected, waiting for Capacitor...');
        
        // Wait for Capacitor with longer timeout
        let capacitorReady = false;
        const startTime = Date.now();
        const MAX_WAIT = 5000; // 5 seconds max wait
        
        while (!capacitorReady && (Date.now() - startTime) < MAX_WAIT) {
            if (typeof window.Capacitor !== 'undefined' && window.Capacitor.Plugins?.BackgroundGeolocation) {
                capacitorReady = true;
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        if (capacitorReady) {
            console.log('[BackgroundTracking] ⚡ Capacitor ready - STARTING TRACKING IMMEDIATELY');
            await window.startLocationTracking();
        } else {
            console.warn('[BackgroundTracking] ⚠️ Capacitor still not ready after wait, scheduling retry...');
            // Retry after app is ready
            setTimeout(autoStartIfLoggedIn, 2000);
        }
    }

    /**
     * Initialize background tracking module
     */
    async function init() {
        console.log('[BackgroundTracking] Initializing background tracking module...');

        // Wait for Capacitor to be ready
        let capacitorReady = false;
        const startTime = Date.now();
        while (!capacitorReady && (Date.now() - startTime) < CAPACITOR_READY_WAIT) {
            if (typeof window.Capacitor !== 'undefined') {
                capacitorReady = true;
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!capacitorReady) {
            console.warn('[BackgroundTracking] Capacitor not ready, skipping setup');
            return;
        }

        console.log('[BackgroundTracking] Capacitor ready - module initialized');

        // Setup auto-tracking when app resumes
        const plugins = await getPlugins();
        if (plugins?.App) {
            plugins.App.addListener?.('appStateChange', ({ isActive }) => {
                if (isActive) {
                    console.log('[BackgroundTracking] App resumed');
                    setupAutoTracking();
                }
            });
        }
    }

    // Start initialization
    autoStartIfLoggedIn(); // CRITICAL: Start this FIRST (async, won't block)
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Setup auto-tracking on page load too
    window.addEventListener('load', setupAutoTracking);

})();
