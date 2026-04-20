# Face Attendance App - Face++ Migration

## ⚡ What's New

Your face attendance backend has been **completely rewritten** to use **Face++ (Megvii)** instead of local dlib processing.

### Changes at a Glance

| Aspect | Before | After |
|--------|--------|-------|
| **Face Recognition** | Dlib (local, 800MB) | Face++ API (cloud, free) |
| **Accuracy** | 99.38% | 99%+ |
| **Backend Size** | 800MB+ | ~20MB |
| **Cost** | ₹0 (but unreliable) | ₹0 (reliable, always-on) |
| **Credit Card** | N/A | ❌ Not needed |
| **Latency** | ~50ms | ~200-500ms (network) |
| **Deployment** | Your PC + ngrok | Render/Railway (free tier) |

---

## 🚀 Quick Start (3 minutes)

### 1. Create Face++ Account
Go to [faceplusplus.com](https://www.faceplusplus.com) → Sign up with email (no card needed)

### 2. Get Credentials
- Dashboard → "API Key"
- Copy: API Key + API Secret

### 3. Set Environment Variables
```bash
# Windows PowerShell
$env:FACEPP_API_KEY = "your_key"
$env:FACEPP_API_SECRET = "your_secret"

# Linux/Mac
export FACEPP_API_KEY="your_key"
export FACEPP_API_SECRET="your_secret"
```

### 4. Install Dependencies
```bash
pip install -r requirements.txt
```

### 5. Initialize FaceSet
```bash
# Terminal 1
python app.py

# Terminal 2
curl -X POST http://localhost:5000/api/init_facepp_faceset
```

### 6. Test
Register a user with 5 angles, then scan!

---

## 📚 Full Documentation

See [FACEPP_SETUP_GUIDE.md](./FACEPP_SETUP_GUIDE.md) for detailed setup.

---

## 🔧 What Changed in Code

### Files Modified
1. **requirements.txt** - Removed dlib, kept requests
2. **app.py** - Rewritten FaceSystem class + updated endpoints

### New Endpoints
- **`/api/init_facepp_faceset`** - Initialize FaceSet (call once)
- Same recognition/registration endpoints (updated logic)

### Everything Else
- Location checking ✅ (unchanged)
- Attendance marking ✅ (unchanged)  
- Database models ✅ (unchanged)
- API responses ✅ (unchanged)

---

## 💰 Cost Breakdown

| Item | Cost | Why Free |
|------|------|----------|
| Face++ API | ₹0 | 1000 calls/day free tier |
| Render Web | ₹0 | Free tier Web Service |
| UptimeRobot | ₹0 | Prevents auto-sleep |
| PostgreSQL | ₹0 | 1GB free on Render |
| **Total** | **₹0** | Permanently free |

---

## ⚠️ Important Notes

### Face++ Free Tier
- **1,000 API calls per day** = ~30,000/month
- You need ~200 staff × 2 scans × 25 days = 10,000/month ✓
- **No card required, forever free**

### Registration Process
1. User uploads 5 face angles
2. Each angle is added to Face++ FaceSet
3. Takes ~1-2 seconds total
4. Face++ is ready to identify immediately

### Confidence Threshold
- Current: 75% (0.75)
- For college: 70-80% is good
- Adjust in code if too strict/lenient

---

## 📋 Migration Checklist

- [ ] Create Face++ account (faceplusplus.com)
- [ ] Get API Key + API Secret
- [ ] Set environment variables
- [ ] Install: `pip install -r requirements.txt`
- [ ] Call `/api/init_facepp_faceset`
- [ ] Test: Register user with 5 angles
- [ ] Test: Scan and verify attendance
- [ ] Deploy to Render
- [ ] Set up UptimeRobot (optional but recommended)

---

## 🆘 Troubleshooting

### "Face++ not configured"
→ Set `FACEPP_API_KEY` and `FACEPP_API_SECRET`

### "Failed to initialize FaceSet"
→ Check credentials are correct, try again

### "No face detected"
→ Better lighting, keep phone still, face 30-50% of image

### "Invalid user or unregistered face"
→ User not registered yet, or confidence too low

For detailed help: See [FACEPP_SETUP_GUIDE.md#troubleshooting](./FACEPP_SETUP_GUIDE.md#troubleshooting)

---

## 🎯 Next: Deploy to Render (Free Tier)

1. Push code to GitHub
2. Connect GitHub to [render.com](https://render.com)
3. Create Web Service
4. Set environment variables
5. Deploy

See step-by-step in [FACEPP_SETUP_GUIDE.md#step-7-deploy-to-render](./FACEPP_SETUP_GUIDE.md#step-7-deploy-to-render)

---

## 📞 Support

- **Face++ API Docs:** https://www.faceplusplus.com/api-overview/
- **Render Docs:** https://render.com/docs
- **Setup Guide:** See [FACEPP_SETUP_GUIDE.md](./FACEPP_SETUP_GUIDE.md)

---

**You're ready to go!** 🎉

Backend is now ~20MB, always-on, no credit card needed. Next: Sign up on Face++ and deploy to Render.
