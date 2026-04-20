// Admin Management JavaScript

let admins = [];
let invites = [];
let auditLog = [];

function validatePasswordPolicy(password) {
    const pwd = String(password || '');
    if (pwd.length < 8 || pwd.length > 64) {
        return 'Password must be 8-64 characters.';
    }
    if (/\s/.test(pwd)) {
        return 'Password cannot contain spaces.';
    }
    if (!/[A-Z]/.test(pwd)) {
        return 'Password must include at least one uppercase letter.';
    }
    if (!/[a-z]/.test(pwd)) {
        return 'Password must include at least one lowercase letter.';
    }
    if (!/[0-9]/.test(pwd)) {
        return 'Password must include at least one number.';
    }
    if (!/[^A-Za-z0-9]/.test(pwd)) {
        return 'Password must include at least one special symbol.';
    }
    return null;
}

function getPasswordScore(password) {
    const pwd = String(password || '');
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[a-z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
    return score;
}

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    await loadAdmins();
    await loadAuditLog();

    const adminPasswordInput = document.getElementById('adminPassword');
    const adminPasswordStrength = document.getElementById('adminPasswordStrength');
    const toggleAdminPassword = document.getElementById('toggleAdminPassword');

    const updateStrength = (value) => {
        if (!adminPasswordStrength) return;
        const score = getPasswordScore(value);
        const label = score >= 5 ? 'Strong' : score >= 3 ? 'Medium' : score > 0 ? 'Weak' : 'Not set';
        const color = score >= 5 ? '#15803d' : score >= 3 ? '#b45309' : score > 0 ? '#b91c1c' : '#64748b';
        adminPasswordStrength.innerHTML = `<i class="fa-solid fa-shield"></i> Strength: ${label}`;
        adminPasswordStrength.style.color = color;
    };

    if (adminPasswordInput) {
        adminPasswordInput.addEventListener('input', (e) => updateStrength(e.target.value));
        updateStrength(adminPasswordInput.value || '');
    }

    if (toggleAdminPassword && adminPasswordInput) {
        toggleAdminPassword.addEventListener('click', () => {
            const isPwd = adminPasswordInput.type === 'password';
            adminPasswordInput.type = isPwd ? 'text' : 'password';
            toggleAdminPassword.innerHTML = isPwd
                ? '<i class="fa-regular fa-eye-slash"></i>'
                : '<i class="fa-regular fa-eye"></i>';
        });
    }
    
    // Set interval to refresh data every 10 seconds
    setInterval(() => {
        loadAdmins();
    }, 10000);
});

// ============================================
// LOAD FUNCTIONS
// ============================================

