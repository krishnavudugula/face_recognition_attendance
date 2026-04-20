#!/bin/bash
# Quick test script for Azure Face API migration

echo "========================================="
echo "Azure Face API Migration - Test Script"
echo "========================================="

# 1. Install dependencies
echo "[1] Installing dependencies..."
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi
echo "✅ Dependencies installed"

# 2. Set Azure credentials (modify these)
echo ""
echo "[2] Setting Azure credentials..."
echo "Please set these environment variables before running the app:"
echo ""
echo "  export AZURE_FACE_ENDPOINT=https://<your-region>.api.cognitive.microsoft.com/"
echo "  export AZURE_FACE_KEY=<your-key>"
echo ""
echo "Example (for Southeast Asia):"
echo "  export AZURE_FACE_ENDPOINT=https://southeastasia.api.cognitive.microsoft.com/"
echo "  export AZURE_FACE_KEY=abc123xyz..."
echo ""
read -p "Have you set AZURE_FACE_ENDPOINT and AZURE_FACE_KEY? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please set the environment variables first"
    exit 1
fi

# 3. Run Flask app
echo ""
echo "[3] Starting Flask app..."
python app.py &
APP_PID=$!
echo "✅ Flask running (PID: $APP_PID)"
sleep 2

# 4. Test health endpoint
echo ""
echo "[4] Testing /api/health endpoint..."
HEALTH=$(curl -s http://localhost:5000/api/health)
if echo $HEALTH | grep -q "ok"; then
    echo "✅ Health check passed: $HEALTH"
else
    echo "❌ Health check failed"
    kill $APP_PID
    exit 1
fi

# 5. Initialize PersonGroup
echo ""
echo "[5] Initializing Azure PersonGroup..."
INIT=$(curl -s -X POST http://localhost:5000/api/init_azure_persongroup)
echo "$INIT" | python -m json.tool
if echo $INIT | grep -q "success.*true"; then
    echo "✅ PersonGroup initialized"
else
    echo "❌ PersonGroup initialization failed"
    kill $APP_PID
    exit 1
fi

echo ""
echo "========================================="
echo "✅ All tests passed!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Register a user with 5 face angles: POST /api/register_face_multi_angle"
echo "2. Scan the face to verify: POST /api/recognize"
echo ""
echo "Press Ctrl+C to stop the server"
wait
