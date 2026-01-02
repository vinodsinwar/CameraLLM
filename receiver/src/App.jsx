import { useState, useEffect, useRef } from 'react';
import ChatInterface from './components/ChatInterface';
import { useWebSocket } from './hooks/useWebSocket';
import { MESSAGE_TYPES } from '@shared/constants.js';
import './App.css';

function App() {
  const [countdown, setCountdown] = useState(null);
  const [waitTimer, setWaitTimer] = useState(null); // 2-minute wait timer for multiple capture
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCapturingMultiple, setIsCapturingMultiple] = useState(false);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [captureProgress, setCaptureProgress] = useState(null); // { elapsed: 0, total: 180, captured: 0 } - 3 minutes
  const [videoProgress, setVideoProgress] = useState(null); // Elapsed seconds for video recording
  const [analysisProgress, setAnalysisProgress] = useState(null); // { stage, message, totalBatches, currentBatch, etc. }
  const [cameraStream, setCameraStream] = useState(null);
  const countdownIntervalRef = useRef(null);
  const waitTimerIntervalRef = useRef(null);
  const captureIntervalRef = useRef(null);
  const videoTimerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const multipleCaptureImagesRef = useRef([]);
  const { socket, connected } = useWebSocket();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      if (waitTimerIntervalRef.current) {
        clearInterval(waitTimerIntervalRef.current);
      }
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
      }
      if (videoTimerRef.current) {
        clearInterval(videoTimerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  const handleCaptureSingle = async () => {
    if (isCapturing || isCapturingMultiple || isRecordingVideo || countdown !== null) return;

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
    if (isCapturing || isCapturingMultiple || isRecordingVideo || countdown !== null || waitTimer !== null) return;

    setIsCapturingMultiple(true);
    multipleCaptureImagesRef.current = [];
    setCaptureProgress({ elapsed: 0, total: 180, captured: 0 }); // 3 minutes = 180 seconds

    // Start 10-minute wait timer first
    let waitRemaining = 600; // 10 minutes = 600 seconds
    setWaitTimer(waitRemaining);

    waitTimerIntervalRef.current = setInterval(() => {
      waitRemaining -= 1;
      setWaitTimer(waitRemaining);

      if (waitRemaining <= 0) {
        clearInterval(waitTimerIntervalRef.current);
        setWaitTimer(null);
        
        // After 10-minute wait, start the 5-second countdown
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
      }
    }, 1000);
  };

  const handleCaptureVideo = async () => {
    if (isCapturing || isCapturingMultiple || isRecordingVideo || countdown !== null || waitTimer !== null) return;

    setIsRecordingVideo(true);
    recordedChunksRef.current = [];
    setVideoProgress(0);

    try {
      // Get camera stream with optimized constraints for video recording
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 },
          frameRate: { ideal: 15, max: 20 } // Lower frame rate for smaller file size
        } 
      });
      
      setCameraStream(stream);

      // Start 5-second countdown before recording
      let remaining = 5;
      setCountdown(remaining);

      countdownIntervalRef.current = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);

        if (remaining <= 0) {
          clearInterval(countdownIntervalRef.current);
          setCountdown(null);
          startVideoRecording(stream);
        }
      }, 1000);
    } catch (error) {
      console.error('Error starting video capture:', error);
      setIsRecordingVideo(false);
      setVideoProgress(null);
      alert('Failed to start video recording: ' + error.message);
    }
  };

  const startVideoRecording = (stream) => {
    try {
      // Determine best codec and mime type (vp9 is more efficient, fallback to vp8)
      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          alert('Video recording is not supported in this browser. Please use Chrome or Firefox.');
          setIsRecordingVideo(false);
          setVideoProgress(null);
          stream.getTracks().forEach(track => track.stop());
          setCameraStream(null);
          return;
        }
      }

      // Optimized settings for balance between quality and file size
      // 1.2 Mbps bitrate: ~27 MB for 3 minutes (good quality, reasonable size)
      // Resolution: 1280x720 (already constrained in getUserMedia)
      // Frame rate: 15 fps (sufficient for text capture, reduces file size)
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: 1200000 // 1.2 Mbps - optimized for text capture
      });

      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('[VIDEO] Recording stopped. Extracting frames...');
        await extractFramesFromVideo();
      };

      // Start recording
      mediaRecorder.start(1000); // Collect data every second
      console.log('[VIDEO] Started recording video');

      // Record for 1 minute (60 seconds)
      let elapsed = 0;
      setVideoProgress(0);

      videoTimerRef.current = setInterval(() => {
        elapsed += 1;
        setVideoProgress(elapsed);

        if (elapsed >= 60) {
          clearInterval(videoTimerRef.current);
          if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
          stream.getTracks().forEach(track => track.stop());
          setCameraStream(null);
          console.log('[VIDEO] Recording completed after 1 minute');
        }
      }, 1000);
    } catch (error) {
      console.error('Error in video recording:', error);
      setIsRecordingVideo(false);
      setVideoProgress(null);
      alert('Failed to record video: ' + error.message);
    }
  };

  const extractFramesFromVideo = async () => {
    try {
      console.log('[VIDEO] Starting frame extraction...');
      setIsCapturing(true);
      setVideoProgress(null);

      // Create blob from recorded chunks
      const videoBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const videoUrl = URL.createObjectURL(videoBlob);

      // Create video element to extract frames
      const video = document.createElement('video');
      video.src = videoUrl;
      video.muted = true;
      video.playsInline = true;

      await new Promise((resolve, reject) => {
        video.onloadedmetadata = () => {
          video.currentTime = 0;
          resolve();
        };
        video.onerror = reject;
      });

      // Wait for video to be ready
      await new Promise(resolve => setTimeout(resolve, 500));

      const extractedFrames = [];
      const frameInterval = 2; // Extract frame every 2 seconds
      const totalDuration = video.duration;
      let currentTime = 0;
      let frameCount = 0;

      // Log video info for debugging
      const videoSizeMB = (videoBlob.size / 1024 / 1024).toFixed(2);
      console.log(`[VIDEO] Video duration: ${totalDuration.toFixed(2)}s, size: ${videoSizeMB} MB, extracting frames every ${frameInterval}s`);

      // Extract frames at intervals
      const extractFrameAtTime = async (time) => {
        return new Promise((resolve) => {
          const onSeeked = async () => {
            video.removeEventListener('seeked', onSeeked);
            // Wait a bit for frame to render
            await new Promise(r => setTimeout(r, 100));
            try {
              const canvas = document.createElement('canvas');
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(video, 0, 0);

              // Use lower quality for frames since they're from optimized video
              const frameData = canvas.toDataURL('image/jpeg', 0.75);
              
              // Optimize frame before storing (already constrained to 1280x720 from video)
              const optimizedFrame = await optimizeImage(frameData, 1280, 720, 0.7);
              extractedFrames.push(optimizedFrame);
              frameCount++;

              console.log(`[VIDEO] Extracted frame ${frameCount} at ${time.toFixed(2)}s. Size: ${(optimizedFrame.length / 1024).toFixed(2)} KB`);
              resolve();
            } catch (err) {
              console.error(`[VIDEO] Error extracting frame at ${time}s:`, err);
              resolve(); // Continue even if one frame fails
            }
          };
          
          video.addEventListener('seeked', onSeeked);
          video.currentTime = time;
        });
      };

      while (currentTime < totalDuration) {
        await extractFrameAtTime(currentTime);
        currentTime += frameInterval;
      }

      // Cleanup
      URL.revokeObjectURL(videoUrl);
      video.src = '';
      recordedChunksRef.current = [];

      console.log(`[VIDEO] Frame extraction complete. Total frames: ${extractedFrames.length}`);

      if (extractedFrames.length > 0) {
        // Use existing batch analysis service
        await analyzeMultipleImages(extractedFrames);
      } else {
        console.warn('[VIDEO] No frames extracted from video!');
        setIsCapturing(false);
        setIsRecordingVideo(false);
        alert('No frames could be extracted from the video. Please try again.');
      }
    } catch (error) {
      console.error('[VIDEO] Error extracting frames:', error);
      setIsCapturing(false);
      setIsRecordingVideo(false);
      alert('Failed to extract frames from video: ' + error.message);
    }
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
        setCaptureProgress({ elapsed: 0, total: 180, captured: 1 }); // 3 minutes = 180 seconds
        console.log(`[CAPTURE] Image 1 captured and optimized. Size: ${(optimizedImage.length / 1024).toFixed(2)} KB`);
      } catch (err) {
        console.error('Error capturing first image:', err);
      }

      let elapsed = 2; // Start at 2 seconds since first capture was at 0
      let captured = 1;

      // Capture every 2 seconds for 3 minutes (total 90 captures: 1 immediate + 89 more)
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

          setCaptureProgress({ elapsed, total: 180, captured }); // 3 minutes = 180 seconds
          console.log(`[CAPTURE] Image ${captured} captured and optimized. Size: ${(optimizedImage.length / 1024).toFixed(2)} KB`);

          // After 3 minutes (180 seconds), stop capturing and analyze
          if (elapsed >= 180) {
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
        setIsRecordingVideo(false);
        setCaptureProgress(null);
        setVideoProgress(null);
        setAnalysisProgress(null);
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
      // Use API directly for large payloads (more reliable than socket)
      if (payloadSize > 10 * 1024 * 1024) { // > 10MB, use API
        console.log('[BATCH_ANALYZE] Large payload, using API directly');
        if (timeoutId) clearTimeout(timeoutId);
        window.removeEventListener('batchAnalyzeComplete', handleComplete);
        return tryApiFallback(images);
      }
      
      if (socket && socket.connected) {
        console.log('[BATCH_ANALYZE] Sending via socket');
        
        socket.emit(MESSAGE_TYPES.BATCH_ANALYZE_REQUEST, {
          images,
          timestamp: Date.now()
        });
        console.log('[BATCH_ANALYZE] Request sent via socket, waiting for response...');
        // Don't set isCapturing to false here - wait for response or timeout
      } else {
        // Fallback to API
        console.log('[BATCH_ANALYZE] Socket not available, using API fallback');
        if (timeoutId) clearTimeout(timeoutId);
        window.removeEventListener('batchAnalyzeComplete', handleComplete);
        return tryApiFallback(images);
      }
    } catch (error) {
      console.error('[BATCH_ANALYZE] Error:', error);
      setIsCapturing(false);
      setIsCapturingMultiple(false);
      setCaptureProgress(null);
      alert('Failed to analyze images: ' + (error.message || 'Unknown error'));
    }
  };

  const tryApiFallback = async (images) => {
    try {
      console.log('[BATCH_ANALYZE] Trying API fallback...');
      setIsCapturing(true);
      
      // Show initial progress (API doesn't support real-time updates)
      setAnalysisProgress({
        stage: 'analyzing',
        message: `Analyzing ${images.length} images via API...`,
        totalBatches: Math.ceil(images.length / 10),
        currentBatch: 0,
        totalImages: images.length,
        processedImages: 0
      });
      
      const response = await fetch('/api/batch-analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ images })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data.success && data.analysis) {
        console.log('[BATCH_ANALYZE] Analysis complete via API');
        // Trigger response handler manually
        window.dispatchEvent(new CustomEvent('batchAnalyzeComplete', { 
          detail: { success: true, analysis: data.analysis } 
        }));
        
        // Also emit socket event if socket exists (for ChatInterface)
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
    } catch (apiError) {
      console.error('[BATCH_ANALYZE] API fallback error:', apiError);
      setIsCapturing(false);
      setIsCapturingMultiple(false);
      setCaptureProgress(null);
      setAnalysisProgress(null);
      alert('Failed to analyze images via API: ' + apiError.message);
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

    const handleBatchAnalyzeProgress = (data) => {
      console.log('[BATCH_ANALYZE] Progress update:', data);
      setAnalysisProgress(data);
    };

    socket.on(MESSAGE_TYPES.CAPTURE_RESPONSE, handleCaptureResponse);
    socket.on(MESSAGE_TYPES.CAPTURE_ERROR, handleCaptureError);
    socket.on(MESSAGE_TYPES.BATCH_ANALYZE_PROGRESS, handleBatchAnalyzeProgress);

    return () => {
      socket.off(MESSAGE_TYPES.CAPTURE_RESPONSE, handleCaptureResponse);
      socket.off(MESSAGE_TYPES.CAPTURE_ERROR, handleCaptureError);
      socket.off(MESSAGE_TYPES.BATCH_ANALYZE_PROGRESS, handleBatchAnalyzeProgress);
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

      {/* 2-minute wait timer overlay for multiple capture */}
      {waitTimer !== null && (
        <div className="countdown-overlay">
          <div className="countdown-content">
            <div className="countdown-number">{waitTimer}</div>
            <p className="countdown-text">
              Waiting {Math.floor(waitTimer / 60)}:{(waitTimer % 60).toString().padStart(2, '0')}
              <br />
              <span style={{ fontSize: '0.6em', opacity: 0.8 }}>
                Capture will start after wait timer...
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Countdown overlay */}
      {countdown !== null && waitTimer === null && (
        <div className="countdown-overlay">
          <div className="countdown-content">
            <div className="countdown-number">{countdown}</div>
            <p className="countdown-text">
              {isRecordingVideo
                ? `Video recording will start in ${countdown} second${countdown !== 1 ? 's' : ''}...`
                : countdown > 0 
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

      {/* Video recording overlay */}
      {isRecordingVideo && videoProgress !== null && (
        <div className="countdown-overlay">
          <div className="countdown-content">
            <div className="countdown-number">🎥</div>
            <p className="countdown-text">
              Recording video...
              <br />
              <span style={{ fontSize: '1.2em', fontWeight: 'bold' }}>
                {Math.floor(videoProgress / 60)}:{(videoProgress % 60).toString().padStart(2, '0')} / 1:00
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Video frame extraction overlay */}
      {isRecordingVideo && videoProgress === null && isCapturing && (
        <div className="countdown-overlay">
          <div className="countdown-content">
            <div className="countdown-number">⏳</div>
            <p className="countdown-text">
              Extracting frames from video...
              <br />
              Please wait
            </p>
          </div>
        </div>
      )}

      {/* Analysis in progress overlay */}
      {isCapturing && !isCapturingMultiple && captureProgress === null && (
        <div className="countdown-overlay">
          <div className="countdown-content">
            {analysisProgress ? (
              <>
                <div className="countdown-number">⏳</div>
                <p className="countdown-text">
                  {analysisProgress.message || 'Analyzing images...'}
                  {analysisProgress.totalImages && (
                    <>
                      <br />
                      <span style={{ fontSize: '0.8em', opacity: 0.8 }}>
                        Processing {analysisProgress.totalImages} images together...
                      </span>
                    </>
                  )}
                </p>
              </>
            ) : (
              <>
                <div className="countdown-number">⏳</div>
                <p className="countdown-text">
                  Analyzing images...
                  <br />
                  Please wait
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main chat interface */}
      <ChatInterface
        socket={socket}
        onCaptureSingle={handleCaptureSingle}
        onCaptureMultiple={handleCaptureMultiple}
        onCaptureVideo={handleCaptureVideo}
        isCapturing={isCapturing}
        isCapturingMultiple={isCapturingMultiple}
        isRecordingVideo={isRecordingVideo}
        countdown={countdown}
        waitTimer={waitTimer}
        captureProgress={captureProgress}
        videoProgress={videoProgress}
      />
    </div>
  );
}

export default App;
