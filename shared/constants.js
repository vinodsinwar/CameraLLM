// Shared constants for receiver and mobile interfaces

export const MESSAGE_TYPES = {
  // Pairing
  PAIRING_REQUEST: 'pairing:request',
  PAIRING_SUCCESS: 'pairing:success',
  PAIRING_ERROR: 'pairing:error',
  
  // Session management
  SESSION_START: 'session:start',
  SESSION_STARTED: 'session:started',
  SESSION_STOP: 'session:stop',
  SESSION_STOPPED: 'session:stopped',
  SESSION_ERROR: 'session:error',
  
  // Camera capture
  CAPTURE_REQUEST: 'capture:request',
  CAPTURE_RESPONSE: 'capture:response',
  CAPTURE_ERROR: 'capture:error',
  
  // Receive/Upload request (for testing)
  RECEIVE_REQUEST: 'receive:request',
  RECEIVE_TRIGGERED: 'receive:triggered',
  RECEIVE_ERROR: 'receive:error',
  
  // Batch analysis
  BATCH_ANALYZE_REQUEST: 'batch:analyze:request',
  BATCH_ANALYZE_RESPONSE: 'batch:analyze:response',
  BATCH_ANALYZE_ERROR: 'batch:analyze:error',
  
  // Chat messages
  CHAT_MESSAGE: 'chat:message',
  CHAT_RESPONSE: 'chat:response',
  CHAT_ERROR: 'chat:error',
  
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  HEARTBEAT: 'heartbeat',
  CONNECTION_STATUS: 'connection:status'
};

export const SESSION_STATUS = {
  IDLE: 'idle',
  PAIRING: 'pairing',
  PAIRED: 'paired',
  ACTIVE: 'active',
  STOPPED: 'stopped',
  ERROR: 'error'
};

export const WEBSOCKET_EVENTS = {
  JOIN_SESSION: 'join:session',
  LEAVE_SESSION: 'leave:session',
  SESSION_JOINED: 'session:joined',
  SESSION_LEFT: 'session:left'
};

export const API_ENDPOINTS = {
  PAIRING: '/api/pairing',
  HEALTH: '/api/health'
};

export const IMAGE_QUALITY = {
  MAX_WIDTH: 1920,
  MAX_HEIGHT: 1080,
  QUALITY: 0.85,
  FORMAT: 'image/jpeg'
};

