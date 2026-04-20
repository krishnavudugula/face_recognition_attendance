# Face++ (Megvii) Setup Guide

## Overview

Your app now uses **Face++ (Megvii)** for cloud-based face recognition.

### What Changed?
- ✅ Removed: dlib, face_recognition library (800MB+ downloads)
- ✅ Added: Face++ API (lightweight REST calls)
- ✅ Benefit: No card required, 1000 API calls/day free, simple signup

**Backend size reduction:** 800MB → ~20MB

---

## Step 1: Create Face++ Account (2 minutes)

1. Go to [faceplusplus.com](https://www.faceplusplus.com)
2. Click "Sign Up" (top right)
3. Enter email → Verify email
4. **No credit card needed**
5. Login to dashboard

---

## Step 2: Get Your API Credentials

1. Go to console → "API Key" (left sidebar)
2. Under "Free Trial", you'll see:
   - **API Key**
   - **API Secret**
3. Copy both values

Example:
```
API Key:    d6e8c3f7a2b9e4d1f5g8h3k9
API Secret: 7a2d8f3e9c1b5g4h8k2f6j9
```

---

## Step 3: Configure Environment Variables

### Local Development

Create a `.env` file in project root:

```bash
FACEPP_API_KEY=your_api_key_here
FACEPP_API_SECRET=your_api_secret_here
FACEPP_FACESET_ID=attendance-system
DATABASE_URL=sqlite:///face_attendance.db
```

### Production (Render.com)

In Render dashboard → Environment:
```
FACEPP_API_KEY=<your_key>
FACEPP_API_SECRET=<your_secret>
DATABASE_URL=postgresql://... (Render auto-provides)
```

---

## Step 4: Install Updated Dependencies

```bash
pip install -r requirements.txt
```

No more dlib compilation! This installs:
- `requests` (for Face++ API calls)
- Flask, SQLAlchemy, etc.

---

## Step 5: Initialize FaceSet (One-time setup)

A "FaceSet" is like a folder that holds all your registered faces.

```bash
# Make sure Flask is running
python app.py

# In another terminal, initialize:
curl -X POST http://localhost:5000/api/init_facepp_faceset
```

Expected response:
```json
{
  "success": true,
  "message": "FaceSet 'attendance-system' created successfully",
  "faceset_id": "attendance-system"
}
```

If FaceSet already exists:
```json
{
  "success": true,
  "message": "FaceSet 'attendance-system' already exists",
  "face_count": 0
}
```

---

## Step 6: Test Locally (Optional)

```bash
# Set env vars
$env:FACEPP_API_KEY = "your_key"
$env:FACEPP_API_SECRET = "your_secret"

# Run Flask
python app.py

# In another terminal
.\test_facepp_setup.ps1
```

---

## Step 7: Deploy to Render (or Railway/Fly.io)

### Option A: Render.com (Recommended)

1. Push code to GitHub
2. Connect GitHub to [render.com](https://render.com)
3. Create new "Web Service"
4. Set build command: `pip install -r requirements.txt`
5. Set start command: `gunicorn app:app --workers 4 --bind 0.0.0.0:8000`
6. Add environment variables (from Step 3)
7. Deploy

To prevent auto-sleep (free tier sleeps after 15 min):
- Use [UptimeRobot](https://uptimerobot.com) (free)
- Monitor: `https://your-app-url/api/health` every 10 minutes

### Option B: Railway.com

Similar setup, but Railway's free tier is better (doesn't auto-sleep).

---

## How It Works

### Registration (5-angle face capture)

```
User uploads 5 angles
  ↓ (each angle)
  Detect face → Get face_token
  Add to FaceSet with user_id
  ↓
Face++ stores all tokens
```

**Time:** ~100-200ms per angle + ~1 second per FaceSet update

### Verification (scan face)

```
User scans face
  ↓
Detect face → Get face_token
Search in FaceSet
  ↓
Face++ returns matching user_id + confidence (0-100)
  ↓
If confidence ≥ 75: Match found!
If confidence < 75: No match
```

**Time:** ~200-500ms (depending on internet speed)

---

## Free Tier Limits

| Feature | Limit | Your Usage |
|---------|-------|-----------|
| API calls/day | 1,000 | 200 staff × 2 scans = 400/day ✓ |
| API calls/month | 30,000 | ~10,000/month ✓ |
| Requests/minute | Not limited | OK |
| Face detection | Per call | 1 per scan |
| Face search | Per call | 1 per scan |

**Status:** You're well within free tier limits.

---

## Cost Breakdown

| Item | Cost | Notes |
|------|------|-------|
| Face++ | ₹0 | Free tier, forever |
| Render Web Service | ₹0 | 750 hrs/month |
| Render PostgreSQL | ₹0 | 1GB storage |
| UptimeRobot | ₹0 | Keeps server awake |
| **Total** | **₹0** | Fully free forever |

---

## Troubleshooting

### Error: "Face++ not configured"

**Cause:** `FACEPP_API_KEY` or `FACEPP_API_SECRET` not set.

**Fix:**
```powershell
$env:FACEPP_API_KEY = "your_key"
$env:FACEPP_API_SECRET = "your_secret"
```

### Error: "Failed to initialize FaceSet"

**Cause:** Invalid credentials or network issue.

**Fix:**
1. Verify API key/secret are correct (copy-paste from dashboard)
2. Check internet connection
3. Try again: `curl -X POST http://localhost:5000/api/init_facepp_faceset`

### Error: "No face detected in image"

**Cause:** Bad lighting, blurry image, or face too small.

**Solutions:**
1. Better lighting during capture
2. Hold phone still (avoid blur)
3. Ensure face takes up 30-50% of image

### Error: "Invalid user or unregistered face"

**Cause:** Face not in FaceSet OR confidence too low.

**Solutions:**
1. Register user first (5 angles)
2. Lower confidence threshold from 75 to 60 in code if needed
3. Re-register with better lighting

### Search returns confidence too low (< 75%)

**Cause:** Different lighting/angle from registration.

**Fix in code:** Lower confidence threshold in `search_face()`:
```python
face_system.search_face(image_bytes, confidence_threshold=0.60)  # Changed from 0.75
```

---

## API Endpoints

### 1. Register Face (5 angles)
```
POST /api/register_face_multi_angle
Body: {
  "user_id": "EMP001",
  "face_images": {
    "front": "data:image/jpeg;base64,...",
    "left": "data:image/jpeg;base64,...",
    "right": "data:image/jpeg;base64,...",
    "up": "data:image/jpeg;base64,...",
    "down": "data:image/jpeg;base64,..."
  }
}
```

### 2. Scan/Verify Face
```
POST /api/recognize
Body: {
  "image": "data:image/jpeg;base64,...",
  "location": {
    "latitude": 17.937823,
    "longitude": 79.848803
  }
}
```

### 3. Health Check
```
GET /api/health
```

### 4. Initialize FaceSet
```
POST /api/init_facepp_faceset
```

---

## Migration from Previous System

If you had the old dlib/Azure system:

1. ✅ Old face encodings in DB will be ignored
2. ✅ All users need to re-register faces (with 5 angles)
3. ✅ Attendance records stay intact
4. ✅ All other endpoints work same as before

---

## Next Steps

1. ✅ Create Face++ account (faceplusplus.com)
2. ✅ Get API credentials
3. ✅ Set `.env` file
4. ✅ `pip install -r requirements.txt`
5. ✅ Call `/api/init_facepp_faceset`
6. ✅ Test with registration + scan
7. ✅ Deploy to Render

---

## Support

- **Face++ Docs:** https://www.faceplusplus.com/api-overview/
- **Render Docs:** https://render.com/docs
- **This guide:** See FACEPP_SETUP_GUIDE.md

---

**Ready to go!** 🚀

No credit card needed. 1000 free API calls per day. That's it.
