const SessionControls = ({ onStop, cameraActive }) => {
  return (
    <div className="session-controls">
      <div className="control-info">
        <p>Camera session is active</p>
        <p className="info-text">You can now receive capture requests</p>
      </div>
      <button className="stop-button" onClick={onStop}>
        Stop Session
      </button>
    </div>
  );
};

export default SessionControls;