async function loadAdmins() {
    try {
        const response = await fetch('/api/list_admins', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error('Failed to load admins');
        
        const data = await response.json();
        admins = data.admins || [];
        renderAdmins();
    } catch (error) {
        console.error('Error loading admins:', error);
        showToast('Failed to load admins list', 'error');
    }
}

async function loadAuditLog() {
    try {
        const response = await fetch('/api/admin_audit_log', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error('Failed to load audit log');
        
        const data = await response.json();
        auditLog = data.logs || [];
        renderAuditLog();
    } catch (error) {
        console.error('Error loading audit log:', error);
    }
}

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderAdmins() {
    const adminsList = document.getElementById('adminsList');
    
    if (admins.length === 0) {
        adminsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"><i class="fa-solid fa-user-tie"></i></div>
                <h3>No Admins Yet</h3>
                <p>Start by creating your first administrator account</p>
            </div>
        `;
        return;
    }

    adminsList.innerHTML = admins.map(admin => `
        <div class="admin-card" style="animation: slideUp 0.5s ease-out;">
            <div class="admin-info">
                <div class="admin-avatar">${getInitials(admin.name)}</div>
                <div class="admin-details">
                    <h4>${admin.name}</h4>
                    <p>ID: ${admin.user_id}</p>
                </div>
            </div>
            
            <div class="admin-meta">
                <div class="meta-item">
                    <p class="meta-label">Status</p>
                    <span class="${admin.is_active ? 'status-active' : 'status-inactive'}">
                        <span class="status-dot"></span>
                        ${admin.is_active ? 'Active' : 'Inactive'}
                    </span>
                </div>
                <div class="meta-item">
                    <p class="meta-label">Created</p>
                    <p class="meta-value">${formatDate(admin.created_at)}</p>
                </div>
                <div class="meta-item">
                    <p class="meta-label">Last Active</p>
                    <p class="meta-value">${admin.last_active ? formatDate(admin.last_active) : 'Never'}</p>
                </div>
            </div>
            
            <div class="admin-actions">
                <button title="View Details" onclick="viewAdminDetails('${admin.user_id}')">
                    <i class="fa-solid fa-eye"></i>
                </button>
                <button title="Edit Admin" onclick="editAdmin('${admin.user_id}')">
                    <i class="fa-solid fa-pen"></i>
                </button>
                ${admin.is_active ? `
                    <button class="danger" title="Deactivate" onclick="deactivateAdmin('${admin.user_id}', '${admin.name}')">
                        <i class="fa-solid fa-ban"></i>
                    </button>
                ` : `
                    <button title="Reactivate" onclick="reactivateAdmin('${admin.user_id}', '${admin.name}')">
                        <i class="fa-solid fa-check"></i>
                    </button>
                `}
                <button class="danger" title="Delete Permanently" onclick="deleteAdmin('${admin.user_id}', '${admin.name}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function renderAuditLog() {
    const auditLogContainer = document.getElementById('auditLog');
    
    if (auditLog.length === 0) {
        auditLogContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"><i class="fa-solid fa-history"></i></div>
                <h3>No Activity Yet</h3>
                <p>Actions will appear here as they happen</p>
            </div>
        `;
        return;
    }

    auditLogContainer.innerHTML = `
        <div class="audit-timeline">
            ${auditLog.slice(0, 20).map(log => {
                const icons = {
                    'admin_created': 'fa-user-plus',
                    'invite_sent': 'fa-envelope',
                    'invite_accepted': 'fa-check',
                    'admin_activated': 'fa-toggle-on',
                    'admin_deactivated': 'fa-toggle-off',
                    'admin_edited': 'fa-pen'
                };
                
                const icon = icons[log.action] || 'fa-history';
                
                return `
                    <div class="audit-item">
                        <div class="audit-icon">
                            <i class="fa-solid ${icon}"></i>
                        </div>
                        <div class="audit-content">
                            <h4>${capitalize(log.action.replace(/_/g, ' '))}</h4>
                            <p>${log.description}</p>
                            <div class="audit-time">
                                <i class="fa-solid fa-clock"></i>
                                ${formatRelativeTime(log.created_at)}
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// ============================================
// FORM SUBMISSION FUNCTIONS
// ============================================

async function submitCreateAdmin() {
    const name = document.getElementById('adminName').value.trim();
    const user_id = document.getElementById('adminId').value.trim();
    const password = document.getElementById('adminPassword').value;
    const email = document.getElementById('adminEmail').value.trim();

    if (!name || !user_id || !password) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    if (user_id.includes(' ')) {
        showToast('Admin ID cannot contain spaces', 'error');
        return;
    }

    const passwordError = validatePasswordPolicy(password);
    if (passwordError) {
        showToast(passwordError, 'error');
        return;
    }

    try {
        const response = await fetch('/api/create_admin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                user_id,
                password,
                email,
                created_by: localStorage.getItem('user_id') || 'ADMIN01'
            })
        });

        const data = await response.json();

        if (!response.ok) {
            showToast(data.error || 'Failed to create admin', 'error');
            return;
        }

        showToast(`Admin "${name}" created successfully! They should login to register their face on first login.`, 'success');
        document.getElementById('createAdminForm').reset();
        closeCreateModal();
        
        await loadAdmins();
        await loadAuditLog();
    } catch (error) {
        console.error('Error creating admin:', error);
        showToast('Error creating admin', 'error');
    }
}

async function submitInviteAdmin() {
    const email = document.getElementById('inviteEmail').value.trim();
    const name = document.getElementById('inviteName').value.trim();
    const expiry = document.getElementById('inviteExpiry').value;

    if (!email || !name) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    try {
        const response = await fetch('/api/invite_admin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                recipient_email: email,
                recipient_name: name,
                expiry_period: expiry,
                created_by: localStorage.getItem('user_id') || 'ADMIN01'
            })
        });

        const data = await response.json();

        if (!response.ok) {
            showToast(data.error || 'Failed to send invite', 'error');
            return;
        }

        showToast(`Invitation sent to ${email}!`, 'success');
        document.getElementById('inviteAdminForm').reset();
        closeInviteModal();
        await loadInvites();
        await loadAuditLog();
    } catch (error) {
        console.error('Error sending invite:', error);
        showToast('Error sending invite', 'error');
    }
}

// ============================================
// ACTION FUNCTIONS
// ============================================

async function deactivateAdmin(user_id, name) {
    if (!confirm(`Are you sure you want to deactivate ${name}? They won't be able to log in.`)) {
        return;
    }

    try {
        const response = await fetch('/api/deactivate_admin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                user_id,
                current_user: localStorage.getItem('user_id') || 'ADMIN01'
            })
        });

        const data = await response.json();

        if (!response.ok) {
            showToast(data.error || 'Failed to deactivate admin', 'error');
            return;
        }

        showToast(`${name} has been deactivated`, 'success');
        await loadAdmins();
        await loadAuditLog();
    } catch (error) {
        console.error('Error deactivating admin:', error);
        showToast('Error deactivating admin', 'error');
    }
}

async function reactivateAdmin(user_id, name) {
    try {
        const response = await fetch('/api/reactivate_admin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                user_id,
                current_user: localStorage.getItem('user_id') || 'ADMIN01'
            })
        });

        const data = await response.json();

        if (!response.ok) {
            showToast(data.error || 'Failed to reactivate admin', 'error');
            return;
        }

        showToast(`${name} has been reactivated`, 'success');
        await loadAdmins();
        await loadAuditLog();
    } catch (error) {
        console.error('Error reactivating admin:', error);
        showToast('Error reactivating admin', 'error');
    }
}

