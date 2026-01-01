# Quick Start: Public Testing on Mobile

## Easiest Method: Cloudflare Tunnel (Recommended)

### Step 1: Install Cloudflare Tunnel

```bash
brew install cloudflared
```

### Step 2: Start Your App

```bash
npm run dev
```

Wait for all services to start (you'll see 3 servers running).

### Step 3: Expose with Cloudflare Tunnel

Open **3 new terminal windows** and run:

**Terminal 2 (Server):**
```bash
cloudflared tunnel --url http://localhost:3001
```
Copy the HTTPS URL (e.g., `https://xxxx-xxxx.trycloudflare.com`)

**Terminal 3 (Receiver):**
```bash
cloudflared tunnel --url http://localhost:5173
```
Copy the HTTPS URL

**Terminal 4 (Mobile):**
```bash
cloudflared tunnel --url http://localhost:5174
```
Copy the HTTPS URL

### Step 4: Update Environment Variables

Create/update `.env` file in the root:

```bash
# Server tunnel URL (from Terminal 2)
VITE_SERVER_URL=https://xxxx-xxxx.trycloudflare.com
```

### Step 5: Restart Frontend Apps

Stop the current `npm run dev` (Ctrl+C) and restart:

```bash
npm run dev
```

### Step 6: Test on Mobile

1. Open the **Receiver URL** (from Terminal 3) on your desktop
2. Open the **Mobile URL** (from Terminal 4) on your mobile device
3. Test the image upload flow!

---

## Alternative: ngrok (If you prefer)

### Step 1: Install & Setup

```bash
brew install ngrok
# Sign up at https://ngrok.com (free)
# Get authtoken from dashboard
ngrok config add-authtoken YOUR_TOKEN
```

### Step 2: Start App & Expose

Same as Cloudflare, but use `ngrok` instead:

```bash
# Terminal 2
ngrok http 3001

# Terminal 3
ngrok http 5173

# Terminal 4
ngrok http 5174
```

Update `.env` with the server ngrok URL and restart.

---

## Notes

- **Tunnel URLs change** each time you restart the tunnel
- **HTTPS is required** for camera access on mobile
- **CORS is now open** in development mode for testing
- The server accepts connections from any origin in development

---

## Troubleshooting

**Connection issues?**
- Make sure all 3 tunnels are running
- Check that `.env` has the correct `VITE_SERVER_URL`
- Restart the frontend apps after updating `.env`

**CORS errors?**
- The server is configured to allow any origin in development
- If issues persist, check tunnel URLs are correct

