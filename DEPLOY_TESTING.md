# Public Testing Setup Guide

This guide helps you make the application publicly accessible for testing on mobile devices.

## Option 1: Using Cloudflare Tunnel (Free, No Signup Required)

Cloudflare Tunnel (cloudflared) is free and doesn't require signup for basic use.

### Installation

```bash
# macOS
brew install cloudflared

# Or download from: https://github.com/cloudflare/cloudflared/releases
```

### Start Your Application

```bash
# Terminal 1: Start all services
npm run dev
```

### Expose with Cloudflare Tunnel

```bash
# Terminal 2: Expose server (port 3001)
cloudflared tunnel --url http://localhost:3001

# Terminal 3: Expose receiver (port 5173)
cloudflared tunnel --url http://localhost:5173

# Terminal 4: Expose mobile (port 5174)
cloudflared tunnel --url http://localhost:5174
```

You'll get URLs like:
- Server: `https://xxxx-xxxx.trycloudflare.com`
- Receiver: `https://yyyy-yyyy.trycloudflare.com`
- Mobile: `https://zzzz-zzzz.trycloudflare.com`

**Important:** Update the frontend to use the server tunnel URL:
- Update `receiver/vite.config.js` proxy target to the server tunnel URL
- Update `mobile/vite.config.js` proxy target to the server tunnel URL
- Or use the tunnel URLs directly in your frontend code

---

## Option 2: Using ngrok (Requires Free Account)

### Installation

```bash
# macOS
brew install ngrok

# Or download from: https://ngrok.com/download
```

### Signup & Setup

1. Sign up at https://ngrok.com (free)
2. Get your authtoken from dashboard
3. Configure: `ngrok config add-authtoken YOUR_TOKEN`

### Start Your Application

```bash
# Terminal 1: Start all services
npm run dev
```

### Expose with ngrok

```bash
# Terminal 2: Expose server (port 3001)
ngrok http 3001

# Terminal 3: Expose receiver (port 5173)
ngrok http 5173

# Terminal 4: Expose mobile (port 5174)
ngrok http 5174
```

You'll get URLs like:
- Server: `https://xxxx-xxxx-xxxx.ngrok-free.app`
- Receiver: `https://yyyy-yyyy-yyyy.ngrok-free.app`
- Mobile: `https://zzzz-zzzz-zzzz.ngrok-free.app`

**Important:** Update the frontend to use the server tunnel URL (same as Cloudflare above).

---

## Option 3: Using localtunnel (Free, No Signup)

### Installation

```bash
npm install -g localtunnel
```

### Start Your Application

```bash
# Terminal 1: Start all services
npm run dev
```

### Expose with localtunnel

```bash
# Terminal 2: Expose server (port 3001)
lt --port 3001

# Terminal 3: Expose receiver (port 5173)
lt --port 5173

# Terminal 4: Expose mobile (port 5174)
lt --port 5174
```

You'll get URLs like:
- Server: `https://xxxx.loca.lt`
- Receiver: `https://yyyy.loca.lt`
- Mobile: `https://zzzz.loca.lt`

---

## Quick Setup Script

Create a helper script to make this easier:

```bash
# Create deploy-test.sh
cat > deploy-test.sh << 'EOF'
#!/bin/bash

echo "🚀 Starting Remote Camera App for Public Testing"
echo ""

# Start the app in background
npm run dev &
APP_PID=$!

# Wait for services to start
sleep 5

echo "✅ App started on:"
echo "   Server: http://localhost:3001"
echo "   Receiver: http://localhost:5173"
echo "   Mobile: http://localhost:5174"
echo ""
echo "📱 Now expose with your preferred tunnel service:"
echo ""
echo "Option 1 - Cloudflare (Recommended):"
echo "   cloudflared tunnel --url http://localhost:3001"
echo "   cloudflared tunnel --url http://localhost:5173"
echo "   cloudflared tunnel --url http://localhost:5174"
echo ""
echo "Option 2 - ngrok:"
echo "   ngrok http 3001"
echo "   ngrok http 5173"
echo "   ngrok http 5174"
echo ""
echo "Press Ctrl+C to stop all services"
wait $APP_PID
EOF

chmod +x deploy-test.sh
```

---

## Important Notes

1. **CORS Configuration**: The server is now configured to allow any origin in development mode for testing.

2. **HTTPS Required**: Mobile browsers require HTTPS for:
   - Camera access
   - PWA installation
   - WebSocket connections (WSS)

3. **Tunnel URLs Change**: Tunnel URLs change each time you restart the tunnel. For production, use a fixed domain.

4. **Security**: These tunnels are for **testing only**. Don't use in production without proper security measures.

5. **Update Frontend URLs**: After getting tunnel URLs, you may need to update:
   - WebSocket connection URLs in `useWebSocket.js` hooks
   - API endpoints if not using proxy

---

## Testing on Mobile Device

1. Get the tunnel URLs for receiver and mobile interfaces
2. Open the receiver URL on your desktop browser
3. Open the mobile URL on your mobile device
4. Test the image upload and analysis flow

---

## Production Deployment

For production, consider:
- **Vercel/Netlify**: For frontend (receiver & mobile)
- **Railway/Render**: For backend server
- **Custom VPS**: Full control with nginx reverse proxy

