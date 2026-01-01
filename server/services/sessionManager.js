import crypto from 'crypto';
import QRCode from 'qrcode';
import { validateSessionId } from '../../shared/utils/validation.js';

// In-memory session storage (use Redis in production)
const sessions = new Map();
const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT) || 3600000; // 1 hour default

/**
 * Generate a unique session ID
 */
export const generateSessionId = () => {
  return crypto.randomBytes(16).toString('hex');
};

/**
 * Generate encryption key for session
 */
export const generateEncryptionKey = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Create a new pairing session
 */
export const createPairingSession = async () => {
  const sessionId = generateSessionId();
  const encryptionKey = generateEncryptionKey();
  const expiresAt = Date.now() + SESSION_TIMEOUT;

  const session = {
    sessionId,
    encryptionKey,
    expiresAt,
    status: 'pairing',
    receiverSocketId: null,
    mobileSocketId: null,
    cameraActive: false,
    createdAt: Date.now(),
    lastActivity: Date.now()
  };

  sessions.set(sessionId, session);

  // Generate QR code data
  const qrData = JSON.stringify({
    sessionId,
    encryptionKey,
    serverUrl: process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3001}`
  });

  let qrCodeDataURL;
  try {
    qrCodeDataURL = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }

  // Cleanup expired sessions periodically
  cleanupExpiredSessions();

  return {
    ...session,
    qrData: qrCodeDataURL
  };
};

/**
 * Get session by ID
 */
export const getSession = (sessionId) => {
  if (!validateSessionId(sessionId)) {
    return null;
  }
  const session = sessions.get(sessionId);
  if (session && session.expiresAt > Date.now()) {
    session.lastActivity = Date.now();
    return session;
  }
  if (session) {
    sessions.delete(sessionId);
  }
  return null;
};

/**
 * Update session
 */
export const updateSession = (sessionId, updates) => {
  const session = getSession(sessionId);
  if (!session) {
    return false;
  }
  Object.assign(session, updates, { lastActivity: Date.now() });
  return true;
};

/**
 * Delete session
 */
export const deleteSession = (sessionId) => {
  return sessions.delete(sessionId);
};

/**
 * Cleanup expired sessions
 */
export const cleanupExpiredSessions = () => {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(sessionId);
    }
  }
};

/**
 * Get all active sessions (for debugging)
 */
export const getAllSessions = () => {
  return Array.from(sessions.values());
};

// Cleanup expired sessions every 5 minutes
setInterval(cleanupExpiredSessions, 5 * 60 * 1000);

