import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import serviceService from '../services/serviceService';
import './ShareModal.css';

const ShareModal = ({ service, isOpen, onClose }) => {
  const [shareCode, setShareCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && service) {
      fetchShareLink();
    }
  }, [isOpen, service]);

  const fetchShareLink = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await serviceService.getShareLink(service.id);
      setShareCode(data.code);
    } catch (err) {
      console.error('Error getting share link:', err);
      setError('Failed to generate share link');
    } finally {
      setLoading(false);
    }
  };

  const getShareUrl = () => {
    return `${window.location.origin}/service/code/${shareCode}`;
  };

  const copyToClipboard = (text) => {
    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }

    // Fallback for mobile/HTTP: use textarea method
    return new Promise((resolve, reject) => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (successful) {
          resolve();
        } else {
          reject(new Error('Copy command failed'));
        }
      } catch (err) {
        document.body.removeChild(textarea);
        reject(err);
      }
    });
  };

  const handleCopyLink = async () => {
    try {
      const url = getShareUrl();
      await copyToClipboard(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
      setError('Failed to copy link. Please copy manually.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleCopyCode = async () => {
    try {
      await copyToClipboard(shareCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
      setError('Failed to copy code. Please copy manually.');
      setTimeout(() => setError(''), 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content share-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Share Service</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="share-loading">Generating share link...</div>
          ) : error ? (
            <div className="modal-error">{error}</div>
          ) : (
            <>
              <div className="share-info">
                <p className="share-description">
                  Share this service with others. Registered users can add it to their services list, while guests can view it.
                </p>
              </div>

              <div className="share-section">
                <label className="share-label">Share Code</label>
                <div className="share-code-display">
                  <span className="share-code-text">{shareCode}</span>
                  <button
                    type="button"
                    className="btn-copy-code"
                    onClick={handleCopyCode}
                  >
                    {copied ? 'Copied!' : 'Copy Code'}
                  </button>
                </div>
                <p className="share-hint">Others can enter this code on the home page to join the service</p>
              </div>

              <div className="share-section">
                <label className="share-label">Share Link</label>
                <div className="share-link-display">
                  <input
                    type="text"
                    className="share-link-input"
                    value={getShareUrl()}
                    readOnly
                    onClick={(e) => e.target.select()}
                  />
                  <button
                    type="button"
                    className="btn-copy-link"
                    onClick={handleCopyLink}
                  >
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>

              <div className="share-section qr-section">
                <label className="share-label">QR Code</label>
                <div className="qr-code-container">
                  <QRCodeCanvas
                    value={getShareUrl()}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <p className="share-hint">Scan this QR code with a phone camera to join the service</p>
              </div>

              <div className="share-note">
                <strong>Note:</strong> Only upcoming services can be added to other users' lists. Guests can view any public service.
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn-close-modal"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
