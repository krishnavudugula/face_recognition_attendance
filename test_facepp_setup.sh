#!/bin/bash
# Quick test script for Face++ integration

echo "========================================="
echo "Face++ Integration - Test Script"
echo "========================================="

# 1. Install dependencies
echo "[1] Installing dependencies..."
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi
echo "✅ Dependencies installed"

# 2. Set Face++ credentials
echo ""
echo "[2] Setting Face++ credentials..."
echo ""
echo "Get these from: https://www.faceplusplus.com"
echo "  1. Dashboard → Console"
echo "  2. Copy API Key"
echo "  3. Copy API Secret"
echo ""
echo "Set environment variables:"
echo "  export FACEPP_API_KEY='your_key'"
echo "  export FACEPP_API_SECRET='your_secret'"
echo ""
read -p "Have you set FACEPP_API_KEY and FACEPP_API_SECRET? (y/n) " -n 1 -r
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

# 5. Initialize FaceSet
echo ""
echo "[5] Initializing Face++ FaceSet..."
INIT=$(curl -s -X POST http://localhost:5000/api/init_facepp_faceset)
echo "$INIT" | python -m json.tool
if echo $INIT | grep -q "success.*true"; then
    echo "✅ FaceSet initialized"
else
    echo "❌ FaceSet initialization failed"
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
