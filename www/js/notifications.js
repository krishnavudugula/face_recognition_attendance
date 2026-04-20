/**
 * Comprehensive Notification System
 * ===================================
 * Handles all system alerts, warnings, and reminders
 * 
 * Notification Types:
 * - CRITICAL: Network/Location issues (RED)
 * - WARNING: Policy violations, out-of-bounds (ORANGE/AMBER)
 * - INFO: Lunch reminders, policy alerts (BLUE)
 * - SUCCESS: Marked attendance (GREEN)
 */

class NotificationManager {
    constructor() {
        this.notifications = [];
        this.shownToday = new Set();
        this.notificationQueue = [];
        this.isDisplaying = false;
        this.container = null;
        this.maxNotifications = 3;
        
        // Initialize container
        this.initContainer();
        
        // Notification types configuration
        this.notificationTypes = {
            NETWORK_OFF: {
                level: 'CRITICAL',
                icon: '📡',
                color: '#991b1b',
                bgColor: '#fee2e2',
                textColor: '#7f1d1d',
                timeout: 0,
                dismissible: false,
                autoHide: false
            },
            LOCATION_OFF: {
                level: 'CRITICAL',
                icon: '📍',
                color: '#991b1b',
                bgColor: '#fee2e2',
                textColor: '#7f1d1d',
                timeout: 0,
                dismissible: false,
                autoHide: false
            },
            OUT_OF_BOUNDS: {
                level: 'WARNING',
                icon: '⚠️',
                color: '#b45309',
                bgColor: '#fef3c7',
                textColor: '#78350f',
                timeout: 5000,
                dismissible: true,
                autoHide: true
            },
            LUNCH_START_REMINDER: {
                level: 'INFO',
                icon: '🍽️',
                color: '#0369a1',
                bgColor: '#e0f2fe',
                textColor: '#082f49',
                timeout: 8000,
                dismissible: true,
                autoHide: true
            },
            LUNCH_END_REMINDER: {
                level: 'WARNING',
                icon: '⏰',
                color: '#b45309',
                bgColor: '#fef3c7',
                textColor: '#78350f',
                timeout: 10000,
                dismissible: true,
                autoHide: true
            },
            MARKED_ATTENDANCE: {
                level: 'SUCCESS',
                icon: '✅',
                color: '#15803d',
                bgColor: '#dcfce7',
                textColor: '#166534',
                timeout: 3000,
                dismissible: true,
                autoHide: true
            },
            POLICY_VIOLATION: {
                level: 'WARNING',
                icon: '⛔',
                color: '#991b1b',
                bgColor: '#fee2e2',
                textColor: '#7f1d1d',
                timeout: 0,
                dismissible: true,
                autoHide: false
            },
            INFO: {
                level: 'INFO',
                icon: 'ℹ️',
                color: '#0369a1',
                bgColor: '#e0f2fe',
                textColor: '#082f49',
                timeout: 5000,
                dismissible: true,
                autoHide: true
            },
            ERROR: {
                level: 'CRITICAL',
                icon: '❌',
                color: '#991b1b',
                bgColor: '#fee2e2',
                textColor: '#7f1d1d',
                timeout: 6000,
                dismissible: true,
                autoHide: true
            },
            SUCCESS: {
                level: 'SUCCESS',
                icon: '✨',
                color: '#15803d',
                bgColor: '#dcfce7',
                textColor: '#166534',
                timeout: 4000,
                dismissible: true,
                autoHide: true
            }
        };
    }

