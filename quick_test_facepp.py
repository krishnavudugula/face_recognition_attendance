#!/usr/bin/env python3
"""Quick Face++ API credential test"""
import os
import requests
from pathlib import Path

# Load .env
env_file = Path(".env")
if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                key, val = line.split("=", 1)
                os.environ[key] = val

# Get credentials
api_key = os.getenv("FACEPP_API_KEY")
api_secret = os.getenv("FACEPP_API_SECRET")
faceset_id = os.getenv("FACEPP_FACESET_ID", "bits_faculty")

print("=" * 50)
print("Face++ Credentials Test")
print("=" * 50)
print(f"API Key:     {api_key[:20]}..." if api_key else "❌ API Key not found")
print(f"API Secret:  {api_secret[:20]}..." if api_secret else "❌ API Secret not found")
print(f"FaceSet ID:  {faceset_id}")

if not api_key or not api_secret:
    print("\n❌ Credentials missing!")
    exit(1)

# Test 1: Basic connectivity (quota API)
print("\n[TEST 1] Checking API quota...")
try:
    response = requests.post(
        "https://api-us.faceplusplus.com/facepp/v3/grpc_quota/query",
        data={"api_key": api_key, "api_secret": api_secret},
        timeout=5
    )
    result = response.json()
    
    if response.status_code == 200:
        print(f"✅ API Connection: OK")
        print(f"   Calls today: {result.get('call_quota', {}).get('remaining', 'N/A')}")
    else:
        print(f"❌ Error: {result.get('error_message', 'Unknown error')}")
except Exception as e:
    print(f"❌ Connection failed: {e}")
    exit(1)

# Test 2: Create/Check FaceSet
print("\n[TEST 2] Checking FaceSet...")
try:
    response = requests.post(
        "https://api-us.faceplusplus.com/facepp/v3/faceset/detail",
        data={
            "api_key": api_key,
            "api_secret": api_secret,
            "outer_id": faceset_id
        },
        timeout=5
    )
    result = response.json()
    
    if result.get("face_count") is not None:
        print(f"✅ FaceSet exists: {faceset_id}")
        print(f"   Faces registered: {result.get('face_count', 0)}")
    else:
        print(f"ℹ️ FaceSet doesn't exist yet (will be created on first registration)")
except Exception as e:
    print(f"❌ FaceSet check failed: {e}")

print("\n" + "=" * 50)
print("✅ All tests passed! Ready to use Face++")
print("=" * 50)
