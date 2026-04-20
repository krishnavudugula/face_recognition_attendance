const video = document.getElementById('webcam');
const statusMessage = document.getElementById('statusMessage');
const startBtn = document.getElementById('startScanBtn');
const stopBtn = document.getElementById('stopScanBtn');
let scanningInterval = null;
let isProcessing = false;
let isMatched = false; // Strict lock
let locationError = false;
let currentLocation = null;
let locationWatchId = null;
let scanAttempts = 0;

function normalizeAttendanceType(attendance) {
    return String(attendance?.type || '').trim().toUpperCase();
}

function isMarkedAttendanceType(type) {
    // Only these two represent a fresh attendance mark in current scan flow.
    return type === 'IN' || type === 'OUT';
}

function isRecognitionOnlyType(type) {
    // Face matched but no fresh attendance mark happened.
    return ['ALREADY_DONE', 'COOLDOWN', 'IGNORED', 'HOLIDAY'].includes(type);
}

function showErrorMessage(message) {
    statusMessage.innerHTML = `<span style="font-size: 1rem; font-weight: 600;">${message}</span>`;
    statusMessage.style.color = '#dc2626';
    if (window.logSystem) {
        window.logSystem.showProblem(message);
    }
}

function showSuccessMessage(message) {
    statusMessage.innerHTML = `<span style="font-size: 1.1rem; font-weight: 700; color: #059669;">${message}</span>`;
    statusMessage.style.color = '#059669';
    if (window.logSystem) {
        window.logSystem.hideProblem();
    }
}

function showInfoMessage(message) {
    statusMessage.innerHTML = `<span>${message}</span>`;
    statusMessage.style.color = '#2d3748';
}

function showWarningMessage(message) {
    statusMessage.innerHTML = `<span style="font-size: 1rem; font-weight: 700; color: #d97706;">${message}</span>`;
    statusMessage.style.color = '#d97706';
}

function resolveScanError(result, httpStatus) {
    const code = result?.error_code || '';

    if (code === 'LOCATION_REQUIRED') return 'GPS location mandatory. Enable location access and allow permission.';
    if (code === 'LOCATION_INVALID') return 'Location could not be validated. Refresh GPS and try again.';
    if (code === 'OUT_OF_BOUNDS') return 'You are outside the allowed campus boundary. Move closer to permitted zone.';
    if (code === 'FACE_NOT_DETECTED') return 'Face not clearly detected. Keep steady, improve lighting, and try again.';
    if (code === 'INVALID_USER') return 'Unregistered user. Please contact administration.';
    if (code === 'NO_IMAGE') return 'Camera frame not captured. Please retry the scan.';
    if (code === 'SERVER_ERROR') return 'Server error during validation. Please retry.';

    if (httpStatus === 401) return 'Invalid or unregistered user. Please contact admin.';
    if (httpStatus === 403) return result?.message || 'Out of campus boundary. Move within allowed range.';
    if (httpStatus === 400) return result?.message || 'Invalid scan request. Please retry.';

    return result?.message || 'Attendance validation failed. Please try again.';
}

if (startBtn) startBtn.addEventListener('click', startScanning);
if (stopBtn) stopBtn.addEventListener('click', stopScanning);

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('webcam')) {
        const videoEl = document.getElementById('webcam');
        videoEl.style.transform = "scaleX(-1)";
        showInfoMessage('Preparing scanner... please keep your face in frame.');
        if (window.logSystem) {
            window.logSystem.updateFaceDetection('Standby', 'info');
        }

        // Auto-start scanner when entering from Mark Attendance flow.
        window.setTimeout(() => {
            startScanning();
        }, 400);
    }
});

