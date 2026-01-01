# Free Deployment Guide - Public Access from Mobile

This guide shows you how to deploy the app for free so you can access it from any mobile device.

## 🎯 Best Free Options

### Option 1: Railway (Recommended - Easiest)
**Why:** Supports WebSockets, free tier, easy deployment
**Free Tier:** $5 credit/month (usually enough for small apps)

### Option 2: Render
**Why:** Free tier, supports WebSockets, good for full-stack
**Free Tier:** Free with limitations (spins down after inactivity)

### Option 3: Vercel (Frontend) + Railway/Render (Backend)
**Why:** Best performance, separate frontend/backend
**Free Tier:** Both have free tiers

---

## 🚀 Quick Deploy: Railway (Recommended)

### Step 1: Prepare for Deployment

1. **Create `railway.json` in root:**
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "cd server && npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

2. **Update `server/server.js` to use environment PORT:**
```javascript
const PORT = process.env.PORT || 3001;
```

3. **Create `Procfile` in root (for Railway):**
```
web: cd server && npm start
```

### Step 2: Deploy to Railway

1. Go to https://railway.app
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway will auto-detect and deploy

### Step 3: Set Environment Variables

In Railway dashboard:
- `GEMINI_API_KEY` = your Gemini API key
- `NODE_ENV` = `production`
- `PORT` = (auto-set by Railway)

### Step 4: Get Your Backend URL

Railway will give you a URL like: `https://your-app.railway.app`

### Step 5: Deploy Frontend to Vercel

1. Go to https://vercel.com
2. Sign up with GitHub
3. Click "New Project" → Import your repo
4. **Root Directory:** Set to `receiver`
5. **Build Command:** `npm run build`
6. **Output Directory:** `dist`
7. **Environment Variables:**
   - `VITE_SERVER_URL` = your Railway backend URL

### Step 6: Access Your App

- Frontend: `https://your-app.vercel.app`
- Backend: `https://your-app.railway.app`

---

## 🌐 Alternative: Render (All-in-One)

### Step 1: Prepare

1. Create `render.yaml` in root:
```yaml
services:
  - type: web
    name: camera-analyzer-backend
    env: node
    buildCommand: cd server && npm install
    startCommand: cd server && npm start
    envVars:
      - key: GEMINI_API_KEY
        sync: false
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000

  - type: web
    name: camera-analyzer-frontend
    env: static
    buildCommand: cd receiver && npm install && npm run build
    staticPublishPath: receiver/dist
```

### Step 2: Deploy

1. Go to https://render.com
2. Sign up with GitHub
3. Create "New Web Service"
4. Connect your GitHub repo
5. Render will auto-detect and deploy

---

## 📱 Quick Deploy: Vercel + Railway (Best Performance)

### Backend (Railway)

1. **Create `railway.json`:**
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "cd server && npm start"
  }
}
```

2. Deploy to Railway (see steps above)

### Frontend (Vercel)

1. **Create `vercel.json` in `receiver/` folder:**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://your-backend.railway.app/api/:path*"
    },
    {
      "source": "/socket.io/:path*",
      "destination": "https://your-backend.railway.app/socket.io/:path*"
    }
  ]
}
```

2. Deploy to Vercel:
   - Connect GitHub repo
   - Root directory: `receiver`
   - Environment: `VITE_SERVER_URL` = your Railway URL

---

## 🔧 Required Code Changes

### 1. Update Server CORS

In `server/server.js`, update CORS to allow your frontend domain:

```javascript
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:5173',
  'http://localhost:5174',
  process.env.FRONTEND_URL // Add your Vercel/Render URL
];
```

### 2. Update Frontend WebSocket URL

The `useWebSocket.js` hook already uses `VITE_SERVER_URL`, so just set it in environment variables.

---

## 🎯 Simplest Option: Render (Single Platform)

Render can host both frontend and backend:

1. **Backend Service:**
   - Type: Web Service
   - Build: `cd server && npm install`
   - Start: `cd server && npm start`
   - Port: `10000` (Render default)

2. **Frontend Service:**
   - Type: Static Site
   - Build: `cd receiver && npm install && npm run build`
   - Publish: `receiver/dist`

---

## 📝 Environment Variables Checklist

### Backend (Railway/Render):
- `GEMINI_API_KEY` = your API key
- `NODE_ENV` = `production`
- `PORT` = (auto-set)
- `ALLOWED_ORIGINS` = your frontend URL

### Frontend (Vercel/Render):
- `VITE_SERVER_URL` = your backend URL (e.g., `https://your-app.railway.app`)

---

## 🚀 Quick Start Commands

### Railway:
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Deploy
railway up
```

### Vercel:
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd receiver
vercel
```

---

## ✅ After Deployment

1. **Test Backend:**
   - Visit: `https://your-backend.railway.app/health`
   - Should return: `{"status":"ok"}`

2. **Test Frontend:**
   - Visit: `https://your-frontend.vercel.app`
   - Should load the app

3. **Test on Mobile:**
   - Open the frontend URL on your phone
   - Click "Capture Image"
   - Should work!

---

## 🆓 Free Tier Limits

### Railway:
- $5 credit/month
- Usually enough for small apps
- No credit card required for free tier

### Render:
- Free tier available
- Spins down after 15 min inactivity
- Wakes up on first request (may take 30-60 seconds)

### Vercel:
- Unlimited for personal projects
- Great performance
- Free SSL

---

## 🎉 Recommended Setup

**For Best Performance:**
- Frontend: Vercel (free, fast, global CDN)
- Backend: Railway (free tier, WebSocket support)

**For Simplest Setup:**
- Both: Render (one platform, easy setup)

Choose the option that works best for you!

