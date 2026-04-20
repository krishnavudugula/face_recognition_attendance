#!/usr/bin/env python3
"""Check credential format and encoding"""
import os
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

print("API Key Details:")
print(f"  Length: {len(api_key)}")
print(f"  Value: '{api_key}'")
print(f"  Repr: {repr(api_key)}")

print("\nAPI Secret Details:")
print(f"  Length: {len(api_secret)}")
print(f"  Value: '{api_secret}'")
print(f"  Repr: {repr(api_secret)}")

# Check for special characters
print("\nCharacter Analysis:")
print(f"  API Key has '-': {'-' in api_key}")
print(f"  API Secret has special chars: {any(c in api_secret for c in '!@#$%^&*()_+-=[]{}|;:,.<>?')}")

# Hex dump
print("\nHex (last 20 chars of secret):")
print(f"  {api_secret[-20:].encode().hex()}")
