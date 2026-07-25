document.addEventListener('DOMContentLoaded', () => {
    // Determine which dashboard we are on
    const path = window.location.pathname;
    const pendingFaceUser = JSON.parse(localStorage.getItem('pending_face_user') || 'null');

    if (pendingFaceUser) {
        window.location.href = 'capture_face.html';
        return;
    }
    
    if (path.includes('admin_dashboard')) {
        initAdminDashboard();
    } else if (path.includes('faculty_dashboard')) {
        initFacultyDashboard();
    }
});

let allPermissionRows = [];

const PERMISSION_POLICY_RULE_INPUTS = {
    'Require face': 'permRequireFace',
    'Ignore GPS': 'permIgnoreGps',
    'Ignore radius': 'permIgnoreRadius',
    'Ignore WiFi': 'permIgnoreWifi',
    'Morning mark required': 'permMorningRequired',
    'Evening mark required': 'permEveningRequired',
    'One mark enough': 'permOneMarkEnough',
    'Manual approval': 'permManualApproval'
};

const PERMISSION_POLICIES = {
    late_arrival: {
        label: 'Late Arrival',
        result: 'Present',
        priority: 'Normal',
        windowMode: 'TIME_RANGE',
        startTime: '09:30',
        endTime: '11:30',
        marks: '2 marks',
        location: 'Default campus rules',
        timeRule: 'Check-in window extended',
        rules: ['Require face', 'Morning mark required', 'Evening mark required'],
        className: 'late-arrival'
    },
    early_departure: {
        label: 'Early Leave',
        result: 'Present',
        priority: 'Normal',
        windowMode: 'TIME_RANGE',
        startTime: '14:00',
        endTime: '17:00',
        marks: '2 marks',
        location: 'Default campus rules',
        timeRule: 'Checkout window relaxed',
        rules: ['Require face', 'Morning mark required'],
        className: 'early-departure'
    },
    half_day_morning: {
        label: 'Half Day (Morning)',
        result: 'Half Day Present',
        priority: 'High',
        windowMode: 'FULL_DAY',
        marks: '1 mark',
        location: 'Default campus rules',
        timeRule: 'Morning session waived',
        rules: ['Require face', 'Second Mark Not Required'],
        className: 'half-day'
    },
    half_day_afternoon: {
        label: 'Half Day (Afternoon)',
        result: 'Half Day Present',
        priority: 'High',
        windowMode: 'FULL_DAY',
        marks: '1 mark',
        location: 'Default campus rules',
        timeRule: 'Afternoon session waived',
        rules: ['Require face', 'Second Mark Not Required'],
        className: 'half-day'
    },
    full_day_absence: {
        label: 'Full Day Leave',
        result: 'Leave Approved',
        priority: 'High',
        windowMode: 'FULL_DAY',
        marks: '0 marks',
        location: 'No campus validation',
        timeRule: 'Full day leave',
        rules: ['Manual approval'],
        className: 'full-day-absence'
    },
    work_from_home: {
        label: 'Work From Home',
        result: 'Present (WFH)',
        priority: 'High',
        windowMode: 'FULL_DAY',
        marks: '2 marks',
        location: 'Any location',
        timeRule: 'Working hours apply',
        rules: ['Require face', 'Ignore GPS', 'Ignore radius', 'Ignore WiFi'],
        className: 'work-from-home'
    },
    outdoor_duty: {
        label: 'Outdoor Duty',
        result: 'Outdoor Duty',
        priority: 'High',
        windowMode: 'TIME_RANGE',
        startTime: '09:00',
        endTime: '17:00',
        marks: '1 mark',
        location: 'Any duty location',
        timeRule: 'Flexible duty window',
        rules: ['Require face', 'Ignore GPS', 'Ignore radius', 'Ignore WiFi', 'One mark enough'],
        className: 'custom'
    },
    exam_duty: {
        label: 'Exam Duty',
        result: 'On Duty',
        priority: 'High',
        windowMode: 'TIME_RANGE',
        startTime: '08:00',
        endTime: '17:00',
        marks: '1 mark',
        location: 'Assigned exam venue',
        timeRule: 'Exam schedule window',
        rules: ['Require face', 'Ignore radius', 'One mark enough'],
        className: 'custom'
    },
    on_duty: {
        label: 'On Duty',
        result: 'On Duty',
        priority: 'High',
        windowMode: 'FULL_DAY',
        marks: '1 mark',
        location: 'Duty location',
        timeRule: 'Duty schedule',
        rules: ['Require face', 'Ignore GPS', 'Ignore radius', 'Ignore WiFi', 'One mark enough'],
        className: 'custom'
    },
    forgot_check_in: {
        label: 'Forgot Check-in',
        result: 'Manual Override',
        priority: 'Normal',
        windowMode: 'FULL_DAY',
        marks: 'Manual mark',
        location: 'Admin verified',
        timeRule: 'Manual check-in',
        rules: ['Manual approval'],
        className: 'custom'
    },
    forgot_checkout: {
        label: 'Forgot Checkout',
        result: 'Manual Override',
        priority: 'Normal',
        windowMode: 'FULL_DAY',
        marks: 'Manual mark',
        location: 'Admin verified',
        timeRule: 'Manual checkout',
        rules: ['Manual approval'],
        className: 'custom'
    },
    device_problem: {
        label: 'Device Problem',
        result: 'Manual Override',
        priority: 'Normal',
        windowMode: 'FULL_DAY',
        marks: 'Manual mark',
        location: 'Admin verified',
        timeRule: 'Today only',
        rules: ['Manual approval'],
        className: 'custom'
    },
    gps_failure: {
        label: 'GPS Failure',
        result: 'Present',
        priority: 'Normal',
        windowMode: 'FULL_DAY',
        marks: '2 marks',
        location: 'GPS ignored',
        timeRule: 'Default time rules',
        rules: ['Require face', 'Ignore GPS', 'Ignore radius'],
        className: 'custom'
    },
    face_failure: {
        label: 'Face Recognition Failure',
        result: 'Needs Admin Review',
        priority: 'High',
        windowMode: 'FULL_DAY',
        marks: 'Manual review',
        location: 'GPS required',
        timeRule: 'Default time rules',
        rules: ['Manual approval'],
        className: 'custom'
    },
    internet_failure: {
        label: 'Internet Failure',
        result: 'Manual Override',
        priority: 'Normal',
        windowMode: 'FULL_DAY',
        marks: 'Offline sync',
        location: 'Sync later',
        timeRule: 'Offline window',
        rules: ['Require face', 'Manual approval'],
        className: 'custom'
    },
    emergency: {
        label: 'Emergency',
        result: 'Needs Admin Review',
        priority: 'Critical',
        windowMode: 'FULL_DAY',
        marks: 'Admin decision',
        location: 'All validations waived',
        timeRule: 'Emergency override',
        rules: ['Ignore GPS', 'Ignore radius', 'Ignore WiFi', 'Manual approval'],
        className: 'emergency'
    },
    custom: {
        label: 'Custom Permission',
        result: 'Needs Admin Review',
        priority: 'Normal',
        windowMode: 'TIME_RANGE',
        startTime: '09:00',
        endTime: '17:00',
        marks: 'Custom',
        location: 'Custom policy',
        timeRule: 'Custom window',
        rules: ['Require face', 'Manual approval'],
        className: 'custom'
    }
};

const PERMISSION_TYPE_ALIASES = {
    lp: 'late_arrival',
    ep: 'early_departure',
    early_exit: 'early_departure',
    early_leave: 'early_departure',
    full_day_leave: 'full_day_absence',
    full_day: 'full_day_absence',
    od: 'on_duty',
    wfh: 'work_from_home'
};

