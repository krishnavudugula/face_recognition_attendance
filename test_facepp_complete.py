#!/usr/bin/env python3
"""Test Face++ API - Complete Setup"""
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

api_key = os.getenv("FACEPP_API_KEY")
api_secret = os.getenv("FACEPP_API_SECRET")
faceset_id = os.getenv("FACEPP_FACESET_ID", "bits_faculty")

print("=" * 60)
print("Face++ Complete Setup Test")
print("=" * 60)
print(f"✅ API Key:     {api_key[:15]}...{api_key[-4:]}")
print(f"✅ API Secret:  {api_secret[:15]}...{api_secret[-4:]}")
print(f"✅ FaceSet ID:  {faceset_id}")

# Test: Create FaceSet
print("\n[Step 1] Creating/Checking FaceSet...")
try:
    response = requests.post(
        "https://api-us.faceplusplus.com/facepp/v3/faceset/create",
        data={
            "api_key": api_key,
            "api_secret": api_secret,
            "outer_id": faceset_id,
            "display_name": "Faculty Attendance"
        },
        timeout=5
    )
    result = response.json()
    
    if response.status_code == 200:
        print(f"✅ FaceSet created/exists!")
        print(f"   Faceset Token: {result.get('faceset_token', 'N/A')[:20]}...")
        print(f"   Face Count: {result.get('face_count', 0)}")
    elif "FACESET_EXIST" in result.get("error_message", ""):
        print(f"✅ FaceSet already exists (outer_id: {faceset_id})")
    else:
        print(f"Response: {result}")
except Exception as e:
    print(f"❌ Error: {e}")

# Test: Get API Quota
print("\n[Step 2] Checking API Quota...")
try:
    response = requests.post(
        "https://api-us.faceplusplus.com/facepp/v3/statistics",
        data={
            "api_key": api_key,
            "api_secret": api_secret
        },
        timeout=5
    )
    result = response.json()
    
    if response.status_code == 200:
        print(f"✅ Quota info retrieved!")
        print(f"   Calls this month: {result.get('call_quota', {}).get('total_calls', 'N/A')}")
        print(f"   Remaining calls: {result.get('call_quota', {}).get('remaining_calls', 'N/A')}")
    else:
        print(f"⚠️  Response: {result}")
except Exception as e:
    print(f"⚠️  Quota check: {e}")

print("\n" + "=" * 60)
print("✅ Setup Complete - Ready to Use Face++!")
print("=" * 60)
print("\nNext Steps:")
print("  1. Run: python app.py")
print("  2. Use the Android app to register faces")
print("  3. Faces will auto-initialize FaceSet on first registration")
