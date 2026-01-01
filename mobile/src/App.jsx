import { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { MESSAGE_TYPES } from '@shared/constants.js';
import './App.css';

function App() {
  const { socket, connected } = useWebSocket();

  // Trigger capture on receiver when button is clicked
  const handleTriggerCapture = () => {
    if (!socket || !connected) {
      alert('Not connected to server. Please wait...');
      return;
    }

    // Send capture request to receiver
    socket.emit(MESSAGE_TYPES.CAPTURE_REQUEST, {
      timestamp: Date.now()
    });
  };

  // Listen for capture response from receiver
  useEffect(() => {
    if (!socket) return;

    const handleCaptureResponse = (data) => {
      console.log('Capture response received from receiver:', data);
      if (data.imageData) {
        // Image captured and sent to receiver - receiver will analyze it
        alert('✅ Image captured from receiver camera and sent for analysis!');
      }
    };

    const handleCaptureError = (data) => {
      console.error('Capture error:', data);
      alert('❌ Error: ' + (data.error || 'Failed to capture image'));
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
        <h1>Remote Camera Sender</h1>
        <div className="status-indicator">
          <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`}></span>
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </header>

      <div className="main-content">
        <div className="trigger-section">
          <h2>Trigger Camera Capture</h2>
          <p>Click the button below to trigger camera capture on the receiver device.</p>
          <button 
            className="trigger-button"
            onClick={handleTriggerCapture}
            disabled={!connected}
          >
            📷 Trigger Capture
          </button>
          {!connected && (
            <p className="warning-text">Please wait for connection...</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;