async function deleteAdmin(user_id, name) {
    if (!confirm(`⚠️ WARNING: You are about to PERMANENTLY DELETE ${name}.\n\nThis action cannot be undone. Are you absolutely sure?`)) {
        return;
    }

    // Second confirmation for safety
    if (!confirm(`This will permanently remove ${name} and all their data.\n\nType YES to confirm deletion.`)) {
        return;
    }

    try {
        const response = await fetch('/api/delete_admin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                user_id,
                current_user: localStorage.getItem('user_id') || 'ADMIN01'
            })
        });

        const data = await response.json();

        if (!response.ok) {
            showToast(data.error || 'Failed to delete admin', 'error');
            return;
        }

        showToast(`Admin '${name}' has been permanently deleted`, 'success');
        await loadAdmins();
        await loadAuditLog();
    } catch (error) {
        console.error('Error deleting admin:', error);
        showToast('Error deleting admin', 'error');
    }
}

async function cancelInvite(invite_code) {
    if (!confirm('Cancel this invitation? The recipient will no longer be able to accept it.')) {
        return;
    }

    try {
        const response = await fetch('/api/cancel_invite', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ invite_code })
        });

        const data = await response.json();

        if (!response.ok) {
            showToast(data.error || 'Failed to cancel invite', 'error');
            return;
        }

        showToast('Invitation cancelled', 'success');
        await loadInvites();
        await loadAuditLog();
    } catch (error) {
        console.error('Error cancelling invite:', error);
        showToast('Error cancelling invite', 'error');
    }
}

async function resendInviteEmail(invite_code) {
    try {
        const response = await fetch('/api/resend_invite', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ invite_code })
        });

        const data = await response.json();

        if (!response.ok) {
            showToast(data.error || 'Failed to resend invite', 'error');
            return;
        }

        showToast('Invitation resent successfully', 'success');
    } catch (error) {
        console.error('Error resending invite:', error);
        showToast('Error resending invite', 'error');
    }
}

function copyInviteLink(invite_code) {
    const inviteLink = `${window.location.origin}/pages/accept_invite.html?code=${invite_code}`;
    navigator.clipboard.writeText(inviteLink).then(() => {
        showToast('Invite link copied to clipboard!', 'success');
    });
}

async function refreshAuditLog() {
    await loadAuditLog();
    showToast('Audit log refreshed', 'info');
}

// Placeholder functions for future implementation
function viewAdminDetails(user_id) {
    console.log('View admin details:', user_id);
    showToast('Admin details feature coming soon', 'info');
}

function editAdmin(user_id) {
    console.log('Edit admin:', user_id);
    showToast('Edit admin feature coming soon', 'info');
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getInitials(text) {
    return text
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatRelativeTime(dateString) {
    if (!dateString) return 'Unknown';
    
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    
    return formatDate(dateString);
}

function capitalize(text) {
    return text
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        'success': 'fa-check-circle',
        'error': 'fa-exclamation-circle',
        'info': 'fa-info-circle'
    };
    
    const icon = icons[type] || 'fa-info-circle';
    const colors = {
        'success': '#10b981',
        'error': '#ef4444',
        'info': '#2563eb'
    };
    
    toast.innerHTML = `
        <i class="fa-solid ${icon}" style="color: ${colors[type]};"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
