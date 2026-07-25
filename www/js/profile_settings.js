// profile_settings.js
// Handles displaying the user profile settings modal, editing details (partial updates), and 1-click face capture.

document.addEventListener('DOMContentLoaded', () => {
    // Inject minimalist, premium Profile Modal HTML into the DOM
    const profileModalHTML = `
    <div id="profileSettingsModal" class="profile-modal-overlay" style="display: none;">
        <div class="modal-content profile-modal-content">
            <div class="profile-modal-header">
                <h2>Profile Settings</h2>
                <button class="profile-close-btn" id="closeProfileModal" aria-label="Close Profile Settings"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="modal-body profile-modal-body">
                
                <div class="profile-tabs">
                    <button class="profile-tab-btn active" data-tab="profile-details-tab">Account Details</button>
                    <button class="profile-tab-btn" data-tab="profile-face-tab">Face ID</button>
                </div>
                
                <div class="profile-status-message" id="profileStatusMessage" style="display:none;"></div>

                <!-- DETAILS TAB -->
                <div id="profile-details-tab" class="profile-tab-content active">
                    <p class="profile-instruction">Update only the fields you wish to change. Leave everything else blank.</p>
                    
                    <form id="profileUpdateForm">
                        <div class="profile-input-wrapper">
                            <label>Full Name</label>
                            <input type="text" id="profName" placeholder="Enter new full name">
                        </div>

                        <div class="profile-input-wrapper">
                            <label>Employee ID</label>
                            <input type="text" id="profUserId" placeholder="Enter new Employee ID">
                            <small class="field-hint">Changing this logs you out instantly.</small>
                        </div>

                        <div class="profile-email-section">
                            <div class="profile-input-wrapper read-only-wrapper">
                                <label>Current Email</label>
                                <input type="email" id="profCurrentEmail" readonly disabled>
                            </div>
                            <div class="profile-input-wrapper">
                                <label>New Email</label>
                                <input type="email" id="profNewEmail" placeholder="Enter new email address">
                            </div>
                        </div>

                        <div class="profile-input-wrapper">
                            <label>New Password</label>
                            <div style="position: relative;">
                                <input type="password" id="profPassword" placeholder="••••••••" style="padding-right: 2.5rem;">
                                <button type="button" id="profTogglePass" aria-label="Toggle password visibility" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #94a3b8; cursor: pointer; padding: 0; font-size: 1.1rem; display: flex; align-items: center;">
                                    <i class="fa-regular fa-eye" id="profEyeIcon"></i>
                                </button>
                            </div>
                            <div id="profPassStrengthContainer" style="display: none; margin-top: 0.75rem;">
                                <div style="display: flex; gap: 4px; margin-bottom: 0.4rem;">
                                    <div class="prof-strength-bar" id="profBar1" style="height: 4px; flex: 1; background: #e2e8f0; border-radius: 2px; transition: background 0.3s;"></div>
                                    <div class="prof-strength-bar" id="profBar2" style="height: 4px; flex: 1; background: #e2e8f0; border-radius: 2px; transition: background 0.3s;"></div>
                                    <div class="prof-strength-bar" id="profBar3" style="height: 4px; flex: 1; background: #e2e8f0; border-radius: 2px; transition: background 0.3s;"></div>
                                    <div class="prof-strength-bar" id="profBar4" style="height: 4px; flex: 1; background: #e2e8f0; border-radius: 2px; transition: background 0.3s;"></div>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem;">
                                    <span id="profStrengthText" style="font-weight: 600; color: #64748b;">Strength</span>
                                </div>
                            </div>
                            <small class="field-hint" id="profPassHint" style="margin-top: 0.5rem; display: block;">Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 symbol.</small>
                        </div>
                        
                        <div class="profile-form-actions">
                            <button type="submit" class="btn-profile-primary" id="saveProfileBtn">Save Changes</button>
                        </div>
                    </form>
                </div>

                <!-- FACE CAPTURE TAB -->
                <div id="profile-face-tab" class="profile-tab-content" style="display: none;">
                    <p class="profile-instruction" style="text-align: center; margin-bottom: 1.5rem;">Add or update your facial recognition profile. Please look directly at the camera and ensure good lighting.</p>
                    
                    <div class="profile-camera-container">
                        <div class="profile-camera-frame">
                            <video id="profFaceVideo" autoplay playsinline muted style="display:none;"></video>
                            <canvas id="profFaceCanvas" style="display:none;"></canvas>
                            <div id="profFacePrompt" class="profile-camera-prompt">
                                <i class="fa-solid fa-camera fa-2x"></i>
                                <span>Camera Offline</span>
                            </div>
                        </div>
                        
                        <div class="profile-camera-actions">
                            <button type="button" class="btn-profile-primary" id="profStartCameraBtn">Start Camera</button>
                            <button type="button" class="btn-profile-capture" id="profCaptureBtn" style="display:none;"><i class="fa-solid fa-camera"></i> Capture Face</button>
                            <button type="button" class="btn-profile-success" id="profSaveFaceBtn" style="display:none;">Save Face ID</button>
                            <button type="button" class="btn-profile-secondary" id="profRetakeFaceBtn" style="display:none;">Retake</button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', profileModalHTML);

    // Setup elements
    const profileModal = document.getElementById('profileSettingsModal');
    const closeBtn = document.getElementById('closeProfileModal');
    const tabBtns = document.querySelectorAll('.profile-tab-btn');
    const tabContents = document.querySelectorAll('.profile-tab-content');
    const updateForm = document.getElementById('profileUpdateForm');
    const statusMsg = document.getElementById('profileStatusMessage');

    // Tab Switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.style.display = 'none');
            
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).style.display = 'block';
        });
    });

    // Add Profile Button to Navbar robustly next to the hamburger menu
    const menuToggle = document.querySelector('.menu-toggle');
    if (menuToggle) {
        const profileBtnHTML = `
            <button id="openProfileSettings" class="profile-nav-btn" aria-label="Profile Settings" title="Profile Settings">
                <i class="fa-regular fa-user"></i>
            </button>
        `;
        
        if (menuToggle.parentElement.classList.contains('mobile-nav-actions')) {
            // Admin dashboard already has the wrapper
            menuToggle.insertAdjacentHTML('beforebegin', profileBtnHTML);
        } else {
            // Faculty dashboard lacks the wrapper, so we create it to preserve flexbox layout
            const wrapper = document.createElement('div');
            wrapper.className = 'mobile-nav-actions';
            wrapper.style.display = 'flex';
            wrapper.style.alignItems = 'center';
            wrapper.style.gap = '1rem';
            
            menuToggle.parentNode.insertBefore(wrapper, menuToggle);
            wrapper.appendChild(menuToggle);
            wrapper.insertAdjacentHTML('afterbegin', profileBtnHTML);
        }
    }

    const openProfileBtn = document.getElementById('openProfileSettings');
    
    // Open Modal
    if (openProfileBtn) {
        openProfileBtn.addEventListener('click', () => {
            const user = JSON.parse(localStorage.getItem('user'));
            if (!user) return;
            
            // Show placeholders/read-only info, clear new inputs
            document.getElementById('profName').placeholder = user.name || 'Enter new full name';
            document.getElementById('profName').value = '';
            
            document.getElementById('profUserId').placeholder = user.user_id || user.id || 'Enter new Employee ID';
            document.getElementById('profUserId').value = '';
            
            document.getElementById('profCurrentEmail').value = user.email || 'No initial email linked';
            document.getElementById('profNewEmail').value = '';
            
            const passInput = document.getElementById('profPassword');
            passInput.value = '';
            passInput.type = 'password';
            document.getElementById('profEyeIcon').className = 'fa-regular fa-eye';
            document.getElementById('profPassStrengthContainer').style.display = 'none';
            document.getElementById('profPassHint').style.display = 'block';
            
            statusMsg.style.display = 'none';
            profileModal.style.display = 'flex';
        });
    }

    // Password Toggle & Strength Logic
    const togglePassBtn = document.getElementById('profTogglePass');
    const passInput = document.getElementById('profPassword');
    const eyeIcon = document.getElementById('profEyeIcon');
    const strengthContainer = document.getElementById('profPassStrengthContainer');
    const strengthText = document.getElementById('profStrengthText');
    const passHint = document.getElementById('profPassHint');
    const bars = [
        document.getElementById('profBar1'),
        document.getElementById('profBar2'),
        document.getElementById('profBar3'),
        document.getElementById('profBar4')
    ];

    if (togglePassBtn && passInput) {
        togglePassBtn.addEventListener('click', () => {
            if (passInput.type === 'password') {
                passInput.type = 'text';
                eyeIcon.className = 'fa-regular fa-eye-slash';
            } else {
                passInput.type = 'password';
                eyeIcon.className = 'fa-regular fa-eye';
            }
        });
    }

    if (passInput) {
        passInput.addEventListener('input', (e) => {
            const val = e.target.value;
            if (val.length === 0) {
                strengthContainer.style.display = 'none';
                passHint.style.display = 'block';
                return;
            }
            strengthContainer.style.display = 'block';
            passHint.style.display = 'none';

            let score = 0;
            if (val.length > 5) score += 1;
            if (val.length >= 8) score += 1;
            if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score += 1;
            if (/[0-9]/.test(val) && /[^A-Za-z0-9]/.test(val)) score += 1;

            // Reset bars
            bars.forEach(b => b.style.background = '#e2e8f0');

            if (score <= 1) {
                bars[0].style.background = '#ef4444'; // Red
                strengthText.textContent = 'Strength: Weak';
                strengthText.style.color = '#ef4444';
            } else if (score === 2) {
                bars[0].style.background = '#f59e0b'; // Orange
                bars[1].style.background = '#f59e0b';
                strengthText.textContent = 'Strength: Fair';
                strengthText.style.color = '#f59e0b';
            } else if (score === 3) {
                bars[0].style.background = '#10b981'; // Green
                bars[1].style.background = '#10b981';
                bars[2].style.background = '#10b981';
                strengthText.textContent = 'Strength: Good';
                strengthText.style.color = '#10b981';
            } else {
                bars.forEach(b => b.style.background = '#059669'); // Dark Green
                strengthText.textContent = 'Strength: Strong';
                strengthText.style.color = '#059669';
            }
        });
    }

    // Close Modal Logic
    const closeAndCleanup = () => {
        profileModal.style.display = 'none';
        profStopCamera();
    };

    if (closeBtn) closeBtn.addEventListener('click', closeAndCleanup);
    if (profileModal) {
        profileModal.addEventListener('click', (e) => {
            if (e.target === profileModal) closeAndCleanup();
        });
    }

    function showProfileStatus(msg, type = 'error') {
        statusMsg.style.display = 'block';
        statusMsg.textContent = msg;
        statusMsg.className = `profile-status-message ${type}`;
        setTimeout(() => { statusMsg.style.display = 'none'; }, 5000);
    }

    // Submit Profile Details Update (Partial Updates)
    if (updateForm) {
        updateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const user = JSON.parse(localStorage.getItem('user'));
            if (!user) return;

            const nameVal = document.getElementById('profName').value.trim();
            const idVal = document.getElementById('profUserId').value.trim();
            const emailVal = document.getElementById('profNewEmail').value.trim();
            const passVal = document.getElementById('profPassword').value;

            // If absolutely nothing was entered, just show a message
            if (!nameVal && !idVal && !emailVal && !passVal) {
                showProfileStatus('No changes were entered.', 'error');
                return;
            }

            const submitBtn = document.getElementById('saveProfileBtn');
            const oldText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

            const payload = {};
            if (idVal) payload.user_id = idVal;
            if (nameVal) payload.name = nameVal;
            if (emailVal) payload.email = emailVal;
            if (passVal) payload.password = passVal;

            try {
                const response = await fetch(`/api/users/${user.user_id || user.id}/profile`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();

                if (result.success) {
                    if (payload.user_id && payload.user_id !== (user.user_id || user.id)) {
                        showProfileStatus('Employee ID changed. Logging you out...', 'success');
                        setTimeout(() => {
                            localStorage.clear();
                            window.location.href = 'login.html';
                        }, 1500);
                        return;
                    }

                    showProfileStatus('Profile updated successfully! Syncing...', 'success');
                    localStorage.setItem('user', JSON.stringify(result.user));
                    if (result.user.name) localStorage.setItem('user_name', result.user.name);
                    
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } else {
                    showProfileStatus(result.message || 'Update failed', 'error');
                }
            } catch (error) {
                console.error('Update error:', error);
                showProfileStatus('Server error occurred.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = oldText;
            }
        });
    }

    // --- Face Capture Logic (Single Shot) ---
    let profStream = null;
    let profCapturedImageData = null;
    
    const profVideo = document.getElementById('profFaceVideo');
    const profCanvas = document.getElementById('profFaceCanvas');
    const profPrompt = document.getElementById('profFacePrompt');
    const profStartBtn = document.getElementById('profStartCameraBtn');
    const profCaptureBtn = document.getElementById('profCaptureBtn');
    const profSaveFaceBtn = document.getElementById('profSaveFaceBtn');
    const profRetakeFaceBtn = document.getElementById('profRetakeFaceBtn');

    async function profStartCamera() {
        try {
            profStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            profVideo.srcObject = profStream;
            
            profPrompt.style.display = 'none';
            profCanvas.style.display = 'none';
            profVideo.style.display = 'block';
            
            profStartBtn.style.display = 'none';
            profSaveFaceBtn.style.display = 'none';
            profRetakeFaceBtn.style.display = 'none';
            profCaptureBtn.style.display = 'inline-block';
            
        } catch (err) {
            console.error('Camera Error:', err);
            alert('Camera access denied. Please enable camera permissions.');
        }
    }

    function profStopCamera() {
        if (profStream) {
            profStream.getTracks().forEach(track => track.stop());
            profStream = null;
        }
        if (profVideo) profVideo.srcObject = null;
        
        if (profStartBtn) {
            profCanvas.style.display = 'none';
            profVideo.style.display = 'none';
            profPrompt.style.display = 'flex';
            
            profCaptureBtn.style.display = 'none';
            profSaveFaceBtn.style.display = 'none';
            profRetakeFaceBtn.style.display = 'none';
            profStartBtn.style.display = 'inline-block';
        }
        profCapturedImageData = null;
    }

    if (profStartBtn) profStartBtn.onclick = profStartCamera;
    
    if (profRetakeFaceBtn) profRetakeFaceBtn.onclick = profStartCamera;

    if (profCaptureBtn) {
        profCaptureBtn.onclick = () => {
            if (!profStream) return;
            const ctx = profCanvas.getContext('2d');
            profCanvas.width = profVideo.videoWidth;
            profCanvas.height = profVideo.videoHeight;
            ctx.drawImage(profVideo, 0, 0);
            profCapturedImageData = profCanvas.toDataURL('image/jpeg', 0.95);
            
            // Stop stream and show picture
            profStream.getTracks().forEach(track => track.stop());
            profStream = null;
            profVideo.style.display = 'none';
            profCanvas.style.display = 'block';
            
            profCaptureBtn.style.display = 'none';
            profSaveFaceBtn.style.display = 'inline-block';
            profRetakeFaceBtn.style.display = 'inline-block';
        };
    }

    if (profSaveFaceBtn) {
        profSaveFaceBtn.addEventListener('click', async () => {
            const user = JSON.parse(localStorage.getItem('user'));
            if (!user || !profCapturedImageData) return;

            profSaveFaceBtn.disabled = true;
            profRetakeFaceBtn.disabled = true;
            profSaveFaceBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

            try {
                const response = await fetch(`/api/users/${user.user_id || user.id}/face`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ face_image: profCapturedImageData })
                });
                const result = await response.json();

                if (result.success) {
                    showProfileStatus(result.message || 'Face data updated successfully!', 'success');
                    setTimeout(() => {
                        closeAndCleanup();
                    }, 2500);
                } else {
                    showProfileStatus(result.message || 'Face update failed', 'error');
                }
            } catch (error) {
                console.error('Face save error:', error);
                showProfileStatus('Server error occurred.', 'error');
            } finally {
                profSaveFaceBtn.disabled = false;
                profRetakeFaceBtn.disabled = false;
                profSaveFaceBtn.textContent = 'Save Face ID';
            }
        });
    }

});
