
let adminMap = null;
let adminMapCenterMarker = null;
let adminMapBoundary = null;
let adminMapMarkers = {};
let adminLivePollInterval = null;
let adminHeartbeatInterval = null;
let shownLiveFaults = new Set();
let currentLiveViolationsData = null;
let selectedExportType = 'summary';
const LIVE_POPUP_ALERTS_ENABLED = false;
let selectedDailyReportDate = '';

// ========== TIMEZONE UTILITY (IST - UTC+5:30) ==========
function convertUTCtoIST(utcDateString) {
    if (!utcDateString) return 'N/A';
    
    try {
        const date = new Date(utcDateString);
        // IST offset: UTC+5:30 (5 hours 30 minutes = 330 minutes)
        const istDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
        
        // Convert to 12-hour format with AM/PM
        let hours = istDate.getUTCHours();
        let minutes = istDate.getUTCMinutes();
        let seconds = istDate.getUTCSeconds();
        
        // Determine AM/PM before conversion
        const ampm = hours >= 12 ? 'PM' : 'AM';
        
        // Convert hours to 12-hour format
        hours = hours % 12 || 12;  // 0 becomes 12, others mod by 12
        
        const hoursStr = String(hours).padStart(2, '0');
        const minutesStr = String(minutes).padStart(2, '0');
        const secondsStr = String(seconds).padStart(2, '0');
        
        const timeString = `${hoursStr}:${minutesStr}:${secondsStr} ${ampm}`;
        
        // Debug log
        console.log(`[Timezone] UTC: ${utcDateString} → IST: ${timeString}`);
        
        return timeString;
    } catch (error) {
        console.error('Time conversion error:', error);
        return 'N/A';
    }
}

function testShowAlert() {
    const testAlerts = [
        {
            code: 'OUT_OF_BOUNDS',
            name: 'Krishna',
            user_id: '203CD',
            message: 'Outside campus boundary (12825.54 m from center).',
            last_seen: new Date().toISOString(),
            fault_key: 'OUT_OF_BOUNDS_203CD_' + Date.now(),
            distance_m: 12825.54
        },
        {
            code: 'NETWORK_OFF',
            name: 'Krishna',
            user_id: '203CD',
            message: 'No recent heartbeat from device. Network may be OFF.',
            last_seen: new Date().toISOString(),
            fault_key: 'NETWORK_OFF_203CD_' + Date.now()
        }
    ];
    currentLiveViolationsData = {
        fault_alerts: testAlerts,
        event_alerts: [],
        map_points: [],
        success: true
    };
    openLiveViolationsPanel();
}

// ========== EXPORT MODAL FUNCTIONS ==========

function openExportModal() {
    const modal = document.getElementById('advancedExportModal');
    if (modal) {
        modal.style.display = 'flex';
        // Set default dates
        const today = new Date();
        const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        document.getElementById('exportStartDate').value = lastMonth.toISOString().split('T')[0];
        document.getElementById('exportEndDate').value = today.toISOString().split('T')[0];
        
        // Add event listeners for real-time preview
        const dateInputs = document.querySelectorAll('#exportStartDate, #exportEndDate');
        dateInputs.forEach(input => {
            input.removeEventListener('change', updateExportPreview);
            input.addEventListener('change', updateExportPreview);
        });
        
        // Add listeners to column checkboxes
        const colCheckboxes = document.querySelectorAll('#col-user, #col-date, #col-status, #col-location, #col-checkin, #col-period');
        colCheckboxes.forEach(checkbox => {
            checkbox.removeEventListener('change', updateExportPreview);
            checkbox.addEventListener('change', updateExportPreview);
        });
        
        // Trigger initial preview
        updateExportPreview();
    }
}

function closeExportModal() {
    const modal = document.getElementById('advancedExportModal');
    if (modal) modal.style.display = 'none';
}

function selectReportType(type) {
    selectedExportType = type;
    // Update UI selection
    document.querySelectorAll('.export-report-type').forEach(el => {
        el.style.borderColor = '#e2e8f0';
        el.style.background = 'white';
        el.style.color = '#64748b';
    });
    event.currentTarget.style.borderColor = '#3b82f6';
    event.currentTarget.style.background = '#dbeafe';
    event.currentTarget.style.color = '#1e40af';
    
    // Update preview with new report type
    updateExportPreview();
}

function applyExportPreset(preset) {
    const today = new Date();
    const startDateEl = document.getElementById('exportStartDate');
    const endDateEl = document.getElementById('exportEndDate');
    
    let startDate;
    switch(preset) {
        case 'today':
            startDate = new Date(today);
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'week':
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 7);
            break;
        case 'month':
            startDate = new Date(today);
            startDate.setMonth(today.getMonth() - 1);
            break;
        case 'year':
            startDate = new Date(today);
            startDate.setFullYear(today.getFullYear() - 1);
            break;
    }
    
    startDateEl.value = startDate.toISOString().split('T')[0];
    endDateEl.value = today.toISOString().split('T')[0];
    
    // Update preview
    updateExportPreview();
}

async function executeExport(btn) {
    console.log('[Export] Export button clicked - selectedExportType:', selectedExportType);
    
    // Get all export parameters
    const startDate = document.getElementById('exportStartDate').value;
    const endDate = document.getElementById('exportEndDate').value;
    const format = document.querySelector('input[name="exportFormat"]:checked')?.value || 'csv';
    const filterLatestOnly = document.getElementById('filterLatestOnly')?.checked || false;
    const filterViolationsOnly = document.getElementById('filterViolationsOnly')?.checked || false;
    const includeTimestamps = document.getElementById('includeTimestamps')?.checked || true;
    
    console.log('[Export] Parameters:', {
        startDate, endDate, format, selectedExportType,
        filterLatestOnly, filterViolationsOnly, includeTimestamps
    });
    
    // Validation
    if (!startDate || !endDate) {
        alert('❌ Please select both Start and End dates');
        return;
    }
    
    if (!selectedExportType) {
        alert('❌ Please select a Report Type (Summary, Detailed, Violations, or Compliance)');
        return;
    }
    
    if (format === 'json') {
        alert('❌ JSON format is not available. Please use CSV, Excel, or PDF.');
        return;
    }
    
    // Find and disable the button if it exists
    const exportBtn = btn || document.getElementById('btnExecuteExport');
    let originalHTML = '';
    if (exportBtn) {
        originalHTML = exportBtn.innerHTML;
        exportBtn.disabled = true;
        exportBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
    }
    
    try {
        console.log('[Export] Platform detection...');
        // Check if running on mobile
        const isMobile = window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform();
        console.log('[Export] Is Mobile:', isMobile);
        
        if (isMobile) {
            console.log('[Export] 📱 Using MOBILE export path');
            await executeExportMobile(startDate, endDate, format, selectedExportType, filterLatestOnly, filterViolationsOnly, includeTimestamps);
        } else {
            console.log('[Export] 🖥️ Using DESKTOP export path');
            await executeExportDesktop(startDate, endDate, format, selectedExportType, filterLatestOnly, filterViolationsOnly, includeTimestamps);
        }
        
        console.log('[Export] ✅ Export successful!');
        // Show success message
        closeExportModal();
        showExportSuccess(format, selectedExportType);
        
    } catch (err) {
        console.error('[Export] ❌ Export error:', err);
        alert(`❌ Export failed!\n\nError: ${err.message}\n\nPlease check console for details.`);
        // Log full error
        console.error('[Export] Full error object:', err);
    } finally {
        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.innerHTML = originalHTML;
        }
    }
}

