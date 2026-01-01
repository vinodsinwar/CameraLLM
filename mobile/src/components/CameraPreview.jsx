import { useEffect, useRef } from 'react';

const CameraPreview = ({ stream, error }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (error) {
    return (
      <div className="camera-error">
        <p>Camera Error: {error}</p>
        <p>Please check permissions and try again</p>
      </div>
    );
  }

  return (
    <div className="camera-preview-container">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="camera-preview"
      />
      <div className="camera-overlay">
        <div className="camera-indicator">
          <span className="indicator-dot"></span>
          <span>Camera Active</span>
        </div>
      </div>
    </div>
  );
};

export default CameraPreview;

