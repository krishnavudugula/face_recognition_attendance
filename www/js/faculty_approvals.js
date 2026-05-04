// Faculty Registration Approval Management

let pendingRegistrations = [];
let currentAction = null;
let currentUserId = null;

// Load pending registrations on page load
async function loadPendingRegistrations() {
    try {
        const response = await fetch('/api/admin/pending_faculty_registrations', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (result.success) {
            pendingRegistrations = result.registrations || [];
            renderRegistrationsTable();
        } else {
            console.error('Failed to load registrations:', result.message);
            document.getElementById('registrationTableBody').innerHTML = `
                <tr>
                    <td colspan="5" style="padding: 2rem; text-align: center; color: #dc2626;">
                        <i class="fa-solid fa-exclamation-triangle" style="margin-right: 0.5rem;"></i> Failed to load registrations
                    </td>
                </tr>
            `;
        }
    } catch (err) {
        console.error('Error loading registrations:', err);
        document.getElementById('registrationTableBody').innerHTML = `
            <tr>
                <td colspan="5" style="padding: 2rem; text-align: center; color: #dc2626;">
                    <i class="fa-solid fa-exclamation-triangle" style="margin-right: 0.5rem;"></i> Network error
                </td>
            </tr>
        `;
    }
}

function renderRegistrationsTable() {
    const tableBody = document.getElementById('registrationTableBody');
    const badge = document.getElementById('registrationBadge');
    const pendingCount = document.getElementById('pendingCount');

    if (pendingRegistrations.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="padding: 2rem; text-align: center; color: #94a3b8;">
                    <i class="fa-solid fa-check-circle" style="margin-right: 0.5rem; color: #059669;"></i>
                    No pending registrations. All faculty are approved!
                </td>
            </tr>
        `;
        badge.style.display = 'none';
        return;
    }

    badge.style.display = 'block';
    pendingCount.textContent = pendingRegistrations.length;

    tableBody.innerHTML = pendingRegistrations.map(reg => {
        const submittedDate = new Date(reg.submitted_at);
        const formattedDate = submittedDate.toLocaleDateString() + ' ' + submittedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return `
            <tr style="border-bottom: 1px solid #e2e8f0; transition: background 0.2s;">
                <td style="padding: 1rem; color: #0f172a; font-weight: 600; font-size: 0.9rem;">${reg.user_id}</td>
                <td style="padding: 1rem; color: #0f172a; font-size: 0.9rem;">${reg.name}</td>
                <td style="padding: 1rem; color: #0f172a; font-size: 0.9rem;">${reg.email}</td>
                <td style="padding: 1rem; color: #64748b; font-size: 0.85rem;">${formattedDate}</td>
                <td style="padding: 1rem; text-align: center;">
                    <div style="display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap;">
                        <button type="button" onclick="openApprovalModal('${reg.user_id}')" class="btn-approve" style="
                            padding: 0.5rem 1rem;
                            background: #059669;
                            color: white;
                            border: none;
                            border-radius: 6px;
                            font-weight: 600;
                            font-size: 0.8rem;
                            cursor: pointer;
                            transition: background 0.2s;
                        ">
                            <i class="fa-solid fa-check" style="margin-right: 0.3rem;"></i> Approve
                        </button>
                        <button type="button" onclick="openRejectionModal('${reg.user_id}')" class="btn-reject" style="
                            padding: 0.5rem 1rem;
                            background: #dc2626;
                            color: white;
                            border: none;
                            border-radius: 6px;
                            font-weight: 600;
                            font-size: 0.8rem;
                            cursor: pointer;
                            transition: background 0.2s;
                        ">
                            <i class="fa-solid fa-times" style="margin-right: 0.3rem;"></i> Reject
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function openApprovalModal(userId) {
    currentAction = 'approve';
    currentUserId = userId;
    const modal = document.getElementById('registrationActionModal');
    const title = document.getElementById('modalTitle');
    const message = document.getElementById('modalMessage');
    const rejectionDiv = document.getElementById('rejectionReason');
    const confirmBtn = document.getElementById('confirmActionBtn');

    const user = pendingRegistrations.find(u => u.user_id === userId);

    title.textContent = `Approve Faculty Registration?`;
    message.textContent = `Approve ${user.name} (${user.user_id}) to join the system. They will be able to login and mark attendance.`;
    rejectionDiv.style.display = 'none';
    confirmBtn.textContent = 'Approve';
    confirmBtn.style.background = '#059669';
    confirmBtn.onclick = () => submitApprovalAction();

    modal.style.display = 'flex';
}

function openRejectionModal(userId) {
    currentAction = 'reject';
    currentUserId = userId;
    const modal = document.getElementById('registrationActionModal');
    const title = document.getElementById('modalTitle');
    const message = document.getElementById('modalMessage');
    const rejectionDiv = document.getElementById('rejectionReason');
    const confirmBtn = document.getElementById('confirmActionBtn');

    const user = pendingRegistrations.find(u => u.user_id === userId);

    title.textContent = `Reject Faculty Registration?`;
    message.textContent = `Reject the registration for ${user.name} (${user.user_id}). They will not be able to access the system.`;
    rejectionDiv.style.display = 'block';
    document.getElementById('rejectionNotes').value = '';
    confirmBtn.textContent = 'Reject';
    confirmBtn.style.background = '#dc2626';
    confirmBtn.onclick = () => submitApprovalAction();

    modal.style.display = 'flex';
}

function closeRegistrationModal() {
    document.getElementById('registrationActionModal').style.display = 'none';
    currentAction = null;
    currentUserId = null;
}

async function submitApprovalAction() {
    if (!currentUserId || !currentAction) return;

    const adminId = localStorage.getItem('user_id') || 'ADMIN01';
    const confirmBtn = document.getElementById('confirmActionBtn');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.3rem;"></i> Processing...';

    try {
        const endpoint = currentAction === 'approve' 
            ? '/api/admin/approve_faculty'
            : '/api/admin/reject_faculty';

        const payload = {
            admin_id: adminId,
            user_id: currentUserId
        };

        if (currentAction === 'reject') {
            payload.notes = document.getElementById('rejectionNotes').value || '';
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.success) {
            // Remove from pending list and refresh table
            pendingRegistrations = pendingRegistrations.filter(u => u.user_id !== currentUserId);
            renderRegistrationsTable();
            closeRegistrationModal();
            
            // Show success message
            showSuccessNotification(result.message);
        } else {
            alert('Error: ' + (result.message || 'Action failed'));
        }
    } catch (err) {
        console.error('Error submitting action:', err);
        alert('Network error. Please try again.');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = currentAction === 'approve' ? 'Approve' : 'Reject';
    }
}

function showSuccessNotification(message) {
    // Create a temporary notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        background: #059669;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        z-index: 2000;
        animation: slideIn 0.3s ease;
    `;
    notification.innerHTML = `<i class="fa-solid fa-check-circle" style="margin-right: 0.5rem;"></i> ${message}`;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Auto-load registrations when the admin dashboard is opened
document.addEventListener('DOMContentLoaded', function() {
    // Only load if we're on the admin dashboard
    if (document.getElementById('registrationTableBody')) {
        loadPendingRegistrations();
        
        // Reload every 30 seconds
        setInterval(loadPendingRegistrations, 30000);
    }
});