async function updateExportPreview() {
    const startDate = document.getElementById('exportStartDate').value;
    const endDate = document.getElementById('exportEndDate').value;
    
    if (!startDate || !endDate) {
        document.getElementById('exportPreview').innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 2rem 1rem;"><i class="fa-solid fa-calendar-xmark" style="font-size: 2rem; opacity: 0.5; margin-bottom: 0.5rem; display: block;"></i>Select dates to preview</div>';
        return;
    }
    
    try {
        // Get selected columns for filtering
        const selectedCols = {
            user: document.getElementById('col-user').checked,
            date: document.getElementById('col-date').checked,
            status: document.getElementById('col-status').checked,
            location: document.getElementById('col-location').checked,
            checkin: document.getElementById('col-checkin').checked,
            period: document.getElementById('col-period').checked
        };
        const colsParam = encodeURIComponent(JSON.stringify(selectedCols));
        
        const query = `/api/export_report?start_date=${startDate}&end_date=${endDate}&type=${selectedExportType}&format=json&columns=${colsParam}`;
        const response = await fetch(query);
        
        if (!response.ok) throw new Error('Preview failed');
        
        const data = await response.json();
        const records = data.data || [];
        
        if (records.length === 0) {
            document.getElementById('exportPreview').innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 2rem 1rem;"><i class="fa-solid fa-inbox" style="font-size: 2rem; opacity: 0.5; margin-bottom: 0.5rem; display: block;"></i>No data found for selected range</div>';
            return;
        }
        
        // Build preview table using actual column names from data
        let html = '<table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">';
        
        // Get columns from first record
        const cols = records.length > 0 ? Object.keys(records[0]) : [];
        
        if (cols.length === 0) {
            document.getElementById('exportPreview').innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 2rem 1rem;"><i class="fa-solid fa-inbox" style="font-size: 2rem; opacity: 0.5; margin-bottom: 0.5rem; display: block;"></i>No columns available</div>';
            return;
        }
        
        // Header
        html += '<tr style="background: #0f172a; border-bottom: 2px solid #334155;">';
        cols.forEach(col => {
            const label = col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            html += `<th style="padding: 0.6rem; text-align: left; font-weight: 700; color: white; font-size: 0.75rem;">${label}</th>`;
        });
        html += '</tr>';
        
        // Data rows
        records.slice(0, 5).forEach((record, idx) => {
            const bg = idx % 2 === 0 ? '#f8f9fa' : 'white';
            html += `<tr style="background: ${bg}; border-bottom: 1px solid #e2e8f0;">`;
            cols.forEach(col => {
                const value = record[col] !== undefined && record[col] !== null ? record[col] : '-';
                const displayValue = typeof value === 'object' ? JSON.stringify(value).substring(0, 20) : String(value).substring(0, 20);
                html += `<td style="padding: 0.6rem; color: #334155; font-size: 0.75rem;">${displayValue}</td>`;
            });
            html += '</tr>';
        });
        
        html += '</table>';
        html += `<div style="margin-top: 0.75rem; font-size: 0.75rem; color: #64748b; text-align: right; padding-right: 0.5rem;">Preview: ${records.length}/5 | Total: ${data.record_count || records.length} records</div>`;
        
        document.getElementById('exportPreview').innerHTML = html;
        
    } catch (err) {
        console.error('Preview error:', err);
        document.getElementById('exportPreview').innerHTML = `<div style="color: #e74c3c; padding: 1rem; font-size: 0.9rem;"><i class="fa-solid fa-circle-exclamation"></i> Error loading preview: ${err.message}</div>`;
    }
}

function downloadFile(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

async function executeExportDesktop(startDate, endDate, format, reportType, filterLatestOnly, filterViolationsOnly, includeTimestamps) {
    console.log('[ExportDesktop] Building query...');
    
    // Get selected columns
    const selectedCols = {
        user: document.getElementById('col-user')?.checked || true,
        date: document.getElementById('col-date')?.checked || true,
        status: document.getElementById('col-status')?.checked || true,
        location: document.getElementById('col-location')?.checked || true,
        checkin: document.getElementById('col-checkin')?.checked || true,
        period: document.getElementById('col-period')?.checked || true
    };
    
    // Build API query with all parameters
    const params = new URLSearchParams({
        'start_date': startDate,
        'end_date': endDate,
        'type': reportType,
        'format': format,
        'filter_latest': filterLatestOnly.toString(),
        'filter_violations': filterViolationsOnly.toString(),
        'include_timestamps': includeTimestamps.toString(),
        'columns': JSON.stringify(selectedCols)
    });
    
    const query = `/api/export_report?${params.toString()}`;
    console.log('[ExportDesktop] Query:', query);
    
    try {
        const response = await fetch(query);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[ExportDesktop] API error:', errorText);
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }
        
        // Get content type to verify it's the right file type
        const contentType = response.headers.get('content-type');
        console.log('[ExportDesktop] Content-Type:', contentType);
        
        const blob = await response.blob();
        console.log('[ExportDesktop] Blob size:', blob.size, 'bytes');
        
        if (blob.size === 0) {
            throw new Error('Server returned empty file. No data available for this date range.');
        }
        
        const fileExt = format === 'excel' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'csv';
        const filename = `FaceAttend_${reportType}_${startDate}_to_${endDate}.${fileExt}`;
        
        console.log('[ExportDesktop] Downloading:', filename);
        downloadFile(blob, filename);
        console.log('[ExportDesktop] ✅ Download initiated');
        
    } catch (err) {
        console.error('[ExportDesktop] Error:', err);
        throw new Error(`Desktop export failed: ${err.message}`);
    }
}

