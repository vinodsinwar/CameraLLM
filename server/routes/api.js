import express from 'express';
import { createPairingSession } from '../services/sessionManager.js';
import { chatWithContext, analyzeImage } from '../services/llmService.js';

const router = express.Router();

// Store latest uploaded image (for testing - use database in production)
let latestImage = null;

// Create a new pairing session
router.post('/pairing', async (req, res) => {
  try {
    const session = await createPairingSession();
    res.json({
      success: true,
      sessionId: session.sessionId,
      qrData: session.qrData,
      encryptionKey: session.encryptionKey,
      expiresAt: session.expiresAt
    });
  } catch (error) {
    console.error('Error creating pairing session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create pairing session'
    });
  }
});

// Direct chat endpoint (for testing without pairing)
router.post('/chat', async (req, res) => {
  try {
    const { message, imageContext } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    const response = await chatWithContext(message, imageContext || null);
    
    res.json({
      success: true,
      response
    });
  } catch (error) {
    console.error('Error processing chat:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process chat message'
    });
  }
});

// Image upload endpoint (for testing without pairing)
router.post('/upload-image', async (req, res) => {
  try {
    const { imageData } = req.body;
    
    if (!imageData) {
      return res.status(400).json({
        success: false,
        error: 'Image data is required'
      });
    }

    // Analyze image with LLM
    const analysis = await analyzeImage(imageData);
    
    // Store for receiver to fetch with unique timestamp
    const timestamp = Date.now();
    latestImage = {
      imageData,
      analysis,
      timestamp,
      imageId: `${timestamp}-${imageData.substring(0, 50)}` // Unique ID for this image
    };
    
    res.json({
      success: true,
      analysis,
      timestamp,
      message: 'Image uploaded and analyzed successfully'
    });
  } catch (error) {
    console.error('Error processing image upload:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process image'
    });
  }
});

// Get latest uploaded image (for testing)
router.get('/latest-image', (req, res) => {
  if (latestImage) {
    res.json({
      success: true,
      imageData: latestImage.imageData,
      analysis: latestImage.analysis,
      timestamp: latestImage.timestamp,
      imageId: latestImage.imageId
    });
  } else {
    res.json({
      success: false,
      message: 'No image available'
    });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;

