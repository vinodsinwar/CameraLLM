import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useWebSocket } from '../hooks/useWebSocket';
import { api } from '../services/api';
import { WEBSOCKET_EVENTS, MESSAGE_TYPES } from '@shared/constants.js';

const PairingModal = ({ onComplete, onCancel, socket }) => {
  const [qrData, setQrData] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [encryptionKey, setEncryptionKey] = useState(null);
  const [pairingStatus, setPairingStatus] = useState('generating');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!socket) return;

    const handleSessionJoined = (data) => {
      setPairingStatus('paired');
      setTimeout(() => {
        onComplete(data.sessionId);
      }, 1000);
    };

    const handlePairingError = (data) => {
      setError(data.error);
      setPairingStatus('error');
    };

    socket.on(WEBSOCKET_EVENTS.SESSION_JOINED, handleSessionJoined);
    socket.on(MESSAGE_TYPES.PAIRING_ERROR, handlePairingError);

    return () => {
      socket.off(WEBSOCKET_EVENTS.SESSION_JOINED, handleSessionJoined);
      socket.off(MESSAGE_TYPES.PAIRING_ERROR, handlePairingError);
    };
  }, [socket, onComplete]);

  useEffect(() => {
    const createPairing = async () => {
      try {
        setPairingStatus('generating');
        const response = await api.createPairingSession();
        
        if (response.success) {
          setSessionId(response.sessionId);
          setEncryptionKey(response.encryptionKey);
          setQrData(response.qrData);
          setPairingStatus('waiting');

          // Generate QR code data for mobile to scan
          const qrCodeData = JSON.stringify({
            sessionId: response.sessionId,
            encryptionKey: response.encryptionKey,
            serverUrl: import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
          });

          // Join WebSocket session as receiver
          if (socket) {
            socket.emit(WEBSOCKET_EVENTS.JOIN_SESSION, {
              sessionId: response.sessionId,
              deviceType: 'receiver',
              encryptionKey: response.encryptionKey
            });
          }
        } else {
          setError('Failed to create pairing session');
          setPairingStatus('error');
        }
      } catch (err) {
        console.error('Error creating pairing:', err);
        setError('Failed to create pairing session');
        setPairingStatus('error');
      }
    };

    createPairing();
  }, [socket]);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Pair with Mobile Device</h2>
          <button className="close-button" onClick={onCancel}>×</button>
        </div>

        <div className="modal-body">
          {pairingStatus === 'generating' && (
            <div className="pairing-status">
              <p>Generating pairing code...</p>
            </div>
          )}

          {pairingStatus === 'waiting' && qrData && (
            <div className="pairing-content">
              <p>Scan this QR code with your mobile device:</p>
              <div className="qr-code-container">
                <QRCodeSVG 
                  value={JSON.stringify({
                    sessionId,
                    encryptionKey,
                    serverUrl: import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
                  })} 
                  size={256} 
                />
              </div>
              <p className="session-id">Session ID: <code>{sessionId}</code></p>
              <p className="pairing-instruction">
                Or enter this code manually on your mobile device
              </p>
            </div>
          )}

          {pairingStatus === 'paired' && (
            <div className="pairing-status success">
              <p>✓ Paired successfully!</p>
            </div>
          )}

          {pairingStatus === 'error' && (
            <div className="pairing-status error">
              <p>Error: {error || 'Pairing failed'}</p>
              <button onClick={() => window.location.reload()}>Retry</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PairingModal;

