// Validation utilities

export const validateSessionId = (sessionId) => {
  if (!sessionId || typeof sessionId !== 'string') {
    return false;
  }
  // Session ID should be alphanumeric, 8-32 characters
  return /^[a-zA-Z0-9]{8,32}$/.test(sessionId);
};

export const validateImageData = (imageData) => {
  if (!imageData || typeof imageData !== 'string') {
    return false;
  }
  // Check if it's a valid base64 image data URL
  return /^data:image\/(jpeg|jpg|png|webp);base64,/.test(imageData);
};

export const sanitizeMessage = (message) => {
  if (!message || typeof message !== 'string') {
    return '';
  }
  // Remove potentially dangerous characters, limit length
  return message.trim().slice(0, 2000);
};

