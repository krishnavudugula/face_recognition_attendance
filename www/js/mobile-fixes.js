/**
 * Mobile Fixes for Face Attendance App
 * =====================================
 * Fixes three critical mobile issues:
 * 1. Hamburger not expanding (touch events)
 * 2. Export not working on phone (mobile-compatible downloads)
 * 3. Back button exits app / session reset (History API + storage persistence)
 * 
 * Include this BEFORE </body> in all HTML files
 */

// ============ 1. HAMBURGER MENU FIX - TOUCH EVENT SUPPORT ============

(function initHamburgerFix() {
    function setupMenuToggle() {
        // Try both ID and class selectors
        const menuToggle = document.querySelector('#hamburger') || 
                          document.querySelector('.menu-toggle') ||
                          document.querySelector('.hamburger');
        
        const navMenu = document.querySelector('#sidebar') || 
                       document.querySelector('.nav-menu') ||
                       document.querySelector('nav');
        
        if (!menuToggle || !navMenu) {
            console.warn('[MobileFix] Hamburger menu elements not found. Looking for: #hamburger or .menu-toggle, and #sidebar or .nav-menu');
            return;
        }

        // Store state
        let isMenuOpen = false;

        // Handle both touch and click events
        function toggleMenu(e) {
            e.preventDefault();
            e.stopPropagation();
            
            isMenuOpen = !isMenuOpen;
            
            if (isMenuOpen) {
                navMenu.classList.add('active');
                menuToggle.classList.add('active');
            } else {
                navMenu.classList.remove('active');
                menuToggle.classList.remove('active');
            }
        }

        // Touch events (primary for mobile)
        menuToggle.addEventListener('touchstart', toggleMenu, { passive: false });
        
        // Click events (fallback)
        menuToggle.addEventListener('click', toggleMenu);

        console.log('[MobileFix] Hamburger menu fix applied - Menu stays open until hamburger clicked again');
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupMenuToggle);
    } else {
        setupMenuToggle();
    }
})();

// ============ 2. MOBILE-COMPATIBLE FILE DOWNLOAD ============

/**
 * Mobile-safe download function
 * Uses fetch + Blob instead of window.location.href
 * Works on Android and iOS where direct assignment is blocked
 * 
 * Usage:
 *   mobileDownload('/api/export_report?type=summary&format=csv&start_date=2025-01-01&end_date=2025-01-31');
 */
window.mobileDownload = async function(url, filename = null) {
    try {
        console.log('[MobileFix] Starting mobile-safe download:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Download failed: ${response.status} ${response.statusText}`);
        }

        // Get filename from Content-Disposition header if not provided
        if (!filename) {
            const contentDisposition = response.headers.get('content-disposition');
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="?([^"]+)"?/);
                if (match && match[1]) {
                    filename = match[1];
                }
            }
        }

        // Fallback filename
        if (!filename) {
            const contentType = response.headers.get('content-type');
            const ext = getFileExtension(contentType);
            filename = `report_${Date.now()}${ext}`;
        }

        const blob = await response.blob();
        downloadBlob(blob, filename);
        
        console.log('[MobileFix] Download completed:', filename);
        return true;
    } catch (error) {
        console.error('[MobileFix] Download error:', error);
        alert(`Download failed: ${error.message}`);
        return false;
    }
};

/**
 * Cross-browser blob download
 * Works on web, Capacitor, and native Android/iOS
 */
function downloadBlob(blob, filename) {
    // Try native method first (works on desktop)
    if (navigator.msSaveBlob) {
        navigator.msSaveBlob(blob, filename);
        return;
    }

    // Create blob URL
    const url = window.URL.createObjectURL(blob);
    
    try {
        // Method 1: Direct link (works on most browsers)
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        
        // Dispatch click event
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        link.dispatchEvent(clickEvent);
        
        // Cleanup
        setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        }, 100);
    } catch (error) {
        console.error('[MobileFix] Blob download failed:', error);
        
        // Method 2: Fallback - try opening in new tab (Android fallback)
        window.open(url, '_blank');
    }
}

function getFileExtension(contentType) {
    const extensions = {
        'application/pdf': '.pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
        'application/vnd.ms-excel': '.xls',
        'text/csv': '.csv',
        'application/json': '.json',
        'text/plain': '.txt',
        'application/zip': '.zip'
    };
    return extensions[contentType] || '.bin';
}

console.log('[MobileFix] Mobile download function available as window.mobileDownload()');

// ============ 3. SESSION STORAGE + HISTORY API FIX ============

