import { useState, useEffect, useRef } from 'react';
import QrScanner from 'qr-scanner';
import { useWebSocket } from '../hooks/useWebSocket';
import { WEBSOCKET_EVENTS, MESSAGE_TYPES } from '@shared/constants.js';

const PairingScanner = ({ onComplete, onCancel, socket }) => {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const videoRef = useRef(null);
  const qrScannerRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    const handleSessionJoined = (data) => {
      setScanning(false);
      if (qrScannerRef.current) {
        qrScannerRef.current.stop();
      }
      onComplete(data.sessionId);
    };

    const handlePairingError = (data) => {
      setError(data.error);
      setScanning(false);
      if (qrScannerRef.current) {
        qrScannerRef.current.stop();
      }
    };

    socket.on(WEBSOCKET_EVENTS.SESSION_JOINED, handleSessionJoined);
    socket.on(MESSAGE_TYPES.PAIRING_ERROR, handlePairingError);

    return () => {
      socket.off(WEBSOCKET_EVENTS.SESSION_JOINED, handleSessionJoined);
      socket.off(MESSAGE_TYPES.PAIRING_ERROR, handlePairingError);
    };
  }, [socket, onComplete]);

  const startScanning = async () => {
    try {
      if (!videoRef.current) {
        setError('Video element not available');
        return;
      }

      const qrScanner = new QrScanner(
        videoRef.current,
        (result) => {
          try {
            const data = JSON.parse(result.data);
            joinSession(data.sessionId, data.encryptionKey);
          } catch (err) {
            setError('Invalid QR code format');
          }
        },
        {
          returnDetailedScanResult: true,
          highlightScanRegion: true
        }
      );

      qrScannerRef.current = qrScanner;
      await qrScanner.start();
      setScanning(true);
      setError(null);
    } catch (err) {
      console.error('Error starting QR scanner:', err);
      setError('Failed to start camera. Please check permissions.');
    }
  };

  const stopScanning = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop();
      qrScannerRef.current.destroy();
      qrScannerRef.current = null;
    }
    setScanning(false);
  };

  const joinSession = (sessionId, encryptionKey) => {
    if (!socket) {
      setError('WebSocket not connected');
      return;
    }

    socket.emit(WEBSOCKET_EVENTS.JOIN_SESSION, {
      sessionId,
      deviceType: 'mobile',
      encryptionKey
    });
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) {
      setError('Please enter a session ID');
      return;
    }

    // Try to parse as JSON (in case user pasted full QR data)
    try {
      const data = JSON.parse(manualCode);
      joinSession(data.sessionId, data.encryptionKey);
    } catch {
      // If not JSON, treat as session ID only
      joinSession(manualCode.trim(), null);
    }
  };

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  return (
    <div className="pairing-scanner-overlay">
      <div className="pairing-scanner-content">
        <div className="scanner-header">
          <h2>Pair with Receiver</h2>
          <button className="close-button" onClick={onCancel}>×</button>
        </div>

        <div className="scanner-body">
          {!scanning && !showManualInput && (
            <div className="scanner-options">
              <button className="scan-button" onClick={startScanning}>
                Scan QR Code
              </button>
              <button 
                className="manual-button" 
                onClick={() => setShowManualInput(true)}
              >
                Enter Code Manually
              </button>
            </div>
          )}

          {scanning && (
            <div className="scanner-view">
              <video ref={videoRef} className="scanner-video" />
              <div className="scanner-overlay">
                <div className="scanner-frame"></div>
                <p>Position QR code within frame</p>
              </div>
              <button className="cancel-scan-button" onClick={stopScanning}>
                Cancel
              </button>
            </div>
          )}

          {showManualInput && (
            <div className="manual-input">
              <form onSubmit={handleManualSubmit}>
                <input
                  type="text"
                  className="session-id-input"
                  placeholder="Enter session ID"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                />
                <div className="manual-buttons">
                  <button type="submit" className="submit-button">
                    Connect
                  </button>
                  <button 
                    type="button" 
                    className="back-button"
                    onClick={() => {
                      setShowManualInput(false);
                      setManualCode('');
                    }}
                  >
                    Back
                  </button>
                </div>
              </form>
            </div>
          )}

          {error && (
            <div className="scanner-error">
              <p>{error}</p>
              <button onClick={() => setError(null)}>Dismiss</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PairingScanner;

