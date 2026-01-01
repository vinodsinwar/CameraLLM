import { useState } from 'react';

const ImageUpload = ({ onImageUpload, socket, sessionId, enabled = true }) => {
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    setUploading(true);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const imageData = event.target.result; // base64 data URL

        // Send via API for analysis (testing mode - analyze on sender/mobile end)
        try {
          const response = await fetch('/api/upload-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              imageData
            })
          });

          const data = await response.json();
          if (data.success) {
            if (onImageUpload) {
              onImageUpload(imageData, data.analysis);
            }
            // Don't show alert, let the UI show the result
          } else {
            alert('Failed to upload image: ' + (data.error || 'Unknown error'));
          }
        } catch (error) {
          console.error('Upload error:', error);
          alert('Failed to upload image: ' + error.message);
        }

        setUploading(false);
      };

      reader.onerror = () => {
        setUploading(false);
        alert('Failed to read image file');
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error processing file:', error);
      setUploading(false);
      alert('Failed to process image');
    }
  };

  return (
    <div className="image-upload">
      <label className={`upload-button ${!enabled ? 'disabled' : ''}`}>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          disabled={uploading || !enabled}
          style={{ display: 'none' }}
        />
        {uploading ? 'Uploading & Analyzing...' : 'Upload Image'}
      </label>
    </div>
  );
};

export default ImageUpload;

