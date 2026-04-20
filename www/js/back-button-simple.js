/**
 * Android Back Button Handler - CAPACITOR READY EVENT
 * Maintains our own navigation stack since history.pushState doesn't work reliably
 */

(function() {
    console.log('[BackButton] Initializing...');
    
    let isReady = false;
    const navigationStack = [];
    const MAX_STACK_SIZE = 50;

    // Track navigation to build our own stack
    function trackNavigation(path) {
        // Don't add duplicate consecutive entries
        if (navigationStack.length === 0 || navigationStack[navigationStack.length - 1] !== path) {
            navigationStack.push(path);
            if (navigationStack.length > MAX_STACK_SIZE) {
                navigationStack.shift();
            }
            console.log('[BackButton] Stack updated, size:', navigationStack.length, 'Current:', path);
        }
    }

    // Track initial page
    trackNavigation(window.location.pathname + window.location.search);

    // Override link clicks to track navigation
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link && link.href) {
            const newPath = new URL(link.href).pathname + new URL(link.href).search;
            if (newPath !== window.location.pathname + window.location.search) {
                console.log('[BackButton] Link clicked, will track:', newPath);
                // Schedule tracking after brief delay to let page load
                setTimeout(() => trackNavigation(newPath), 100);
            }
        }
    }, true);

    // Override window.location.href to track navigation
    const originalHrefDescriptor = Object.getOwnPropertyDescriptor(Location.prototype, 'href');
    if (originalHrefDescriptor && originalHrefDescriptor.set) {
        Object.defineProperty(window.location, 'href', {
            ...originalHrefDescriptor,
            set: function(newUrl) {
                try {
                    const newPath = new URL(newUrl, window.location.origin).pathname + 
                                   new URL(newUrl, window.location.origin).search;
                    console.log('[BackButton] Direct href set to:', newPath);
                    setTimeout(() => trackNavigation(newPath), 100);
                } catch (e) {
                    console.warn('[BackButton] URL parse error:', e);
                }
                return originalHrefDescriptor.set.call(window.location, newUrl);
            }
        });
    }

    // Function to register back button listener
    function registerBackButton() {
        console.log('[BackButton] Attempting to register with Capacitor...');
        
        try {
            const App = window.aCapacitor?.Plugins?.App;
            
            if (!App) {
                console.log('[BackButton] App plugin not available yet');
                return false;
            }

            if (isReady) {
                console.log('[BackButton] Already registered, skipping...');
                return true;
            }

            console.log('[BackButton] ✅ Successfully registered');
            isReady = true;

            App.addListener('backButton', () => {
                console.log('[BackButton] PRESSED');
                console.log('[BackButton] Navigation stack size:', navigationStack.length);
                console.log('[BackButton] Current path:', window.location.pathname);
                
                if (navigationStack.length > 1) {
                    // Remove current page from stack
                    navigationStack.pop();
                    // Go back to previous page
                    const previousPath = navigationStack[navigationStack.length - 1];
                    console.log('[BackButton] Going back to:', previousPath);
                    window.location.href = previousPath;
                } else {
                    console.log('[BackButton] At root of stack, minimizing app');
                    // At root - minimize to background
                    App.minimizeApp();
                }
            });

            return true;

        } catch (e) {
            console.error('[BackButton] Error registering:', e);
            return false;
        }
    }

    // Use Capacitor's ready state and/or polling with timeout
    let attempts = 0;
    const maxAttempts = 100; // Timeout after ~10 seconds (100 * 100ms)
    
    function tryRegister() {
        attempts++;
        
        if (registerBackButton()) {
            console.log('[BackButton] ✅ Hook registered successfully!');
            return;
        }
        
        if (attempts < maxAttempts) {
            setTimeout(tryRegister, 100);
        } else {
            console.error('[BackButton] ❌ FAILED TO REGISTER - Capacitor.Plugins.App not available after 10 seconds');
            console.log('[BackButton] window.Capacitor:', typeof window.Capacitor);
            if (window.Capacitor) {
                console.log('[BackButton] window.Capacitor.Plugins:', typeof window.Capacitor.Plugins);
                if (window.Capacitor.Plugins) {
                    console.log('[BackButton] window.Capacitor.Plugins.App:', typeof window.Capacitor.Plugins.App);
                }
            }
        }
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryRegister);
    } else {
        tryRegister();
    }
})();
