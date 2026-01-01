import { getSession } from '../services/sessionManager.js';

/**
 * Middleware to validate session
 */
export const validateSession = (req, res, next) => {
  const sessionId = req.headers['x-session-id'] || req.body.sessionId || req.query.sessionId;
  
  if (!sessionId) {
    return res.status(401).json({ error: 'Session ID required' });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  req.session = session;
  next();
};

