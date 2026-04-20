#!/usr/bin/env python3
"""Test Face++ API with direct endpoint"""
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
print("Face++ API Endpoint Tests")
print("=" * 60)
print(f"API Key:     {api_key}")
print(f"API Secret:  {api_secret}")
print(f"FaceSet ID:  {faceset_id}")

# Test different endpoints
endpoints = [
    ("https://api-us.faceplusplus.com/facepp/v3/detect", "detect"),
    ("https://api-us.faceplusplus.com/facepp/v3/faceset/detail", "faceset/detail"),
    ("https://api.faceplusplus.com/facepp/v3/detect", "detect (default)"),
]

for url, name in endpoints:
    print(f"\n[Testing] {name}")
    print(f"  URL: {url}")
    try:
        response = requests.post(
            url,
            data={"api_key": api_key, "api_secret": api_secret},
            timeout=5
        )
        print(f"  Status: {response.status_code}")
        result = response.json()
        
        if "error_message" in result:
            print(f"  Error: {result.get('error_message')}")
            if "invalid_credential" in result.get('error_message', '').lower():
                print(f"  → Credential format may be incorrect")
        elif "request_id" in result:
            print(f"  ✅ Request successful! (request_id: {result['request_id'][:20]}...)")
        else:
            print(f"  Response: {result}")
    except Exception as e:
        print(f"  ❌ Connection error: {e}")

print("\n" + "=" * 60)
