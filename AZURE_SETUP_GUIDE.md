# Azure Face API Migration Setup Guide

## Overview

This app has been migrated from **dlib** (local face recognition) to **Azure Face API** (cloud-based).

### What Changed?
- ❌ Removed: dlib, face_recognition library (800MB+ downloads)
- ✅ Added: Azure Cognitive Services Face API (lightweight)
- ✅ Benefit: Better accuracy (99.9% vs 99.38%), no server computation, always-on service

**Backend size reduction:** 800MB → ~30MB

---

## Step 1: Create Azure Account & Face API Resource

1. Go to [portal.azure.com](https://portal.azure.com)
2. Click "Create a resource" → Search for "Face"
3. Select "Face" → Click "Create"
4. Choose tier: **F0 (Free)** - Permanently free, 30,000 transactions/month
5. Set:
   - **Resource group:** Create new (e.g., "attendance-system")
   - **Name:** `attendance-face-api` (or any name)
   - **Region:** Choose closest to your users (e.g., "Southeast Asia" for India)
6. Click "Create" → Wait 2-3 minutes

---

## Step 2: Get Your API Credentials

1. Go to resource → Click "Keys and Endpoint" (left sidebar)
2. Copy:
   - **Key 1** → Paste as `AZURE_FACE_KEY`
   - **Endpoint** → Paste as `AZURE_FACE_ENDPOINT`

Example endpoint: `https://southeastasia.api.cognitive.microsoft.com/`

---

## Step 3: Configure Environment Variables

### Local Development

Create a `.env` file in the project root:

```bash
AZURE_FACE_ENDPOINT=https://southeastasia.api.cognitive.microsoft.com/
AZURE_FACE_KEY=your_key_here_abc123xyz
AZURE_PERSON_GROUP_ID=attendance-system
DATABASE_URL=sqlite:///face_attendance.db
```

### Production (Render.com)

On Render dashboard:
1. Go to your service → Environment
2. Add these variables:
   ```
   AZURE_FACE_ENDPOINT=https://southeastasia.api.cognitive.microsoft.com/
   AZURE_FACE_KEY=<your_key>
   DATABASE_URL=postgresql://... (Render auto-provides this)
   ```

---

## Step 4: Install Updated Dependencies

```bash
pip install -r requirements.txt
```

This installs:
- `azure-cognitiveservices-vision-face` (Azure SDK)
- `msrest` (Azure authentication)
- Removes: `dlib`

---

## Step 5: Initialize PersonGroup (One-time setup)

Make a POST request to initialize the PersonGroup:

```bash
curl -X POST http://localhost:5000/api/init_azure_persongroup
```

Expected response:
```json
{
  "success": true,
  "message": "PersonGroup 'attendance-system' created successfully",
  "person_group_id": "attendance-system"
}
```

If PersonGroup already exists, you'll get:
```json
{
  "success": true,
  "message": "PersonGroup 'attendance-system' already exists"
}
```

---

## Step 6: Run Locally (Optional)

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
export AZURE_FACE_ENDPOINT=https://southeastasia.api.cognitive.microsoft.com/
export AZURE_FACE_KEY=your_key_here

# Run Flask
python app.py
```

Then in another terminal, initialize PersonGroup:
```bash
curl -X POST http://localhost:5000/api/init_azure_persongroup
```

---

## Step 7: Deploy to Render (or Railway/Fly.io)

### Option A: Render.com (Recommended)

1. Push code to GitHub
2. Connect GitHub to Render
3. Create new "Web Service"
4. Set build command: `pip install -r requirements.txt`
5. Set start command: `gunicorn app:app --workers 4 --bind 0.0.0.0:8000`
6. Add environment variables (from Step 3)
7. Deploy

To prevent spin-down (free tier sleeps after 15 min):
- Use [UptimeRobot](https://uptimerobot.com) (free)
- Add monitor: Ping `https://your-app-url/api/health` every 10 minutes

### Option B: Railway.com

Similar to Render, but Railway's free tier doesn't auto-sleep.

### Option C: Fly.io

Free tier with 3 shared-cpu VMs. Always-on (no sleep).

---

## How It Works Now

### Registration (5-angle face capture)

**Old flow:**
```
Image → dlib → extract encoding → store locally → done (50ms, local)
```

**New flow:**
```
Image → Azure Detect → Azure Add to PersonGroup → training initiated → done (500-1000ms, cloud)
        ↓
      Training complete (10-30 seconds) → PersonGroup ready for identify
```

**Client side:** User uploads 5 angles. Server adds each to PersonGroup. Then trains.

### Verification (scan face)

**Old flow:**
```
Image → dlib extract → compare against all stored encodings (100ms) → return user_id
```

**New flow:**
```
Image → Azure Detect (face_id) → Azure Identify → return person_id (user_id) (200-500ms)
```

**Latency trade-off:** +150-300ms network delay, but more accurate and no server load.

---

## Troubleshooting

### Error: "Azure Face API not initialized"

**Cause:** `AZURE_FACE_ENDPOINT` or `AZURE_FACE_KEY` not set.

**Fix:**
```bash
export AZURE_FACE_ENDPOINT=https://southeastasia.api.cognitive.microsoft.com/
export AZURE_FACE_KEY=your_key
```

### Error: "PersonGroup training failed"

**Cause:** PersonGroup not initialized OR training in progress.

**Fix:**
1. Call `/api/init_azure_persongroup` first
2. Wait 10-30 seconds after first face registration
3. Then try scanning

### Error: "Invalid user or unregistered face"

**Cause:** Face not in PersonGroup OR confidence too low.

**Solutions:**
1. Register the user again (with 5 angles)
2. Lower confidence threshold in `recognize()` from `0.6` to `0.5`
3. Ensure good lighting during capture

### PersonGroup stuck "training"

**Workaround:** Check Azure Portal → Delete PersonGroup → Re-run `/api/init_azure_persongroup`

---

## Azure Free Tier Limits

| Feature | Limit | Typical Usage |
|---------|-------|---------------|
| Transactions/month | 30,000 | 200 staff × 2 scans/day × 25 days = 10,000 ✓ |
| Requests/minute | 20 | Should be fine for college |
| Face detection | 1 per request | OK |
| Face identification | 1 per request | OK |

**Status:** You're well within free tier limits.

---

## Database Migration

If you're moving from SQLite to PostgreSQL (Render):

1. Export SQLite data:
   ```bash
   sqlite3 face_attendance.db .dump > backup.sql
   ```

2. On PostgreSQL, create tables first by running your Flask app with new DB URL

3. Import data as needed

---

## Cost Estimate

| Component | Cost | Notes |
|-----------|------|-------|
| Azure Face API (F0) | ₹0 | 30k transactions free, forever |
| Render PostgreSQL | ₹0 | 1GB free storage |
| Render Web Service | ₹0 | 750 hours/month free (always-on setup possible) |
| UptimeRobot | ₹0 | Prevents Render sleep |
| **Total** | **₹0** | Permanently free for small deployment |

---

## Next Steps

1. ✅ Create Azure Account + Face API
2. ✅ Get credentials, set `.env`
3. ✅ Install requirements
4. ✅ Call `/api/init_azure_persongroup`
5. ✅ Test register with 5 angles
6. ✅ Test scan/verify
7. ✅ Deploy to Render

You're ready to go!

---

## Questions?

- Azure Face API docs: https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/overview-identity
- Render deployment: https://render.com/docs
- UptimeRobot setup: https://uptimerobot.com/help/
