import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import MessageItem from './MessageItem';
import { MESSAGE_TYPES } from '@shared/constants.js';

const ChatInterface = ({ socket, onCaptureSingle, onCaptureMultiple, isCapturing, isCapturingMultiple, countdown, captureProgress }) => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const imageContextRef = useRef(null);
  const seenImageIdsRef = useRef(new Set()); // Track all seen image IDs to prevent duplicates

  useEffect(() => {
    // Listen for image uploads via API (for testing mode)
    const handleImageUpload = async (imageData) => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/upload-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ imageData })
        });
        const data = await response.json();
        
        if (data.success) {
          // Store image context for follow-up questions
          imageContextRef.current = imageData;
          
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now(),
              type: 'image',
              imageData,
              analysis: data.analysis,
              timestamp: new Date()
            }
          ]);
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Error processing uploaded image:', error);
        setIsLoading(false);
      }
    };

    // Expose handler globally for image uploads (testing mode)
    window.handleImageUpload = handleImageUpload;

    if (!socket) return;

    const handleCaptureResponse = (data) => {
      const { imageData, analysis, error } = data;
      
      // Store image context for follow-up questions
      if (imageData) {
        imageContextRef.current = imageData;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          type: 'image',
          imageData,
          analysis,
          error,
          timestamp: new Date()
        }
      ]);
      setIsLoading(false);
    };

    const handleChatResponse = (data) => {
      const { response } = data;
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          type: 'assistant',
          content: response,
          timestamp: new Date()
        }
      ]);
      setIsLoading(false);
    };

    const handleChatError = (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          type: 'error',
          content: data.error || 'An error occurred',
          timestamp: new Date()
        }
      ]);
      setIsLoading(false);
    };

    const handleCaptureError = (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          type: 'error',
          content: data.error || 'Failed to capture image',
          timestamp: new Date()
        }
      ]);
      setIsLoading(false);
    };

    const handleBatchAnalyzeResponse = (data) => {
      console.log('[BATCH_ANALYZE] Response received in ChatInterface:', data);
      const { analysis, error } = data;
      
      if (error) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            type: 'error',
            content: error,
            timestamp: new Date()
          }
        ]);
      } else if (analysis) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            type: 'assistant',
            content: analysis,
            timestamp: new Date()
          }
        ]);
      }
      setIsLoading(false);
      
      // Trigger custom event to notify App.jsx
      window.dispatchEvent(new CustomEvent('batchAnalyzeComplete', { detail: { success: !error } }));
    };

    const handleBatchAnalyzeProgress = (data) => {
      // Progress is handled by App.jsx, but we can log it here too
      console.log('[BATCH_ANALYZE] Progress in ChatInterface:', data);
    };

    const handleBatchAnalyzeError = (data) => {
      console.error('[BATCH_ANALYZE] Error in ChatInterface:', data);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          type: 'error',
          content: data.error || 'Failed to analyze images',
          timestamp: new Date()
        }
      ]);
      setIsLoading(false);
      
      // Trigger custom event to notify App.jsx
      window.dispatchEvent(new CustomEvent('batchAnalyzeComplete', { detail: { success: false, error: data.error } }));
    };

    socket.on(MESSAGE_TYPES.CAPTURE_RESPONSE, handleCaptureResponse);
    socket.on(MESSAGE_TYPES.CAPTURE_ERROR, handleCaptureError);
    socket.on(MESSAGE_TYPES.CHAT_RESPONSE, handleChatResponse);
    socket.on(MESSAGE_TYPES.CHAT_ERROR, handleChatError);
    socket.on(MESSAGE_TYPES.BATCH_ANALYZE_RESPONSE, handleBatchAnalyzeResponse);
    socket.on(MESSAGE_TYPES.BATCH_ANALYZE_ERROR, handleBatchAnalyzeError);
    socket.on(MESSAGE_TYPES.BATCH_ANALYZE_PROGRESS, handleBatchAnalyzeProgress);

    return () => {
      socket.off(MESSAGE_TYPES.CAPTURE_RESPONSE, handleCaptureResponse);
      socket.off(MESSAGE_TYPES.CAPTURE_ERROR, handleCaptureError);
      socket.off(MESSAGE_TYPES.CHAT_RESPONSE, handleChatResponse);
      socket.off(MESSAGE_TYPES.CHAT_ERROR, handleChatError);
      socket.off(MESSAGE_TYPES.BATCH_ANALYZE_RESPONSE, handleBatchAnalyzeResponse);
      socket.off(MESSAGE_TYPES.BATCH_ANALYZE_ERROR, handleBatchAnalyzeError);
      socket.off(MESSAGE_TYPES.BATCH_ANALYZE_PROGRESS, handleBatchAnalyzeProgress);
    };
  }, [socket]);

  // Optimize scroll - only scroll when new message is added, not on every render
  const prevMessagesLength = useRef(0);
  useEffect(() => {
    if (messages.length > prevMessagesLength.current) {
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    }
    prevMessagesLength.current = messages.length;
  }, [messages.length]);

  // Poll for new uploaded images (for testing mode)
  useEffect(() => {
    let lastImageId = null; // Track the last image ID to prevent duplicates
    
    const checkForNewImages = async () => {
      try {
        const response = await fetch('/api/latest-image');
        const data = await response.json();
        
        if (data.success && data.imageId) {
          // Only add if we haven't seen this image ID before
          if (data.imageId !== lastImageId && !seenImageIdsRef.current.has(data.imageId)) {
            lastImageId = data.imageId;
            seenImageIdsRef.current.add(data.imageId);
            
            // Store image context for follow-up questions
            if (data.imageData) {
              imageContextRef.current = data.imageData;
            }
            
            setMessages((prev) => {
              // Double-check: ensure this image wasn't already added
              const exists = prev.some(msg => 
                msg.type === 'image' && 
                msg.imageData === data.imageData
              );
              if (exists) return prev;
              
              return [
                ...prev,
                {
                  id: Date.now(),
                  type: 'image',
                  imageData: data.imageData,
                  analysis: data.analysis,
                  timestamp: new Date(data.timestamp)
                }
              ];
            });
          }
        }
      } catch (error) {
        // Silently fail - image might not be available yet
      }
    };
    
    // Check every 2 seconds for new images
    const interval = setInterval(checkForNewImages, 2000);
    
    return () => clearInterval(interval);
  }, []);

  const handleCapture = () => {
    if (!cameraActive) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          type: 'error',
          content: 'Camera session is not active',
          timestamp: new Date()
        }
      ]);
      return;
    }

    setIsLoading(true);
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        type: 'user',
        content: 'Capturing image...',
        timestamp: new Date()
      }
    ]);

    // This is no longer used - camera capture is handled in App.jsx
    // socket.emit(MESSAGE_TYPES.CAPTURE_REQUEST, { sessionId });
  };

  const showWelcomeMessage = useMemo(() => 
    messages.length === 0,
    [messages.length]
  );

  const handleClearChat = () => {
    setMessages([]);
    seenImageIdsRef.current.clear(); // Clear seen image IDs so images can be shown again
    imageContextRef.current = null; // Clear image context
  };

  return (
    <div className="chat-interface">
      {/* No floating buttons needed - camera activation is in header */}

      <div className="chat-messages">
        {showWelcomeMessage && (
          <div className="welcome-message">
            <div className="welcome-content">
              <h3>Welcome to Camera Analyzer</h3>
              <p>Click the "Capture Image" button below to take a picture.</p>
              <div className="welcome-actions">
                <p>After a 5-second countdown, your camera will activate and capture an image. The image will be analyzed by AI to extract questions/problems and provide solutions.</p>
              </div>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}

        {isLoading && (
          <div className="message message-assistant">
            <div className="message-content">
              <div className="message-text loading">Thinking...</div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={(e) => e.preventDefault()}>
        <div className="capture-actions">
          <button
            type="button"
            className="capture-button capture-single"
            onClick={onCaptureSingle}
            disabled={isCapturing || isCapturingMultiple || countdown !== null || isLoading}
            title="Capture Single Image"
          >
            {countdown !== null && !isCapturingMultiple
              ? `${countdown}`
              : isCapturing && !isCapturingMultiple
              ? '...'
              : '1'}
          </button>
          <button
            type="button"
            className="capture-button capture-multiple"
            onClick={onCaptureMultiple}
            disabled={isCapturing || isCapturingMultiple || countdown !== null || isLoading}
            title="Capture Multiple Images"
          >
            {isCapturingMultiple
              ? `${captureProgress?.captured || 0}`
              : countdown !== null && isCapturingMultiple
              ? `${countdown}`
              : '2'}
          </button>
          {messages.length > 0 && (
            <button
              type="button"
              className="clear-button"
              onClick={handleClearChat}
              title="Clear Chat"
              disabled={isCapturing || isCapturingMultiple || countdown !== null}
            >
              X
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default ChatInterface;

