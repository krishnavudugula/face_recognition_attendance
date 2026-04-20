/**
 * Android Back Button Handler - NATIVE BRIDGE
 * Called directly from MainActivity.java onBackPressed()
 * Tracks page history and navigates backwards
 */

(function() {
    console.log('[BackButton] Initializing native back button handler...');
    
    const HISTORY_KEY = 'pageHistory';
    const DASHBOARD_PAGES = ['/pages/admin_dashboard.html', '/pages/faculty_dashboard.html'];
    
    // Get history from storage
    function getHistory() {
        try {
            const stored = sessionStorage.getItem(HISTORY_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('[BackButton] Failed to parse history:', e);
            return [];
        }
    }
    
    // Save history to storage
    function saveHistory(history) {
        try {
            sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        } catch (e) {
            console.error('[BackButton] Failed to save history:', e);
        }
    }
    
    // Track current page
    function trackCurrentPage() {
        const currentPath = window.location.pathname + window.location.search;
        
        // Skip login and index pages
        if (currentPath.includes('/index.html') || currentPath === '/' || currentPath.includes('login')) {
            return;
        }
        
        const history = getHistory();
        
        // Don't add duplicate consecutive entries
        if (history.length === 0 || history[history.length - 1] !== currentPath) {
            history.push(currentPath);
            if (history.length > 50) {
                history.shift();
            }
            saveHistory(history);
            console.log('[BackButton] Tracked:', currentPath, '| History size:', history.length);
        }
    }
    
    // Track navigation from link clicks
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link && link.href) {
            try {
                const newPath = new URL(link.href).pathname + new URL(link.href).search;
                if (newPath !== window.location.pathname) {
                    setTimeout(() => trackCurrentPage(), 100);
                }
            } catch (err) {
                // Ignore parse errors
            }
        }
    }, true);
    
    // Handle native Android back button press
    // Called from MainActivity.java
    window.handleAndroidBackButton = function() {
        console.log('[BackButton] ========== BACK BUTTON PRESSED ==========');
        
        const history = getHistory();
        const currentPath = window.location.pathname + window.location.search;
        
        console.log('[BackButton] Current page:', currentPath);
        console.log('[BackButton] History size:', history.length);
        console.log('[BackButton] Full history:', history);
        
        // Remove current page from stack if it's there
        if (history.length > 0 && history[history.length - 1] === currentPath) {
            history.pop();
        }
        
        if (history.length >= 1) {
            const nextPage = history[history.length - 1];
            console.log('[BackButton] Going back to:', nextPage);
            saveHistory(history);
            window.location.href = nextPage;
        } else {
            // No more pages in history, go to dashboard
            console.log('[BackButton] History empty, minimizing app');
            if (window.Capacitor?.Plugins?.App) {
                window.Capacitor.Plugins.App.minimizeApp();
            }
        }
        console.log('[BackButton] ==========================================');
    };
    
    // Track initial page
    trackCurrentPage();
    console.log('[BackButton] ✅ Ready - will be called from MainActivity.onBackPressed()');
    
})();