async function startScanning() {
    isMatched = false; // Reset lock
    locationError = false; // Reset error flag
    currentLocation = null; // Reset location
    scanAttempts = 0;

    try {
        if (!navigator.onLine) {
            showErrorMessage('No internet connection. Enable mobile data or Wi-Fi.');
            if (window.logSystem) {
                window.logSystem.updateBoundary('Network Error', 'error');
            }
            return;
        }

        showInfoMessage('Acquiring GPS location...');
        if (window.logSystem) {
            window.logSystem.updateBoundary('Acquiring...', 'warning');
        }

        // Start Location Watch
        if (navigator.geolocation) {
            locationWatchId = navigator.geolocation.watchPosition(
                (position) => {
                    locationError = false;
                    currentLocation = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    };
                    
                    if (window.logSystem) {
                        window.logSystem.updateLocation(
                            position.coords.latitude, 
                            position.coords.longitude, 
                            position.coords.accuracy || 0
                        );
                    }

                    // Update UI to show we have location
                    if (!isProcessing && !isMatched) {
                        showInfoMessage('GPS Located • Align Face • Stand Steady');
                        if (window.logSystem) {
                            window.logSystem.updateBoundary('Within Bounds', 'success');
                        }
                    }
                },
                (error) => {
                    console.error("Location error:", error);
                    locationError = true;
                    let msg = "Location Error";
                    switch(error.code) {
                        case error.PERMISSION_DENIED: 
                            msg = "Location permission denied. Allow location access in settings."; 
                            break;
                        case error.POSITION_UNAVAILABLE: 
                            msg = "GPS unavailable. Turn ON location services and move to open area."; 
                            break;
                        case error.TIMEOUT: 
                            msg = "Location acquisition timeout. Move to open area and retry."; 
                            break;
                        default: 
                            msg = "Location Error: " + error.message;
                    }
                    showErrorMessage(msg);
                    if (window.logSystem) {
                        window.logSystem.updateLocationError(msg.substring(0, 30) + '...');
                        window.logSystem.showProblem(msg);
                    }
                },
                { enableHighAccuracy: false, maximumAge: 30000, timeout: 20000 }
            );
        } else {
            showErrorMessage('Location service not supported on this device.');
            locationError = true;
            if (window.logSystem) {
                window.logSystem.updateLocationError('Not Supported');
            }
        }

        // Simple getUserMedia call
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    
        video.srcObject = stream;
        video.play();
        
        showInfoMessage('Camera Active • Position Face in Frame');
        if(startBtn) startBtn.style.display = 'none';
        if(stopBtn) stopBtn.style.display = 'inline-flex';
        
        // Scan every 500ms for responsiveness
        if (scanningInterval) clearInterval(scanningInterval);
        scanningInterval = setInterval(processFrame, 500); 

    } catch (err) {
        console.error("Camera Error:", err);
        showErrorMessage('Camera access denied or unavailable. Enable camera permission in settings.');
        if (window.logSystem) {
            window.logSystem.showProblem('Camera access denied');
        }
    }
}

function stopScanning() {
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
    clearInterval(scanningInterval);
    scanningInterval = null;
    isProcessing = false;

    if (locationWatchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(locationWatchId);
        locationWatchId = null;
    }
    
    if(!isMatched) {
        showInfoMessage('Scan cancelled.');
        if(startBtn) startBtn.style.display = 'inline-flex';
        if(stopBtn) stopBtn.style.display = 'none';
    }
}

