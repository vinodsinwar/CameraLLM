#!/bin/bash

echo "🚀 Cloudflare Tunnel Setup for Remote Camera App"
echo "================================================"
echo ""

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "❌ cloudflared is not installed!"
    echo "   Install it with: brew install cloudflared"
    exit 1
fi

echo "✅ cloudflared is installed"
echo ""

# Check if app is running
echo "Checking if app is running..."
if ! curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "⚠️  Server (port 3001) is not running!"
    echo "   Please start the app first with: npm run dev"
    echo ""
    read -p "Do you want to start it now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Starting app in background..."
        npm run dev > /tmp/remote-camera-app.log 2>&1 &
        APP_PID=$!
        echo "App started (PID: $APP_PID)"
        echo "Waiting for services to start..."
        sleep 8
    else
        echo "Please start the app manually and run this script again."
        exit 1
    fi
fi

echo "✅ App is running"
echo ""

echo "📋 Setup Instructions:"
echo "======================"
echo ""
echo "You need to open 3 NEW terminal windows and run these commands:"
echo ""
echo "Terminal 2 (Server - port 3001):"
echo "  cloudflared tunnel --url http://localhost:3001"
echo ""
echo "Terminal 3 (Receiver - port 5173):"
echo "  cloudflared tunnel --url http://localhost:5173"
echo ""
echo "Terminal 4 (Mobile - port 5174):"
echo "  cloudflared tunnel --url http://localhost:5174"
echo ""
echo "After running each command, you'll get a URL like:"
echo "  https://xxxx-xxxx.trycloudflare.com"
echo ""
echo "📝 Important:"
echo "  1. Copy the SERVER URL from Terminal 2"
echo "  2. Add it to your .env file as: VITE_SERVER_URL=https://xxxx-xxxx.trycloudflare.com"
echo "  3. Restart the app (npm run dev)"
echo ""
echo "Then use the Receiver and Mobile URLs on your devices!"
echo ""
read -p "Press Enter when you're ready to continue, or Ctrl+C to cancel..."

