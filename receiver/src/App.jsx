import { useState, useEffect, useRef } from 'react';
import ChatInterface from './components/ChatInterface';
import { useWebSocket } from './hooks/useWebSocket';
import { MESSAGE_TYPES } from '@shared/constants.js';
import './App.css';

function App() {
  const [countdown, setCountdown] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCapturingMultiple, setIsCapturingMultiple] = useState(false);
  const [captureProgress, setCaptureProgress] = useState(null); // { elapsed: 0, total: 60, captured: 0 }
  const [cameraStream, setCameraStream] = useState(null);
  const countdownIntervalRef = useRef(null);
  const captureIntervalRef = useRef(null);
  const multipleCaptureImagesRef = useRef([]);
  const { socket, connected } = useWebSocket();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
      }
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  const handleCaptureSingle = async () => {
    if (isCapturing || isCapturingMultiple || countdown !== null) return;

    setIsCapturing(true);
    let remaining = 5;
    setCountdown(remaining);

    // Start countdown
    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);

      if (remaining <= 0) {
        clearInterval(countdownIntervalRef.current);
        setCountdown(null);
        captureImage();
      }
    }, 1000);
  };

  const handleCaptureMultiple = async () => {
    if (isCapturing || isCapturingMultiple || countdown !== null) return;

    setIsCapturingMultiple(true);
    multipleCaptureImagesRef.current = [];
    setCaptureProgress({ elapsed: 0, total: 60, captured: 0 });

    let remaining = 5;
    setCountdown(remaining);

    // Start countdown
    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);

      if (remaining <= 0) {
        clearInterval(countdownIntervalRef.current);
        setCountdown(null);
        startMultipleCapture();
      }
    }, 1000);
  };

  // Optimize image: resize and compress
  const optimizeImage = (imageData, maxWidth = 1280, maxHeight = 720, quality = 0.7) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions maintaining aspect ratio
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to base64 with compression
        const optimizedData = canvas.toDataURL('image/jpeg', quality);
        resolve(optimizedData);
      };
      img.onerror = () => resolve(imageData); // Fallback to original if optimization fails
      img.src = imageData;
    });
  };

  const startMultipleCapture = async () => {
    try {
      // Get camera stream once
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment'
        } 
      });
      
      setCameraStream(stream);

      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      await new Promise((resolve, reject) => {
        video.onloadedmetadata = () => {
          resolve();
        };
        video.onerror = reject;
      });

      // Wait a moment for camera to stabilize
      await new Promise(resolve => setTimeout(resolve, 500));

      // Capture first image immediately
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        const rawImageData = canvas.toDataURL('image/jpeg', 0.85);
        
        // Optimize image before storing
        const optimizedImage = await optimizeImage(rawImageData);
        multipleCaptureImagesRef.current.push(optimizedImage);
        setCaptureProgress({ elapsed: 0, total: 60, captured: 1 });
        console.log(`[CAPTURE] Image 1 captured and optimized. Size: ${(optimizedImage.length / 1024).toFixed(2)} KB`);
      } catch (err) {
        console.error('Error capturing first image:', err);
      }

      let elapsed = 2; // Start at 2 seconds since first capture was at 0
      let captured = 1;

      // Capture every 2 seconds for 1 minute (total 30 captures: 1 immediate + 29 more)
      captureIntervalRef.current = setInterval(async () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0);

          const rawImageData = canvas.toDataURL('image/jpeg', 0.85);
          
          // Optimize image before storing
          const optimizedImage = await optimizeImage(rawImageData);
          multipleCaptureImagesRef.current.push(optimizedImage);
          captured++;
          elapsed += 2;

          setCaptureProgress({ elapsed, total: 60, captured });
          console.log(`[CAPTURE] Image ${captured} captured and optimized. Size: ${(optimizedImage.length / 1024).toFixed(2)} KB`);

          // After 1 minute (60 seconds), stop capturing and analyze
          if (elapsed >= 60) {
            clearInterval(captureIntervalRef.current);
            
            // Stop camera stream
            stream.getTracks().forEach(track => track.stop());
            setCameraStream(null);

            // Calculate total size
            const totalSize = multipleCaptureImagesRef.current.reduce((sum, img) => sum + img.length, 0);
            console.log(`[BATCH_ANALYZE] Capture complete. Total images: ${multipleCaptureImagesRef.current.length}, Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
            
            // Clear progress overlay and show analyzing state
            setCaptureProgress(null);
            setIsCapturingMultiple(false);
            
            if (multipleCaptureImagesRef.current.length > 0) {
              // Start analysis
              console.log('[BATCH_ANALYZE] Starting analysis...');
              await analyzeMultipleImages(multipleCaptureImagesRef.current);
            } else {
              console.warn('[BATCH_ANALYZE] No images captured!');
              setIsCapturing(false);
              alert('No images were captured. Please try again.');
            }
          }
        } catch (err) {
          console.error('Error during multiple capture:', err);
        }
      }, 2000); // Every 2 seconds

    } catch (error) {
      console.error('Error starting multiple capture:', error);
      setIsCapturingMultiple(false);
      setCaptureProgress(null);
      setCountdown(null);
      alert('Failed to start multiple capture: ' + error.message);
    }
  };

  const analyzeMultipleImages = async (images) => {
    try {
      console.log(`[BATCH_ANALYZE] Starting analysis for ${images.length} images`);
      setIsCapturing(true);
      
      // Calculate payload size for logging
      const payloadSize = JSON.stringify({ images }).length;
      console.log(`[BATCH_ANALYZE] Payload size: ${(payloadSize / 1024 / 1024).toFixed(2)} MB`);
      
      // Set up timeout and completion handler
      let timeoutId;
      let completed = false;
      
      const cleanup = (success = true) => {
        if (completed) return;
        completed = true;
        if (timeoutId) clearTimeout(timeoutId);
        setIsCapturing(false);
        setIsCapturingMultiple(false);
        setCaptureProgress(null);
        console.log(`[BATCH_ANALYZE] Cleanup complete. Success: ${success}`);
      };
      
      // Set timeout (5 minutes)
      timeoutId = setTimeout(() => {
        console.error('[BATCH_ANALYZE] Timeout after 5 minutes');
        cleanup(false);
        alert('Analysis timed out after 5 minutes. Trying API fallback...');
        // Try API fallback
        tryApiFallback(images);
      }, 5 * 60 * 1000);
      
      // Listen for completion event from ChatInterface
      const handleComplete = (event) => {
        cleanup(event.detail.success);
        window.removeEventListener('batchAnalyzeComplete', handleComplete);
      };
      window.addEventListener('batchAnalyzeComplete', handleComplete);
      
      // Send all images to server for batch analysis
      if (socket && socket.connected) {
        console.log('[BATCH_ANALYZE] Sending via socket');
        
        // Check if payload is too large (Socket.io default limit is 1MB)
        if (payloadSize > 1024 * 1024) {
          console.warn('[BATCH_ANALYZE] Payload too large for socket, using API fallback');
          if (timeoutId) clearTimeout(timeoutId);
          window.removeEventListener('batchAnalyzeComplete', handleComplete);
          return tryApiFallback(images);
        }
        
        socket.emit(MESSAGE_TYPES.BATCH_ANALYZE_REQUEST, {
          images,
          timestamp: Date.now()
        });
        console.log('[BATCH_ANALYZE] Request sent via socket, waiting for response...');
        // Don't set isCapturing to false here - wait for response or timeout
      } else {
        // Fallback to API
        console.log('[BATCH_ANALYZE] Sending via API fallback');
        const response = await fetch('/api/batch-analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ images })
        });
        const data = await response.json();
        if (data.success && data.analysis) {
          // Manually add message since we're using API (no socket)
          console.log('[BATCH_ANALYZE] Analysis complete via API');
          // We'll need to trigger a custom event or use a callback
          // For now, let's emit a fake socket event if socket exists
          if (socket) {
            socket.emit(MESSAGE_TYPES.BATCH_ANALYZE_RESPONSE, {
              analysis: data.analysis,
              imageCount: images.length,
              timestamp: Date.now()
            });
          }
          setIsCapturing(false);
          setIsCapturingMultiple(false);
          setCaptureProgress(null);
        } else {
          throw new Error(data.error || 'Analysis failed');
        }
      }
    } catch (error) {
      console.error('[BATCH_ANALYZE] Error:', error);
      setIsCapturing(false);
      setIsCapturingMultiple(false);
      setCaptureProgress(null);
      if (socket) {
        socket.emit(MESSAGE_TYPES.BATCH_ANALYZE_ERROR, {
          error: error.message || 'Failed to analyze images'
        });
      }
    }
  };

  const captureImage = async () => {
    try {
      console.log('Activating camera and capturing image...');

      // Get camera stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment' // Use back camera on mobile if available
        } 
      });
      
      setCameraStream(stream);

      // Create video element to capture frame
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      await new Promise((resolve, reject) => {
        video.onloadedmetadata = () => {
          try {
            // Wait a moment for camera to stabilize
            setTimeout(() => {
              const canvas = document.createElement('canvas');
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(video, 0, 0);

              // Stop the stream
              stream.getTracks().forEach(track => track.stop());
              setCameraStream(null);

              // Convert to base64
              const imageData = canvas.toDataURL('image/jpeg', 0.85);

              // Send to server for analysis
              if (socket) {
                socket.emit(MESSAGE_TYPES.CAPTURE_RESPONSE, {
                  imageData,
                  timestamp: Date.now()
                });
              } else {
                // Fallback to API if socket not available
                fetch('/api/upload-image', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ imageData })
                });
              }

              setIsCapturing(false);
              resolve();
            }, 500); // Small delay for camera stabilization
          } catch (err) {
            stream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
            reject(err);
          }
        };

        video.onerror = (err) => {
          stream.getTracks().forEach(track => track.stop());
          setCameraStream(null);
          setIsCapturing(false);
          reject(err);
        };
      });
    } catch (error) {
      console.error('Error capturing image:', error);
      setIsCapturing(false);
      setCountdown(null);
      alert('Failed to capture image: ' + error.message);
    }
  };

  // Listen for analysis results
  useEffect(() => {
    if (!socket) return;

    const handleCaptureResponse = (data) => {
      const { imageData, analysis, error } = data;
      // Results are handled by ChatInterface
      setIsCapturing(false);
    };

    const handleCaptureError = (data) => {
      console.error('Capture error:', data);
      setIsCapturing(false);
      setCountdown(null);
    };

    socket.on(MESSAGE_TYPES.CAPTURE_RESPONSE, handleCaptureResponse);
    socket.on(MESSAGE_TYPES.CAPTURE_ERROR, handleCaptureError);

    return () => {
      socket.off(MESSAGE_TYPES.CAPTURE_RESPONSE, handleCaptureResponse);
      socket.off(MESSAGE_TYPES.CAPTURE_ERROR, handleCaptureError);
    };
  }, [socket]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Camera Analyzer</h1>
        <div className="header-actions-top">
          <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`}></span>
          <span className="status-text">{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </header>

      {/* Countdown overlay */}
      {countdown !== null && (
        <div className="countdown-overlay">
          <div className="countdown-content">
            <div className="countdown-number">{countdown}</div>
            <p className="countdown-text">
              {countdown > 0 
                ? `Camera will be activated in ${countdown} second${countdown !== 1 ? 's' : ''}...`
                : 'Capturing image...'}
            </p>
          </div>
        </div>
      )}

      {/* Multiple capture progress overlay */}
      {captureProgress !== null && (
        <div className="countdown-overlay">
          <div className="countdown-content">
            <div className="countdown-number">{captureProgress.captured}</div>
            <p className="countdown-text">
              Captured {captureProgress.captured} images
              <br />
              {captureProgress.elapsed}s / {captureProgress.total}s
            </p>
          </div>
        </div>
      )}

      {/* Analysis in progress overlay */}
      {isCapturing && !isCapturingMultiple && captureProgress === null && (
        <div className="countdown-overlay">
          <div className="countdown-content">
            <div className="countdown-number">⏳</div>
            <p className="countdown-text">
              Analyzing images...
              <br />
              Please wait
            </p>
          </div>
        </div>
      )}

      {/* Main chat interface */}
      <ChatInterface
        socket={socket}
        onCaptureSingle={handleCaptureSingle}
        onCaptureMultiple={handleCaptureMultiple}
        isCapturing={isCapturing}
        isCapturingMultiple={isCapturingMultiple}
        countdown={countdown}
        captureProgress={captureProgress}
      />
    </div>
  );
}

export default App;
