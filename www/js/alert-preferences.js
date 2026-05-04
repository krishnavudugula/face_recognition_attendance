/**
 * Alert Preferences Panel - User notification customization
 * Allows users to manage which alerts they receive and how
 */

class AlertPreferencesPanel {
    constructor() {
        this.API_URL = window.CONFIG?.API_URL || 'http://127.0.0.1:5000/api';
        this.currentUser = JSON.parse(localStorage.getItem('user') || 'null');
        this.preferences = {};
        
        this.init();
    }

    async init() {
        if (!this.currentUser) return;
        
        // Load preferences from server
        await this.loadPreferences();
        
        // Create preferences UI
        this.createPanel();
        
        // Attach event listeners
        this.attachEventListeners();
    }

    async loadPreferences() {
        try {
            const response = await fetch(`${this.API_URL}/alert-preferences/${this.currentUser.user_id}`);
            const data = await response.json();
            
            if (data.success) {
                this.preferences = data.preferences;
            }
        } catch (error) {
            console.error('Failed to load alert preferences:', error);
        }
    }

    createPanel() {
        const panelHTML = `
            <div id="alertPreferencesPanel" class="preferences-panel" style="display: none;">
                <div class="preferences-overlay" id="preferencesOverlay"></div>
                
                <div class="preferences-modal">
                    <div class="preferences-header">
                        <h2>⚙️ Alert Preferences</h2>
                        <button class="close-btn" id="closePreferencesBtn">✕</button>
                    </div>

                    <div class="preferences-content">
                        <!-- Alert Types Section -->
                        <div class="preference-section">
                            <h3>📢 Alert Types</h3>
                            <p class="section-desc">Choose which types of alerts you want to receive:</p>
                            
                            <div class="preference-option">
                                <label>
                                    <input type="checkbox" id="alertLateArrival" class="pref-checkbox">
                                    <span>🕐 Late Arrival Warnings</span>
                                </label>
                                <small>Get notified when you're running late</small>
                            </div>

                            <div class="preference-option">
                                <label>
                                    <input type="checkbox" id="alertApprovalStatus" class="pref-checkbox">
                                    <span>✓ Approval Status Updates</span>
                                </label>
                                <small>Notifications when your requests are approved/rejected</small>
                            </div>

                            <div class="preference-option">
                                <label>
                                    <input type="checkbox" id="alertPolicyViolation" class="pref-checkbox">
                                    <span>⚠️ Policy Violation Alerts</span>
                                </label>
                                <small>Important alerts about policy violations</small>
                            </div>

                            <div class="preference-option">
                                <label>
                                    <input type="checkbox" id="alertAnnouncements" class="pref-checkbox">
                                    <span>📣 Announcements</span>
                                </label>
                                <small>Admin announcements and important updates</small>
                            </div>

                            <div class="preference-option">
                                <label>
                                    <input type="checkbox" id="alertFailedScans" class="pref-checkbox">
                                    <span>❌ Failed Scan Alerts</span>
                                </label>
                                <small>Notifications when face scan fails</small>
                            </div>

                            <div class="preference-option">
                                <label>
                                    <input type="checkbox" id="alertSuspiciousActivity" class="pref-checkbox">
                                    <span>🚨 Suspicious Activity</span>
                                </label>
                                <small>Security alerts about suspicious activities</small>
                            </div>
                        </div>

                        <!-- Delivery Methods Section -->
                        <div class="preference-section">
                            <h3>📬 Delivery Methods</h3>
                            <p class="section-desc">How do you want to receive alerts?</p>
                            
                            <div class="preference-option">
                                <label>
                                    <input type="checkbox" id="enableInAppNotifications" class="pref-checkbox">
                                    <span>💬 In-App Notifications</span>
                                </label>
                                <small>Notifications within the app</small>
                            </div>

                            <div class="preference-option">
                                <label>
                                    <input type="checkbox" id="enablePushNotifications" class="pref-checkbox">
                                    <span>📲 Push Notifications</span>
                                </label>
                                <small>Push notifications to your device</small>
                            </div>
                        </div>

                        <!-- Quiet Hours Section -->
                        <div class="preference-section">
                            <h3>🔕 Quiet Hours</h3>
                            <p class="section-desc">Set a time window when you don't want to receive notifications:</p>
                            
                            <div class="time-inputs">
                                <div class="time-input-group">
                                    <label for="quietHoursStart">Start Time (HH:MM):</label>
                                    <input type="time" id="quietHoursStart" class="time-input">
                                </div>
                                <div class="time-input-group">
                                    <label for="quietHoursEnd">End Time (HH:MM):</label>
                                    <input type="time" id="quietHoursEnd" class="time-input">
                                </div>
                            </div>
                            <small class="quiet-hours-desc">
                                💡 Tip: Set from 22:00 (10 PM) to 08:00 (8 AM) for sleeping hours
                            </small>
                        </div>

                        <!-- Info Box -->
                        <div class="info-box">
                            <p>📝 You can always change these preferences anytime from the settings.</p>
                        </div>
                    </div>

                    <div class="preferences-footer">
                        <button id="resetPreferencesBtn" class="btn btn-secondary">Reset to Default</button>
                        <button id="savePreferencesBtn" class="btn btn-primary">💾 Save Preferences</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', panelHTML);
        this.populatePreferences();
    }

    populatePreferences() {
        // Populate checkboxes
        const checkboxMap = {
            'alertLateArrival': this.preferences.alert_late_arrival,
            'alertApprovalStatus': this.preferences.alert_approval_status,
            'alertPolicyViolation': this.preferences.alert_policy_violation,
            'alertAnnouncements': this.preferences.alert_announcements,
            'alertFailedScans': this.preferences.alert_failed_scans,
            'alertSuspiciousActivity': this.preferences.alert_suspicious_activity,
            'enableInAppNotifications': this.preferences.enable_in_app_notifications,
            'enablePushNotifications': this.preferences.enable_push_notifications
        };

        Object.entries(checkboxMap).forEach(([id, checked]) => {
            const element = document.getElementById(id);
            if (element) {
                element.checked = checked !== false;
            }
        });

        // Populate time inputs
        const startTimeInput = document.getElementById('quietHoursStart');
        const endTimeInput = document.getElementById('quietHoursEnd');

        if (startTimeInput) {
            startTimeInput.value = this.preferences.quiet_hours_start || '22:00';
        }
        if (endTimeInput) {
            endTimeInput.value = this.preferences.quiet_hours_end || '08:00';
        }
    }

    attachEventListeners() {
        const closeBtn = document.getElementById('closePreferencesBtn');
        const overlay = document.getElementById('preferencesOverlay');
        const saveBtn = document.getElementById('savePreferencesBtn');
        const resetBtn = document.getElementById('resetPreferencesBtn');

        closeBtn?.addEventListener('click', () => this.hide());
        overlay?.addEventListener('click', () => this.hide());
        saveBtn?.addEventListener('click', () => this.savePreferences());
        resetBtn?.addEventListener('click', () => this.resetPreferences());

        // Close on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.hide();
            }
        });
    }

    async savePreferences() {
        const preferences = {
            alert_late_arrival: document.getElementById('alertLateArrival')?.checked ?? true,
            alert_approval_status: document.getElementById('alertApprovalStatus')?.checked ?? true,
            alert_policy_violation: document.getElementById('alertPolicyViolation')?.checked ?? true,
            alert_announcements: document.getElementById('alertAnnouncements')?.checked ?? true,
            alert_failed_scans: document.getElementById('alertFailedScans')?.checked ?? true,
            alert_suspicious_activity: document.getElementById('alertSuspiciousActivity')?.checked ?? false,
            enable_in_app_notifications: document.getElementById('enableInAppNotifications')?.checked ?? true,
            enable_push_notifications: document.getElementById('enablePushNotifications')?.checked ?? true,
            quiet_hours_start: document.getElementById('quietHoursStart')?.value || '22:00',
            quiet_hours_end: document.getElementById('quietHoursEnd')?.value || '08:00'
        };

        try {
            const response = await fetch(
                `${this.API_URL}/alert-preferences/${this.currentUser.user_id}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(preferences)
                }
            );

            const data = await response.json();

            if (data.success) {
                this.showNotification('✓ Preferences saved successfully!', 'success');
                this.hide();
            } else {
                this.showNotification('Failed to save preferences', 'error');
            }
        } catch (error) {
            console.error('Error saving preferences:', error);
            this.showNotification('Error saving preferences', 'error');
        }
    }

    async resetPreferences() {
        const confirmed = confirm('Reset all preferences to default values?');
        if (!confirmed) return;

        const defaultPreferences = {
            alert_late_arrival: true,
            alert_approval_status: true,
            alert_policy_violation: true,
            alert_announcements: true,
            alert_failed_scans: true,
            alert_suspicious_activity: false,
            enable_in_app_notifications: true,
            enable_push_notifications: true,
            quiet_hours_start: '22:00',
            quiet_hours_end: '08:00'
        };

        try {
            const response = await fetch(
                `${this.API_URL}/alert-preferences/${this.currentUser.user_id}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(defaultPreferences)
                }
            );

            const data = await response.json();

            if (data.success) {
                this.preferences = defaultPreferences;
                this.populatePreferences();
                this.showNotification('✓ Preferences reset to defaults!', 'success');
            }
        } catch (error) {
            console.error('Error resetting preferences:', error);
            this.showNotification('Error resetting preferences', 'error');
        }
    }

    show() {
        const panel = document.getElementById('alertPreferencesPanel');
        if (panel) {
            panel.style.display = 'flex';
            this.isOpen = true;
            this.loadPreferences();
        }
    }

    hide() {
        const panel = document.getElementById('alertPreferencesPanel');
        if (panel) {
            panel.style.display = 'none';
            this.isOpen = false;
        }
    }

    showNotification(message, type = 'info') {
        // Simple notification using browser alert
        // In production, use a toast notification library
        const notifDiv = document.createElement('div');
        notifDiv.className = `preference-notif preference-notif-${type}`;
        notifDiv.textContent = message;
        notifDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : '#ef4444'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            animation: slideIn 0.3s ease-in-out;
        `;

        document.body.appendChild(notifDiv);
        setTimeout(() => notifDiv.remove(), 3000);
    }
}

// Auto-initialize alert preferences panel
document.addEventListener('DOMContentLoaded', () => {
    window.alertPreferencesPanel = new AlertPreferencesPanel();
});