async function initAdminDashboard() {
    const user = JSON.parse(localStorage.getItem('user'));
    
    // Check if user is logged in
    if (!user || user.role !== 'admin') {
        console.warn("Unauthorized Access: user not found or not admin. Redirecting to login.");
        window.location.href = 'login.html';
        return;
    }

    // Use a valid user ID if logged in, or a default for dev if backend supports it
    const userId = user ? user.id : 'ADMIN01'; 

    try {
        const response = await fetch(`/api/dashboard/admin/${userId}`);
        // Check if response is ok
        if (!response.ok) {
             throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();

        // Update Stats using specific IDs (More robust)
        const totalEl = document.getElementById('statTotalStaff');
        const presentEl = document.getElementById('statPresent');
        const lateEl = document.getElementById('statLate');
        const absentEl = document.getElementById('statAbsent');


        if (totalEl) totalEl.textContent = data.stats.total_users || 0;
        if (presentEl) presentEl.textContent = data.stats.present_today || 0;
        if (lateEl) lateEl.textContent = data.stats.late_count || 0;
        if (absentEl) absentEl.textContent = data.stats.absent_count || 0;
        
        // Fetch tables (Check-Ins)
        const tablesRes = await fetch('/api/admin/dashboard_tables');
        const tablesData = await tablesRes.json();
        
        if (tablesData.success) {
            const checkinTbody = document.getElementById('checkInTableBody');
            const checkinPill = document.getElementById('nxadmCheckinCountPill');
            
            if (checkinTbody) {
                checkinTbody.innerHTML = '';
                if (tablesData.checkins.length === 0) {
                    checkinTbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:1.6rem !important; color:#64748b;">No check-ins today yet.</td></tr>';
                } else {
                    tablesData.checkins.forEach(log => {
                        const tr = document.createElement('tr');
                        
                        // Use existing helper if available or inline logic for badge class
                        const getBadgeClass = (status) => {
                            if (!status) return 'nxadm-badge--neutral';
                            const s = status.toLowerCase();
                            if (s.includes('late') || s.includes('absent')) return 'nxadm-badge--danger';
                            if (s.includes('on time') || s.includes('present')) return 'nxadm-badge--success';
                            if (s.includes('half')) return 'nxadm-badge--warn';
                            return 'nxadm-badge--neutral';
                        };

                        tr.innerHTML = `
                            <td class="nxadm-col-id nxadm-sticky-col">${log.user_id}</td>
                            <td class="nxadm-col-name">${log.name}</td>
                            <td><span class="nxadm-role-tag">${log.role}</span></td>
                            <td>${log.date}</td>
                            <td>${log.day}</td>
                            <td>${log.period}</td>
                            <td>${log.time_in}</td>
                            <td><span class="nxadm-badge ${getBadgeClass(log.check_in_status)}">${log.check_in_status}</span></td>
                            <td>${log.time_out}</td>
                            <td><span class="nxadm-badge ${getBadgeClass(log.check_out_status)}">${log.check_out_status}</span></td>
                            <td><span class="nxadm-badge ${getBadgeClass(log.status)}">${log.status}</span></td>
                        `;
                        checkinTbody.appendChild(tr);
                    });
                }
            }
            if (checkinPill) {
                checkinPill.textContent = `${tablesData.checkins.length} record${tablesData.checkins.length === 1 ? '' : 's'}`;
            }
        }

    } catch (error) {
        console.error("Failed to load admin dashboard:", error);
    } finally {
        initializePermissionCenter(userId);
        loadPermissionAnalytics(userId);
    }
}

async function loadPermissionAnalytics(adminId) {
    const topContainer = document.getElementById('analyticsTopPermissions');
    const flagsContainer = document.getElementById('analyticsAbuseFlags');
    
    if (!topContainer || !flagsContainer) return;
    
    try {
        const res = await fetch(`/api/admin/analytics/permissions?admin_id=${adminId}`);
        const data = await res.json();
        
        if (data.success) {
            // Render Top Permissions
            if (data.top_permissions && data.top_permissions.length > 0) {
                let html = '';
                data.top_permissions.forEach((p, idx) => {
                    const color = idx === 0 ? '#3b82f6' : (idx === 1 ? '#10b981' : '#f59e0b');
                    html += `
                        <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 0.75rem; border-bottom: 1px solid #f1f5f9;">
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <div style="width: 8px; height: 8px; border-radius: 50%; background: ${color};"></div>
                                <span style="font-weight: 600; color: #334155; font-size: 0.95rem;">${p.type}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 1rem;">
                                <span style="font-weight: 700; color: #0f172a;">${p.percentage}%</span>
                                <span style="color: #64748b; font-size: 0.85rem;">(${p.count})</span>
                            </div>
                        </div>
                    `;
                });
                topContainer.innerHTML = html;
            } else {
                topContainer.innerHTML = '<div style="color: #64748b; font-size: 0.9rem;">No data in last 30 days.</div>';
            }
            
            // Render Abuse Flags
            if (data.abuse_flags && data.abuse_flags.length > 0) {
                let html = '';
                data.abuse_flags.forEach(f => {
                    html += `
                        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 0.75rem 1rem; border-radius: 4px;">
                            <div style="font-weight: 700; color: #991b1b; font-size: 0.9rem;">${f.user_id}</div>
                            <div style="color: #b91c1c; font-size: 0.85rem; margin-top: 0.25rem;">${f.reason}</div>
                        </div>
                    `;
                });
                flagsContainer.innerHTML = html;
            } else {
                flagsContainer.innerHTML = '<div style="color: #10b981; font-size: 0.9rem; font-weight: 600;"><i class="fas fa-check-circle"></i> No abuse detected.</div>';
            }
        }
    } catch (e) {
        console.error("Failed to load analytics", e);
    }
}

function initializePermissionCenter(adminId) {
    const createForm = document.getElementById('permissionCreateForm');
    const dateInput = document.getElementById('permDate');
    const statusFilter = document.getElementById('permFilterStatus');
    const typeFilter = document.getElementById('permFilterType');
    const userFilter = document.getElementById('permFilterUserId');
    const dateFilter = document.getElementById('permFilterDate');
    const windowFilter = document.getElementById('permFilterWindow');
    const permissionTableBody = document.getElementById('permissionTableBody');
    const windowMode = document.getElementById('permWindowMode');
    const permissionType = document.getElementById('permType');
    const policyResult = document.getElementById('permPolicyResult');
    const priority = document.getElementById('permPriority');

    if (!createForm || !permissionTableBody) {
        return;
    }

    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    createForm.addEventListener('submit', (event) => {
        event.preventDefault();
        createPermissionFromForm(adminId);
    });

    if (windowMode) {
        windowMode.addEventListener('change', updatePermissionWindowInputs);
        updatePermissionWindowInputs();
    }

    if (permissionType) {
        permissionType.addEventListener('change', () => {
            applyPermissionPolicyPreset();
            updatePermissionWindowInputs();
            renderPermissionPolicyPreview();
        });
    }

    [policyResult, priority, document.getElementById('permCustomType'), ...Object.values(PERMISSION_POLICY_RULE_INPUTS).map((id) => document.getElementById(id))].forEach((el) => {
        if (!el) return;
        el.addEventListener('input', renderPermissionPolicyPreview);
        el.addEventListener('change', renderPermissionPolicyPreview);
    });

    const validityFilter = document.getElementById('permFilterValidity');

    [statusFilter, typeFilter, userFilter, dateFilter, windowFilter, validityFilter].forEach((el) => {
        if (!el) return;
        el.addEventListener('input', () => applyPermissionFilters());
        el.addEventListener('change', () => applyPermissionFilters());
    });

    permissionTableBody.addEventListener('click', async (event) => {
        const actionBtn = event.target.closest('button[data-perm-action]');
        if (!actionBtn) return;

        const permissionId = actionBtn.getAttribute('data-perm-id');
        const action = actionBtn.getAttribute('data-perm-action');
        if (!permissionId || !action) return;

        if (action === 'Delete') {
            const confirmation = confirm(`Are you sure you want to permanently delete permission #${permissionId}? This action cannot be undone.`);
            if (!confirmation) return;
            
            await deletePermission(adminId, permissionId);
        } else if (action === 'Approved') {
            window.currentPermissionDecisionId = permissionId;
            const request = allPermissionRows.find(r => String(r.id) === String(permissionId));
            
            if (!request) {
                alert('Error: Request details not found.');
                return;
            }
            
            if (request.type === 'custom') {
                // Show massive Custom Policy Builder form
                const row = event.target.closest('tr');
                if (row) {
                    const dateCell = row.cells[1]?.textContent;
                    if (dateCell && document.getElementById('pbDate')) {
                        document.getElementById('pbDate').value = dateCell.trim();
                    }
                }
                document.getElementById('policyBuilderModal').style.display = 'flex';
            } else {
                // Show clean Template Approval UI
                openTemplateApproval(request);
            }
        } else {
            // Reject
            const confirmation = confirm(`Mark permission #${permissionId} as ${action}?`);
            if (!confirmation) return;

            const adminReason = prompt('Optional admin note (reason for decision):', '') || '';
            await decidePermission(adminId, permissionId, action, adminReason);
        }
    });

    applyPermissionPolicyPreset();
    renderPermissionPolicyPreview();
    fetchPermissions(adminId);
}

// ==========================================
// TEMPLATE APPROVAL SYSTEM (NEW)
// ==========================================

const TEMPLATE_POLICIES = {
    'late_arrival': {
        modifier: 'LP', priority: 20,
        policy: { attendance_status: 'FD', require_face: true, require_gps: true, require_geofence: true, require_morning: true, require_evening: true, morning_deadline: null, evening_deadline: null }
    },
    'early_departure': {
        modifier: 'EP', priority: 20,
        policy: { attendance_status: 'FD', require_face: true, require_gps: true, require_geofence: true, require_morning: true, require_evening: true, morning_deadline: null, evening_deadline: null }
    },
    'extended_campus_exit': {
        modifier: 'ECE', priority: 20,
        policy: { attendance_status: 'FD', require_face: true, require_gps: true, require_geofence: false, require_morning: true, require_evening: true, morning_deadline: null, evening_deadline: null }
    },
    'half_day_morning': {
        modifier: 'HD-M', priority: 30,
        policy: { attendance_status: 'HD', require_face: true, require_gps: true, require_geofence: true, require_morning: false, require_evening: true, morning_deadline: null, evening_deadline: null }
    },
    'half_day_afternoon': {
        modifier: 'HD-A', priority: 30,
        policy: { attendance_status: 'HD', require_face: true, require_gps: true, require_geofence: true, require_morning: true, require_evening: false, morning_deadline: null, evening_deadline: null }
    },
    'work_from_home': {
        modifier: 'WFH', priority: 50,
        policy: { attendance_status: 'FD', require_face: true, require_gps: false, require_geofence: false, require_morning: true, require_evening: true, morning_deadline: null, evening_deadline: null }
    },
    'on_duty': {
        modifier: 'OD', priority: 40,
        policy: { attendance_status: 'FD', require_face: false, require_gps: false, require_geofence: false, require_morning: false, require_evening: false, morning_deadline: null, evening_deadline: null }
    },
    'outdoor_duty': {
        modifier: 'OUT', priority: 40,
        policy: { attendance_status: 'FD', require_face: true, require_gps: false, require_geofence: false, require_morning: true, require_evening: true, morning_deadline: null, evening_deadline: null }
    },
    'medical_leave': {
        modifier: 'ML', priority: 90,
        policy: { attendance_status: 'LV', require_face: false, require_gps: false, require_geofence: false, require_morning: false, require_evening: false, morning_deadline: null, evening_deadline: null }
    },
    'full_day_absence': {
        modifier: 'LV', priority: 80,
        policy: { attendance_status: 'LV', require_face: false, require_gps: false, require_geofence: false, require_morning: false, require_evening: false, morning_deadline: null, evening_deadline: null }
    },
    'emergency': {
        modifier: 'EMG', priority: 100,
        policy: { attendance_status: 'LV', require_face: false, require_gps: false, require_geofence: false, require_morning: false, require_evening: false, morning_deadline: null, evening_deadline: null }
    }
};

window.currentTemplateData = null;

// ==========================================
// DECISION TIMELINE LOGIC
// ==========================================

function openDecisionTimeline() {
    const request = window.currentTemplateData;
    if (!request) return;
    
    const timelineContent = document.getElementById('decisionTimelineContent');
    if (!timelineContent) return;
    
    let html = '';
    
    // Step 1: Submission
    const reqDateStr = request.timestamp || (request.date + ' 08:00 AM');
    html += `
        <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; position: relative;">
            <div style="width: 2px; background: #3b82f6; position: absolute; left: 15px; top: 30px; bottom: -20px;"></div>
            <div style="width: 32px; height: 32px; border-radius: 50%; background: #eff6ff; color: #3b82f6; display: flex; align-items: center; justify-content: center; z-index: 1;"><i class="fa-solid fa-paper-plane"></i></div>
            <div>
                <h4 style="margin: 0 0 0.25rem 0; font-size: 0.95rem; color: #0f172a;">Faculty Submitted</h4>
                <p style="margin: 0; font-size: 0.8rem; color: #64748b;">${reqDateStr}</p>
            </div>
        </div>
    `;

    // Step 2: Approval & Policy
    if (request.status === 'Approved') {
        html += `
            <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; position: relative;">
                <div style="width: 2px; background: #10b981; position: absolute; left: 15px; top: 30px; bottom: -20px;"></div>
                <div style="width: 32px; height: 32px; border-radius: 50%; background: #dcfce7; color: #10b981; display: flex; align-items: center; justify-content: center; z-index: 1;"><i class="fa-solid fa-check"></i></div>
                <div>
                    <h4 style="margin: 0 0 0.25rem 0; font-size: 0.95rem; color: #0f172a;">Admin Approved & Policy Generated</h4>
                    <p style="margin: 0; font-size: 0.8rem; color: #64748b;">By ${request.admin_id || 'Admin'} - Policy rules injected.</p>
                </div>
            </div>
        `;
    } else if (request.status === 'Rejected') {
        html += `
            <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; position: relative;">
                <div style="width: 32px; height: 32px; border-radius: 50%; background: #fee2e2; color: #ef4444; display: flex; align-items: center; justify-content: center; z-index: 1;"><i class="fa-solid fa-xmark"></i></div>
                <div>
                    <h4 style="margin: 0 0 0.25rem 0; font-size: 0.95rem; color: #0f172a;">Admin Rejected</h4>
                    <p style="margin: 0; font-size: 0.8rem; color: #64748b;">By ${request.admin_id || 'Admin'}</p>
                </div>
            </div>
        `;
    } else {
        html += `
            <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; position: relative;">
                <div style="width: 32px; height: 32px; border-radius: 50%; background: #fef3c7; color: #d97706; display: flex; align-items: center; justify-content: center; z-index: 1;"><i class="fa-solid fa-hourglass-half"></i></div>
                <div>
                    <h4 style="margin: 0 0 0.25rem 0; font-size: 0.95rem; color: #0f172a;">Pending Admin Review</h4>
                    <p style="margin: 0; font-size: 0.8rem; color: #64748b;">Waiting for decision</p>
                </div>
            </div>
        `;
    }

    // Step 3: Attendance Progress
    if (request.status === 'Approved' && request.attendance_progress) {
        const pM = request.attendance_progress.morning || 'Pending';
        const pE = request.attendance_progress.evening || 'Pending';
        const pF = request.attendance_progress.final || 'Pending';
        
        const mIcon = pM !== 'Pending' ? 'fa-check' : 'fa-clock';
        const mColor = pM !== 'Pending' ? '#10b981' : '#94a3b8';
        const mBg = pM !== 'Pending' ? '#dcfce7' : '#f1f5f9';

        html += `
            <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; position: relative;">
                <div style="width: 2px; background: ${pM !== 'Pending' ? '#10b981' : '#cbd5e1'}; position: absolute; left: 15px; top: 30px; bottom: -20px;"></div>
                <div style="width: 32px; height: 32px; border-radius: 50%; background: ${mBg}; color: ${mColor}; display: flex; align-items: center; justify-content: center; z-index: 1;"><i class="fa-solid ${mIcon}"></i></div>
                <div>
                    <h4 style="margin: 0 0 0.25rem 0; font-size: 0.95rem; color: #0f172a;">Morning Attendance Recorded</h4>
                    <p style="margin: 0; font-size: 0.8rem; color: #64748b;">Status: ${pM}</p>
                </div>
            </div>
        `;
        
        const eIcon = pE !== 'Pending' ? 'fa-check' : 'fa-clock';
        const eColor = pE !== 'Pending' ? '#10b981' : '#94a3b8';
        const eBg = pE !== 'Pending' ? '#dcfce7' : '#f1f5f9';
        html += `
            <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; position: relative;">
                <div style="width: 2px; background: ${pE !== 'Pending' ? '#10b981' : '#cbd5e1'}; position: absolute; left: 15px; top: 30px; bottom: -20px;"></div>
                <div style="width: 32px; height: 32px; border-radius: 50%; background: ${eBg}; color: ${eColor}; display: flex; align-items: center; justify-content: center; z-index: 1;"><i class="fa-solid ${eIcon}"></i></div>
                <div>
                    <h4 style="margin: 0 0 0.25rem 0; font-size: 0.95rem; color: #0f172a;">Evening Attendance Recorded</h4>
                    <p style="margin: 0; font-size: 0.8rem; color: #64748b;">Status: ${pE}</p>
                </div>
            </div>
        `;

        const fIcon = pF !== 'Pending' ? 'fa-flag-checkered' : 'fa-hourglass';
        const fColor = pF !== 'Pending' ? '#6366f1' : '#94a3b8';
        const fBg = pF !== 'Pending' ? '#e0e7ff' : '#f1f5f9';
        html += `
            <div style="display: flex; gap: 1rem; margin-bottom: 0; position: relative;">
                <div style="width: 32px; height: 32px; border-radius: 50%; background: ${fBg}; color: ${fColor}; display: flex; align-items: center; justify-content: center; z-index: 1;"><i class="fa-solid ${fIcon}"></i></div>
                <div>
                    <h4 style="margin: 0 0 0.25rem 0; font-size: 0.95rem; color: #0f172a;">Attendance Finalized</h4>
                    <p style="margin: 0; font-size: 0.8rem; color: #64748b;">Final Status: ${pF}</p>
                </div>
            </div>
        `;
    }
    
    timelineContent.innerHTML = html;
    document.getElementById('decisionTimelineModal').style.display = 'flex';
}

function openTemplateApproval(request) {
    window.currentTemplateData = request;
    
    // Set Summary Data
    document.getElementById('taReqFaculty').textContent = request.user_id;
    document.getElementById('taReqDate').textContent = request.date || '--';
    document.getElementById('taReqTime').textContent = (request.start_time && request.end_time) ? `${request.start_time} to ${request.end_time}` : (request.is_full_day ? 'Full Day' : '--');
    document.getElementById('taReqReason').textContent = request.reason || 'None provided';
    
    const proofLink = document.getElementById('taReqProof');
    if (request.document_path) {
        proofLink.innerHTML = `<a href="${request.document_path}" target="_blank" style="color: #2563eb; text-decoration: underline;">View Attachment</a>`;
    } else {
        proofLink.textContent = 'None';
    }

    // Determine Template
    const templateType = request.type || 'late_arrival';
    // Fallback to LP if unknown standard type, though it shouldn't happen
    const template = TEMPLATE_POLICIES[templateType] || TEMPLATE_POLICIES['late_arrival'];
    
    // Render Policy Rules Read-Only
    const rulesContainer = document.getElementById('taPolicyRules');
    const p = template.policy;
    
    let rulesHtml = '';
    if (p.require_face) rulesHtml += `<div><i class="fas fa-check" style="color: #10b981; margin-right: 6px;"></i> Face verification required</div>`;
    else rulesHtml += `<div><i class="fas fa-times" style="color: #64748b; margin-right: 6px;"></i> Face verification waived</div>`;
    
    const fromTime = request.start_time || '09:00';
    const untilTime = request.end_time || '18:00';

    if (request.type === 'extended_campus_exit') {
        rulesHtml += `<div><i class="fas fa-check" style="color: #10b981; margin-right: 6px;"></i> Outside Campus allowed ONLY during ${fromTime} - ${untilTime}</div>`;
    } else if (!p.require_gps || !p.require_geofence) {
        rulesHtml += `<div><i class="fas fa-check" style="color: #10b981; margin-right: 6px;"></i> Attendance may be marked outside campus</div>`;
    } else {
        rulesHtml += `<div><i class="fas fa-map-marker-alt" style="color: #64748b; margin-right: 6px;"></i> Must be on campus</div>`;
    }
    
    // Time rules

    if (p.require_morning) rulesHtml += `<div style="margin-top: 4px;"><i class="fas fa-clock" style="color: #3b82f6; margin-right: 6px;"></i> Morning mark required</div>`;
    else if (request.type === 'late_arrival') rulesHtml += `<div style="margin-top: 4px;"><i class="fas fa-clock" style="color: #3b82f6; margin-right: 6px;"></i> Attendance allowed until ${untilTime}</div>`;
    else rulesHtml += `<div style="margin-top: 4px;"><i class="fas fa-clock" style="color: #64748b; margin-right: 6px;"></i> Morning mark waived</div>`;

    if (p.require_evening) rulesHtml += `<div style="margin-top: 4px;"><i class="fas fa-clock" style="color: #3b82f6; margin-right: 6px;"></i> Evening checkout required</div>`;
    else if (request.type === 'early_departure') rulesHtml += `<div style="margin-top: 4px;"><i class="fas fa-clock" style="color: #3b82f6; margin-right: 6px;"></i> Checkout allowed from ${fromTime}</div>`;
    else rulesHtml += `<div style="margin-top: 4px;"><i class="fas fa-clock" style="color: #64748b; margin-right: 6px;"></i> Evening checkout waived (Second Mark Not Required)</div>`;

    rulesContainer.innerHTML = rulesHtml || '<div>No specific rules apply.</div>';

    // Hook up Attendance Progress logic
    const progM = document.getElementById('taProgMorning');
    const progE = document.getElementById('taProgEvening');
    const progF = document.getElementById('taProgFinal');
    
    if (request.attendance_progress) {
        progM.textContent = request.attendance_progress.morning || 'Pending';
        progE.textContent = request.attendance_progress.evening || 'Pending';
        progF.textContent = request.attendance_progress.final || 'Pending';
        
        progM.style.color = (progM.textContent !== 'Pending') ? '#10b981' : '#0f172a';
        progE.style.color = (progE.textContent !== 'Pending') ? '#10b981' : '#0f172a';
    } else {
        progM.textContent = 'Pending';
        progE.textContent = 'Pending';
        progF.textContent = 'Pending';
        progM.style.color = '#0f172a';
        progE.style.color = '#0f172a';
    }

    // Update Exception Name
    const templateLabel = TEMPLATE_POLICIES[templateType]?.label || templateType.replace('_', ' ').toUpperCase();
    document.getElementById('taModifier').textContent = `${templateLabel} (${template.modifier})`;

    // Editable limits
    const now = new Date();
    const isoDate = request.date ? request.date : now.toISOString().split('T')[0];
    // Default valid window to requested time if available
    document.getElementById('taValidFrom').value = request.start_time || '09:00';
    document.getElementById('taValidUntil').value = request.end_time || '18:00';
    document.getElementById('taRemarks').value = '';

    document.getElementById('templateApprovalModal').style.display = 'flex';
}

async function submitTemplatePolicy() {
    const request = window.currentTemplateData;
    if (!request) return;

    const btn = document.getElementById('taSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = 'Approving...';

    const templateType = request.type || 'late_arrival';
    const template = TEMPLATE_POLICIES[templateType] || TEMPLATE_POLICIES['late_arrival'];

    // Construct full date-time strings
    const reqDate = request.date || new Date().toISOString().split('T')[0];
    const timeFrom = document.getElementById('taValidFrom').value || '00:00';
    const timeUntil = document.getElementById('taValidUntil').value || '23:59';
    
    const validFrom = `${reqDate}T${timeFrom}:00`;
    const validUntil = `${reqDate}T${timeUntil}:00`;
    
    const payload = {
        admin_id: JSON.parse(localStorage.getItem('user'))?.id || 'ADMIN01',
        decision: 'Approved',
        decision_reason: 'Approved via standard template.',
        modifier: template.modifier,
        priority: template.priority,
        valid_from: validFrom,
        valid_until: validUntil,
        internal_notes: document.getElementById('taRemarks').value,
        effective_policy: template.policy
    };

    try {
        const response = await fetch(`/api/admin/permissions/${request.id}/decision`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Failed to approve');

        document.getElementById('templateApprovalModal').style.display = 'none';
        showPermissionFlash(`Request #${request.id} approved successfully!`, 'success');
        
        const adminId = JSON.parse(localStorage.getItem('user'))?.id || 'ADMIN01';
        fetchPermissions(adminId);
    } catch (e) {
        alert(e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Approve & Apply';
    }
}

function updatePermissionWindowInputs() {
    const mode = (document.getElementById('permWindowMode')?.value || 'TIME_RANGE').trim();
    const type = normalizePermissionType(document.getElementById('permType')?.value || '');
    const start = document.getElementById('permStartTime');
    const end = document.getElementById('permEndTime');
    const customWrap = document.getElementById('permCustomDaysWrap');
    const customTypeWrap = document.getElementById('permCustomTypeWrap');

    if (!start || !end || !customWrap) return;

    if (customTypeWrap) {
        customTypeWrap.style.display = type === 'custom' ? 'block' : 'none';
    }

    if (mode === 'FULL_DAY') {
        start.disabled = true;
        end.disabled = true;
        start.value = '';
        end.value = '';
        customWrap.style.display = 'none';
    } else if (mode === 'CUSTOM_DAYS') {
        start.disabled = false;
        end.disabled = false;
        customWrap.style.display = 'block';
    } else {
        start.disabled = false;
        end.disabled = false;
        customWrap.style.display = 'none';
    }

    renderPermissionPolicyPreview();
}

function normalizePermissionType(type) {
    const raw = String(type || '').trim();
    if (!raw) return '';
    const normalized = raw
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .toLowerCase();
    return PERMISSION_TYPE_ALIASES[normalized] || normalized;
}

function getPermissionPolicyDefinition(type, customType = '') {
    const normalized = normalizePermissionType(type);
    const policy = PERMISSION_POLICIES[normalized] || PERMISSION_POLICIES.custom;
    if (normalized === 'custom' && customType) {
        return { ...policy, label: customType };
    }
    return policy;
}

function applyPermissionPolicyPreset() {
    const typeInput = document.getElementById('permType');
    const policyResult = document.getElementById('permPolicyResult');
    const priority = document.getElementById('permPriority');
    const windowMode = document.getElementById('permWindowMode');
    const start = document.getElementById('permStartTime');
    const end = document.getElementById('permEndTime');
    const customType = document.getElementById('permCustomType')?.value || '';
    const policy = getPermissionPolicyDefinition(typeInput?.value || '', customType);

    if (policyResult) policyResult.value = policy.result;
    if (priority) priority.value = policy.priority;
    if (windowMode) windowMode.value = policy.windowMode;

    Object.entries(PERMISSION_POLICY_RULE_INPUTS).forEach(([rule, id]) => {
        const input = document.getElementById(id);
        if (input) input.checked = policy.rules.includes(rule);
    });

    if (start && policy.startTime) start.value = policy.startTime;
    if (end && policy.endTime) end.value = policy.endTime;
}

function collectPermissionOverrideRules() {
    return Object.entries(PERMISSION_POLICY_RULE_INPUTS)
        .filter(([, id]) => document.getElementById(id)?.checked)
        .map(([rule]) => rule);
}

function renderPermissionPolicyPreview() {
    const type = document.getElementById('permType')?.value || 'late_arrival';
    const customType = document.getElementById('permCustomType')?.value || '';
    const policy = getPermissionPolicyDefinition(type, customType);
    const selectedResult = document.getElementById('permPolicyResult')?.value || policy.result;
    const selectedRules = collectPermissionOverrideRules();
    const mode = document.getElementById('permWindowMode')?.value || policy.windowMode;

    const marks = selectedRules.includes('One mark enough') ? '1 mark' : policy.marks;
    const location = selectedRules.includes('Ignore GPS') || selectedRules.includes('Ignore radius') || selectedRules.includes('Ignore WiFi')
        ? 'Location relaxed'
        : policy.location;
    const timeRule = mode === 'FULL_DAY'
        ? 'Full day'
        : mode === 'CUSTOM_DAYS'
            ? 'Selected dates'
            : policy.timeRule;

    const resultEl = document.getElementById('permPreviewResult');
    const marksEl = document.getElementById('permPreviewMarks');
    const locationEl = document.getElementById('permPreviewLocation');
    const timeEl = document.getElementById('permPreviewTime');

    if (resultEl) resultEl.textContent = selectedResult;
    if (marksEl) marksEl.textContent = marks;
    if (locationEl) locationEl.textContent = location;
    if (timeEl) timeEl.textContent = timeRule;
}

function buildPermissionPolicyNote(baseNote) {
    const type = document.getElementById('permType')?.value || '';
    const customType = document.getElementById('permCustomType')?.value || '';
    const policy = getPermissionPolicyDefinition(type, customType);
    const result = document.getElementById('permPolicyResult')?.value || policy.result;
    const priority = document.getElementById('permPriority')?.value || policy.priority;
    const rules = collectPermissionOverrideRules();
    const noteParts = [
        baseNote ? `Admin note: ${baseNote}` : '',
        `Policy result: ${result}`,
        `Priority: ${priority}`,
        `Overrides: ${rules.length ? rules.join(', ') : 'Default rules'}`
    ];
    return noteParts.filter(Boolean).join(' | ');
}

function extractPolicyMeta(row) {
    const policy = getPermissionPolicyDefinition(row?.type || '', row?.custom_type || '');
    const notes = String(row?.admin_notes || row?.reason || '');
    const resultMatch = notes.match(/Policy result:\s*([^|]+)/i);
    const priorityMatch = notes.match(/Priority:\s*([^|]+)/i);
    const overridesMatch = notes.match(/Overrides:\s*([^|]+)/i);
    const overrides = overridesMatch
        ? overridesMatch[1].split(',').map((item) => item.trim()).filter(Boolean)
        : policy.rules;

    return {
        ...policy,
        result: resultMatch ? resultMatch[1].trim() : policy.result,
        priority: priorityMatch ? priorityMatch[1].trim() : policy.priority,
        rules: overrides
    };
}

function renderMiniChips(items, className) {
    const values = Array.isArray(items) && items.length ? items : ['Default rules'];
    return values
        .slice(0, 6)
        .map((item) => `<span class="${className}">${escapeHtml(item)}</span>`)
        .join('');
}

function getPermissionTypeClass(type) {
    const normalized = normalizePermissionType(type);
    return PERMISSION_POLICIES[normalized]?.className || 'custom';
}

function getCleanAdminNote(note) {
    const text = String(note || '').trim();
    if (!text) return '';
    const match = text.match(/Admin note:\s*([^|]+)/i);
    return match ? match[1].trim() : text.replace(/\s*\|\s*Policy result:.*$/i, '').trim();
}

async function fetchPermissions(adminId) {
    try {
        const response = await fetch(`/api/admin/permissions?admin_id=${encodeURIComponent(adminId)}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Failed to load permissions.');
        }

        allPermissionRows = Array.isArray(result.permissions) ? result.permissions : [];
        applyPermissionFilters();
    } catch (error) {
        console.error('Permission fetch error:', error);
        showPermissionFlash(error.message || 'Failed to load permissions.', 'error');
    }
}

function renderPermissionSummary(rows) {
    const total = rows.length;
    const pending = rows.filter((row) => row.status === 'Pending').length;
    const approved = rows.filter((row) => row.status === 'Approved').length;
    const rejected = rows.filter((row) => row.status === 'Rejected').length;

    const totalEl = document.getElementById('permStatTotal');
    const pendingEl = document.getElementById('permStatPending');
    const approvedEl = document.getElementById('permStatApproved');
    const rejectedEl = document.getElementById('permStatRejected');

    if (totalEl) totalEl.textContent = total;
    if (pendingEl) pendingEl.textContent = pending;
    if (approvedEl) approvedEl.textContent = approved;
    if (rejectedEl) rejectedEl.textContent = rejected;
}

function applyPermissionFilters() {
    const statusFilter = (document.getElementById('permFilterStatus')?.value || '').trim();
    const typeFilter = normalizePermissionType(document.getElementById('permFilterType')?.value || '');
    const userFilter = (document.getElementById('permFilterUserId')?.value || '').trim().toLowerCase();
    const dateFilter = (document.getElementById('permFilterDate')?.value || '').trim();
    const windowFilter = (document.getElementById('permFilterWindow')?.value || '').trim();
    const validityFilter = (document.getElementById('permFilterValidity')?.value || 'active').trim();

    const filtered = allPermissionRows.filter((row) => {
        const statusOk = !statusFilter || row.status === statusFilter;
        const typeOk = !typeFilter || normalizePermissionType(row.type || '') === typeFilter;
        const userOk = !userFilter || (row.user_id || '').toLowerCase().includes(userFilter);
        const dateOk = !dateFilter || row.date === dateFilter;
        const mode = getPermissionWindowMode(row);
        const windowOk = !windowFilter || mode === windowFilter;

        // Validity logic: checks if the policy applies to today/future, or if it's still pending
        let validityOk = true;
        if (validityFilter !== '') {
            const tzOffset = (new Date()).getTimezoneOffset() * 60000;
            const todayStr = (new Date(Date.now() - tzOffset)).toISOString().split('T')[0];
            
            let maxDate = row.date || '';
            if (row.custom_days) {
                const days = String(row.custom_days).split(',').map(d => d.trim()).sort();
                if (days.length > 0) maxDate = days[days.length - 1];
            }
            
            const isFutureOrToday = (maxDate >= todayStr);
            const isPending = row.status === 'Pending';
            const isActive = isFutureOrToday || isPending;

            if (validityFilter === 'active') {
                validityOk = isActive;
            } else if (validityFilter === 'expired') {
                validityOk = !isActive;
            }
        }

        return statusOk && typeOk && userOk && dateOk && windowOk && validityOk;
    });

    renderPermissionSummary(filtered);
    renderPermissionTable(filtered);
}

function renderPermissionTable(rows) {
    const tbody = document.getElementById('permissionTableBody');
    const countPill = document.getElementById('nxadmPermissionCountPill');
    
    if (countPill) countPill.textContent = `${rows.length} records`;
    if (!tbody) return;

    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:1.6rem !important; color:#64748b;">No exception policies match this filter.</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map((row) => {
        const statusClass = getStatusClass(row.status);
        const isPending = row.status === 'Pending';
        const policy = extractPolicyMeta(row);
        const safeReason = row.reason ? escapeHtml(row.reason) : 'No faculty reason recorded';
        const adminNote = getCleanAdminNote(row.admin_notes || '');
        const permissionType = formatPermissionType(row.type, row.custom_type);
        const statusLabel = formatStatusLabel(row.status || '-');
        const typeClass = getPermissionTypeClass(row.type);
        const overrideChips = renderMiniChips(policy.rules, 'permission-mini-chip');
        const proofLink = row.document_url || (row.document_path ? `/api/uploads/permissions/${encodeURIComponent(String(row.document_path).split('/').pop())}` : '');
        return `
            <tr>
                <td>${row.id}</td>
                <td>
                    <div style="display:flex; flex-direction:column; gap:0.1rem;">
                        <span style="font-weight:700; color:#0f172a;">${escapeHtml(row.name || row.user_id)}</span>
                        <span style="font-size:0.78rem; color:#64748b;">${escapeHtml(row.user_id || '')}</span>
                    </div>
                </td>
                <td>
                    <span class="permission-type-chip ${typeClass}">${escapeHtml(permissionType)}</span>
                    <div style="color:#64748b; font-size:0.78rem; line-height:1.45;">${safeReason}</div>
                    ${proofLink ? `
                      <a class="permission-proof-link" href="${escapeHtml(proofLink)}" target="_blank" rel="noopener noreferrer">
                        <i class="fa-solid fa-paperclip"></i>
                        <span>Open proof</span>
                      </a>
                    ` : ''}
                </td>
                <td>
                    <div style="font-weight:800; color:#0f172a;">${escapeHtml(row.date || '-')}</div>
                    <div style="color:#64748b; font-size:0.78rem;">${escapeHtml(getPermissionWindowLabel(row))}</div>
                </td>
                <td style="min-width: 220px; white-space: normal;">${overrideChips}</td>
                <td style="min-width: 190px;">
                    <span class="permission-policy-chip">${escapeHtml(policy.result)}</span>
                    <span class="permission-policy-chip">${escapeHtml(policy.priority)} priority</span>
                    ${adminNote ? `<div style="margin-top:0.35rem; color:#64748b; font-size:0.76rem; line-height:1.45;">${escapeHtml(adminNote)}</div>` : ''}
                </td>
                <td><span class="status-pill ${statusClass}">${escapeHtml(statusLabel)}</span></td>
                <td style="text-align:right; padding-right:0.75rem;">
                    ${isPending ? `
                    <div style="display:flex; gap:0.25rem; flex-wrap:wrap; justify-content:flex-end; align-items:center;">
                        <button data-perm-action="Approved" data-perm-id="${row.id}" class="action-btn-primary" style="padding:0.4rem 0.65rem; font-size:0.85rem; white-space:nowrap; display:inline-flex; align-items:center; justify-content:center;" title="Approve">
                            <i class="fa-solid fa-check" style="color:white;"></i>
                        </button>
                        <button data-perm-action="Rejected" data-perm-id="${row.id}" class="action-btn-danger" style="padding:0.4rem 0.65rem; font-size:0.85rem; white-space:nowrap; display:inline-flex; align-items:center; justify-content:center;" title="Reject">
                            <i class="fa-solid fa-xmark" style="color:white;"></i>
                        </button>
                        <button data-perm-action="Delete" data-perm-id="${row.id}" class="action-btn-danger" style="padding:0.4rem 0.65rem; font-size:0.85rem; background-color: #ef4444 !important; white-space:nowrap; display:inline-flex; align-items:center; justify-content:center;" title="Delete">
                            <i class="fa-solid fa-trash" style="color:white;"></i>
                        </button>
                    </div>
                    ` : `
                    <button data-perm-action="Delete" data-perm-id="${row.id}" class="action-btn-danger" style="padding:0.4rem 0.65rem; font-size:0.85rem; background-color: #ef4444 !important; white-space:nowrap; display:inline-flex; align-items:center; justify-content:center;" title="Delete Permission">
                        <i class="fa-solid fa-trash" style="color:white;"></i>
                    </button>
                    `}
                </td>
            </tr>
        `;
    }).join('');
}

async function createPermissionFromForm(adminId) {
    const userId = (document.getElementById('permUserId')?.value || '').trim();
    const type = (document.getElementById('permType')?.value || '').trim();
    const customType = (document.getElementById('permCustomType')?.value || '').trim();
    const date = (document.getElementById('permDate')?.value || '').trim();
    const reason = (document.getElementById('permReason')?.value || '').trim();
    const adminNote = (document.getElementById('permAdminNote')?.value || '').trim();
    const status = (document.getElementById('permDefaultStatus')?.value || 'Pending').trim();
    const windowMode = (document.getElementById('permWindowMode')?.value || 'TIME_RANGE').trim();
    const startTime = (document.getElementById('permStartTime')?.value || '').trim();
    const endTime = (document.getElementById('permEndTime')?.value || '').trim();
    const customDays = (document.getElementById('permCustomDays')?.value || '').trim();
    const policy = getPermissionPolicyDefinition(type, customType);
    const attendanceResult = (document.getElementById('permPolicyResult')?.value || policy.result).trim();
    const priority = (document.getElementById('permPriority')?.value || policy.priority).trim();
    const overrides = collectPermissionOverrideRules();

    if (!userId || !type || !date) {
        showPermissionFlash('Faculty ID, type, and date are required.', 'error');
        return;
    }

    if (normalizePermissionType(type) === 'custom' && !customType) {
        showPermissionFlash('Custom permission label is required.', 'error');
        return;
    }

    if (windowMode !== 'FULL_DAY' && (!startTime || !endTime)) {
        showPermissionFlash('Start and end time are required for timed permissions.', 'error');
        return;
    }

    if (windowMode !== 'FULL_DAY' && endTime <= startTime) {
        showPermissionFlash('End time must be later than start time.', 'error');
        return;
    }

    if (windowMode === 'CUSTOM_DAYS' && !customDays) {
        showPermissionFlash('Provide custom days in YYYY-MM-DD format (comma-separated).', 'error');
        return;
    }

    try {
        const response = await fetch('/api/admin/permissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_id: adminId,
                user_id: userId,
                type,
                custom_type: customType,
                date,
                start_time: windowMode === 'FULL_DAY' ? null : startTime,
                end_time: windowMode === 'FULL_DAY' ? null : endTime,
                is_full_day: windowMode === 'FULL_DAY',
                custom_days: windowMode === 'CUSTOM_DAYS' ? customDays : '',
                reason,
                status,
                attendance_result: attendanceResult,
                priority,
                overrides,
                admin_notes: buildPermissionPolicyNote(adminNote)
            })
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Failed to create permission.');
        }

        const form = document.getElementById('permissionCreateForm');
        if (form) form.reset();
        const dateInput = document.getElementById('permDate');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
        applyPermissionPolicyPreset();
        updatePermissionWindowInputs();
        renderPermissionPolicyPreview();

        showPermissionFlash('Exception policy saved successfully.', 'success');
        fetchPermissions(adminId);
    } catch (error) {
        console.error('Create permission error:', error);
        showPermissionFlash(error.message || 'Failed to save permission.', 'error');
    }
}

function getPermissionWindowMode(row) {
    if (row?.is_full_day) return 'FULL_DAY';
    if (row?.custom_days && String(row.custom_days).trim()) return 'CUSTOM_DAYS';
    return 'TIME_RANGE';
}

function getPermissionWindowLabel(row) {
    const mode = getPermissionWindowMode(row);
    if (mode === 'FULL_DAY') return 'Full Day';
    if (mode === 'CUSTOM_DAYS') {
        const timePart = row?.start_time && row?.end_time ? ` (${row.start_time}-${row.end_time})` : '';
        return `Custom Days${timePart}`;
    }
    if (row?.start_time && row?.end_time) return `${row.start_time} - ${row.end_time}`;
    return 'Time Not Set';
}

async function decidePermission(adminId, permissionId, decision, decisionReason) {
    try {
        const response = await fetch(`/api/admin/permissions/${permissionId}/decision`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_id: adminId,
                decision,
                decision_reason: decisionReason
            })
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Failed to update decision.');
        }

        showPermissionFlash(`Permission #${permissionId} ${decision.toLowerCase()}.`, 'success');
        fetchPermissions(adminId);
    } catch (error) {
        console.error('Permission decision error:', error);
        showPermissionFlash(error.message || 'Failed to update permission decision.', 'error');
    }
}

async function deletePermission(adminId, permissionId) {
    try {
        const response = await fetch(`/api/admin/permissions/${permissionId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_id: adminId
            })
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Failed to delete permission.');
        }

        showPermissionFlash(`Permission #${permissionId} deleted successfully.`, 'success');
        fetchPermissions(adminId);
    } catch (error) {
        console.error('Permission delete error:', error);
        showPermissionFlash(error.message || 'Failed to delete permission.', 'error');
    }
}

function showPermissionFlash(message, type = 'success') {
    const flash = document.getElementById('permFlash');
    if (!flash) return;

    flash.style.display = 'inline-flex';
    flash.style.alignItems = 'center';
    flash.style.gap = '0.5rem';
    flash.textContent = message;

    if (type === 'success') {
        flash.style.background = '#dcfce7';
        flash.style.color = '#166534';
        flash.style.border = '1px solid #86efac';
    } else {
        flash.style.background = '#fee2e2';
        flash.style.color = '#991b1b';
        flash.style.border = '1px solid #fca5a5';
    }

    window.clearTimeout(flash._timer);
    flash._timer = window.setTimeout(() => {
        flash.style.display = 'none';
    }, 3200);
}

function escapeHtml(input) {
    const raw = String(input || '');
    return raw
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function initFacultyDashboard() {
    const user = JSON.parse(localStorage.getItem('user'));
    
    // Check if we are viewing as Admin
    const urlParams = new URLSearchParams(window.location.search);
    const viewUserId = urlParams.get('view_user'); 
    
    let targetUserId = user ? user.id : null;
    let isViewer = false;

    if (viewUserId) {
        // Admin viewing someone else
        const adminUser = JSON.parse(localStorage.getItem('user'));
        if (!adminUser || adminUser.role !== 'admin') {
            alert("Unauthorized View");
            window.location.href = 'login.html';
            return;
        }
        targetUserId = viewUserId;
        isViewer = true;
    } else if (!user) {
        // Not logged in at all
        window.location.href = 'login.html';
        return;
    }

    // Start background location tracking for faculty users (not for admins viewing)
    if (!isViewer && user && user.role === 'faculty') {
        console.log('[Dashboard] Starting background location tracking for faculty...');
        if (window.startLocationTracking) {
            try {
                await window.startLocationTracking();
                console.log('[Dashboard] ✅ Background location tracking started');
                
                // Show tracking status badge
                const trackingBadge = document.getElementById('trackingStatusBadge');
                if (trackingBadge) {
                    trackingBadge.style.display = 'inline-flex';
                    trackingBadge.title = '📍 Location tracking is ACTIVE and PERSISTENT\n✓ Will survive force-close\n✓ Will survive cache clear\n✓ Will restart after reboot';
                    console.log('[Dashboard] 📍 Tracking status badge displayed');
                }
                
                // Verify notification persistence
                if (window.verifyNotificationPersistence) {
                    window.verifyNotificationPersistence();
                }
            } catch (e) {
                console.error('[Dashboard] Failed to start tracking:', e);
            }
        }
    } else if (user && user.role === 'faculty') {
        // Even when viewing as admin, hide the tracking badge for clarity
        const trackingBadge = document.getElementById('trackingStatusBadge');
        if (trackingBadge) {
            trackingBadge.style.display = 'none';
        }
    }

    // Set Initial User Info (if viewing self)
    if (!isViewer && user) {
        const nameEl = document.getElementById('facultyName');
        const roleEl = document.getElementById('facultyDept');
        if (nameEl) nameEl.textContent = user.name;
        if (roleEl) roleEl.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
    }

    try {
        // Fetch viewed user's details if in viewer mode
        if (isViewer) {
            const userDetailsResponse = await fetch(`/api/users/${targetUserId}`);
            const userDetailsData = await userDetailsResponse.json();
            if (userDetailsData.success && userDetailsData.user) {
                document.getElementById('facultyName').textContent = userDetailsData.user.name;
                document.getElementById('facultyDept').textContent = userDetailsData.user.role.charAt(0).toUpperCase() + userDetailsData.user.role.slice(1);
            }
        }

        const response = await fetch(`/api/dashboard/faculty/${targetUserId}`);
        const data = await response.json();
        
        // Hide Scan Button for non-owner viewing
        if (isViewer) {
            const scanBtn = document.querySelector('a[href="scan.html"]');
            if(scanBtn) scanBtn.style.display = 'none';
        }

        // --- Update Status Cards ---
        const todayDateEl = document.getElementById('todayDate');
        const checkInTimeEl = document.getElementById('checkInTime');
        const checkOutTimeEl = document.getElementById('checkOutTime');
        const statusEl = document.getElementById('todayStatus');

        if (todayDateEl) {
            todayDateEl.textContent = new Date().toLocaleDateString('en-US', { 
                weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
            });
        }

        if (checkInTimeEl) {
            checkInTimeEl.textContent = data.last_check_in || "--:--";
            checkInTimeEl.style.color = (data.last_check_in && data.last_check_in !== '--:--') ? 'var(--success-color)' : '#64748b';
        }

        if (checkOutTimeEl) {
            checkOutTimeEl.textContent = data.last_check_out || "--:--";
            checkOutTimeEl.style.color = (data.last_check_out && data.last_check_out !== '--:--') ? 'var(--warning-color)' : '#64748b';
        }

        if (statusEl) {
            const status = data.current_status || "Not Marked";
            const normalizedCurrentStatus = formatStatusLabel(status);
            statusEl.textContent = normalizedCurrentStatus;
            
            // Color logic
            const statusLower = normalizedCurrentStatus.toLowerCase();
            if (statusLower.includes('present') || statusLower.includes('on time') || statusLower.includes('checked in')) statusEl.style.color = 'var(--success-color)';
            else if (statusLower.includes('late') || statusLower.includes('early')) statusEl.style.color = 'var(--warning-color)';
            else if (statusLower.includes('absent') || statusLower.includes("didn't mark")) statusEl.style.color = 'var(--danger-color)';
            else statusEl.style.color = 'var(--text-secondary)';
        }

        // --- Update History Table ---
        const tbody = document.getElementById('myAttendanceHistory');
        if (tbody) {
            tbody.innerHTML = '';
            
            if (!data.logs || data.logs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">No attendance history found.</td></tr>';
            } else {
                data.logs.forEach(log => {
                    const row = document.createElement('tr');
                    const normalizedLogStatus = formatStatusLabel(log.status || 'Not Marked');
                    
                    let statusClass = 'status-present';
                    const statusText = normalizedLogStatus.toLowerCase();
                    if (statusText.includes('absent') || statusText.includes("didn't mark")) statusClass = 'status-absent';
                    if (statusText.includes('late') || statusText.includes('early')) statusClass = 'status-late';

                    row.innerHTML = `
                        <td>${log.date}</td>
                        <td style="font-weight: 500;">${log.time_in || '--:--'}</td>
                        <td style="color: #64748b;">${log.time_out || '--:--'}</td>
                        <td>${log.duration || '-'}</td> <!-- Backend not yet computing duration, need update if required -->
                        <td><span class="status-pill ${statusClass}">${normalizedLogStatus}</span></td>
                    `;
                    tbody.appendChild(row);
                });
            }
        }

    } catch (error) {
        console.error("Failed to load faculty dashboard:", error);
    }
}

function getStatusClass(status) {
    if (!status) return '';
    const s = status.toLowerCase();
    if (s.includes('approved') || s.includes('on time') || s.includes('checked in') || s.includes('checked out')) return 'status-present';
    if (s.includes('pending')) return 'status-late';
    if (s.includes('rejected')) return 'status-absent';
    if (s.includes('late')) return 'status-late';
    if (s.includes('early')) return 'status-late'; // Orange for early too
    if (s.includes('granted') || s.includes('on-time')) return 'status-present';
    if (s.includes("didn't mark") || s.includes('absent')) return 'status-absent';
    return 'status-absent';
}

function formatPermissionType(type, customType = '') {
    const normalized = normalizePermissionType(type);
    if (normalized === 'custom' && customType) return customType;
    return PERMISSION_POLICIES[normalized]?.label || String(type || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '-';
}

function formatStatusLabel(status) {
    const value = String(status || '').trim();
    const normalized = value.toLowerCase().replace(/[_-]+/g, ' ');
    const map = {
        'on time': 'On Time',
        'on-time': 'On Time',
        'late permission': 'Late Permission',
        'early departure': 'Early Departure',
        "didn't mark": "Didn't Mark",
        'not marked': 'Not Marked',
        'checked in': 'Checked In',
        'checked out': 'Checked Out',
        'present': 'Present',
        'late': 'Late',
        'absent': 'Absent',
        'pending': 'Pending',
        'approved': 'Approved',
        'rejected': 'Rejected'
    };

    return map[normalized] || value || '-';
}
