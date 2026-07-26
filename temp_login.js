
        let faceCaptureData = null;
        function validateUserIdPolicy(userId) {
            const value = String(userId || '').trim();
            if (!value) return 'Employee ID is required.';
            return null;
        }

        function validatePasswordPolicy(password, userId = '') {
            const pwd = String(password || '');
            if (pwd.length < 8 || pwd.length > 64) return 'Password must be 8-64 characters.';
            if (/\s/.test(pwd)) return 'Password cannot contain spaces.';
            if (!/[A-Z]/.test(pwd)) return 'Password must include at least one uppercase letter.';
            if (!/[a-z]/.test(pwd)) return 'Password must include at least one lowercase letter.';
            if (!/[0-9]/.test(pwd)) return 'Password must include at least one number.';
            if (!/[^A-Za-z0-9]/.test(pwd)) return 'Password must include at least one special symbol.';
            const normalizedUserId = String(userId || '').trim().toLowerCase();
            if (normalizedUserId.length >= 3 && pwd.toLowerCase().includes(normalizedUserId)) {
                return 'Password cannot contain the Employee ID.';
            }
            return null;
        }

        function scorePassword(password, userId = '') {
            const pwd = String(password || '');
            if (!pwd) return { score: 0, label: 'Not set', color: '#64748b' };

            let score = 0;
            if (pwd.length >= 8) score += 1;
            if (/[A-Z]/.test(pwd)) score += 1;
            if (/[a-z]/.test(pwd)) score += 1;
            if (/[0-9]/.test(pwd)) score += 1;
            if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
            if (/\s/.test(pwd)) score = Math.max(0, score - 1);
            const normalizedUserId = String(userId || '').trim().toLowerCase();
            if (normalizedUserId.length >= 3 && pwd.toLowerCase().includes(normalizedUserId)) {
                score = Math.max(0, score - 1);
            }

            if (score >= 5) return { score: 3, label: 'Strong', color: '#15803d' };
            if (score >= 3) return { score: 2, label: 'Medium', color: '#b45309' };
            return { score: 1, label: 'Weak', color: '#b91c1c' };
        }

        function updateFieldHelper(helperId, message, tone = '') {
            const helper = document.getElementById(helperId);
            if (!helper) return;
            helper.textContent = message;
            helper.classList.remove('error', 'success');
            if (tone) helper.classList.add(tone);
        }

        function updateRegisterPasswordStrength(password, userId = '') {
            const container = document.getElementById('regPasswordStrength');
            if (!container) return;
            const bars = Array.from(container.querySelectorAll('.password-strength-bars span'));
            const label = container.querySelector('.password-strength-label');
            const result = scorePassword(password, userId);
            const palette = result.label === 'Strong'
                ? ['#86efac', '#4ade80', '#15803d']
                : result.label === 'Medium'
                    ? ['#fde68a', '#f59e0b', '#b45309']
                    : result.label === 'Weak'
                        ? ['#fecaca', '#f87171', '#b91c1c']
                        : ['#e5e7eb', '#e5e7eb', '#e5e7eb'];

            bars.forEach((bar, index) => {
                const active = index < result.score;
                bar.classList.toggle('active', active);
                bar.style.background = active ? palette[index] : '#e5e7eb';
            });

            if (label) {
                label.textContent = `Strength: ${result.label}`;
                label.style.color = result.color;
            }
        }

        // Toggle between login and register forms
        document.getElementById('loginToggle').addEventListener('click', function() {
            document.getElementById('loginForm').style.display = 'block';
            document.getElementById('registerForm').style.display = 'none';
            document.getElementById('loginToggle').classList.add('active');
            document.getElementById('registerToggle').classList.remove('active');
        });

        document.getElementById('registerToggle').addEventListener('click', function() {
            document.getElementById('loginForm').style.display = 'none';
            document.getElementById('registerForm').style.display = 'block';
            document.getElementById('loginToggle').classList.remove('active');
            document.getElementById('registerToggle').classList.add('active');
        });

        document.getElementById('backToLogin').addEventListener('click', function(e) {
            e.preventDefault();
            document.getElementById('loginToggle').click();
        });

        document.getElementById('regPasswordToggle')?.addEventListener('click', function() {
            const pwdInput = document.getElementById('regPassword');
            if (pwdInput.type === 'password') {
                pwdInput.type = 'text';
                this.classList.remove('fa-eye');
                this.classList.add('fa-eye-slash');
            } else {
                pwdInput.type = 'password';
                this.classList.remove('fa-eye-slash');
                this.classList.add('fa-eye');
            }
        });

        const regUserIdInput = document.getElementById('regUserId');
        const regPasswordInput = document.getElementById('regPassword');
        if (regUserIdInput) {
            regUserIdInput.addEventListener('input', function() {
                const value = this.value.trim();
                const message = validateUserIdPolicy(value);
                updateFieldHelper(
                    'regUserIdHelper',
                    message || 'Looks good.',
                    message ? 'error' : (value ? 'success' : '')
                );
                updateRegisterPasswordStrength(regPasswordInput?.value || '', value);
            });
        }

        if (regPasswordInput) {
            regPasswordInput.addEventListener('input', function() {
                const userId = regUserIdInput?.value || '';
                const message = validatePasswordPolicy(this.value, userId);
                updateRegisterPasswordStrength(this.value, userId);
                updateFieldHelper(
                    'regPasswordHelper',
                    message || 'Password meets all requirements.',
                    message ? 'error' : (this.value ? 'success' : '')
                );
            });
            updateRegisterPasswordStrength(regPasswordInput.value || '', regUserIdInput?.value || '');
        }

        // Face Capture
        let mediaStream = null;
        let faceCaptureBlob = null;

        document.getElementById('captureFaceBtn').addEventListener('click', async function() {
            const video = document.getElementById('regFaceVideo');
            const canvas = document.getElementById('regFaceCanvas');
            const prompt = document.getElementById('faceCapturePrompt');
            const status = document.getElementById('faceCaptureStatus');
            const captureBtn = this;
            const retakeBtn = document.getElementById('retakeFaceBtn');

            try {
                if (!mediaStream) {
                    mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
                    video.srcObject = mediaStream;
                    video.play();
                    prompt.style.display = 'none';
                    video.style.display = 'block';
                    captureBtn.innerHTML = '<i class="fa-solid fa-circle" style="margin-right: 0.5rem;"></i> Take Photo';
                } else {
                    // Take the photo
                    const ctx = canvas.getContext('2d');
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    ctx.drawImage(video, 0, 0);

                    // Convert canvas to blob
                    canvas.toBlob(function(blob) {
                        faceCaptureBlob = blob;
                        faceCaptureData = canvas.toDataURL('image/jpeg');
                        
                        // Stop camera
                        mediaStream.getTracks().forEach(track => track.stop());
                        mediaStream = null;
                        
                        video.style.display = 'none';
                        canvas.style.display = 'block';
                        prompt.style.display = 'none';
                        status.style.display = 'block';
                        
                        captureBtn.innerHTML = '<i class="fa-solid fa-camera" style="margin-right: 0.5rem;"></i> Capture Face';
                        retakeBtn.style.display = 'flex';
                    }, 'image/jpeg', 0.9);
                }
            } catch (err) {
                console.error('Camera Error:', err);
                alert('Camera access denied. Please enable camera permission.');
            }
        });

        document.getElementById('retakeFaceBtn').addEventListener('click', function() {
            faceCaptureData = null;
            faceCaptureBlob = null;
            
            const video = document.getElementById('regFaceVideo');
            const canvas = document.getElementById('regFaceCanvas');
            const prompt = document.getElementById('faceCapturePrompt');
            const status = document.getElementById('faceCaptureStatus');
            const captureBtn = document.getElementById('captureFaceBtn');
            
            canvas.style.display = 'none';
            video.style.display = 'none';
            prompt.style.display = 'block';
            status.style.display = 'none';
            
            captureBtn.innerHTML = '<i class="fa-solid fa-camera" style="margin-right: 0.5rem;"></i> Capture Face';
            this.style.display = 'none';
        });

        // Faculty Registration Form Submission
        document.getElementById('registerForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const userId = document.getElementById('regUserId').value.trim();
            const name = document.getElementById('regName').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value;
            const statusDiv = document.getElementById('registerStatus');
            const submitBtn = document.getElementById('submitRegisterBtn');

            if (!faceCaptureData) {
                statusDiv.style.display = 'block';
                statusDiv.style.background = '#fee2e2';
                statusDiv.style.color = '#dc2626';
                statusDiv.innerHTML = '<i class="fa-solid fa-exclamation-circle" style="margin-right: 0.5rem;"></i> Please capture your face first';
                return;
            }

            const userIdError = validateUserIdPolicy(userId);
            if (userIdError) {
                updateFieldHelper('regUserIdHelper', userIdError, 'error');
                statusDiv.style.display = 'block';
                statusDiv.style.background = '#fee2e2';
                statusDiv.style.color = '#dc2626';
                statusDiv.innerHTML = `<i class="fa-solid fa-exclamation-circle" style="margin-right: 0.5rem;"></i> ${userIdError}`;
                return;
            }

            const passwordError = validatePasswordPolicy(password, userId);
            if (passwordError) {
                updateFieldHelper('regPasswordHelper', passwordError, 'error');
                statusDiv.style.display = 'block';
                statusDiv.style.background = '#fee2e2';
                statusDiv.style.color = '#dc2626';
                statusDiv.innerHTML = `<i class="fa-solid fa-exclamation-circle" style="margin-right: 0.5rem;"></i> ${passwordError}`;
                return;
            }

            submitBtn.disabled = true;
            statusDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i> Submitting registration...';
            statusDiv.style.display = 'block';
            statusDiv.style.background = '#dbeafe';
            statusDiv.style.color = '#0369a1';

            try {
                const response = await fetch('/api/faculty_self_register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: userId,
                        name: name,
                        email: email,
                        password: password,
                        face_image: faceCaptureData
                    })
                });

                const result = await response.json();

                if (result.success) {
                    statusDiv.style.background = '#d1fae5';
                    statusDiv.style.color = '#059669';
                    statusDiv.innerHTML = `<i class="fa-solid fa-check-circle" style="margin-right: 0.5rem;"></i> Registration submitted! Awaiting admin approval.`;
                    
                    // Reset form
                    setTimeout(() => {
                        document.getElementById('registerForm').reset();
                        faceCaptureData = null;
                        document.getElementById('regFaceVideo').style.display = 'none';
                        document.getElementById('faceCapturePrompt').style.display = 'block';
                        document.getElementById('faceCaptureStatus').style.display = 'none';
                        document.getElementById('retakeFaceBtn').style.display = 'none';
                        document.getElementById('loginToggle').click();
                    }, 2000);
                } else {
                    statusDiv.style.background = '#fee2e2';
                    statusDiv.style.color = '#dc2626';
                    statusDiv.innerHTML = `<i class="fa-solid fa-exclamation-circle" style="margin-right: 0.5rem;"></i> ${result.message}`;
                }
            } catch (err) {
                console.error('Registration Error:', err);
                statusDiv.style.background = '#fee2e2';
                statusDiv.style.color = '#dc2626';
                statusDiv.innerHTML = '<i class="fa-solid fa-exclamation-circle" style="margin-right: 0.5rem;"></i> Registration failed. Please try again.';
            } finally {
                submitBtn.disabled = false;
            }
        });

        // --- HELP PORTAL LOGIC ---
        document.addEventListener('DOMContentLoaded', () => {
            const helpSignInBtn = document.getElementById('helpSignInBtn');
            const helpModal = document.getElementById('helpModal');
            const closeHelpModalBtn = document.getElementById('closeHelpModalBtn');
            const helpModalSubtitle = document.getElementById('helpModalSubtitle');

            const stepSelection = document.getElementById('helpSelectionStep');
            const stepEmail = document.getElementById('helpEmailStep');
            const stepOtp = document.getElementById('helpOtpStep');
            const stepResetPwd = document.getElementById('helpResetPwdStep');
            const stepShowId = document.getElementById('helpShowIdStep');

            const btnForgotPwd = document.getElementById('btnForgotPwd');
            const btnForgotId = document.getElementById('btnForgotId');
            const btnSendOtp = document.getElementById('btnSendOtp');
            const btnBackToSelection = document.getElementById('btnBackToSelection');
            const btnVerifyOtp = document.getElementById('btnVerifyOtp');
            const btnSaveNewPwd = document.getElementById('btnSaveNewPwd');
            const btnProceedToLogin = document.getElementById('btnProceedToLogin');

            let currentHelpAction = ''; // 'PASSWORD_RESET' or 'ID_RECOVERY'
            let currentHelpEmail = '';

            function resetHelpModal() {
                stepSelection.style.display = 'block';
                stepEmail.style.display = 'none';
                stepOtp.style.display = 'none';
                stepResetPwd.style.display = 'none';
                stepShowId.style.display = 'none';
                helpModalSubtitle.textContent = 'How can we help you today?';
                document.getElementById('helpEmailInput').value = '';
                document.getElementById('helpOtpInput').value = '';
                document.getElementById('helpNewPwd').value = '';
                document.getElementById('helpConfirmPwd').value = '';
                btnSendOtp.textContent = 'Send OTP';
                btnSendOtp.disabled = false;
            }

            if (helpSignInBtn) {
                helpSignInBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    resetHelpModal();
                    helpModal.style.display = 'flex';
                });
            }

            if (closeHelpModalBtn) {
                closeHelpModalBtn.addEventListener('click', () => {
                    helpModal.style.display = 'none';
                });
            }

            if (btnBackToSelection) {
                btnBackToSelection.addEventListener('click', () => {
                    resetHelpModal();
                });
            }

            if (btnForgotPwd) {
                btnForgotPwd.addEventListener('click', () => {
                    currentHelpAction = 'PASSWORD_RESET';
                    helpModalSubtitle.textContent = 'Enter your email to reset password';
                    stepSelection.style.display = 'none';
                    stepEmail.style.display = 'block';
                });
            }

            if (btnForgotId) {
                btnForgotId.addEventListener('click', () => {
                    currentHelpAction = 'ID_RECOVERY';
                    helpModalSubtitle.textContent = 'Enter your email to recover your ID';
                    stepSelection.style.display = 'none';
                    stepEmail.style.display = 'block';
                });
            }

            if (btnSendOtp) {
                btnSendOtp.addEventListener('click', async () => {
                    const email = document.getElementById('helpEmailInput').value.trim();
                    if (!email) {
                        alert('Please enter your email address');
                        return;
                    }

                    btnSendOtp.disabled = true;
                    btnSendOtp.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';

                    try {
                        const response = await fetch('/api/auth/forgot-help', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email, action: currentHelpAction })
                        });
                        const data = await response.json();

                        if (data.success) {
                            currentHelpEmail = email;
                            document.getElementById('displaySentEmail').textContent = email;
                            helpModalSubtitle.textContent = 'Enter the OTP sent to your email';
                            stepEmail.style.display = 'none';
                            stepOtp.style.display = 'block';
                        } else {
                            alert(data.message || 'Failed to send OTP');
                            btnSendOtp.disabled = false;
                            btnSendOtp.textContent = 'Send OTP';
                        }
                    } catch (error) {
                        console.error(error);
                        alert('Server error occurred while sending OTP');
                        btnSendOtp.disabled = false;
                        btnSendOtp.textContent = 'Send OTP';
                    }
                });
                
                // Add Enter key support
                const emailInput = document.getElementById('helpEmailInput');
                if (emailInput) {
                    emailInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            btnSendOtp.click();
                        }
                    });
                }
            }

            if (btnVerifyOtp) {
                btnVerifyOtp.addEventListener('click', async () => {
                    const otp = document.getElementById('helpOtpInput').value.trim();
                    if (otp.length !== 6) {
                        alert('Please enter a valid 6-digit OTP');
                        return;
                    }

                    btnVerifyOtp.disabled = true;
                    btnVerifyOtp.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';

                    try {
                        const response = await fetch('/api/auth/verify-otp', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: currentHelpEmail, otp, action: currentHelpAction })
                        });
                        const data = await response.json();

                        if (data.success) {
                            stepOtp.style.display = 'none';
                            if (currentHelpAction === 'PASSWORD_RESET') {
                                helpModalSubtitle.textContent = 'Create a new secure password';
                                stepResetPwd.style.display = 'block';
                            } else if (currentHelpAction === 'ID_RECOVERY') {
                                helpModalSubtitle.textContent = 'ID Recovered Successfully';
                                document.getElementById('recoveredFacultyId').textContent = data.faculty_id;
                                stepShowId.style.display = 'block';
                            }
                        } else {
                            alert(data.message || 'Invalid OTP');
                        }
                    } catch (error) {
                        console.error(error);
                        alert('Server error occurred during verification');
                    } finally {
                        btnVerifyOtp.disabled = false;
                        btnVerifyOtp.textContent = 'Verify OTP';
                    }
                });
                
                // Add Enter key support
                const otpInput = document.getElementById('helpOtpInput');
                if (otpInput) {
                    otpInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            btnVerifyOtp.click();
                        }
                    });
                }
            }

            if (btnSaveNewPwd) {
                btnSaveNewPwd.addEventListener('click', async () => {
                    const newPwd = document.getElementById('helpNewPwd').value;
                    const confirmPwd = document.getElementById('helpConfirmPwd').value;
                    const otp = document.getElementById('helpOtpInput').value.trim();

                    if (!newPwd || !confirmPwd) {
                        alert('Please fill in both password fields');
                        return;
                    }
                    if (newPwd !== confirmPwd) {
                        alert('Passwords do not match');
                        return;
                    }

                    btnSaveNewPwd.disabled = true;
                    btnSaveNewPwd.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';

                    try {
                        const response = await fetch('/api/auth/reset-password', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: currentHelpEmail, otp, new_password: newPwd })
                        });
                        const data = await response.json();

                        if (data.success) {
                            alert('Password updated successfully! You can now sign in.');
                            helpModal.style.display = 'none';
                        } else {
                            alert(data.message || 'Failed to update password');
                        }
                    } catch (error) {
                        console.error(error);
                        alert('Server error occurred');
                    } finally {
                        btnSaveNewPwd.disabled = false;
                        btnSaveNewPwd.textContent = 'Update Password';
                    }
                });
            }

            if (btnProceedToLogin) {
                btnProceedToLogin.addEventListener('click', () => {
                    const helpModal = document.getElementById('helpModal');
                    if (helpModal) helpModal.style.display = 'none';
                });
            }
        });
        // Login submit and password toggle are handled by ../js/main.js
    