    initContainer() {
        if (this.container) return;
        
        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        this.container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 450px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            pointer-events: none;
        `;
        document.body.appendChild(this.container);
    }

    /**
     * Show a notification
     * @param {string} type - Notification type (NETWORK_OFF, LOCATION_OFF, etc.)
     * @param {string} title - Notification title
     * @param {string} message - Notification message
     * @param {object} options - Additional options (dismissible, autoHide, timeout, etc.)
     */
    show(type, title, message, options = {}) {
        const typeConfig = this.notificationTypes[type] || this.notificationTypes.INFO;
        
        // Prevent duplicate notifications
        const notifKey = `${type}_${title}_${message}`;
        if (this.isDuplicate(notifKey)) {
            console.log(`[Notification] Duplicate suppressed: ${notifKey}`);
            return;
        }

        const notification = {
            id: `notif_${Date.now()}_${Math.random()}`,
            type,
            title,
            message,
            ...typeConfig,
            ...options,
            createdAt: new Date(),
            key: notifKey
        };

        this.notifications.push(notification);
        this.render(notification);

        // Auto-hide if configured
        if (notification.autoHide && notification.timeout > 0) {
            setTimeout(() => this.dismiss(notification.id), notification.timeout);
        }
    }

    /**
     * Show critical network alert
     */
    showNetworkAlert(message = 'Internet is OFF. Turn on mobile data or Wi-Fi to continue.') {
        this.show('NETWORK_OFF', '📡 Network Offline', message, {
            autoHide: false,
            dismissible: false
        });
    }

    /**
     * Show location service alert
     */
    showLocationAlert(message = 'Location services are disabled. Please enable GPS to continue.') {
        this.show('LOCATION_OFF', '📍 Location Offline', message, {
            autoHide: false,
            dismissible: false
        });
    }

    /**
     * Show lunch period reminder
     */
    showLunchStartReminder() {
        if (this.hasShownToday('LUNCH_START_REMINDER')) return;
        
        this.show('LUNCH_START_REMINDER', 
            '🍽️ Lunch Break Starting', 
            'Lunch free-exit window: 1:00 PM - 1:40 PM. Return before 1:40 PM to avoid absent marking.',
            { autoHide: true }
        );
        this.markAsShownToday('LUNCH_START_REMINDER');
    }

    /**
     * Show lunch end reminder
     */
    showLunchEndReminder() {
        if (this.hasShownToday('LUNCH_END_REMINDER')) return;
        
        this.show('LUNCH_END_REMINDER', 
            '⏰ Lunch Ending Soon', 
            '10-minute alert: Lunch free-exit ends at 1:40 PM. Return to campus immediately!',
            { autoHide: true }
        );
        this.markAsShownToday('LUNCH_END_REMINDER');
    }

    /**
     * Show out-of-bounds alert
     */
    showOutOfBoundsAlert(distanceM, message = '') {
        const msg = message || `You are ${(distanceM / 1000).toFixed(2)} km outside campus. Return immediately to avoid absent marking.`;
        this.show('OUT_OF_BOUNDS', 
            '⚠️ Outside Campus Bounds', 
            msg,
            { autoHide: true }
        );
    }

    /**
     * Show attendance marked successfully
     */
    showAttendanceMarked(status = 'Present') {
        this.show('MARKED_ATTENDANCE', 
            '✅ Attendance Marked', 
            `Your attendance has been marked as ${status}.`,
            { autoHide: true, timeout: 3000 }
        );
    }

    /**
     * Show policy violation
     */
    showPolicyViolation(message) {
        this.show('POLICY_VIOLATION', 
            '⛔ Policy Violation', 
            message,
            { autoHide: false, dismissible: true }
        );
    }

    /**
     * Show success message
     */
    showSuccess(title, message) {
        this.show('SUCCESS', title, message, { autoHide: true });
    }

    /**
     * Show error message
     */
    showError(title, message) {
        this.show('ERROR', title, message, { autoHide: true });
    }

    /**
     * Show info message
     */
    showInfo(title, message) {
        this.show('INFO', title, message, { autoHide: true });
    }

    /**
     * Render notification in DOM
     */
    render(notification) {
        if (!this.container) this.initContainer();

        const notifEl = document.createElement('div');
        notifEl.id = notification.id;
        notifEl.className = 'notification-item';
        notifEl.style.cssText = `
            background: ${notification.bgColor};
            border-left: 4px solid ${notification.color};
            border-radius: 8px;
            padding: 14px 18px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            animation: slideInRight 0.3s ease;
            pointer-events: all;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 12px;
            min-height: 60px;
            position: relative;
        `;

        // Content wrapper
        const contentWrapper = document.createElement('div');
        contentWrapper.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 4px;
        `;

        // Title
        const titleEl = document.createElement('div');
        titleEl.style.cssText = `
            font-weight: 600;
            font-size: 14px;
            color: ${notification.textColor};
        `;
        titleEl.textContent = notification.title;

        // Message
        const messageEl = document.createElement('div');
        messageEl.style.cssText = `
            font-size: 13px;
            color: ${notification.textColor};
            opacity: 0.9;
            line-height: 1.4;
        `;
        messageEl.textContent = notification.message;

        contentWrapper.appendChild(titleEl);
        contentWrapper.appendChild(messageEl);

        // Close button (if dismissible)
        if (notification.dismissible) {
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '✕';
            closeBtn.style.cssText = `
                background: transparent;
                border: none;
                color: ${notification.textColor};
                font-size: 18px;
                cursor: pointer;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0.7;
                transition: opacity 0.2s;
            `;
            closeBtn.onmouseover = () => closeBtn.style.opacity = '1';
            closeBtn.onmouseout = () => closeBtn.style.opacity = '0.7';
            closeBtn.onclick = () => this.dismiss(notification.id);
            notifEl.appendChild(closeBtn);
        }

        notifEl.appendChild(contentWrapper);
        this.container.insertBefore(notifEl, this.container.firstChild);

        // Auto-remove from DOM after animation
        if (notification.autoHide && notification.timeout > 0) {
            setTimeout(() => {
                if (notifEl.parentNode) {
                    notifEl.style.animation = 'slideOutRight 0.3s ease';
                    setTimeout(() => notifEl.remove(), 300);
                }
            }, notification.timeout);
        }
    }

