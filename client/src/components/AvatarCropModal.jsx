import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import './AvatarCropModal.css';

export default function AvatarCropModal({ imageUrl, onConfirm, onCancel }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onCropComplete = useCallback((_croppedArea, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = () => {
    if (croppedAreaPixels) {
      onConfirm(croppedAreaPixels);
    }
  };

  return createPortal(
    <div className="avatar-crop-overlay" onClick={onCancel}>
      <div className="avatar-crop-modal" onClick={(e) => e.stopPropagation()}>
        <div className="avatar-crop-header">
          <h3>Crop Photo</h3>
          <button type="button" className="avatar-crop-close" onClick={onCancel}>
            ✕
          </button>
        </div>

        <div className="avatar-crop-area">
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="avatar-crop-zoom">
          <span className="avatar-crop-zoom-label">−</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
          <span className="avatar-crop-zoom-label">+</span>
        </div>

        <div className="avatar-crop-actions">
          <button type="button" className="avatar-crop-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="avatar-crop-apply" onClick={handleConfirm}>
            Apply
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
