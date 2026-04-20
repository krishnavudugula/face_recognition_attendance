
document.addEventListener('DOMContentLoaded', () => {
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

    let imageBase64 = null; // Store captured face
    let stream = null;      // Store camera stream

    const video = document.getElementById('webcam');
    const canvas = document.getElementById('canvas');
    const startScanBtn = document.getElementById('startScanBtn');
    const openScannerBtn = document.getElementById('openScannerBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const capturedImage = document.getElementById('capturedImage');
    const submitBtn = document.getElementById('submitBtn');
    const registerForm = document.getElementById('registerForm');
    const statusMsg = document.getElementById('statusMsg');
    
    // --- Camera Control Functions ---
    async function startCamera() {
        try {
            if (stream) {
                 // Even if stream exists, ensure video element is using it and visible
                 if (video.srcObject !== stream) {
                     video.srcObject = stream;
                 }
                 if (video.style.display === 'none') {
                     video.style.display = 'block';
                 }
                 return;
            }

            stream = await navigator.mediaDevices.getUserMedia({ video: true });
            const cameraInactive = document.querySelector('.camera-inactive');
            if (cameraInactive) cameraInactive.style.display = 'none';

            video.srcObject = stream;
            video.style.transform = "scaleX(-1)"; // Mirror
            video.style.opacity = "1";
            video.style.display = "block"; // Ensure it's visible
            
             // Reset UI if retrying
             if (capturedImage) capturedImage.style.display = 'none';
             if (startScanBtn) {
                 startScanBtn.textContent = "Start Capture";
                 startScanBtn.classList.remove('btn-success');
                 startScanBtn.classList.add('btn-primary');
                 startScanBtn.disabled = false;
                 startScanBtn.removeAttribute('data-scanning');
             }

        } catch (err) {
            console.error("Camera Error:", err);
            alert("Could not access camera. Please allow camera permissions.");
        }
    }

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
            video.srcObject = null;
        }
    }

    // --- Init Camera on Modal Open ---
    // Since the modal is opened via a script in register.html attached to openScannerBtn,
    // we attach our own listener here to start the camera simultaneously.
    if (openScannerBtn) {
        openScannerBtn.addEventListener('click', () => {
            startCamera();
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', stopCamera);
    }

    // Initialize UI
    if (startScanBtn) {
        startScanBtn.addEventListener('click', async () => {
            const scanOverlay = document.getElementById('scanOverlay');
            const scanProgress = document.getElementById('scanProgress');

            if (startScanBtn.getAttribute('data-scanning') === 'true') return;
            
            // Ensure camera is running (sanity check)
            if (!stream) {
                await startCamera();
                if (!stream) return; // Still failed
            }

            startScanBtn.setAttribute('data-scanning', 'true');
            
            // Show Overlay
            if (scanOverlay) scanOverlay.style.display = 'flex';
            
            // --- Multi-Angle Capture Logic ---
            startScanBtn.textContent = 'Look Center...';

            let progress = 0;
            let capturePhase = 0; // 0: Center, 1: Left, 2: Right, 3: Done
            
            const scanInterval = setInterval(() => {
                progress += 4; // Slower progress (25 iter @ 300ms = 7.5s total)
                if (scanProgress) scanProgress.textContent = `${progress}%`;
                
                // Simple simulated prompts
                if (progress > 30 && capturePhase === 0) {
                    startScanBtn.textContent = 'Turn Slightly Left...';
                    capturePhase = 1; 
                }
                if (progress > 60 && capturePhase === 1) {
                    startScanBtn.textContent = 'Turn Slightly Right...';
                    capturePhase = 2;
                }
                if (progress > 85 && capturePhase === 2) {
                         startScanBtn.textContent = 'Look Center & Smile!';
                         capturePhase = 3;
                }

                // Capture FINAL frame at 96%
                if (progress === 96) {
                    const context = canvas.getContext('2d');
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    context.drawImage(video, 0, 0, canvas.width, canvas.height);
                    imageBase64 = canvas.toDataURL('image/jpeg', 0.95); // High Quality
                }

                if (progress >= 100) {
                    clearInterval(scanInterval);
                    
                    // Stop Camera
                    stopCamera();
                    
                    // UI Updates
                    if (scanOverlay) scanOverlay.style.display = 'none';
                    video.style.display = 'none';
                    if (capturedImage) {
                        capturedImage.src = imageBase64;
                        capturedImage.style.display = 'block';
                    }

                    // Restore camera-inactive if needed, but here we captured image so keep it hidden
                    const cameraInactive = document.querySelector('.camera-inactive');
                    if (cameraInactive) cameraInactive.style.display = 'none'; 
                    
                    startScanBtn.textContent = "Multi-Angle Scan Complete";
                    startScanBtn.classList.remove('btn-primary');
                    startScanBtn.classList.add('btn-success');
                    startScanBtn.disabled = true;
                    
                    // Enable Submit
                    submitBtn.disabled = false;
                }
            }, 300); // Slower interval for realistic scanning effect
        });
    }

    // 3. Handle Registration
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!imageBase64) {
                alert("Please complete the face scan first.");
                return;
            }

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        if (!email) {
            alert("Please enter a valid Institutional Email.");
            return;
        }

        const passwordError = validatePasswordPolicy(password);
        if (passwordError) {
            alert(passwordError);
            return;
        }

        // Use Email as User ID
        const data = {
            name: document.getElementById('fullName').value,
            user_id: email, 
            role: document.getElementById('userRole').value,
            image: imageBase64,
            password: password
        };
        
        // Disable button during request
        submitBtn.disabled = true;
        submitBtn.textContent = "Registering...";
        statusMsg.textContent = "Processing...";

        try {
            const response = await fetch(`${API_BASE_URL}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                statusMsg.style.color = 'green';
                statusMsg.textContent = "Registration Successful!";
                setTimeout(() => {
                    window.location.href = '/pages/admin_dashboard.html';
                }, 1500);
            } else {
                statusMsg.style.color = 'red';
                statusMsg.textContent = "Error: " + result.message;
                submitBtn.disabled = false;
                submitBtn.textContent = "Save & Register";
            }
        } catch (error) {
            console.error(error);
            statusMsg.style.color = 'red';
            statusMsg.textContent = "Server Error. Check console.";
            submitBtn.disabled = false;
        }
    });
    }
});
