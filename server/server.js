import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import apiRoutes from './routes/api.js';
import { initializeSocketIO } from './services/socketService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from root directory (parent of server/)
dotenv.config({ path: join(__dirname, '..', '.env') });

const app = express();
const httpServer = createServer(app);

// Allow dynamic origins for testing (tunneling services)
const isDevelopment = process.env.NODE_ENV !== 'production';
const defaultOrigins = [
  'http://localhost:5173', 
  'http://localhost:5174',
  'http://192.168.150.77:5173',
  'http://192.168.150.77:5174'
];

// Add frontend URL from environment if provided
const frontendUrl = process.env.FRONTEND_URL;
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || 
  (frontendUrl ? [...defaultOrigins, frontendUrl] : defaultOrigins);

// In development, allow any origin for testing with tunneling services
const corsOptions = {
  origin: isDevelopment ? (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    // Allow any origin in development for testing
    callback(null, true);
  } : allowedOrigins,
  credentials: true
};

const io = new Server(httpServer, {
  cors: {
    origin: isDevelopment ? '*' : allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  maxHttpBufferSize: 50 * 1024 * 1024, // 50MB for large image batches
  pingTimeout: 60000,
  pingInterval: 25000
});

const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize Socket.io
initializeSocketIO(io);

// Start server
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

