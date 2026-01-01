import { useState, useEffect, useRef, useCallback } from 'react';
import { IMAGE_QUALITY } from '@shared/constants.js';

export const useCamera = () => {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Initialize canvas for image capture
  useEffect(() => {
    canvasRef.current = document.createElement('canvas');
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setError(null);

      // Request camera permission and get stream
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: IMAGE_QUALITY.MAX_WIDTH },
          height: { ideal: IMAGE_QUALITY.MAX_HEIGHT }
        },
        audio: false
      });

      setStream(mediaStream);
      setIsActive(true);

      // Handle visibility change - stop camera when app goes to background
      const handleVisibilityChange = () => {
        if (document.hidden && isActive) {
          // Camera will remain active but we track visibility
          console.log('App went to background - camera still active but visible to user');
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    } catch (err) {
      console.error('Error starting camera:', err);
      setError(err.message || 'Failed to access camera');
      setIsActive(false);
      throw err;
    }
  }, [isActive]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
      });
      setStream(null);
      setIsActive(false);
      setError(null);
    }
  }, [stream]);

  const captureFrame = useCallback(async () => {
    if (!stream || !isActive) {
      throw new Error('Camera not active');
    }

    try {
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          video.currentTime = 0;
          resolve();
        };
      });

      // Wait for video to be ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      const canvas = canvasRef.current;
      if (!canvas) {
        throw new Error('Canvas not initialized');
      }

      // Set canvas dimensions to match video
      const aspectRatio = video.videoWidth / video.videoHeight;
      let width = video.videoWidth;
      let height = video.videoHeight;

      // Resize if needed to meet quality constraints
      if (width > IMAGE_QUALITY.MAX_WIDTH) {
        width = IMAGE_QUALITY.MAX_WIDTH;
        height = width / aspectRatio;
      }
      if (height > IMAGE_QUALITY.MAX_HEIGHT) {
        height = IMAGE_QUALITY.MAX_HEIGHT;
        width = height * aspectRatio;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, width, height);

      // Convert to base64 data URL
      const imageData = canvas.toDataURL(IMAGE_QUALITY.FORMAT, IMAGE_QUALITY.QUALITY);

      // Cleanup
      video.srcObject = null;

      return imageData;
    } catch (err) {
      console.error('Error capturing frame:', err);
      throw new Error('Failed to capture image');
    }
  }, [stream, isActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    stream,
    error,
    isActive,
    startCamera,
    stopCamera,
    captureFrame
  };
};

