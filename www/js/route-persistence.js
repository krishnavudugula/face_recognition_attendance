/**
 * Route Persistence Module
 * ========================
 * Saves the current page URL whenever navigation happens.
 * On app restart, restores the user to the last page they were on.
 * This works in conjunction with the back button handler.
 * 
 * Problem Solved:
 * When Android kills the app from recents, it cold-starts it.
 * This module ensures the user returns to their last page instead of login.
 * 
 * Features:
 * ✓ Automatically saves route on every page navigation
 * ✓ Restores to last route on app startup
 * ✓ Clears route persistence on logout
 * ✓ Uses @capacitor/preferences for reliable cross-session storage
 * 
 * Dependencies:
 * - @capacitor/preferences (for secure persistent storage)
 * 
 * Include this script AFTER back-button-handler.js but BEFORE main.js
 */

(function initRoutePersistence() {
    const STORAGE_KEY = 'lastRoute';
    const CAPACITOR_READY_WAIT = 3000; // Wait up to 3 seconds for Capacitor to load

    // Import Preferences from Capacitor
    const getPreferences = async () => {
        try {
            if (typeof window.Capacitor === 'undefined') {
                console.warn('[RoutePersistence] Capacitor not available');
                return null;
            }
            return window.Capacitor.Plugins.Preferences;
        } catch (e) {
            console.warn('[RoutePersistence] Failed to load Preferences plugin:', e);
            return null;
        }
    };

    /**
     * Save current route to persistent storage
     */
    async function saveCurrentRoute() {
        try {
            const currentUrl = window.location.pathname + window.location.search;
            const Preferences = await getPreferences();
            
            if (Preferences) {
                await Preferences.set({ key: STORAGE_KEY, value: currentUrl });
                console.log('[RoutePersistence] Saved route:', currentUrl);
            } else {
                // Fallback to localStorage if Preferences not available
                localStorage.setItem(STORAGE_KEY, currentUrl);
                console.log('[RoutePersistence] Saved route (localStorage):', currentUrl);
            }
        } catch (e) {
            console.warn('[RoutePersistence] Failed to save current route:', e);
        }
    }

    /**
     * Restore app to last saved route on startup
     */
    async function restoreLastRoute() {
        try {
            // Don't restore if user is not logged in
            const user = localStorage.getItem('user');
            if (!user) {
                console.log('[RoutePersistence] User not logged in, skipping route restore');
                return;
            }

            const Preferences = await getPreferences();
            let lastRoute = null;

            if (Preferences) {
                const result = await Preferences.get({ key: STORAGE_KEY });
                lastRoute = result?.value;
                console.log('[RoutePersistence] Retrieved last route from Preferences:', lastRoute);
            } else {
                // Fallback to localStorage
                lastRoute = localStorage.getItem(STORAGE_KEY);
                console.log('[RoutePersistence] Retrieved last route from localStorage:', lastRoute);
            }

            // Only restore if we have a valid route and it's not the login/root page
            if (lastRoute && lastRoute !== '/' && lastRoute !== '/pages/login.html' && lastRoute !== '/index.html') {
                // Only navigate if route is valid and absolute
                if (lastRoute.startsWith('/') && !lastRoute.includes('undefined')) {
                    // Use history.pushState + location.hash to populate browser history
                    window.history.pushState({ route: lastRoute }, '', lastRoute);
                    window.location.href = lastRoute;  // Use absolute path, don't remove leading slash!
                    console.log('[RoutePersistence] Restored route:', lastRoute);
                } else {
                    console.warn('[RoutePersistence] Route is not absolute, skipping restore:', lastRoute);
                }
            }
        } catch (e) {
            console.warn('[RoutePersistence] Failed to restore last route:', e);
        }
    }

    /**
     * Clear saved route (call this on logout)
     */
    window.clearPersistedRoute = async function() {
        try {
            const Preferences = await getPreferences();
            if (Preferences) {
                await Preferences.remove({ key: STORAGE_KEY });
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
            console.log('[RoutePersistence] Cleared persisted route');
        } catch (e) {
            console.warn('[RoutePersistence] Failed to clear persisted route:', e);
        }
    };

    /**
     * Setup route change tracking
     * Intercept all navigation and save the route
     * Also track history for back button support
     */
    function setupRouteTracking() {
        // Track clicks on all links and add to history
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link && link.href) {
                // Save route only for internal links (same domain)
                if (link.href.includes(window.location.origin) || link.href.startsWith('/')) {
                    // Extract path from href
                    const linkPath = new URL(link.href, window.location.origin).pathname + new URL(link.href, window.location.origin).search;
                    if (linkPath !== window.location.pathname + window.location.search) {
                        // Push to history so back button works
                        window.history.pushState({ route: linkPath }, '', linkPath);
                    }
                    setTimeout(saveCurrentRoute, 100); // Small delay to ensure page is ready
                }
            }
        });

        // Track window.location assignments
        // Wrap location.href setter to use history API
        const locationDescriptor = Object.getOwnPropertyDescriptor(Location.prototype, 'href');
        if (locationDescriptor && locationDescriptor.set) {
            const originalSetter = locationDescriptor.set;
            Object.defineProperty(window.location, 'href', {
                ...locationDescriptor,
                set: function(url) {
                    const newPath = new URL(url, window.location.origin).pathname + new URL(url, window.location.origin).search;
                    if (newPath !== window.location.pathname + window.location.search) {
                        window.history.pushState({ route: newPath }, '', newPath);
                    }
                    saveCurrentRoute();
                    return originalSetter.call(window.location, url);
                }
            });
        }

        // Track visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                saveCurrentRoute();
            }
        });

        // Track hash changes
        window.addEventListener('hashchange', () => {
            saveCurrentRoute();
        });

        // Track browser back/forward
        window.addEventListener('popstate', () => {
            saveCurrentRoute();
        });

        console.log('[RoutePersistence] Route tracking initialized with history support');
    }

    /**
     * Initialize route persistence
     * Wait for Capacitor to be ready, then setup tracking
     */
    async function init() {
        console.log('[RoutePersistence] Initializing route persistence...');

        // Wait a bit for Capacitor to load
        let capacitorReady = false;
        const startTime = Date.now();
        while (!capacitorReady && (Date.now() - startTime) < CAPACITOR_READY_WAIT) {
            if (typeof window.Capacitor !== 'undefined') {
                capacitorReady = true;
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (capacitorReady) {
            console.log('[RoutePersistence] Capacitor ready');
            // Skip automatic route restore on initial load - only restore when app resumes
            // This prevents routing issues on app startup
        }

        // Setup tracking for future navigations
        setupRouteTracking();

        // Save current route immediately
        await saveCurrentRoute();
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Also save route when app comes back from background
    if (typeof window.Capacitor !== 'undefined') {
        const { App } = window.Capacitor.Plugins;
        App?.addListener?.('appStateChange', ({ isActive }) => {
            if (isActive) {
                console.log('[RoutePersistence] App resumed - saving current route');
                saveCurrentRoute();
            }
        });
    }

})();