    /**
     * Dismiss a notification
     */
    dismiss(notifId) {
        const notifEl = document.getElementById(notifId);
        if (notifEl) {
            notifEl.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notifEl.parentNode) {
                    notifEl.remove();
                }
            }, 300);
        }
        this.notifications = this.notifications.filter(n => n.id !== notifId);
    }

    /**
     * Check if notification is duplicate
     */
    isDuplicate(key) {
        return this.notifications.some(n => n.key === key);
    }

    /**
     * Mark notification as shown today
     */
    markAsShownToday(type) {
        const today = new Date().toISOString().slice(0, 10);
        this.shownToday.add(`${type}_${today}`);
        sessionStorage.setItem(`notif_shown_${type}_${today}`, '1');
    }

    /**
     * Check if notification was shown today
     */
    hasShownToday(type) {
        const today = new Date().toISOString().slice(0, 10);
        const key = `notif_shown_${type}_${today}`;
        return sessionStorage.getItem(key) === '1' || this.shownToday.has(`${type}_${today}`);
    }

    /**
     * Clear all notifications
     */
    clearAll() {
        const notifEls = document.querySelectorAll('.notification-item');
        notifEls.forEach(el => {
            el.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => el.remove(), 300);
        });
        this.notifications = [];
    }

    /**
     * Get notification statistics
     */
    getStats() {
        const critical = this.notifications.filter(n => n.level === 'CRITICAL').length;
        const warning = this.notifications.filter(n => n.level === 'WARNING').length;
        const info = this.notifications.filter(n => n.level === 'INFO').length;
        
        return { critical, warning, info, total: this.notifications.length };
    }
}

// Initialize globally
window.NotificationManager = NotificationManager;
window.notificationManager = new NotificationManager();

// Add animations to document
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }

    .notification-item {
        transition: all 0.2s ease;
    }

    .notification-item:hover {
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
        transform: translateX(-4px);
    }

    @media (max-width: 600px) {
        #notification-container {
            right: 10px !important;
            left: 10px !important;
            max-width: none !important;
        }

        .notification-item {
            font-size: 12px;
            padding: 12px 14px;
        }
    }
`;
document.head.appendChild(style);

console.log('[NotificationManager] Initialized');
