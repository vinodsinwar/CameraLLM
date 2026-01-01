import { memo } from 'react';

const ImageMessage = memo(({ imageData, analysis, error }) => {
  return (
    <div className="image-message">
      {/* Hide the image, only show analysis */}
      {error ? (
        <div className="analysis-error">
          <p>Error: {error}</p>
        </div>
      ) : analysis ? (
        <div className="analysis-content">
          <p>{analysis}</p>
        </div>
      ) : (
        <div className="analysis-loading">
          <p>Analyzing image...</p>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.imageData === nextProps.imageData &&
         prevProps.analysis === nextProps.analysis &&
         prevProps.error === nextProps.error;
});

ImageMessage.displayName = 'ImageMessage';

export default ImageMessage;

