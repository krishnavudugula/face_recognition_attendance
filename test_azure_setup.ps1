# Quick test script for Azure Face API migration (Windows PowerShell)

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Azure Face API Migration - Test Script" -ForegroundColor Cyan
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

# 2. Set Azure credentials
Write-Host ""
Write-Host "[2] Setting Azure credentials..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Please set these environment variables before running the app:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  `$env:AZURE_FACE_ENDPOINT = 'https://<your-region>.api.cognitive.microsoft.com/'" -ForegroundColor Gray
Write-Host "  `$env:AZURE_FACE_KEY = '<your-key>'" -ForegroundColor Gray
Write-Host ""
Write-Host "Example (for Southeast Asia):" -ForegroundColor Cyan
Write-Host "  `$env:AZURE_FACE_ENDPOINT = 'https://southeastasia.api.cognitive.microsoft.com/'" -ForegroundColor Gray
Write-Host "  `$env:AZURE_FACE_KEY = 'abc123xyz...'" -ForegroundColor Gray
Write-Host ""
$response = Read-Host "Have you set AZURE_FACE_ENDPOINT and AZURE_FACE_KEY? (y/n)"
if ($response -ne "y" -and $response -ne "Y") {
    Write-Host "Please set the environment variables first" -ForegroundColor Red
    exit 1
}

# 3. Run Flask app
Write-Host ""
Write-Host "[3] Starting Flask app..." -ForegroundColor Yellow
Start-Process python -ArgumentList "app.py" -NoNewWindow
$APP_PID = $?
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

# 5. Initialize PersonGroup
Write-Host ""
Write-Host "[5] Initializing Azure PersonGroup..." -ForegroundColor Yellow
try {
    $init = Invoke-RestMethod -Uri "http://localhost:5000/api/init_azure_persongroup" -Method Post
    Write-Host ($init | ConvertTo-Json) -ForegroundColor Cyan
    if ($init.success -eq $true) {
        Write-Host "✅ PersonGroup initialized" -ForegroundColor Green
    } else {
        Write-Host "❌ PersonGroup initialization failed" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ PersonGroup request failed: $_" -ForegroundColor Red
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
