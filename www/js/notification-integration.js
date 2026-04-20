/**
 * Notification Integration Module
 * ================================
 * Integrates NotificationManager with policy heartbeat and app events
 */

(function() {
    if (typeof notificationManager === 'undefined') {
        console.warn('[NotificationIntegration] NotificationManager not available');
        return;
    }

    console.log('[NotificationIntegration] Initializing notification system integration...');

    // Global reference for dashboard integration
    window.NotificationIntegration = {
        lastNetworkStatus: navigator.onLine,
        lastLocationStatus: !!navigator.geolocation,
        lastHeartbeatTime: null,
        
        /**
         * Handle network status change
         */
        onNetworkChange() {
            const isOnline = navigator.onLine;
            if (!isOnline && this.lastNetworkStatus) {
                // Went offline
                notificationManager.showNetworkAlert();
            } else if (isOnline && !this.lastNetworkStatus) {
                // Came back online
                notificationManager.showSuccess('🌐 Network Restored', 'Internet connection restored. Tracking resumed.');
            }
            this.lastNetworkStatus = isOnline;
        },

        /**
         * Handle policy heartbeat response
         */
        onHeartbeatResponse(result) {
            if (!result) return;

            // Network alerts
            if (result.device_status) {
                if (!result.device_status.network_on) {
                    notificationManager.showNetworkAlert();
                    return;
                }
                if (!result.device_status.location_on) {
                    notificationManager.showLocationAlert();
                    return;
                }
            }

            // Out of bounds alerts
            if (!result.in_bounds && result.alert_code !== 'LUNCH_ACTIVE') {
                notificationManager.showOutOfBoundsAlert(
                    result.distance_m || 0,
                    result.alert || 'You are outside campus. Return immediately.'
                );
            }

            // Lunch reminders
            if (result.alert_code === 'LUNCH_START_REMINDER') {
                notificationManager.showLunchStartReminder();
            } else if (result.alert_code === 'LUNCH_END_REMINDER') {
                notificationManager.showLunchEndReminder();
            }

            // Other alerts
            if (result.alert && result.alert_code && result.alert_code.startsWith('CUSTOM')) {
                notificationManager.showInfo('ℹ️ Alert', result.alert);
            }

            this.lastHeartbeatTime = new Date();
        },

        /**
         * Handle attendance marked
         */
        onAttendanceMarked(status) {
            notificationManager.showAttendanceMarked(status);
        },

        /**
         * Handle error
         */
        onError(title, message) {
            notificationManager.showError(title, message);
        },

        /**
         * Handle success
         */
        onSuccess(title, message) {
            notificationManager.showSuccess(title, message);
        },

        /**
         * Fetch and display user notifications from server
         */
        async refreshNotifications(userId) {
            try {
                const response = await fetch(`/api/user/notifications?user_id=${userId}`);
                if (!response.ok) return;

                const data = await response.json();
                if (!data.success || !data.notifications) return;

                // Clear old notifications (keep manual ones)
                notificationManager.notifications = notificationManager.notifications.filter(
                    n => n.type === 'MANUAL' || n.type === 'CUSTOM'
                );

                // Display server notifications
                data.notifications.forEach(notif => {
                    // Skip non-dismissible ones if already shown
                    if (!notif.dismissible && notificationManager.isDuplicate(`${notif.type}_${notif.message}`)) {
                        return;
                    }

                    // Use correct method based on notification type
                    switch (notif.type) {
                        case 'NETWORK_OFF':
                            notificationManager.showNetworkAlert(notif.message);
                            break;
                        case 'LOCATION_OFF':
                            notificationManager.showLocationAlert(notif.message);
                            break;
                        case 'OUT_OF_BOUNDS':
                            notificationManager.showOutOfBoundsAlert(notif.distance_m || 0, notif.message);
                            break;
                        case 'LUNCH_START_REMINDER':
                            notificationManager.showLunchStartReminder();
                            break;
                        case 'LUNCH_END_REMINDER':
                            notificationManager.showLunchEndReminder();
                            break;
                        case 'MARKED_ATTENDANCE':
                            notificationManager.showAttendanceMarked();
                            break;
                        default:
                            const levelMap = {
                                'CRITICAL': 'ERROR',
                                'WARNING': 'showWarning',
                                'SUCCESS': 'SUCCESS',
                                'INFO': 'INFO'
                            };
                            if (levelMap[notif.level]) {
                                notificationManager.show(notif.type, notif.title, notif.message, {
                                    autoHide: true,
                                    dismissible: notif.dismissible !== false
                                });
                            }
                    }
                });

                console.log(`[NotificationIntegration] Loaded ${data.notifications.length} notifications`);
            } catch (e) {
                console.error('[NotificationIntegration] Error fetching notifications:', e);
            }
        }
    };

    // Setup listeners
    window.addEventListener('online', () => window.NotificationIntegration.onNetworkChange());
    window.addEventListener('offline', () => window.NotificationIntegration.onNetworkChange());

    // Expose notification manager to window for global access
    window.showNotification = (type, title, message, options) => {
        notificationManager.show(type, title, message, options);
    };

    console.log('[NotificationIntegration] Ready - use window.NotificationIntegration to interact');
})();
