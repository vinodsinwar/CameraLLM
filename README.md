# Remote Camera PWA System

A production-ready web application with two interfaces: a receiver web interface and a mobile web (PWA) interface. The receiver interface contains a "Receive" button and a ChatGPT-like conversational UI. The mobile interface acts as a camera device that can be remotely triggered by the receiver interface to capture images.

## Features

- **Receiver Interface**: ChatGPT-like conversational UI with image analysis
- **Mobile PWA**: Camera preview with remote trigger capability
- **Real-time Communication**: WebSocket-based bidirectional messaging
- **Secure Pairing**: QR code-based device pairing with encryption
- **LLM Integration**: OpenAI GPT-4 Vision for image analysis
- **Session Management**: Explicit start/stop camera sessions
- **Privacy-First**: Camera only active when explicitly started, visible to user

## Architecture

- **Backend**: Node.js/Express with Socket.io
- **Receiver Frontend**: React with Vite
- **Mobile Frontend**: React PWA with Vite
- **Real-time**: Socket.io WebSockets
- **LLM**: OpenAI GPT-4 Vision API

## Prerequisites

- Node.js 18+ and npm
- OpenAI API key
- Modern browser with camera support (for mobile)

## Installation

1. Clone the repository and navigate to the project directory:

```bash
cd "/Users/apple/Remote AI"
```

2. Install dependencies for all workspaces:

```bash
npm install
```

3. Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

4. Edit `.env` and add your OpenAI API key:

```
OPENAI_API_KEY=your_openai_api_key_here
PORT=3001
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
```

## Development

### Start all services (recommended)

```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:3001`
- Receiver interface on `http://localhost:5173`
- Mobile interface on `http://localhost:5174`

### Start services individually

```bash
# Backend only
npm run dev:server

# Receiver only
npm run dev:receiver

# Mobile only
npm run dev:mobile
```

## Production Build

1. Build frontend applications:

```bash
npm run build
```

2. Set environment variables for production:

```bash
NODE_ENV=production
PORT=3001
OPENAI_API_KEY=your_production_key
ALLOWED_ORIGINS=https://your-receiver-domain.com,https://your-mobile-domain.com
```

3. Start the server:

```bash
npm start
```

## HTTPS/WSS Setup (Production)

For production, you need HTTPS/WSS for:
- Camera access (required by browsers)
- Secure WebSocket connections
- PWA installation

### Option 1: Reverse Proxy (Recommended)

Use nginx or similar:

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Option 2: Node.js HTTPS

Modify `server/server.js` to use HTTPS:

```javascript
import https from 'https';
import fs from 'fs';

const options = {
  key: fs.readFileSync('path/to/key.pem'),
  cert: fs.readFileSync('path/to/cert.pem')
};

const httpsServer = https.createServer(options, app);
const io = new Server(httpsServer, { /* ... */ });
```

## Usage

### Receiver Interface

1. Open `http://localhost:5173` in your browser
2. Click the "Receive" button
3. A QR code will be displayed
4. Scan the QR code with the mobile device
5. Once paired, you can:
   - Click "Capture Image" to trigger remote capture
   - Ask follow-up questions about captured images
   - View image analysis from GPT-4 Vision

### Mobile Interface

1. Open `http://localhost:5174` on your mobile device
2. Click "Start Pairing"
3. Scan the QR code from the receiver interface
4. Once paired, click "Start Camera Session"
5. Grant camera permissions when prompted
6. Camera preview will be displayed
7. Wait for capture requests from receiver
8. Click "Stop Session" when done

## Security Features

- **Encrypted WebSocket Messages**: Session-based encryption keys
- **Session Validation**: Server-side session ID validation
- **Camera Privacy**: 
  - Camera only active when explicitly started
  - No background capture
  - No capture when app is in background
  - Visual indicators when camera is active

## API Endpoints

### POST `/api/pairing`
Create a new pairing session.

**Response:**
```json
{
  "success": true,
  "sessionId": "abc123...",
  "encryptionKey": "xyz789...",
  "qrData": "data:image/png;base64,...",
  "expiresAt": 1234567890
}
```

### GET `/api/health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## WebSocket Events

### Client → Server

- `join:session` - Join a pairing session
- `session:start` - Start camera session (mobile only)
- `session:stop` - Stop camera session
- `capture:request` - Request image capture (receiver only)
- `capture:response` - Send captured image (mobile only)
- `chat:message` - Send chat message (receiver only)

### Server → Client

- `session:joined` - Session joined successfully
- `session:started` - Camera session started
- `session:stopped` - Camera session stopped
- `capture:response` - Image captured and analyzed
- `capture:error` - Capture error
- `chat:response` - LLM response
- `chat:error` - Chat error
- `connection:status` - Connection status update

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment | `development` |
| `OPENAI_API_KEY` | OpenAI API key | Required |
| `SESSION_TIMEOUT` | Session timeout (ms) | `3600000` (1 hour) |
| `ALLOWED_ORIGINS` | CORS allowed origins | `http://localhost:5173,http://localhost:5174` |
| `SERVER_URL` | Server URL for QR codes | `http://localhost:3001` |

## Troubleshooting

### Camera not working
- Ensure HTTPS is used (required for camera access)
- Check browser permissions
- Verify camera is not in use by another application

### WebSocket connection failed
- Check server is running
- Verify CORS settings
- Check firewall/network settings

### OpenAI API errors
- Verify API key is correct
- Check API quota/limits
- Ensure internet connection

### QR code not scanning
- Ensure good lighting
- Hold device steady
- Try manual code entry

## Development Notes

- Camera session must be explicitly started by mobile user
- Camera preview remains visible while session is active
- No automatic timeouts - session persists until explicitly stopped
- Images are not stored - only processed and sent to receiver
- All communication is encrypted with session keys

## License

MIT

