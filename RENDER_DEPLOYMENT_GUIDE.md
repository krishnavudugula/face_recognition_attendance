# 🚀 Deploy to Render (Free Tier)

Your Face++ backend is ready to deploy!

## Step 1: Push to GitHub

### 1.1 Create GitHub Repository
1. Go to https://github.com/new
2. Create repo: `face-attendance-app`
3. Copy the SSH or HTTPS URL

### 1.2 Push Your Code
```bash
# Add remote (replace URL with your repo)
git remote add origin https://github.com/YOUR_USERNAME/face-attendance-app.git

# Push to main branch
git branch -M main
git push -u origin main
```

---

## Step 2: Deploy to Render

### 2.1 Connect Render to GitHub
1. Go to https://render.com (free account)
2. Click "New +" → "Web Service"
3. Select "GitHub" → "Connect account"
4. Search and select `face-attendance-app` repo
5. Click "Connect"

### 2.2 Configure Render Service
**Settings:**
- **Name**: `face-attendance-api`
- **Environment**: `Python 3`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `gunicorn app:app`
- **Instance Type**: `Free`

### 2.3 Set Environment Variables
Click "Add Environment Variable" and add:

```
FACEPP_API_KEY = IHjUolSBEnpmgK1d6JXMi-6R0ji1gulI
FACEPP_API_SECRET = D9rbrBXjE4D60n4YBe4OoRw4h6UciNQR
FACEPP_FACESET_ID = bits_faculty
FLASK_ENV = production
```

⚠️ **Protect .env file** - `.gitignore` already excludes it, so credentials are NOT pushed to GitHub.

### 2.4 Deploy
Click "Create Web Service"
- Render auto-deploys after each GitHub push
- Gets a public URL like: `https://face-attendance-api.onrender.com`

---

## Step 3: Keep Backend Always-On

Render free tier shuts down inactive apps. Use UptimeRobot to keep it alive:

1. Go to https://uptimerobot.com (free account)
2. Click "Create Monitor" → "HTTP(s)"
3. **URL**: `https://face-attendance-api.onrender.com/api/health`
4. **Interval**: `5 minutes`
5. Save

✅ UptimeRobot pings your backend every 5 minutes → always stays awake!

---

## Step 4: Update Android App

Once deployed, update your Android app's backend URL:

**File**: `www/js/config.js`

Change:
```javascript
const API_BASE_URL = "http://192.168.1.X:5000"; // Local
```

To:
```javascript
const API_BASE_URL = "https://face-attendance-api.onrender.com"; // Deployed
```

Then rebuild and redeploy Android app.

---

## Step 5: Test Live Deployment

### Test 1: Health Check
```
https://face-attendance-api.onrender.com/api/health
→ Response: {"message": "Backend is running", "status": "ok"}
```

### Test 2: Register Face
Use Android app → Register user → 5 face angles uploaded → Face++ processes

### Test 3: Recognize Face
Use Android app → Scan → Face recognized → Attendance marked ✅

---

## Troubleshooting

**Error: 502 Bad Gateway**
- Wait 1-2 minutes (Render takes time to start)
- Check Render logs for errors

**Error: FACEPP credentials invalid**
- Verify env vars in Render dashboard
- Check FACEPP_API_KEY and FACEPP_API_SECRET are correct

**App keeps going offline**
- Make sure UptimeRobot is monitoring `/api/health`
- Check UptimeRobot shows "Up"

---

## Cost

| Service | Cost |
|---------|------|
| Render (backend) | ₹0 (free tier, always-on with UptimeRobot) |
| Face++ (API calls) | ₹0 (1,000 calls/day = 30k/month free) |
| UptimeRobot (monitoring) | ₹0 (free tier) |
| **Total** | **₹0 forever** 🎉 |

---

## Next Steps

1. ✅ Backend running locally
2. ⏭️ Push to GitHub
3. ⏭️ Deploy to Render
4. ⏭️ Setup UptimeRobot
5. ⏭️ Update Android app URL
6. ⏭️ Test registration and recognition
