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

  // Cleanup on unmount only (empty dependency array)
  useEffect(() => {
    return () => {
      console.log('[CLEANUP] Component unmounting, cleaning up intervals...');
      if (countdownIntervalRef.current) {
        console.log('[CLEANUP] Clearing countdown interval:', countdownIntervalRef.current);
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
  }, []); // Empty array = only cleanup on unmount, not on cameraStream changes

  // Separate cleanup for camera stream
  useEffect(() => {
    return () => {
      if (cameraStream) {
        console.log('[CLEANUP] Camera stream changed, stopping tracks...');
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
    console.log('[VIDEO] ===== handleCaptureVideo CALLED =====');
    console.log('[VIDEO] Current states:', { isCapturing, isCapturingMultiple, isRecordingVideo, countdown, waitTimer });
    
    if (isCapturing || isCapturingMultiple || isRecordingVideo || countdown !== null || waitTimer !== null) {
      console.log('[VIDEO] ❌ Blocked by state check');
      return;
    }

    console.log('[VIDEO] ✅ State check passed, proceeding...');
    setIsRecordingVideo(true);
    recordedChunksRef.current = [];
    setVideoProgress(0);
    console.log('[VIDEO] States set, requesting camera...');

    try {
      // Get camera stream with optimized constraints for video recording
      console.log('[VIDEO] Calling getUserMedia...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 },
          frameRate: { ideal: 15, max: 20 } // Lower frame rate for smaller file size
        } 
      });
      
      console.log('[VIDEO] ✅ getUserMedia success, stream:', stream);
      console.log('[VIDEO] Stream active:', stream.active);
      setCameraStream(stream);

      // Start 5-second countdown before recording
      // Use ref to avoid closure issues
      const countdownRef = { current: 5 };
      setCountdown(5);
      console.log('[VIDEO] Starting 5-second countdown...');
      console.log('[VIDEO] countdownIntervalRef before setInterval:', countdownIntervalRef.current);

      // Create countdown callback function - use arrow function to preserve context
      const countdownCallback = () => {
        console.log('[VIDEO] 🔔 countdownCallback EXECUTED!');
        countdownRef.current -= 1;
        const currentCountdown = countdownRef.current;
        console.log(`[VIDEO] ⏳ Countdown tick: ${currentCountdown}, countdownRef.current: ${countdownRef.current}`);
        
        // Use functional update to ensure state updates
        setCountdown(prev => {
          console.log(`[VIDEO] setCountdown called: ${prev} -> ${currentCountdown}`);
          return currentCountdown;
        });

        if (currentCountdown <= 0) {
          console.log('[VIDEO] ===== Countdown finished =====');
          const intervalId = countdownIntervalRef.current;
          if (intervalId) {
            console.log('[VIDEO] Clearing countdown interval, ID:', intervalId);
            clearInterval(intervalId);
            countdownIntervalRef.current = null;
          }
          setCountdown(null);
          console.log('[VIDEO] Calling startVideoRecording...');
          console.log('[VIDEO] Stream state:', stream.active, stream.getTracks().length);
          
          try {
            startVideoRecording(stream);
            console.log('[VIDEO] ✅ startVideoRecording called successfully');
          } catch (error) {
            console.error('[VIDEO] ❌ Error in startVideoRecording:', error);
            console.error('[VIDEO] Error stack:', error.stack);
            setIsRecordingVideo(false);
            setVideoProgress(null);
            alert('Failed to start video recording: ' + error.message);
          }
        }
      };

      // Start countdown interval - test immediately
      console.log('[VIDEO] About to create setInterval...');
      const countdownIntervalId = setInterval(countdownCallback, 1000);
      countdownIntervalRef.current = countdownIntervalId;
      console.log('[VIDEO] ✅ Countdown interval created, ID:', countdownIntervalId);
      console.log('[VIDEO] countdownIntervalRef.current after assignment:', countdownIntervalRef.current);
      
      // Test immediately and after 1 second
      console.log('[VIDEO] 🔍 Testing countdown immediately...');
      console.log('[VIDEO] countdownRef.current:', countdownRef.current);
      console.log('[VIDEO] Interval ID stored:', countdownIntervalRef.current);
      
      setTimeout(() => {
        console.log('[VIDEO] 🔍 Testing countdown after 1 second...');
        console.log('[VIDEO] countdownRef.current:', countdownRef.current);
        console.log('[VIDEO] countdownIntervalRef.current:', countdownIntervalRef.current);
        if (countdownRef.current === 5) {
          console.error('[VIDEO] ❌ Countdown is NOT running! Still at 5');
          console.error('[VIDEO] Interval ID:', countdownIntervalRef.current);
          // Try to manually trigger to see if callback works
          console.log('[VIDEO] Attempting manual callback test...');
          try {
            countdownCallback();
            console.log('[VIDEO] Manual callback executed successfully');
          } catch (e) {
            console.error('[VIDEO] Manual callback failed:', e);
          }
        } else {
          console.log('[VIDEO] ✅ Countdown is running! Value:', countdownRef.current);
        }
      }, 1100);
    } catch (error) {
      console.error('[VIDEO] ❌ Error in handleCaptureVideo:', error);
      console.error('[VIDEO] Error details:', { name: error.name, message: error.message, stack: error.stack });
      setIsRecordingVideo(false);
      setVideoProgress(null);
      alert('Failed to start video recording: ' + error.message);
    }
  };

  const startVideoRecording = (stream) => {
    console.log('[VIDEO] ===== startVideoRecording called =====');
    console.log('[VIDEO] Stream tracks:', stream.getTracks().map(t => ({ kind: t.kind, readyState: t.readyState })));
    
    try {
      // Determine best codec and mime type (vp9 is more efficient, fallback to vp8)
      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          console.error('[VIDEO] No supported codec found!');
          alert('Video recording is not supported in this browser. Please use Chrome or Firefox.');
          setIsRecordingVideo(false);
          setVideoProgress(null);
          stream.getTracks().forEach(track => track.stop());
          setCameraStream(null);
          return;
        }
      }
      console.log('[VIDEO] Using mimeType:', mimeType);

      // Optimized settings for balance between quality and file size
      // 1.2 Mbps bitrate: ~27 MB for 3 minutes (good quality, reasonable size)
      // Resolution: 1280x720 (already constrained in getUserMedia)
      // Frame rate: 15 fps (sufficient for text capture, reduces file size)
      console.log('[VIDEO] Creating MediaRecorder...');
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: 1200000 // 1.2 Mbps - optimized for text capture
      });
      console.log('[VIDEO] MediaRecorder created, state:', mediaRecorder.state);

      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];
      console.log('[VIDEO] Refs initialized');

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        console.log('[VIDEO] ===== onstart FIRED =====');
        console.log('[VIDEO] MediaRecorder started successfully, state:', mediaRecorder.state);
      };

      mediaRecorder.onstop = async () => {
        console.log('[VIDEO] ===== onstop FIRED =====');
        console.log('[VIDEO] Recording stopped. Total chunks:', recordedChunksRef.current.length);
        console.log('[VIDEO] Total data size:', recordedChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0), 'bytes');
        
        // Clear timer if still running
        if (videoTimerRef.current) {
          console.log('[VIDEO] Clearing timer in onstop');
          clearInterval(videoTimerRef.current);
          videoTimerRef.current = null;
        }
        
        try {
          console.log('[VIDEO] Starting frame extraction...');
          await extractFramesFromVideo();
        } catch (error) {
          console.error('[VIDEO] Error in onstop handler:', error);
          setIsCapturing(false);
          setIsRecordingVideo(false);
          setVideoProgress(null);
          setAnalysisProgress(null);
          alert('Error processing video: ' + error.message);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('[VIDEO] MediaRecorder error:', event.error);
        clearInterval(videoTimerRef.current);
        videoTimerRef.current = null;
        setIsRecordingVideo(false);
        setVideoProgress(null);
        alert('Video recording error: ' + (event.error?.message || 'Unknown error'));
      };

      // Start recording
      console.log('[VIDEO] Starting MediaRecorder...');
      
      try {
        mediaRecorder.start(1000); // Collect data every second
        console.log('[VIDEO] MediaRecorder.start() called, state:', mediaRecorder.state);
      } catch (startError) {
        console.error('[VIDEO] Error starting MediaRecorder:', startError);
        throw startError;
      }

      // Record for 1 minute (60 seconds)
      // Use ref to avoid closure issues
      const elapsedRef = { current: 0 };
      setVideoProgress(0);
      console.log('[VIDEO] Timer starting, will record for 60 seconds');
      console.log('[VIDEO] videoTimerRef before setInterval:', videoTimerRef.current);

      // Start timer immediately - store in variable first
      const timerCallback = () => {
        elapsedRef.current += 1;
        const currentElapsed = elapsedRef.current;
        console.log(`[VIDEO] ⏱️ Timer tick: ${currentElapsed} seconds, MediaRecorder state: ${mediaRecorder.state}`);
        
        // Force state update - use functional update to ensure it works
        setVideoProgress(prev => {
          const newValue = currentElapsed;
          if (prev !== newValue) {
            console.log(`[VIDEO] 📊 State update: ${prev} -> ${newValue}`);
          }
          return newValue;
        });

        if (currentElapsed >= 60) {
          console.log('[VIDEO] ⏹️ 60 seconds reached, stopping recording...');
          if (videoTimerRef.current) {
            clearInterval(videoTimerRef.current);
            videoTimerRef.current = null;
          }
          
          // Stop recording
          try {
            console.log('[VIDEO] MediaRecorder state before stop:', mediaRecorder.state);
            if (mediaRecorder.state === 'recording' || mediaRecorder.state === 'paused') {
              console.log('[VIDEO] Calling mediaRecorder.stop()...');
              mediaRecorder.stop();
              console.log('[VIDEO] mediaRecorder.stop() called');
            } else {
              console.warn(`[VIDEO] MediaRecorder state is ${mediaRecorder.state}, cannot stop`);
              // Force cleanup if recorder is already stopped
              if (mediaRecorder.state === 'inactive') {
                console.log('[VIDEO] Recorder already inactive, proceeding with cleanup');
                extractFramesFromVideo();
              }
            }
          } catch (e) {
            console.error('[VIDEO] Error stopping mediaRecorder:', e);
            // Try to extract frames anyway
            extractFramesFromVideo();
          }
          
          // Stop camera stream
          try {
            stream.getTracks().forEach(track => {
              if (track.readyState === 'live') {
                track.stop();
                console.log('[VIDEO] Stopped track:', track.kind);
              }
            });
            setCameraStream(null);
          } catch (e) {
            console.error('[VIDEO] Error stopping stream:', e);
          }
          
          console.log('[VIDEO] Recording completed after 1 minute');
        }
      };
      
      const timerId = setInterval(timerCallback, 1000);
      videoTimerRef.current = timerId;

      // Verify timer started
      if (videoTimerRef.current) {
        console.log('[VIDEO] ✅ Timer interval created successfully, ID:', videoTimerRef.current);
        // Test immediate update after 1 second
        setTimeout(() => {
          console.log('[VIDEO] 🔍 Testing timer after 1 second...');
          console.log('[VIDEO] elapsedRef.current:', elapsedRef.current);
          console.log('[VIDEO] videoProgress state should be:', elapsedRef.current);
          if (elapsedRef.current === 0) {
            console.error('[VIDEO] ❌ Timer is NOT running! elapsedRef is still 0');
          } else {
            console.log('[VIDEO] ✅ Timer is running! elapsedRef:', elapsedRef.current);
          }
        }, 1100);
      } else {
        console.error('[VIDEO] ❌ FAILED to create timer interval!');
      }

      // Safety timeout: if recording doesn't stop after 70 seconds, force stop
      setTimeout(() => {
        if (videoTimerRef.current) {
          console.warn('[VIDEO] Safety timeout reached, force stopping...');
          clearInterval(videoTimerRef.current);
          videoTimerRef.current = null;
          
          try {
            if (mediaRecorder.state !== 'inactive') {
              mediaRecorder.stop();
            }
          } catch (e) {
            console.error('[VIDEO] Error in safety timeout:', e);
          }
          
          try {
            stream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
          } catch (e) {
            console.error('[VIDEO] Error stopping stream in timeout:', e);
          }
          
          setIsRecordingVideo(false);
          setVideoProgress(null);
          alert('Video recording timed out. Please try again.');
        }
      }, 70000); // 70 seconds safety timeout
    } catch (error) {
      console.error('Error in video recording:', error);
      setIsRecordingVideo(false);
      setVideoProgress(null);
      alert('Failed to record video: ' + error.message);
    }
  };

  const extractFramesFromVideo = async () => {
    try {
      console.log('[VIDEO] Starting optimized frame extraction...');
      setIsCapturing(true);
      setVideoProgress(null);

      // Show extraction progress
      setAnalysisProgress({
        stage: 'extracting',
        message: 'Extracting frames from video...',
        totalImages: 0,
        processedImages: 0
      });

      // Create blob from recorded chunks
      const videoBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const videoUrl = URL.createObjectURL(videoBlob);

      // Create video element to extract frames
      const video = document.createElement('video');
      video.src = videoUrl;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';

      await new Promise((resolve, reject) => {
        video.onloadedmetadata = () => {
          video.currentTime = 0;
          resolve();
        };
        video.onerror = reject;
        // Timeout after 5 seconds if metadata doesn't load
        setTimeout(() => reject(new Error('Video metadata loading timeout')), 5000);
      });

      // Wait for video to be ready and try to get duration
      await new Promise(resolve => setTimeout(resolve, 500));

      // Validate video is ready and has valid dimensions
      if (!video.videoWidth || !video.videoHeight || video.videoWidth <= 0 || video.videoHeight <= 0) {
        throw new Error(`Video dimensions not available: ${video.videoWidth}x${video.videoHeight}`);
      }

      // Check for browser canvas size limits (most browsers limit to 32767px)
      const MAX_CANVAS_SIZE = 32767;
      if (video.videoWidth > MAX_CANVAS_SIZE || video.videoHeight > MAX_CANVAS_SIZE) {
        throw new Error(`Video dimensions too large: ${video.videoWidth}x${video.videoHeight}. Maximum supported: ${MAX_CANVAS_SIZE}x${MAX_CANVAS_SIZE}`);
      }

      // Get video duration - WebM from MediaRecorder sometimes returns Infinity
      // Try multiple methods to get valid duration
      let totalDuration = video.duration;
      console.log(`[VIDEO] Initial duration from video.duration: ${totalDuration}s`);

      // If duration is invalid, try seeking to end to trigger duration update
      if (!totalDuration || !isFinite(totalDuration) || totalDuration <= 0 || totalDuration === Infinity) {
        console.log(`[VIDEO] Duration invalid (${totalDuration}), attempting to get duration by seeking...`);
        
        try {
          // Try seeking to a very large time to get actual duration
          video.currentTime = 1e10; // Seek to very large time
          await new Promise((resolve) => {
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              totalDuration = video.duration;
              video.currentTime = 0; // Reset to start
              resolve();
            };
            video.addEventListener('seeked', onSeeked);
            setTimeout(() => {
              video.removeEventListener('seeked', onSeeked);
              resolve();
            }, 2000); // Timeout after 2 seconds
          });
          
          // Wait for seek to complete
          await new Promise(resolve => setTimeout(resolve, 300));
          totalDuration = video.duration;
          console.log(`[VIDEO] Duration after seek attempt: ${totalDuration}s`);
        } catch (seekError) {
          console.warn(`[VIDEO] Error seeking for duration:`, seekError);
        }

        // If still invalid, use known recording duration (60 seconds = 1 minute)
        if (!totalDuration || !isFinite(totalDuration) || totalDuration <= 0 || totalDuration === Infinity) {
          console.log(`[VIDEO] Duration still invalid (${totalDuration}), using fallback: 60 seconds (known recording time)`);
          totalDuration = 60; // We know we recorded for 60 seconds
        }
      }

      console.log(`[VIDEO] Video ready: ${video.videoWidth}x${video.videoHeight}, using duration: ${totalDuration}s`);

      const extractedFrames = [];
      const frameInterval = 3; // Extract every 3 seconds (reduced from 2 for fewer frames = faster)
      
      // Final validation
      if (!totalDuration || !isFinite(totalDuration) || totalDuration <= 0) {
        throw new Error(`Invalid video duration after all attempts: ${totalDuration}`);
      }

      const frameTimes = [];
      
      // Calculate all frame times upfront
      for (let time = 0; time < totalDuration; time += frameInterval) {
        frameTimes.push(time);
      }

      console.log(`[VIDEO] Will extract ${frameTimes.length} frames at intervals:`, frameTimes.slice(0, 5).map(t => `${t}s`).join(', '), '...');

      // Log video info
      const videoSizeMB = (videoBlob.size / 1024 / 1024).toFixed(2);
      console.log(`[VIDEO] Duration: ${totalDuration.toFixed(2)}s, size: ${videoSizeMB} MB, extracting ${frameTimes.length} frames every ${frameInterval}s`);

      // Optimized: Extract frames with minimal delays and batch optimization
      const extractFrameAtTime = async (time, index) => {
        return new Promise((resolve) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            
            // Use requestAnimationFrame for better performance
            requestAnimationFrame(() => {
              try {
                // Validate video dimensions - ensure they're valid numbers
                const videoWidth = Math.floor(video.videoWidth);
                const videoHeight = Math.floor(video.videoHeight);
                
                // Comprehensive validation
                if (!videoWidth || !videoHeight || 
                    videoWidth <= 0 || videoHeight <= 0 ||
                    !isFinite(videoWidth) || !isFinite(videoHeight) ||
                    videoWidth > 32767 || videoHeight > 32767) {
                  console.warn(`[VIDEO] Invalid video dimensions at ${time}s: ${videoWidth}x${videoHeight}`);
                  resolve(); // Skip this frame
                  return;
                }
                
                console.log(`[VIDEO] Extracting frame ${index} at ${time.toFixed(2)}s, dimensions: ${videoWidth}x${videoHeight}`);
                
                // Create canvas with validated dimensions
                const canvas = document.createElement('canvas');
                
                // Set dimensions - this is where "Invalid array length" can occur if dimensions are invalid
                try {
                  canvas.width = videoWidth;
                  canvas.height = videoHeight;
                  
                  // Verify dimensions were set correctly
                  if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
                    throw new Error(`Canvas dimension mismatch: set ${videoWidth}x${videoHeight}, got ${canvas.width}x${canvas.height}`);
                  }
                } catch (dimError) {
                  console.error(`[VIDEO] ❌ Error setting canvas dimensions:`, dimError);
                  console.error(`[VIDEO] Video dimensions: ${videoWidth}x${videoHeight}`);
                  resolve(); // Skip this frame
                  return;
                }
                
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                  console.error(`[VIDEO] ❌ Failed to get canvas context`);
                  resolve(); // Skip this frame
                  return;
                }
                
                // Draw image - this can also throw "Invalid array length" if dimensions are wrong
                try {
                  ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
                } catch (drawError) {
                  console.error(`[VIDEO] ❌ Error drawing to canvas:`, drawError);
                  resolve(); // Skip this frame
                  return;
                }

                // Direct extraction without optimization (optimize later in batch)
                const frameData = canvas.toDataURL('image/jpeg', 0.7);
                
                if (!frameData || frameData.length === 0) {
                  console.warn(`[VIDEO] Empty frame data at ${time}s`);
                  resolve(); // Skip this frame
                  return;
                }
                
                extractedFrames[index] = frameData; // Store at correct index
                
                // Update progress
                const processed = extractedFrames.filter(f => f).length;
                setAnalysisProgress({
                  stage: 'extracting',
                  message: `Extracting frames... ${processed}/${frameTimes.length}`,
                  totalImages: frameTimes.length,
                  processedImages: processed
                });
                
                console.log(`[VIDEO] ✅ Frame ${index} extracted successfully, size: ${(frameData.length / 1024).toFixed(2)} KB`);
                resolve();
              } catch (err) {
                console.error(`[VIDEO] ❌ Error extracting frame at ${time}s:`, err);
                console.error(`[VIDEO] Error details:`, { name: err.name, message: err.message, stack: err.stack });
                resolve(); // Continue even if one frame fails
              }
            });
          };
          
          video.addEventListener('seeked', onSeeked);
          video.currentTime = time;
        });
      };

      // Extract frames sequentially (but faster with reduced delays)
      for (let i = 0; i < frameTimes.length; i++) {
        await extractFrameAtTime(frameTimes[i], i);
      }

      // Filter out any failed extractions - ensure we only have valid frame data
      const validFrames = extractedFrames.filter(f => f && typeof f === 'string' && f.length > 0);
      
      console.log(`[VIDEO] Extracted ${validFrames.length} valid frames out of ${extractedFrames.length} total. Optimizing in batch...`);

      if (validFrames.length === 0) {
        throw new Error('No valid frames extracted from video');
      }

      // Batch optimize all frames in parallel (much faster)
      setAnalysisProgress({
        stage: 'optimizing',
        message: `Optimizing ${validFrames.length} frames...`,
        totalImages: validFrames.length,
        processedImages: 0
      });

      // Optimize frames with error handling for each frame
      const optimizedFrames = await Promise.allSettled(
        validFrames.map(async (frameData, index) => {
          try {
            const optimized = await optimizeImage(frameData, 1280, 720, 0.7);
            setAnalysisProgress({
              stage: 'optimizing',
              message: `Optimizing frames... ${index + 1}/${validFrames.length}`,
              totalImages: validFrames.length,
              processedImages: index + 1
            });
            return optimized;
          } catch (err) {
            console.error(`[VIDEO] Error optimizing frame ${index}:`, err);
            return null; // Return null for failed frames
          }
        })
      );

      // Extract only successful optimizations
      const successfulFrames = optimizedFrames
        .map((result, index) => result.status === 'fulfilled' && result.value ? result.value : null)
        .filter(f => f !== null);

      console.log(`[VIDEO] Successfully optimized ${successfulFrames.length} out of ${validFrames.length} frames`);

      if (successfulFrames.length === 0) {
        throw new Error('Failed to optimize any frames');
      }

      // Use successfulFrames instead of optimizedFrames
      const finalFrames = successfulFrames;

      // Cleanup
      URL.revokeObjectURL(videoUrl);
      video.src = '';
      recordedChunksRef.current = [];

      console.log(`[VIDEO] Frame extraction and optimization complete. Total frames: ${finalFrames.length}`);

      if (finalFrames.length > 0) {
        // Use existing batch analysis service
        await analyzeMultipleImages(finalFrames);
      } else {
        console.warn('[VIDEO] No frames extracted from video!');
        setIsCapturing(false);
        setIsRecordingVideo(false);
        setAnalysisProgress(null);
        alert('No frames could be extracted from the video. Please try again.');
      }
    } catch (error) {
      console.error('[VIDEO] Error extracting frames:', error);
      setIsCapturing(false);
      setIsRecordingVideo(false);
      setAnalysisProgress(null);
      alert('Failed to extract frames from video: ' + error.message);
    }
  };

  // Optimize image: resize and compress
  const optimizeImage = (imageData, maxWidth = 1280, maxHeight = 720, quality = 0.7) => {
    return new Promise((resolve) => {
      if (!imageData || typeof imageData !== 'string') {
        console.error('[OPTIMIZE] Invalid imageData:', typeof imageData);
        resolve(imageData); // Return as-is if invalid
        return;
      }
      
      const img = new Image();
      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;

          // Validate dimensions
          if (!width || !height || width <= 0 || height <= 0 || !isFinite(width) || !isFinite(height)) {
            console.warn('[OPTIMIZE] Invalid image dimensions:', width, height);
            resolve(imageData); // Return original if dimensions invalid
            return;
          }

          const canvas = document.createElement('canvas');
          
          // Calculate new dimensions maintaining aspect ratio
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }

          // Validate calculated dimensions
          if (width <= 0 || height <= 0 || !isFinite(width) || !isFinite(height)) {
            console.warn('[OPTIMIZE] Invalid calculated dimensions:', width, height);
            resolve(imageData); // Return original if calculated dimensions invalid
            return;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to base64 with compression
          const optimizedData = canvas.toDataURL('image/jpeg', quality);
          resolve(optimizedData);
        } catch (err) {
          console.error('[OPTIMIZE] Error optimizing image:', err);
          resolve(imageData); // Fallback to original if optimization fails
        }
      };
      img.onerror = (err) => {
        console.error('[OPTIMIZE] Image load error:', err);
        resolve(imageData); // Fallback to original if image load fails
      };
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
      {isRecordingVideo && videoProgress === null && isCapturing && analysisProgress && analysisProgress.stage === 'extracting' && (
        <div className="countdown-overlay">
          <div className="countdown-content">
            <div className="countdown-number">⏳</div>
            <p className="countdown-text">
              {analysisProgress.message || 'Extracting frames from video...'}
              {analysisProgress.totalImages > 0 && (
                <>
                  <br />
                  <span style={{ fontSize: '0.8em', opacity: 0.8 }}>
                    {analysisProgress.processedImages || 0} / {analysisProgress.totalImages} frames
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Video frame optimization overlay */}
      {isRecordingVideo && videoProgress === null && isCapturing && analysisProgress && analysisProgress.stage === 'optimizing' && (
        <div className="countdown-overlay">
          <div className="countdown-content">
            <div className="countdown-number">⚙️</div>
            <p className="countdown-text">
              {analysisProgress.message || 'Optimizing frames...'}
              {analysisProgress.totalImages > 0 && (
                <>
                  <br />
                  <span style={{ fontSize: '0.8em', opacity: 0.8 }}>
                    {analysisProgress.processedImages || 0} / {analysisProgress.totalImages} frames
                  </span>
                </>
              )}
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
