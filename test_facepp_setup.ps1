# Quick test script for Face++ migration (Windows PowerShell)

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Face++ Integration - Test Script" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Install dependencies
Write-Host ""
Write-Host "[1] Installing dependencies..." -ForegroundColor Yellow
pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Dependencies installed" -ForegroundColor Green

# 2. Set Face++ credentials
Write-Host ""
Write-Host "[2] Setting Face++ credentials..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Get these from: https://www.faceplusplus.com" -ForegroundColor Cyan
Write-Host "  1. Dashboard → Console"
Write-Host "  2. Copy API Key"
Write-Host "  3. Copy API Secret"
Write-Host ""
Write-Host "Set environment variables:" -ForegroundColor Yellow
Write-Host "  `$env:FACEPP_API_KEY = '<your_key>'" -ForegroundColor Gray
Write-Host "  `$env:FACEPP_API_SECRET = '<your_secret>'" -ForegroundColor Gray
Write-Host ""
$response = Read-Host "Have you set FACEPP_API_KEY and FACEPP_API_SECRET? (y/n)"
if ($response -ne "y" -and $response -ne "Y") {
    Write-Host "Please set the environment variables first" -ForegroundColor Red
    exit 1
}

# 3. Run Flask app
Write-Host ""
Write-Host "[3] Starting Flask app..." -ForegroundColor Yellow
Start-Process python -ArgumentList "app.py" -NoNewWindow
Write-Host "✅ Flask running" -ForegroundColor Green
Start-Sleep -Seconds 2

# 4. Test health endpoint
Write-Host ""
Write-Host "[4] Testing /api/health endpoint..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:5000/api/health" -Method Get
    Write-Host "✅ Health check passed: $($health | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "❌ Health check failed: $_" -ForegroundColor Red
    exit 1
}

# 5. Initialize FaceSet
Write-Host ""
Write-Host "[5] Initializing Face++ FaceSet..." -ForegroundColor Yellow
try {
    $init = Invoke-RestMethod -Uri "http://localhost:5000/api/init_facepp_faceset" -Method Post
    Write-Host ($init | ConvertTo-Json) -ForegroundColor Cyan
    if ($init.success -eq $true) {
        Write-Host "✅ FaceSet initialized" -ForegroundColor Green
    } else {
        Write-Host "❌ FaceSet initialization failed" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ FaceSet request failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "✅ All tests passed!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Register a user with 5 face angles: POST /api/register_face_multi_angle"
Write-Host "2. Scan the face to verify: POST /api/recognize"
Write-Host ""
Write-Host "The Flask app is running. Press Ctrl+C in the Flask window to stop."