(function initSessionPersistence() {
    /**
     * Patch sessionStorage to also save to localStorage
     * This survives app kills on mobile
     */
    const originalSetItem = sessionStorage.setItem;
    const originalRemoveItem = sessionStorage.removeItem;
    const originalClear = sessionStorage.clear;

    sessionStorage.setItem = function(key, value) {
        originalSetItem.call(this, key, value);
        // Mirror to localStorage (with prefix to avoid conflicts)
        localStorage.setItem(`_session_${key}`, value);
        console.log(`[MobileFix] Storage: ${key} = ${value?.substring?.(0, 50)}...`);
    };

    sessionStorage.removeItem = function(key) {
        originalRemoveItem.call(this, key);
        localStorage.removeItem(`_session_${key}`);
    };

    sessionStorage.clear = function() {
        originalClear.call(this);
        // Clear all session mirrors
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('_session_')) {
                localStorage.removeItem(key);
            }
        });
    };

    /**
     * Restore sessionStorage from localStorage on app resume
     */
    function restoreSessionStorage() {
        console.log('[MobileFix] Restoring session storage from localStorage...');
        const keys = Object.keys(localStorage);
        let restored = 0;
        
        keys.forEach(key => {
            if (key.startsWith('_session_')) {
                const originalKey = key.substring(9); // Remove '_session_' prefix
                const value = localStorage.getItem(key);
                sessionStorage.setItem(originalKey, value);
                restored++;
            }
        });
        
        console.log(`[MobileFix] Restored ${restored} session items`);
    }

    // Restore on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', restoreSessionStorage);
    } else {
        restoreSessionStorage();
    }

    // Also restore when app resumes (Capacitor apps)
    if (window.Capacitor) {
        document.addEventListener('resume', restoreSessionStorage);
        document.addEventListener('capacitorpause', restoreSessionStorage);
    }

    console.log('[MobileFix] Session storage persistence enabled');
})();

/**
 * Global logout function that properly clears all storage
 * Use this instead of manually clearing storage
 */
window.appLogout = async function() {
    console.log('[MobileFix] Logging out - clearing all storage');
    
    // Stop location tracking before logout
    if (window.stopLocationTracking) {
        await window.stopLocationTracking();
    }
    
    // Clear route persistence
    if (window.clearPersistedRoute) {
        await window.clearPersistedRoute();
    }
    
    // Clear navigation history set by back-button-handler.js
    if (window.clearNavigationHistory) {
        window.clearNavigationHistory();
    }

    const userId = localStorage.getItem('user_id');
    if (userId) {
        try {
            await fetch('/api/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId })
            });
            console.log('[MobileFix] ✅ Session cleared from server');
        } catch (err) {
            console.error('[MobileFix] Logout API error:', err);
        }
    }
    
    // Clear localStorage
    localStorage.removeItem('user');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_name');
    localStorage.removeItem('pending_face_user');
    localStorage.removeItem('pending_face_registration');
    
    // Clear session storage
    sessionStorage.removeItem('user_for_face_registration');
    
    // Clear session mirrors
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('_session_')) {
            localStorage.removeItem(key);
        }
    });
    
    // Clear sessionStorage
    sessionStorage.clear();
    
    console.log('[MobileFix] Logout complete');
    
    // Redirect to login
    window.location.href = '/pages/login.html';
};

// ============ 4. HISTORY API + BACK BUTTON FIX ============

(function initHistoryAPI() {
    /**
     * Prevent back button from exiting app
     * Push states so back navigates within app, not to external pages
     */
    
    function initializeHistory() {
        // Push initial state
        history.replaceState({ page: 'current' }, document.title, window.location.href);
        
        // Handle back button
        window.addEventListener('popstate', (event) => {
            console.log('[MobileFix] Back button pressed, state:', event.state);
            
            // If user is logged in, prevent app exit by pushing back to current page
            const user = localStorage.getItem('user');
            if (!user) {
                // Not logged in, allow exit
                console.log('[MobileFix] User not logged in, allowing back');
                return;
            }
            
            // Push state to prevent Android back button from exiting
            history.pushState({ page: 'navigation' }, document.title, window.location.href);
        });
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeHistory);
    } else {
        initializeHistory();
    }

    console.log('[MobileFix] History API and back button protection enabled');
})();

// ============ 5. DEBUG / STATUS LOGGING ============

console.log('=== Mobile Fixes Loaded ===');
console.log('- Hamburger menu: touch + click events');
console.log('- Downloads: mobileDownload() function');
console.log('- Session: persistent storage + logout handler');
console.log('- History: back button protection');
console.log('Try: window.mobileDownload(url) or window.appLogout()');
console.log('========================');

// ============ 6. CAPGO OTA UPDATER ============
// Placeholder for future OTA update checks