# Cloudflare Tunnel Setup - Step by Step

## ✅ Prerequisites Complete
- ✅ cloudflared is installed (version 2025.11.1)
- ✅ Server is configured to accept any origin in development

## 🚀 Setup Steps

### Step 1: Start Your Application

In your main terminal, run:
```bash
npm run dev
```

Wait until you see all 3 servers running:
- Server: http://localhost:3001
- Receiver: http://localhost:5173  
- Mobile: http://localhost:5174

### Step 2: Open 3 New Terminal Windows

You need 3 separate terminal windows for the tunnels.

### Step 3: Start Cloudflare Tunnels

**Terminal 2 - Server Tunnel:**
```bash
cloudflared tunnel --url http://localhost:3001
```

You'll see output like:
```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable): |
|  https://xxxx-xxxx.trycloudflare.com                                                       |
+--------------------------------------------------------------------------------------------+
```

**Copy this URL!** This is your server URL.

---

**Terminal 3 - Receiver Tunnel:**
```bash
cloudflared tunnel --url http://localhost:5173
```

Copy the URL (e.g., `https://yyyy-yyyy.trycloudflare.com`)

---

**Terminal 4 - Mobile Tunnel:**
```bash
cloudflared tunnel --url http://localhost:5174
```

Copy the URL (e.g., `https://zzzz-zzzz.trycloudflare.com`)

### Step 4: Update Environment Variables

Edit your `.env` file in the root directory and add:

```bash
# Cloudflare Tunnel Server URL (from Terminal 2)
VITE_SERVER_URL=https://xxxx-xxxx.trycloudflare.com
```

**Important:** Replace `xxxx-xxxx` with your actual server tunnel URL!

### Step 5: Restart Your Application

Stop the current `npm run dev` (Ctrl+C) and restart:

```bash
npm run dev
```

### Step 6: Test on Mobile Device

1. **On Desktop:** Open the Receiver URL (from Terminal 3)
   - Example: `https://yyyy-yyyy.trycloudflare.com`

2. **On Mobile:** Open the Mobile URL (from Terminal 4)
   - Example: `https://zzzz-zzzz.trycloudflare.com`

3. **Test the flow:**
   - Click "Receive" on the receiver
   - Upload an image on mobile
   - See the analysis on receiver!

## 📝 Important Notes

- **Tunnel URLs change** each time you restart a tunnel
- **Keep all terminals open** - closing a tunnel will break that connection
- **HTTPS is required** for camera access on mobile (Cloudflare provides this automatically)
- **CORS is open** in development mode, so tunnels work without issues

## 🔧 Troubleshooting

**Connection issues?**
- Make sure all 3 tunnels are running
- Verify `.env` has the correct `VITE_SERVER_URL`
- Restart the app after updating `.env`

**Tunnel not working?**
- Check that the local service is running (curl http://localhost:3001/health)
- Make sure you're using the correct port
- Try restarting the tunnel

**CORS errors?**
- The server is configured to allow any origin in development
- If issues persist, check tunnel URLs are correct

## 🎉 You're Ready!

Your app is now publicly accessible via HTTPS. Test it on your mobile device!