async function executeExportMobile(startDate, endDate, format, reportType, filterLatestOnly, filterViolationsOnly, includeTimestamps) {
    console.log('[ExportMobile] Building query...');
    
    // Build API query with all selected columns
    let query = `/api/export_report?start_date=${startDate}&end_date=${endDate}&type=${reportType}&format=${format}`;
    query += `&filter_latest=${filterLatestOnly}&filter_violations=${filterViolationsOnly}&include_timestamps=${includeTimestamps}`;
    
    // Add column preferences
    const selectedCols = {
        user: document.getElementById('col-user').checked,
        date: document.getElementById('col-date').checked,
        status: document.getElementById('col-status').checked,
        location: document.getElementById('col-location').checked,
        checkin: document.getElementById('col-checkin').checked,
        period: document.getElementById('col-period').checked
    };
    query += `&columns=${encodeURIComponent(JSON.stringify(selectedCols))}`;
    
    console.log('[ExportMobile] Fetching from:', query);
    const response = await fetch(query);
    
    if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
    }

    const blob = await response.blob();
    const fileExt = format === 'excel' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'csv';
    const filename = `FaceAttend_${reportType}_${startDate}_to_${endDate}.${fileExt}`;
    
    console.log('[ExportMobile] Got blob, size:', blob.size, 'bytes');
    

    // Try using Capacitor Filesystem
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
        try {
            console.log('[ExportMobile] Using Capacitor Filesystem...');
            const Filesystem = window.Capacitor.Plugins.Filesystem;
            
            const encodedData = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            
            const result = await Filesystem.writeFile({
                path: filename,
                data: encodedData,
                directory: 'DOCUMENTS',
                recursive: true
            });
            console.log('[ExportMobile] File saved successfully:', result.uri);
            
            // Try to share the file
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share) {
                try {
                    console.log('[ExportMobile] Opening Share dialog...');
                    const Share = window.Capacitor.Plugins.Share;
                    await Share.share({
                        title: 'Attendance Report',
                        text: `Exported ${reportType} report (${format.toUpperCase()})`,
                        files: [result.uri],
                        dialogTitle: 'Share Report'
                    });
                    console.log('[ExportMobile] ✅ Share dialog completed');
                } catch (shareErr) {
                    console.log('[ExportMobile] Share not available (normal on some devices):', shareErr.message);
                    alert(`✅ Report saved to:\n${result.uri}\n\nCheck your Downloads folder!`);
                }
            }
            
            return;
        } catch (fsErr) {
            console.error('[ExportMobile] Filesystem error, trying fallback:', fsErr);
        }
    }
    
    // Fallback: Try browser download
    console.log('[ExportMobile] Trying fallback browser download...');
    try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log('[ExportMobile] ✅ Browser download initiated');
    } catch (dlErr) {
        console.error('[ExportMobile] Browser download failed:', dlErr);
        throw new Error('Could not save file. Please ensure Filesystem permissions are enabled.');
    }
}

function downloadJSON(data, filename) {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    downloadFile(blob, filename);
}

function showExportSuccess(format, type) {
    // Show a success notification (you can create a toast-style notification)
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed; 
        top: 20px; right: 20px; 
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        font-weight: 700;
        box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3);
        z-index: 11000;
        animation: slide-in-right 0.4s ease-out;
    `;
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
            <i class="fa-solid fa-check-circle"></i>
            <span>${type.charAt(0).toUpperCase() + type.slice(1)} report exported as ${format.toUpperCase()}</span>
        </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-10px)';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

function closeLiveViolationsModal() {
    const modal = document.getElementById('adminLiveViolationsModal');
    if (modal) modal.style.display = 'none';
}

function openLiveViolationsPanel() {
    const modal = document.getElementById('adminLiveViolationsModal');
    if (modal) modal.style.display = 'flex';
    
    if (currentLiveViolationsData) {
        renderLiveViolationsContent(currentLiveViolationsData);
    }
}

function renderLiveViolationsContent(data) {
    const content = document.getElementById('adminLiveViolationsContent');
    if (!content) return;

    const allAlerts = [...(data.fault_alerts || []), ...(data.event_alerts || [])];
    const dedupedAlerts = dedupeLiveViolations(allAlerts);
    
    if (dedupedAlerts.length === 0) {
        content.innerHTML = '<p style="color: #64748b; text-align: center; padding: 2rem;">✓ No violations detected. All faculties are in compliance.</p>';
        return;
    }

    // Categorize by violation type
    const violations = {
        OUT_OF_BOUNDS: { title: '🚫 Outside Campus Boundary', color: '#ef4444', items: [] },
        NETWORK_OFF: { title: '📡 Network OFF', color: '#f59e0b', items: [] },
        LOCATION_OFF: { title: '📍 Location OFF', color: '#3b82f6', items: [] },
        INVALID_USER_SCAN: { title: '⚠️ Invalid User Scan', color: '#8b5cf6', items: [] },
        OTHER: { title: '❓ Other Issues', color: '#6b7280', items: [] }
    };

    dedupedAlerts.forEach(alert => {
        const code = alert.code || 'OTHER';
        const category = violations[code] ? code : 'OTHER';
        violations[category].items.push(alert);
    });

    let html = '';
    Object.entries(violations).forEach(([key, cat]) => {
        if (cat.items.length === 0) return;

        html += `
        <div style="margin-bottom: 2rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 2px solid ${cat.color};">
                <span style="font-size: 1.5rem;">${cat.title.split(' ')[0]}</span>
                <h3 style="margin: 0; font-size: 1rem; color: #0f172a; flex: 1;">${cat.title}</h3>
                <span style="background: ${cat.color}; color: white; padding: 0.35rem 0.75rem; border-radius: 20px; font-weight: 700; font-size: 0.9rem;">${cat.items.length} ${cat.items.length === 1 ? 'issue' : 'issues'}</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem;">
        `;

        cat.items.forEach(item => {
            const timestamp = item.last_seen || item.created_at;
            const timeStr = timestamp ? convertUTCtoIST(timestamp) : 'N/A';
            const timeLabel = (item.code === 'NETWORK_OFF' || item.code === 'LOCATION_OFF')
                ? 'Disconnected At'
                : 'Last Seen';
            
            html += `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid ${cat.color}; border-radius: 12px; padding: 1rem;">
                <div style="font-weight: 700; color: #0f172a; margin-bottom: 0.25rem;">${item.name || 'Unknown'}</div>
                <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 0.5rem;">ID: ${item.user_id || 'N/A'}</div>
                <div style="font-size: 0.9rem; color: #334155; background: white; padding: 0.5rem; border-radius: 8px; margin-bottom: 0.5rem;">${item.message || item.code}</div>
                <div style="font-size: 0.75rem; color: #94a3b8;">${timeLabel}: ${timeStr}</div>
            </div>
            `;
        });

        html += '</div></div>';
    });

    content.innerHTML = html;
}

function dedupeLiveViolations(alerts) {
    const latestByUserAndCode = new Map();

    (alerts || []).forEach((alert) => {
        const userId = String(alert.user_id || 'unknown');
        const code = String(alert.code || 'OTHER');
        const key = `${userId}::${code}`;

        const currentTime = parseAlertTime(alert);
        const existing = latestByUserAndCode.get(key);

        if (!existing) {
            latestByUserAndCode.set(key, alert);
            return;
        }

        const existingTime = parseAlertTime(existing);
        if (currentTime >= existingTime) {
            latestByUserAndCode.set(key, alert);
        }
    });

    return Array.from(latestByUserAndCode.values()).sort((a, b) => parseAlertTime(b) - parseAlertTime(a));
}

function parseAlertTime(alert) {
    const raw = alert?.last_seen || alert?.created_at;
    if (!raw) return 0;
    const ms = new Date(raw).getTime();
    return Number.isNaN(ms) ? 0 : ms;
}

document.addEventListener('DOMContentLoaded', async () => {
    await setupReportFilters();  // Wait for setup to complete fully
    
    // Check role after setup
    const role = localStorage.getItem('user_role');
    if (role === 'admin') {
        initAdminLiveMonitoring();
    }
    
    fetchReportData();
});

async function setupReportFilters() {
    // 1. Get current user from localStorage
    let userRole = localStorage.getItem('user_role');
    let currentUserId = localStorage.getItem('user_id');

    if (!userRole || !currentUserId) {
        console.warn('Missing login context for reports. Redirecting to login.');
        window.location.href = 'login.html';
        return;
    }

    const facultySelect = document.getElementById('facultySelect');
    const liveMapSection = document.getElementById('adminLiveMapSection');
    
    // Set default dates (Last 30 days for meaningful analytics)
    const todayObj = new Date();
    const startObj = new Date(todayObj);
    startObj.setDate(todayObj.getDate() - 30);
    const today = todayObj.toISOString().split('T')[0];
    const startDateDefault = startObj.toISOString().split('T')[0];
    const startDateElem = document.getElementById('startDate');
    const endDateElem = document.getElementById('endDate');

    if (startDateElem) startDateElem.value = startDateDefault;
    if (endDateElem) endDateElem.value = today;

    if (userRole === 'admin') {
        if (liveMapSection) liveMapSection.style.display = 'block';
        if (facultySelect) facultySelect.style.display = 'block';
        
        // Fetch list of faculty
        if (facultySelect) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/users`);
                if (!response.ok) throw new Error('Failed to fetch users');
                
                const users = await response.json();
                
                facultySelect.innerHTML = '<option value="">All Faculty</option>';
                users.forEach(user => {
                    const opt = document.createElement('option');
                    opt.value = user.user_id || user.id;
                    opt.textContent = `${user.name} (${user.user_id || user.id})`;
                    facultySelect.appendChild(opt);
                });
                
            } catch (e) {
                console.error('Error loading faculty list', e);
            }
        }
    } else {
        if (liveMapSection) liveMapSection.style.display = 'none';
        if (facultySelect) facultySelect.style.display = 'none';
    }
}

