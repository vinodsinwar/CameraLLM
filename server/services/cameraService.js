import { getSession, updateSession } from './sessionManager.js';

/**
 * Start camera session
 */
export const startCameraSession = (sessionId, socketId, deviceType) => {
  const session = getSession(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  if (deviceType === 'mobile') {
    if (session.mobileSocketId && session.mobileSocketId !== socketId) {
      return { success: false, error: 'Another mobile device is already connected' };
    }
    session.mobileSocketId = socketId;
  } else if (deviceType === 'receiver') {
    if (session.receiverSocketId && session.receiverSocketId !== socketId) {
      return { success: false, error: 'Another receiver is already connected' };
    }
    session.receiverSocketId = socketId;
  }

  if (deviceType === 'mobile') {
    session.cameraActive = true;
    session.status = 'active';
  }

  updateSession(sessionId, session);
  return { success: true, session };
};

/**
 * Stop camera session
 */
export const stopCameraSession = (sessionId, socketId) => {
  const session = getSession(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  if (session.mobileSocketId === socketId) {
    session.cameraActive = false;
    session.mobileSocketId = null;
    if (!session.receiverSocketId) {
      session.status = 'stopped';
    }
  } else if (session.receiverSocketId === socketId) {
    session.receiverSocketId = null;
    if (!session.mobileSocketId) {
      session.status = 'stopped';
    }
  }

  updateSession(sessionId, session);
  return { success: true, session };
};

/**
 * Check if camera session is active
 */
export const isCameraActive = (sessionId) => {
  const session = getSession(sessionId);
  return session && session.cameraActive && session.mobileSocketId !== null;
};

/**
 * Get session participants
 */
export const getSessionParticipants = (sessionId) => {
  const session = getSession(sessionId);
  if (!session) {
    return null;
  }
  return {
    receiverSocketId: session.receiverSocketId,
    mobileSocketId: session.mobileSocketId,
    cameraActive: session.cameraActive
  };
};

