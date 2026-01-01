# Render Deployment Guide - Step by Step

Your code is now on GitHub: https://github.com/vinodsinwar/CameraLLM.git

## 🚀 Deploy to Render (Free)

### Step 1: Create Backend Service

1. Go to https://render.com
2. Sign up/Login with GitHub
3. Click "New +" → "Web Service"
4. Connect your repository: `vinodsinwar/CameraLLM`
5. Configure:
   - **Name:** `camera-analyzer-backend`
   - **Region:** Choose closest to you
   - **Branch:** `main`
   - **Root Directory:** (leave empty - root is fine)
   - **Runtime:** `Node`
   - **Build Command:** `cd server && npm install`
   - **Start Command:** `cd server && npm start`
   - **Instance Type:** Free

6. **Environment Variables:**
   - `GEMINI_API_KEY` = your Gemini API key
   - `NODE_ENV` = `production`
   - `PORT` = `10000` (Render default, but auto-set)
   - `FRONTEND_URL` = (we'll add this after frontend is deployed)

7. Click "Create Web Service"

### Step 2: Wait for Backend to Deploy

- Render will build and deploy (takes 2-5 minutes)
- Copy the backend URL (e.g., `https://camera-analyzer-backend.onrender.com`)

### Step 3: Create Frontend Service

1. In Render dashboard, click "New +" → "Static Site"
2. Connect repository: `vinodsinwar/CameraLLM`
3. Configure:
   - **Name:** `camera-analyzer-frontend`
   - **Branch:** `main`
   - **Root Directory:** `receiver`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`

4. **Environment Variables:**
   - `VITE_SERVER_URL` = your backend URL from Step 2
     (e.g., `https://camera-analyzer-backend.onrender.com`)

5. Click "Create Static Site"

### Step 4: Update Backend CORS

1. Go back to your backend service in Render
2. Go to "Environment" tab
3. Add/Update:
   - `FRONTEND_URL` = your frontend URL (e.g., `https://camera-analyzer-frontend.onrender.com`)
4. Save changes (will auto-redeploy)

### Step 5: Test

1. **Backend:** Visit `https://camera-analyzer-backend.onrender.com/health`
   - Should return: `{"status":"ok"}`

2. **Frontend:** Visit your frontend URL
   - Should load the app

3. **Mobile:** Open frontend URL on your phone
   - Click "Capture Image"
   - Should work!

---

## 📝 Important Notes

### Render Free Tier:
- **Spins down after 15 minutes of inactivity**
- **First request after spin-down takes 30-60 seconds** (cold start)
- **After first request, stays active for 15 minutes**
- Perfect for testing and personal use!

### WebSocket Support:
- Render supports WebSockets on paid plans
- For free tier, you may need to use polling fallback
- The app should still work, but real-time updates may be slower

### Environment Variables Checklist:

**Backend:**
- ✅ `GEMINI_API_KEY`
- ✅ `NODE_ENV` = `production`
- ✅ `FRONTEND_URL` = frontend URL

**Frontend:**
- ✅ `VITE_SERVER_URL` = backend URL

---

## 🔧 Troubleshooting

### Backend not starting?
- Check logs in Render dashboard
- Verify `GEMINI_API_KEY` is set
- Check build logs for errors

### Frontend can't connect to backend?
- Verify `VITE_SERVER_URL` is correct
- Check backend is running (visit `/health`)
- Verify CORS settings in backend

### WebSocket not working?
- Free tier may have limitations
- Check browser console for errors
- May need to upgrade to paid plan for full WebSocket support

---

## 🎉 You're Done!

Once deployed, you'll have:
- **Backend:** `https://camera-analyzer-backend.onrender.com`
- **Frontend:** `https://camera-analyzer-frontend.onrender.com`

Access the frontend URL from any device, including mobile!