function updateLiveMapStatus(message, isError = false) {
    const el = document.getElementById('adminLiveMapStatus');
    if (!el) return;
    el.textContent = message;
    el.style.color = isError ? '#b91c1c' : '#64748b';
}

function showAdminFaultPopup(alertItem) {
    if (!LIVE_POPUP_ALERTS_ENABLED) return;

    const stack = document.getElementById('adminLiveAlertStack');
    if (!stack) return;

    const faultKey = alertItem.fault_key;
    if (!faultKey || shownLiveFaults.has(faultKey)) return;
    shownLiveFaults.add(faultKey);

    const card = document.createElement('div');
    card.style.cssText = 'background: #991b1b; color: #fff; border-radius: 12px; padding: 0.8rem 0.9rem; box-shadow: 0 10px 20px rgba(15, 23, 42, 0.35); border-left: 4px solid #fecaca;';
    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: 0.75rem;">
            <div>
                <div style="font-weight:700; font-size:0.92rem;">${alertItem.name || 'Unknown'} (${alertItem.user_id || 'N/A'})</div>
                <div style="font-size:0.82rem; opacity:0.95; margin-top: 0.25rem;">${alertItem.message || alertItem.code || 'Fault detected.'}</div>
            </div>
            <button type="button" style="background:transparent; border:none; color:#fff; cursor:pointer; font-size:1rem;">×</button>
        </div>
    `;

    const closeBtn = card.querySelector('button');
    closeBtn.addEventListener('click', () => card.remove());

    stack.appendChild(card);
    setTimeout(() => {
        if (card.parentElement) card.remove();
    }, 12000);
}

function pruneResolvedFaults(activeAlerts) {
    const keys = new Set((activeAlerts || []).map(a => a.fault_key));
    shownLiveFaults.forEach(key => {
        if (!keys.has(key) && !key.startsWith('EVENT:')) {
            shownLiveFaults.delete(key);
        }
    });
}

function renderAdminLiveMap(data) {
    if (!window.L) {
        updateLiveMapStatus('Leaflet library failed to load. Check internet connection.', true);
        return;
    }

    const mapCanvas = document.getElementById('adminLiveMapCanvas');
    if (!mapCanvas) return;

    const center = [data.target.latitude, data.target.longitude];

    if (!adminMap) {
        adminMap = L.map(mapCanvas).setView(center, 17);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
            minZoom: 15
        }).addTo(adminMap);

        adminMapCenterMarker = L.circleMarker(center, {
            radius: 7,
            fillColor: '#0f172a',
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 1
        }).addTo(adminMap).bindTooltip('Campus Center', { permanent: false });

        adminMapBoundary = L.circle(center, {
            radius: data.target.radius_m,
            color: '#0ea5e9',
            weight: 2,
            opacity: 0.9,
            fill: true,
            fillColor: '#38bdf8',
            fillOpacity: 0.12
        }).addTo(adminMap);
    }

    const incoming = new Set();
    (data.map_points || []).forEach(p => {
        incoming.add(p.user_id);
        const position = [p.latitude, p.longitude];
        
        // Color based on in_bounds status
        let markerColor, markerOpacity;
        if (!p.in_bounds) {
            // Out of bounds - red/danger color
            markerColor = '#ef4444';
            markerOpacity = 0.7;
        } else if (p.role === 'admin') {
            markerColor = '#0ea5e9';
            markerOpacity = 1;
        } else {
            markerColor = '#16a34a';
            markerOpacity = 1;
        }
        
        const markerTitle = `${p.name} (${p.user_id})${!p.in_bounds ? ' - OUT OF BOUNDS' : ''}`;

        if (!adminMapMarkers[p.user_id]) {
            adminMapMarkers[p.user_id] = L.circleMarker(position, {
                radius: 8,
                fillColor: markerColor,
                color: '#ffffff',
                weight: 2,
                opacity: 1,
                fillOpacity: markerOpacity
            }).addTo(adminMap).bindTooltip(markerTitle, { permanent: false });
        } else {
            adminMapMarkers[p.user_id].setLatLng(position);
            adminMapMarkers[p.user_id].setStyle({
                fillColor: markerColor,
                fillOpacity: markerOpacity
            });
            adminMapMarkers[p.user_id].setTooltipContent(markerTitle);
        }
    });

    Object.keys(adminMapMarkers).forEach(userId => {
        if (!incoming.has(userId)) {
            adminMap.removeLayer(adminMapMarkers[userId]);
            delete adminMapMarkers[userId];
        }
    });

    updateLiveMapStatus(`Live tracking active. Showing ${incoming.size} user(s) on map.`);
}

async function sendAdminPresenceHeartbeat() {
    const userObj = JSON.parse(localStorage.getItem('user') || 'null');
    let adminId = null;
    
    if (userObj && userObj.user_id) {
        adminId = userObj.user_id;
    } else if (userObj && userObj.id) {
        adminId = userObj.id;
    } else {
        // Fallback to user_id from localStorage
        adminId = localStorage.getItem('user_id');
    }
    
    if (!adminId) return;

    if (!navigator.onLine) {
        return;
    }

    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
            await fetch(`${API_BASE_URL}/api/location_heartbeat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: adminId,
                    device_status: {
                        network_on: navigator.onLine,
                        location_on: true
                    },
                    location: {
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude
                    }
                })
            });
        } catch (err) {
            console.warn('Admin heartbeat failed:', err);
        }
    }, async () => {
        try {
            await fetch(`${API_BASE_URL}/api/location_heartbeat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: adminId,
                    device_status: {
                        network_on: navigator.onLine,
                        location_on: false
                    }
                })
            });
        } catch (err) {
            console.warn('Admin location-off heartbeat failed:', err);
        }
    }, {
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 10000
    });
}

function updateLiveMetrics(data) {
    const mapPoints = data.map_points || [];
    const inactiveUsers = data.inactive_users || [];  // NEW: Include logged-out users
    const faultAlerts = data.fault_alerts || [];
    
    // Calculate metrics - INCLUDE INACTIVE USERS IN ALL TOTALS
    const totalUsers = mapPoints.length + inactiveUsers.length;
    const inBounds = mapPoints.filter(p => p.in_bounds !== false).length;  // Only active users can be in bounds
    const outBounds = mapPoints.filter(p => p.in_bounds === false).length + inactiveUsers.length;  // Active out of bounds + ALL inactive
    const violations = faultAlerts.length;
    
    // Count devices with network/location ON (only active users can have these)
    // Inactive users (logged out) have NO network and NO location
    const devicesWithNetwork = mapPoints.filter(p => p.device_status && p.device_status.network_on).length;
    const devicesWithLocation = mapPoints.filter(p => p.device_status && p.device_status.location_on).length;
    const devicesWithoutNetwork = mapPoints.filter(p => !p.device_status || !p.device_status.network_on).length + inactiveUsers.length;
    const devicesWithoutLocation = mapPoints.filter(p => !p.device_status || !p.device_status.location_on).length + inactiveUsers.length;
    
    // Calculate percentages based on TOTAL users (active + inactive)
    const networkOnPct = totalUsers > 0 ? Math.round((devicesWithNetwork / totalUsers) * 100) : 0;
    const locationOnPct = totalUsers > 0 ? Math.round((devicesWithLocation / totalUsers) * 100) : 0;
    
    // Network & Location status (based on fault alerts for redundancy)
    const networkOff = faultAlerts.filter(a => a.code === 'NETWORK_OFF').length + inactiveUsers.length;
    const locationOff = faultAlerts.filter(a => a.code === 'LOCATION_OFF').length + inactiveUsers.length;
    
    // Overall health: devices with both network AND location ON
    const healthyDevices = mapPoints.filter(p => 
        p.device_status && p.device_status.network_on && p.device_status.location_on
    ).length;
    const healthPct = totalUsers > 0 ? Math.round((healthyDevices / totalUsers) * 100) : 0;
    
    // === NEW: Update Network & Location Real-Time Board ===
    animateCountChange('network-online-count', devicesWithNetwork);
    animateCountChange('location-active-count', devicesWithLocation);
    
    // Update coverage percentages
    setMetricValue('network-coverage-pct', networkOnPct + '%');
    setMetricValue('location-accuracy-pct', locationOnPct + '%');
    
    // Update progress bars
    const networkBar = document.getElementById('network-coverage-bar');
    const locationBar = document.getElementById('location-accuracy-bar');
    if (networkBar) networkBar.style.width = networkOnPct + '%';
    if (locationBar) locationBar.style.width = locationOnPct + '%';
    
    // Update status badges
    const networkBadge = document.getElementById('network-status-badge');
    const locationBadge = document.getElementById('location-status-badge');
    if (networkBadge) {
        networkBadge.textContent = networkOnPct >= 80 ? 'ONLINE' : networkOnPct >= 50 ? 'DEGRADED' : 'OFFLINE';
        networkBadge.style.background = networkOnPct >= 80 ? '#10b981' : networkOnPct >= 50 ? '#f59e0b' : '#ef4444';
    }
    if (locationBadge) {
        locationBadge.textContent = locationOnPct >= 80 ? 'ACTIVE' : locationOnPct >= 50 ? 'LIMITED' : 'INACTIVE';
        locationBadge.style.background = locationOnPct >= 80 ? '#f59e0b' : locationOnPct >= 50 ? '#3b82f6' : '#ef4444';
    }
    
    // === NEW: Update Campus Boundaries Status ===
    animateCountChange('bounds-inbounds', inBounds);
    animateCountChange('bounds-outbounds', outBounds);
    
    // === NEW: Update Device Health Radar ===
    animateCountChange('health-score', healthPct);
    
    // Update health bar segments (showing network, location, boundary)
    const segment1 = document.getElementById('health-bar-segment1');
    const segment2 = document.getElementById('health-bar-segment2');
    const segment3 = document.getElementById('health-bar-segment3');
    
    if (segment1) segment1.style.width = networkOnPct + '%';
    if (segment2) segment2.style.width = locationOnPct + '%';
    if (segment3) segment3.style.width = (inBounds > 0 && totalUsers > 0 ? Math.round((inBounds / totalUsers) * 100) : 0) + '%';
    
    // Update status summary
    const activeDevices = totalUsers;
    const issueDevices = violations;
    setMetricValue('status-active', activeDevices);
    setMetricValue('status-issues', Math.max(0, issueDevices));
    
    // Legacy fields (for backward compatibility with other functions)
    setMetricValue('status-present', totalUsers);
    setMetricValue('status-inbounds', inBounds);
    setMetricValue('status-outbounds', outBounds);
    
    // Live alerts preview
    updateLiveAlertsPreview(faultAlerts);
}

function animateCountChange(elementId, newValue) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    const oldValue = parseInt(el.textContent) || 0;
    if (oldValue === newValue) return;
    
    // Animate the number change
    el.style.animation = 'none';
    setTimeout(() => {
        el.textContent = newValue;
        el.style.animation = 'number-change 0.4s ease-out';
    }, 10);
}

function setMetricValue(elementId, value) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = value;
    }
}

function updateLiveAlertsPreview(alerts) {
    const container = document.getElementById('liveAlertsPreview');
    if (!container) return;
    
    if (alerts.length === 0) {
        container.innerHTML = '<p style="color: #10b981; font-size: 0.9rem; padding: 1rem; text-align: center;">✓ No violations detected</p>';
        document.getElementById('live-alerts-count').textContent = '0';
        return;
    }
    
    document.getElementById('live-alerts-count').textContent = alerts.length;
    
    // Show top alerts
    const topAlerts = alerts.slice(0, 3);
    let html = '';
    
    topAlerts.forEach(alert => {
        const colorMap = {
            'OUT_OF_BOUNDS': '#ef4444',
            'NETWORK_OFF': '#f59e0b',
            'LOCATION_OFF': '#3b82f6',
            'INVALID_USER_SCAN': '#8b5cf6'
        };
        const color = colorMap[alert.code] || '#6b7280';
        const timeStr = alert.last_seen ? convertUTCtoIST(alert.last_seen) : 'N/A';
        
        html += `
        <div style="border-left: 3px solid ${color}; padding: 0.75rem; background: #f8fafc; margin-bottom: 0.5rem; border-radius: 6px;">
            <div style="font-weight: 700; color: #0f172a; font-size: 0.9rem;">${alert.name || 'Unknown'}</div>
            <div style="color: #64748b; font-size: 0.8rem;">${alert.code}</div>
            <div style="color: #94a3b8; font-size: 0.75rem; margin-top: 0.25rem;">${timeStr}</div>
        </div>
        `;
    });
    
    if (alerts.length > 3) {
        html += `<div style="text-align: center; padding: 0.5rem; color: #3b82f6; font-size: 0.85rem; font-weight: 700; cursor: pointer;" onclick="openLiveViolationsPanel()">+${alerts.length - 3} more...</div>`;
    }
    
    container.innerHTML = html;
}

async function pollAdminLiveData() {
    const userObj = JSON.parse(localStorage.getItem('user') || 'null');
    let adminId = null;
    
    if (userObj && userObj.user_id) {
        adminId = userObj.user_id;
    } else if (userObj && userObj.id) {
        adminId = userObj.id;
    } else {
        // Fallback to user_id from localStorage (set by debug mode or login)
        adminId = localStorage.getItem('user_id');
    }
    
    if (!adminId) {
        console.log('No admin ID found in localStorage. Waiting for login...');
        return;
    }

    try {
        const res = await fetch(`/api/admin/live_locations?admin_id=${encodeURIComponent(adminId)}`);
        const data = await res.json();
        
        console.log('Admin Live Data Response:', data);
        
        if (!res.ok || !data.success) {
            throw new Error(data.message || 'Failed to load live location data');
        }

        // Store latest data for modal access
        currentLiveViolationsData = { ...data };
        
        // Update debug status
        const debugEl = document.getElementById('adminLiveDebugStatus');
        if (debugEl) {
            debugEl.textContent = `Users On Map: ${data.map_points?.length || 0} | Fault Alerts: ${data.fault_alerts?.length || 0} | Event Alerts: ${data.event_alerts?.length || 0} | Last Poll: ${new Date().toLocaleTimeString()}`;
        }
        
        // Update last poll timestamp
        const lastUpdateEl = document.getElementById('map-last-update');
        if (lastUpdateEl) {
            lastUpdateEl.textContent = new Date().toLocaleTimeString();
        }

        renderAdminLiveMap(data);
        updateLiveMetrics(data);

        const allAlerts = [...(data.fault_alerts || []), ...(data.event_alerts || [])];
        pruneResolvedFaults(allAlerts);

        // Floating popups are intentionally disabled; use "View Violations" panel instead.
        const alertStack = document.getElementById('adminLiveAlertStack');
        if (alertStack) {
            alertStack.innerHTML = '';
            alertStack.style.display = 'none';
        }
    } catch (err) {
        console.error('Live monitor error:', err);
        const debugEl = document.getElementById('adminLiveDebugStatus');
        if (debugEl) {
            debugEl.textContent = `ERROR: ${err.message}`;
            debugEl.style.color = '#d32f2f';
        }
        updateLiveMapStatus(`Live monitor error: ${err.message}`, true);
    }
}

async function initAdminLiveMonitoring() {
    if (!window.L) {
        updateLiveMapStatus('Leaflet library not loaded. Check internet connection.', true);
        return;
    }

    sendAdminPresenceHeartbeat();
    pollAdminLiveData();

    if (adminHeartbeatInterval) clearInterval(adminHeartbeatInterval);
    adminHeartbeatInterval = setInterval(sendAdminPresenceHeartbeat, 15000);

    if (adminLivePollInterval) clearInterval(adminLivePollInterval);
    adminLivePollInterval = setInterval(pollAdminLiveData, 15000);
}

// Function to handle quick date presets
window.applyDatePreset = function() {
    const preset = document.getElementById('dateRangePreset').value;
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    
    // Create new Date objects to avoid mutation issues
    const today = new Date();
    // Start date initialization
    let start = new Date(today); 

    if (preset === 'custom') {
        // Do nothing, let user edit
        return;
    } else if (preset === '1m') {
        start.setMonth(today.getMonth() - 1);
    } else if (preset === '3m') {
        start.setMonth(today.getMonth() - 3);
    } else if (preset === 'all') {
        start = new Date('2020-01-01'); // Far past date
    }

    startDateInput.value = start.toISOString().split('T')[0];
    endDateInput.value = today.toISOString().split('T')[0];
}

async function downloadReport(reportType = 'detailed') {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const facultyId = document.getElementById('facultySelect').value;
    
    const currentUserRole = localStorage.getItem('user_role');
    const currentUserId = localStorage.getItem('user_id');

    // Validation
    if (!startDate || !endDate) {
        alert("Please select both Start and End dates.");
        return;
    }

    // Build Query Params
    let query = `?start_date=${startDate}&end_date=${endDate}&type=${reportType}`;

    if (currentUserRole === 'admin') {
        const facultySelect = document.getElementById('facultySelect');
        const fId = facultySelect ? facultySelect.value : '';
        if (fId) {
             query += `&user_id=${fId}`;
        }
    } else {
        // Must be logged in as a normal user (or user_id logic for debug)
        if (currentUserId && currentUserId !== 'null') {
            query += `&user_id=${currentUserId}`;
        } else if (!currentUserRole) {
             console.warn("No user role found. Defaulting to empty (All if backend allows, or user driven).");
             // If debugging, we might not have a user_id. Let backend handle the 404 or empty return.
        } else {
             alert("Please login first to download your report.");
             return;
        }
    }

    // Trigger Download
    const downloadUrl = `/api/download_report${query}`;
    window.location.href = downloadUrl;
}


async function fetchReportData() {
    const tbody = document.getElementById('reportTableBody');
    const mobileList = document.getElementById('reportMobileList');
    const reportDateFilterEl = document.getElementById('reportDateFilter');
    const selectedDailyDateLabel = document.getElementById('selectedDailyDateLabel');
    if (!tbody) {
        console.error('Report table body not found in DOM.');
        return;
    }

    selectedDailyReportDate = reportDateFilterEl ? (reportDateFilterEl.value || '').trim() : '';
    if (selectedDailyDateLabel) {
        selectedDailyDateLabel.textContent = selectedDailyReportDate
            ? `Showing report for ${selectedDailyReportDate}.`
            : 'Showing all dates in range.';
    }

    const attendanceCanvas = document.getElementById('attendanceChart');
    const distributionCanvas = document.getElementById('distributionChart');
    const ctxAttendance = attendanceCanvas ? attendanceCanvas.getContext('2d') : null;
    const ctxDistribution = distributionCanvas ? distributionCanvas.getContext('2d') : null;
    
    // Get filter values
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    let startDate = startDateInput ? startDateInput.value : '';
    let endDate = endDateInput ? endDateInput.value : '';

    if (!startDate || !endDate) {
        const today = new Date();
        const start = new Date(today);
        start.setDate(today.getDate() - 30);
        startDate = start.toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
    }
    
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading Analytics...</td></tr>';
    if (mobileList) {
        mobileList.innerHTML = '<p style="margin:0; color:#64748b; font-size:0.9rem; text-align:center;">Loading daily report...</p>';
    }

    try {
        let url = '/api/report';
        if(startDate && endDate) {
             url += `?start_date=${startDate}&end_date=${endDate}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) throw new Error(data.error);

        const dailyStats = data.daily_stats || [];
        // DeptStats removed or kept? I removed the canvas in HTML, so ignore it.
        const leaderboard = data.leaderboard || [];
        const timeDist = data.time_distribution || {};
        const recentActivity = data.recent_activity || [];
        
        // --- 1. Populate Command Center (Today's Data) ---
        const todayStr = new Date().toISOString().split('T')[0];
        const todayData = dailyStats.find(d => d.date === todayStr) || {};
        
        // Total Faculty (from summary or calculated)
        // If data.summary.total_faculty exists, use it. Else fallback.
        const totalFaculty = data.summary?.total_faculty || 0;
        const metricOccupancy = document.getElementById('metric-occupancy');
        const metricOccupancySub = document.getElementById('metric-occupancy-sub');
        if (metricOccupancy) metricOccupancy.textContent = totalFaculty;
        if (metricOccupancySub) metricOccupancySub.textContent = `${dailyStats.length} day(s) in selected range`;

        // Present/Absent/Late/Avg for Today
        if (todayData.date) {
            const totalForToday = todayData.present + todayData.absent;
            const complianceRate = totalForToday > 0 ? Math.round((todayData.present / totalForToday) * 100) : 0;
            const networkRate = totalForToday > 0 ? Math.max(0, 100 - Math.round((todayData.absent / totalForToday) * 100)) : 0;

            const metricCompliance = document.getElementById('metric-compliance');
            const metricComplianceSub = document.getElementById('metric-compliance-sub');
            const metricViolations = document.getElementById('metric-violations');
            const metricViolationsSub = document.getElementById('metric-violations-sub');
            const metricNetwork = document.getElementById('metric-network');
            const metricNetworkSub = document.getElementById('metric-network-sub');

            if (metricCompliance) metricCompliance.textContent = `${complianceRate}%`;
            if (metricComplianceSub) metricComplianceSub.textContent = `Present: ${todayData.present}, Absent: ${todayData.absent}`;
            if (metricViolations) metricViolations.textContent = todayData.violations ?? todayData.late;
            if (metricViolationsSub) metricViolationsSub.textContent = `Late: ${todayData.late}`;
            if (metricNetwork) metricNetwork.textContent = `${networkRate}%`;
            if (metricNetworkSub) metricNetworkSub.textContent = `Avg check-in: ${todayData.avg_check_in || '--:--'}`;
        } else {
            const metricCompliance = document.getElementById('metric-compliance');
            const metricComplianceSub = document.getElementById('metric-compliance-sub');
            const metricViolations = document.getElementById('metric-violations');
            const metricViolationsSub = document.getElementById('metric-violations-sub');
            const metricNetwork = document.getElementById('metric-network');
            const metricNetworkSub = document.getElementById('metric-network-sub');

            if (metricCompliance) metricCompliance.textContent = '--';
            if (metricComplianceSub) metricComplianceSub.textContent = 'Today not in selected range';
            if (metricViolations) metricViolations.textContent = '--';
            if (metricViolationsSub) metricViolationsSub.textContent = 'No today snapshot';
            if (metricNetwork) metricNetwork.textContent = '--';
            if (metricNetworkSub) metricNetworkSub.textContent = 'Select range including today';
        }

        // --- 2. Charts ---
        if (window.myAttendanceChart) window.myAttendanceChart.destroy();
        if (window.myDistributionChart) window.myDistributionChart.destroy();
        
        // A. Weekly Trend (or Range Trend)
        if (ctxAttendance && window.Chart) {
            window.myAttendanceChart = new Chart(ctxAttendance, {
                type: 'line',
                data: {
                    labels: dailyStats.map(d => d.date),
                    datasets: [
                        {
                            label: 'Present',
                            data: dailyStats.map(d => d.present),
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            fill: true,
                            tension: 0.4
                        },
                        {
                            label: 'Late',
                            data: dailyStats.map(d => d.late),
                            borderColor: '#f59e0b',
                            backgroundColor: 'rgba(245, 158, 11, 0.1)',
                            fill: true,
                            tension: 0.4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'top' } },
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
                }
            });
        }

        // B. Time Distribution
        if (ctxDistribution && window.Chart) {
            const labels = Object.keys(timeDist);
            const values = Object.values(timeDist);
            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']; // Blue, Green, Yellow, Red logic order?
            // Early, On Time, Grace, Late
            
            window.myDistributionChart = new Chart(ctxDistribution, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Check-ins',
                        data: values,
                        backgroundColor: colors.slice(0, labels.length),
                        borderRadius: 6
                    }]
                },
                options: {
                    indexAxis: 'y', // Horizontal Bar
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } }
                }
            });
        }

        // --- 3. Leaderboard ---
        const leaderboardContainer = document.getElementById('lateLeaderboardContainer');
        if (leaderboardContainer) leaderboardContainer.innerHTML = '';
        if (leaderboard.length === 0) {
            if (leaderboardContainer) leaderboardContainer.innerHTML = '<p style="color: #94a3b8; padding: 0.5rem;">No late arrivals recorded.</p>';
        } else {
            leaderboard.forEach((item, index) => {
                const row = document.createElement('div');
                row.style.cssText = 'display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid #f1f5f9;';
                row.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <span style="font-weight: 700; color: #cbd5e1; font-size: 0.9rem;">#${index + 1}</span>
                        <span style="font-weight: 600; color: #334155;">${item.name}</span>
                    </div>
                    <span style="font-weight: 700; color: #f59e0b; background: #fffbeb; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.85rem;">${item.count} Late</span>
                `;
                if (leaderboardContainer) leaderboardContainer.appendChild(row);
            });
        }

        // --- 4. Recent Activity ---
        const feedContainer = document.getElementById('activityFeedContainer');
        if (feedContainer) {
            feedContainer.innerHTML = '<div style="position: absolute; left: 8px; top: 0; bottom: 0; width: 2px; background: linear-gradient(180deg, #3b82f6, #dbeafe);"></div>';
        }
        if (recentActivity.length === 0) {
            if (feedContainer) {
                const empty = document.createElement('p');
                empty.style.cssText = 'color: #94a3b8; padding: 0.5rem 1rem; position: relative;';
                empty.textContent = 'No recent activity.';
                feedContainer.appendChild(empty);
            }
        } else {
            recentActivity.forEach(log => {
                const row = document.createElement('div');
                row.style.cssText = 'padding: 0.75rem 0.75rem 0.75rem 1.4rem; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between; position: relative;';
                
                // Color code status
                let color = '#64748b';
                const statusText = log.status || 'N/A';
                if (statusText.includes('Late')) color = '#f59e0b';
                else if (statusText.includes('Present') || statusText.includes('Full Day')) color = '#10b981';

                const timeLabel = (log.time || '').includes(' ') ? (log.time.split(' ')[1] || log.time) : (log.time || '00:00:00');
                
                row.innerHTML = `
                    <div>
                        <div style="font-weight: 600; color: #334155;">${log.name}</div>
                        <div style="font-size: 0.8rem; color: #94a3b8;">${timeLabel}</div>
                    </div>
                    <span style="font-size: 0.8rem; font-weight: 600; color: ${color};">${statusText}</span>
                `;
                if (feedContainer) feedContainer.appendChild(row);
            });
        }

        // --- 5. Heatmap ---
        const heatmapContainer = document.getElementById('heatmapContainer');
        if (heatmapContainer) {
            heatmapContainer.innerHTML = '';

            // Loop through dailyStats (which is chronological? Backend keys sorted, list appended in order)
            // dailyStats is sorted by date ascending in backend.
            dailyStats.forEach(day => {
                const dateObj = new Date(day.date);
                const dateLabel = dateObj.getDate();
                const fullDate = day.date;

                // Determine Color
                // Logic: High (>90% present), Moderate (80-90%), Low (<80%)
                // We need total staff to calculate %.
                // We have `totalFaculty` (number) or `day.present + day.absent`.
                // Let's use (present / (present + absent)) * 100 for that day's attendance rate.
                // Note: `totalFaculty` might account for everyone, but logged data only has present/absent counts.
                // If absent is computed correctly in backend as (Total - Present), then Present+Absent = Total.

                const totalForDay = day.present + day.absent;
                let pct = 0;
                if (totalForDay > 0) pct = (day.present / totalForDay) * 100;

                let bg = '#e2e8f0'; // Default gray
                if (totalForDay > 0) {
                    if (pct >= 90) bg = '#10b981'; // Green
                    else if (pct >= 80) bg = '#f59e0b'; // Yellow
                    else bg = '#ef4444'; // Red
                }

                const cell = document.createElement('div');
                cell.title = `${fullDate}: ${Math.round(pct)}% Attendance`;
                cell.style.cssText = `
                    width: 36px; height: 36px; 
                    background: ${bg}; 
                    border-radius: 8px; 
                    border: ${selectedDailyReportDate === fullDate ? '2px solid #1d4ed8' : '1px solid transparent'};
                    display: flex; align-items: center; justify-content: center;
                    color: white; font-weight: 600; font-size: 0.8rem;
                    cursor: pointer; transition: transform 0.2s;
                `;
                cell.textContent = dateLabel;
                cell.onmouseover = () => cell.style.transform = 'scale(1.1)';
                cell.onmouseout = () => cell.style.transform = 'scale(1)';
                cell.onclick = () => {
                    if (reportDateFilterEl) {
                        reportDateFilterEl.value = fullDate;
                    }
                    selectedDailyReportDate = fullDate;
                    fetchReportData();
                };

                heatmapContainer.appendChild(cell);
            });
        }

        // --- 6. Existing Table ---
        tbody.innerHTML = '';
        if (mobileList) mobileList.innerHTML = '';
        
        if (!selectedDailyReportDate) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Select a date from calendar to view logs.</td></tr>';
            if (mobileList) {
                mobileList.innerHTML = '<p style="margin:0; color:#64748b; font-size:0.9rem; text-align:center;">Select a date from calendar to view logs.</p>';
            }
            return;
        }

        if (dailyStats.length === 0) {
             tbody.innerHTML = '<tr><td colspan="6" class="text-center">No data found for this range.</td></tr>';
             if (mobileList) {
                mobileList.innerHTML = '<p style="margin:0; color:#64748b; font-size:0.9rem; text-align:center;">No data found for this range.</p>';
             }
        } else {
            const sortedDaily = [...dailyStats].reverse(); // Newest first for table
            const filteredDaily = sortedDaily.filter(day => day.date === selectedDailyReportDate);

            if (filteredDaily.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center">No report found for ${selectedDailyReportDate}.</td></tr>`;
                if (mobileList) {
                    mobileList.innerHTML = `<p style="margin:0; color:#64748b; font-size:0.9rem; text-align:center;">No report found for ${selectedDailyReportDate}.</p>`;
                }
                return;
            }

            filteredDaily.forEach(day => {
                const violations = (typeof day.violations === 'number') ? day.violations : (day.absent + day.late);
                const totalForDay = day.present + day.absent;
                const attendanceRate = totalForDay > 0 ? Math.round((day.present / totalForDay) * 100) : 0;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${day.date}</td>
                    <td><span class="badge badge-green">${day.present}</span></td>
                    <td><span class="badge badge-red">${day.absent}</span></td>
                    <td><span class="badge badge-yellow">${day.late}</span></td>
                    <td><span class="badge badge-red">${violations}</span></td>
                    <td>${day.avg_check_in}</td>
                `;
                tbody.appendChild(tr);

                if (mobileList) {
                    const details = document.createElement('details');
                    details.className = 'mobile-day-item';
                    details.innerHTML = `
                        <summary class="mobile-day-summary">
                            <span>${day.date}</span>
                            <span style="font-size:0.82rem; color:${attendanceRate >= 80 ? '#166534' : '#991b1b'};">${attendanceRate}% Attendance</span>
                        </summary>
                        <div class="mobile-day-grid">
                            <div class="mobile-day-chip"><span class="k">Present</span><span class="v">${day.present}</span></div>
                            <div class="mobile-day-chip"><span class="k">Absent</span><span class="v">${day.absent}</span></div>
                            <div class="mobile-day-chip"><span class="k">Late</span><span class="v">${day.late}</span></div>
                            <div class="mobile-day-chip"><span class="k">Violations</span><span class="v">${violations}</span></div>
                            <div class="mobile-day-chip" style="grid-column: 1 / -1;"><span class="k">Avg Check-In</span><span class="v">${day.avg_check_in}</span></div>
                        </div>
                    `;
                    mobileList.appendChild(details);
                }
            });
        }

    } catch (err) {
        console.error("Fetch Error:", err);
        tbody.innerHTML = `<tr><td colspan="5" style="color: red; text-align: center;">Error loading data: ${err.message}</td></tr>`;
        if (mobileList) {
            mobileList.innerHTML = `<p style="margin:0; color:#b91c1c; font-size:0.9rem; text-align:center;">Error loading data: ${err.message}</p>`;
        }
    }
}


// Add event listeners to date inputs to auto-refresh
const startDateEl = document.getElementById('startDate');
const endDateEl = document.getElementById('endDate');
const reportDateFilterEl = document.getElementById('reportDateFilter');
const clearReportDateFilterBtn = document.getElementById('clearReportDateFilter');
if (startDateEl) startDateEl.addEventListener('change', fetchReportData);
if (endDateEl) endDateEl.addEventListener('change', fetchReportData);
if (reportDateFilterEl) reportDateFilterEl.addEventListener('change', fetchReportData);
if (clearReportDateFilterBtn) {
    clearReportDateFilterBtn.addEventListener('click', () => {
        if (reportDateFilterEl) reportDateFilterEl.value = '';
        selectedDailyReportDate = '';
        fetchReportData();
    });
}


