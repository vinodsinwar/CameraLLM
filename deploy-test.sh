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
echo "Option 1 - Cloudflare (Recommended, Free, No Signup):"
echo "   Terminal 2: cloudflared tunnel --url http://localhost:3001"
echo "   Terminal 3: cloudflared tunnel --url http://localhost:5173"
echo "   Terminal 4: cloudflared tunnel --url http://localhost:5174"
echo ""
echo "Option 2 - ngrok (Requires Free Account):"
echo "   Terminal 2: ngrok http 3001"
echo "   Terminal 3: ngrok http 5173"
echo "   Terminal 4: ngrok http 5174"
echo ""
echo "Option 3 - localtunnel (Free, No Signup):"
echo "   Terminal 2: lt --port 3001"
echo "   Terminal 3: lt --port 5173"
echo "   Terminal 4: lt --port 5174"
echo ""
echo "Press Ctrl+C to stop all services"
wait $APP_PID