async function processFrame() {
    if (isProcessing || !scanningInterval || isMatched) return;

    // Stop if we have a definitive location error
    if (locationError) {
        return; 
    }

    if (!navigator.onLine) {
        showErrorMessage('Network disconnected. Reconnect and retry.');
        if (window.logSystem) {
            window.logSystem.showProblem('Network disconnected');
        }
        return;
    }

    // Check if location is available before sending
    if (!currentLocation) {
        if (!statusMessage.textContent.includes("Acquiring")) {
            showInfoMessage('Acquiring GPS location...');
        }
        return;
    }

    scanAttempts++;
    if (window.logSystem) {
        window.logSystem.incrementAttempts();
    }

    isProcessing = true;
    
    try {
        // Performance: Resize to 320px width with 0.8 quality JPEG
        const canvas = document.createElement('canvas');
        const aspect = video.videoHeight / video.videoWidth;
        const targetWidth = 320;
        canvas.width = targetWidth;
        canvas.height = targetWidth * aspect;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg', 0.8); 

        // Update face detection status
        if (window.logSystem) {
            window.logSystem.updateFaceDetection('Scanning...', 'info');
        }

        // Safety timeout to release lock if server hangs
        const processingTimeout = setTimeout(() => {
             if(isProcessing) {
                 isProcessing = false;
             }
        }, 10000);

        // Send to API
        const response = await fetch('/api/recognize', {
            method: 'POST',
            body: JSON.stringify({ 
                image: imageData,
                location: currentLocation 
            }),
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        clearTimeout(processingTimeout);

        // Handle Result
        if (result.success && !isMatched) {
            isMatched = true; // LOCK IMMEDIATELY

            // Status Message Context
            const name = result.user.name;
            const logType = normalizeAttendanceType(result.attendance);
            const logStatus = result.attendance ? result.attendance.status : 'Success';
            
            // Persist login
            localStorage.setItem('user', JSON.stringify(result.user));
            localStorage.setItem('user_role', result.user.role);
            localStorage.setItem('user_id', result.user.user_id || result.user.id);

            const markedNow = isMarkedAttendanceType(logType);
            const recognitionOnly = isRecognitionOnlyType(logType);

            if (window.logSystem) {
                if (markedNow) {
                    window.logSystem.updateFaceDetection('Attendance Marked', 'success');
                    window.logSystem.updateBoundary('Verified', 'success');
                    window.logSystem.hideProblem();
                } else {
                    window.logSystem.updateFaceDetection('Face Verified', 'warning');
                    window.logSystem.updateBoundary('No New Mark', 'warning');
                }
            }

            if (markedNow) {
                showSuccessMessage(`Attendance Marked: ${name} • ${logStatus}`);
            } else if (recognitionOnly) {
                showWarningMessage(`Face Verified: ${name} • ${logStatus} (No new attendance mark)`);
            } else {
                showInfoMessage(`Face Verified: ${name} • ${logStatus}`);
            }
            
            // Stop Camera
            stopScanning();
            if(stopBtn) stopBtn.style.display = 'none';

            // Redirect only when attendance is marked, and wait 3 seconds.
            if (markedNow) {
                setTimeout(() => {
                    if (result.user.role === 'admin') {
                        window.location.href = '../pages/admin_dashboard.html';
                    } else if (result.user.role === 'faculty') {
                        window.location.href = '../pages/faculty_dashboard.html';
                    } else {
                        alert('Attendance marked successfully.');
                        history.back();
                    }
                }, 3000);
            } else {
                // Stay on scanner so user can clearly see it was only verification.
                if(startBtn) startBtn.style.display = 'inline-flex';
                if(stopBtn) stopBtn.style.display = 'none';
            }
            
        } else {
            // Failure feedback
            const userMessage = resolveScanError(result, response.status);
            showErrorMessage(userMessage);
            

            if (window.logSystem) {
                if (result.error_code === 'INVALID_USER') {
                    window.logSystem.updateFaceDetection('Not Registered', 'error');
                } else {
                    window.logSystem.updateFaceDetection('No Match', 'error');
                }
                if (result.error_code === 'OUT_OF_BOUNDS') {
                    window.logSystem.updateBoundary('Out of Bounds', 'error');
                }
            }
        }

    } catch (err) {
        console.error("Scan Error:", err);
        showErrorMessage('Connection lost while scanning. Check internet and retry.');
        if (window.logSystem) {
            window.logSystem.showProblem('Network or server error');
        }
    } finally {
        isProcessing = false;
    }
}
