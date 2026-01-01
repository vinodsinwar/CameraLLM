# 🚀 Quick Start: Deploy to Render

Your code is on GitHub: **https://github.com/vinodsinwar/CameraLLM.git**

## Step-by-Step Deployment

### 1️⃣ Deploy Backend (Web Service)

1. **Go to Render:** https://render.com
2. **Sign up/Login** with GitHub
3. **Click "New +"** → **"Web Service"**
4. **Connect Repository:**
   - Select: `vinodsinwar/CameraLLM`
   - Branch: `main`
5. **Configure Service:**
   ```
   Name: camera-analyzer-backend
   Region: (choose closest)
   Branch: main
   Root Directory: (leave empty)
   Runtime: Node
   Build Command: cd server && npm install
   Start Command: cd server && npm start
   Instance Type: Free
   ```
6. **Add Environment Variables:**
   - `GEMINI_API_KEY` = (your API key)
   - `NODE_ENV` = `production`
   - `PORT` = `10000` (or leave auto)
7. **Click "Create Web Service"**
8. **Wait for deployment** (2-5 minutes)
9. **Copy the URL** (e.g., `https://camera-analyzer-backend.onrender.com`)

### 2️⃣ Deploy Frontend (Static Site)

1. **In Render dashboard, click "New +"** → **"Static Site"**
2. **Connect Repository:**
   - Select: `vinodsinwar/CameraLLM`
   - Branch: `main`
3. **Configure:**
   ```
   Name: camera-analyzer-frontend
   Branch: main
   Root Directory: receiver
   Build Command: npm install && npm run build
   Publish Directory: dist
   ```
4. **Add Environment Variable:**
   - `VITE_SERVER_URL` = (your backend URL from step 1)
     Example: `https://camera-analyzer-backend.onrender.com`
5. **Click "Create Static Site"**
6. **Wait for deployment** (1-2 minutes)
7. **Copy the frontend URL**

### 3️⃣ Update Backend CORS

1. **Go back to backend service**
2. **Click "Environment" tab**
3. **Add:**
   - `FRONTEND_URL` = (your frontend URL from step 2)
4. **Save** (will auto-redeploy)

### 4️⃣ Test

1. **Backend:** Visit `https://your-backend.onrender.com/health`
   - Should show: `{"status":"ok"}`

2. **Frontend:** Visit your frontend URL
   - Should load the app

3. **Mobile:** Open frontend URL on your phone
   - Click "Capture Image"
   - Should work! 🎉

---

## 📋 Environment Variables Summary

### Backend:
- `GEMINI_API_KEY` = your API key
- `NODE_ENV` = `production`
- `FRONTEND_URL` = frontend URL (add after frontend deploys)

### Frontend:
- `VITE_SERVER_URL` = backend URL

---

## ⚠️ Important Notes

- **Free tier spins down after 15 min inactivity**
- **First request after spin-down takes 30-60 seconds** (cold start)
- **WebSocket may have limitations on free tier** (app should still work)

---

## ✅ You're Done!

Your app will be accessible at:
- **Frontend:** `https://camera-analyzer-frontend.onrender.com`
- **Backend:** `https://camera-analyzer-backend.onrender.com`

Open the frontend URL on any device, including mobile! 📱

