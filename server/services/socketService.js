import { getSession, updateSession, deleteSession } from './sessionManager.js';
import { startCameraSession, stopCameraSession, isCameraActive, getSessionParticipants } from './cameraService.js';
import { analyzeImage, chatWithContext } from './llmService.js';
import { analyzeMultipleImages } from './batchAnalyzeService.js';
import { encryptMessage, decryptMessage } from '../utils/encryption.js';
import { MESSAGE_TYPES, WEBSOCKET_EVENTS } from '../../shared/constants.js';

let ioInstance = null;

/**
 * Initialize Socket.io handlers
 */
export const initializeSocketIO = (io) => {
  ioInstance = io;

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Join session
    socket.on(WEBSOCKET_EVENTS.JOIN_SESSION, async (data) => {
      try {
        const { sessionId, deviceType, encryptionKey } = data;
        
        if (!sessionId || !deviceType) {
          socket.emit(MESSAGE_TYPES.PAIRING_ERROR, { error: 'Missing session ID or device type' });
          return;
        }

        const session = getSession(sessionId);
        if (!session) {
          socket.emit(MESSAGE_TYPES.PAIRING_ERROR, { error: 'Session not found or expired' });
          return;
        }

        // Verify encryption key for security
        if (encryptionKey && encryptionKey !== session.encryptionKey) {
          socket.emit(MESSAGE_TYPES.PAIRING_ERROR, { error: 'Invalid encryption key' });
          return;
        }

        // Join socket room
        socket.join(sessionId);
        socket.sessionId = sessionId;
        socket.deviceType = deviceType;
        socket.encryptionKey = session.encryptionKey;

        // Update session with socket connection
        if (deviceType === 'receiver') {
          session.receiverSocketId = socket.id;
        } else if (deviceType === 'mobile') {
          session.mobileSocketId = socket.id;
        }
        updateSession(sessionId, session);

        socket.emit(WEBSOCKET_EVENTS.SESSION_JOINED, {
          sessionId,
          status: session.status,
          cameraActive: session.cameraActive
        });

        // Notify other participant
        socket.to(sessionId).emit(MESSAGE_TYPES.CONNECTION_STATUS, {
          connected: true,
          deviceType
        });

        console.log(`Socket ${socket.id} joined session ${sessionId} as ${deviceType}`);
      } catch (error) {
        console.error('Error joining session:', error);
        socket.emit(MESSAGE_TYPES.PAIRING_ERROR, { error: 'Failed to join session' });
      }
    });

    // Start camera session
    socket.on(MESSAGE_TYPES.SESSION_START, async (data) => {
      try {
        const { sessionId } = data;
        const actualSessionId = sessionId || socket.sessionId;

        if (!actualSessionId || socket.deviceType !== 'mobile') {
          socket.emit(MESSAGE_TYPES.SESSION_ERROR, { error: 'Invalid request' });
          return;
        }

        const result = startCameraSession(actualSessionId, socket.id, 'mobile');
        if (result.success) {
          socket.emit(MESSAGE_TYPES.SESSION_STARTED, {
            sessionId: actualSessionId,
            cameraActive: true
          });

          // Notify receiver
          const receiverSocketId = result.session.receiverSocketId;
          if (receiverSocketId) {
            io.to(receiverSocketId).emit(MESSAGE_TYPES.SESSION_STARTED, {
              sessionId: actualSessionId,
              cameraActive: true
            });
          }
        } else {
          socket.emit(MESSAGE_TYPES.SESSION_ERROR, { error: result.error });
        }
      } catch (error) {
        console.error('Error starting camera session:', error);
        socket.emit(MESSAGE_TYPES.SESSION_ERROR, { error: 'Failed to start session' });
      }
    });

    // Stop camera session
    socket.on(MESSAGE_TYPES.SESSION_STOP, async (data) => {
      try {
        const { sessionId } = data;
        const actualSessionId = sessionId || socket.sessionId;

        if (!actualSessionId) {
          socket.emit(MESSAGE_TYPES.SESSION_ERROR, { error: 'Invalid session' });
          return;
        }

        const result = stopCameraSession(actualSessionId, socket.id);
        if (result.success) {
          socket.emit(MESSAGE_TYPES.SESSION_STOPPED, {
            sessionId: actualSessionId,
            cameraActive: false
          });

          // Notify other participant
          socket.to(actualSessionId).emit(MESSAGE_TYPES.SESSION_STOPPED, {
            sessionId: actualSessionId,
            cameraActive: false
          });
        } else {
          socket.emit(MESSAGE_TYPES.SESSION_ERROR, { error: result.error });
        }
      } catch (error) {
        console.error('Error stopping camera session:', error);
        socket.emit(MESSAGE_TYPES.SESSION_ERROR, { error: 'Failed to stop session' });
      }
    });

    // Capture request from sender (mobile) - forward to receiver
    socket.on(MESSAGE_TYPES.CAPTURE_REQUEST, async (data) => {
      try {
        console.log(`[CAPTURE_REQUEST] Received from sender ${socket.id}`);
        
        // Broadcast to all receivers (no pairing needed)
        // Find all receiver sockets
        const receiverSockets = Array.from(io.sockets.sockets.values()).filter(
          s => s.deviceType === 'receiver' || !s.deviceType // Include untyped for simplicity
        );

        if (receiverSockets.length === 0) {
          socket.emit(MESSAGE_TYPES.CAPTURE_ERROR, { 
            error: 'No receiver device connected' 
          });
          return;
        }

        // Forward to all receivers
        receiverSockets.forEach(receiverSocket => {
          io.to(receiverSocket.id).emit(MESSAGE_TYPES.CAPTURE_REQUEST, {
            timestamp: Date.now(),
            from: 'sender'
          });
        });

        console.log(`[CAPTURE_REQUEST] Forwarded to ${receiverSockets.length} receiver(s)`);
      } catch (error) {
        console.error('Error handling capture request:', error);
        socket.emit(MESSAGE_TYPES.CAPTURE_ERROR, { error: 'Failed to process capture request' });
      }
    });

    // Capture response from receiver - analyze and send to sender
    socket.on(MESSAGE_TYPES.CAPTURE_RESPONSE, async (data) => {
      try {
        const { imageData } = data;

        if (!imageData) {
          socket.emit(MESSAGE_TYPES.CAPTURE_ERROR, { error: 'No image data provided' });
          return;
        }

        console.log(`[CAPTURE_RESPONSE] Received image from receiver ${socket.id}`);

        // Analyze image with LLM
        try {
          const analysis = await analyzeImage(imageData);

          // Find sender sockets and send response
          const senderSockets = Array.from(io.sockets.sockets.values()).filter(
            s => s.deviceType === 'mobile' || (!s.deviceType && s.id !== socket.id)
          );

          // Also send to receiver for display
          senderSockets.forEach(senderSocket => {
            io.to(senderSocket.id).emit(MESSAGE_TYPES.CAPTURE_RESPONSE, {
              imageData,
              analysis,
              timestamp: Date.now()
            });
          });

          // Send to receiver itself for display
          socket.emit(MESSAGE_TYPES.CAPTURE_RESPONSE, {
            imageData,
            analysis,
            timestamp: Date.now()
          });

          console.log(`[CAPTURE_RESPONSE] Image analyzed and sent to ${senderSockets.length} sender(s) and receiver`);
        } catch (llmError) {
          console.error('Error analyzing image:', llmError);
          socket.emit(MESSAGE_TYPES.CAPTURE_ERROR, {
            error: 'Failed to analyze image: ' + llmError.message
          });
        }
      } catch (error) {
        console.error('Error handling capture response:', error);
        socket.emit(MESSAGE_TYPES.CAPTURE_ERROR, { error: 'Failed to process capture' });
      }
    });

    // Receive request from receiver (for testing - triggers image upload on mobile)
    socket.on(MESSAGE_TYPES.RECEIVE_REQUEST, async (data) => {
      try {
        const { sessionId } = data;
        const actualSessionId = sessionId || socket.sessionId || 'test-session';

        console.log(`[RECEIVE_REQUEST] Received from socket ${socket.id} for session: ${actualSessionId}`);
        console.log(`[RECEIVE_REQUEST] Socket device type: ${socket.deviceType || 'unknown'}`);

        // For testing: broadcast to all connected sockets (mobile devices will listen)
        // In production, this would be session-specific
        const requestData = {
          sessionId: actualSessionId,
          timestamp: Date.now(),
          from: 'receiver'
        };

        // Try session-specific first
        if (actualSessionId !== 'test-session') {
          const session = getSession(actualSessionId);
          if (session && session.mobileSocketId) {
            console.log(`[RECEIVE_REQUEST] Forwarding to mobile device ${session.mobileSocketId} in session`);
            io.to(session.mobileSocketId).emit(MESSAGE_TYPES.RECEIVE_REQUEST, requestData);
            return;
          }
        }

        // Broadcast to all connected sockets (for testing without pairing)
        console.log(`[RECEIVE_REQUEST] Broadcasting to all connected sockets (test mode)`);
        console.log(`[RECEIVE_REQUEST] Total connected sockets: ${io.sockets.sockets.size}`);
        
        // Log all connected sockets for debugging
        io.sockets.sockets.forEach((s, id) => {
          console.log(`  - Socket ${id}: deviceType=${s.deviceType || 'unknown'}, sessionId=${s.sessionId || 'none'}`);
        });

        io.emit(MESSAGE_TYPES.RECEIVE_REQUEST, requestData);
        console.log(`[RECEIVE_REQUEST] Event emitted to all sockets`);
      } catch (error) {
        console.error('[RECEIVE_REQUEST] Error handling receive request:', error);
      }
    });

    // Receive triggered acknowledgment from mobile
    socket.on(MESSAGE_TYPES.RECEIVE_TRIGGERED, (data) => {
      console.log('Receive triggered acknowledgment from mobile:', data);
      // Optionally notify receiver that mobile received the request
      const { sessionId } = data;
      const actualSessionId = sessionId || socket.sessionId || 'test-session';
      
      if (actualSessionId !== 'test-session') {
        const session = getSession(actualSessionId);
        if (session && session.receiverSocketId) {
          io.to(session.receiverSocketId).emit(MESSAGE_TYPES.RECEIVE_TRIGGERED, {
            sessionId: actualSessionId,
            timestamp: Date.now()
          });
        }
      }
    });

    // Chat message from receiver
    socket.on(MESSAGE_TYPES.CHAT_MESSAGE, async (data) => {
      try {
        const { sessionId, message, imageContext } = data;
        const actualSessionId = sessionId || socket.sessionId;

        if (!actualSessionId || socket.deviceType !== 'receiver') {
          socket.emit(MESSAGE_TYPES.CHAT_ERROR, { error: 'Invalid request' });
          return;
        }

        if (!message) {
          socket.emit(MESSAGE_TYPES.CHAT_ERROR, { error: 'No message provided' });
          return;
        }

        // Get last captured image context if available
        const session = getSession(actualSessionId);
        if (!session) {
          socket.emit(MESSAGE_TYPES.CHAT_ERROR, { error: 'Session not found' });
          return;
        }

        try {
          const response = await chatWithContext(message, imageContext || session.lastImageData);
          
          socket.emit(MESSAGE_TYPES.CHAT_RESPONSE, {
            sessionId: actualSessionId,
            message,
            response,
            timestamp: Date.now()
          });
        } catch (llmError) {
          console.error('Error processing chat message:', llmError);
          socket.emit(MESSAGE_TYPES.CHAT_ERROR, { 
            error: 'Failed to process message' 
          });
        }
      } catch (error) {
        console.error('Error handling chat message:', error);
        socket.emit(MESSAGE_TYPES.CHAT_ERROR, { error: 'Failed to process chat message' });
      }
    });

    // Batch analyze multiple images
    socket.on(MESSAGE_TYPES.BATCH_ANALYZE_REQUEST, async (data) => {
      try {
        const { images } = data;

        if (!images || !Array.isArray(images) || images.length === 0) {
          socket.emit(MESSAGE_TYPES.BATCH_ANALYZE_ERROR, {
            error: 'No images provided for batch analysis'
          });
          return;
        }

        console.log(`[BATCH_ANALYZE] Received ${images.length} images from ${socket.id}`);

        try {
          // Analyze all images at once
          const analysis = await analyzeMultipleImages(images);

          // Send response back to sender
          socket.emit(MESSAGE_TYPES.BATCH_ANALYZE_RESPONSE, {
            analysis,
            imageCount: images.length,
            timestamp: Date.now()
          });

          console.log(`[BATCH_ANALYZE] Completed analysis for ${images.length} images`);
        } catch (llmError) {
          console.error('Error in batch analysis:', llmError);
          socket.emit(MESSAGE_TYPES.BATCH_ANALYZE_ERROR, {
            error: 'Failed to analyze images: ' + llmError.message
          });
        }
      } catch (error) {
        console.error('Error handling batch analyze request:', error);
        socket.emit(MESSAGE_TYPES.BATCH_ANALYZE_ERROR, {
          error: 'Failed to process batch analysis request'
        });
      }
    });

    // Heartbeat
    socket.on(MESSAGE_TYPES.HEARTBEAT, () => {
      socket.emit(MESSAGE_TYPES.HEARTBEAT, { timestamp: Date.now() });
    });

    // Leave session
    socket.on(WEBSOCKET_EVENTS.LEAVE_SESSION, () => {
      if (socket.sessionId) {
        stopCameraSession(socket.sessionId, socket.id);
        socket.leave(socket.sessionId);
        socket.to(socket.sessionId).emit(MESSAGE_TYPES.CONNECTION_STATUS, {
          connected: false,
          deviceType: socket.deviceType
        });
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      if (socket.sessionId) {
        stopCameraSession(socket.sessionId, socket.id);
        socket.to(socket.sessionId).emit(MESSAGE_TYPES.CONNECTION_STATUS, {
          connected: false,
          deviceType: socket.deviceType
        });
      }
    });
  });
};

