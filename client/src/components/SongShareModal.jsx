import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import songService from '../services/songService';
import './ShareModal.css';

const SongShareModal = ({ song, isOpen, onClose }) => {
  const [shareCode, setShareCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && song) {
      fetchShareLink();
    }
  }, [isOpen, song]);

  const fetchShareLink = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await songService.getShareLink(song.id);
      setShareCode(data.code);
    } catch (err) {
      console.error('Error getting share link:', err);
      setError('Failed to generate share link');
    } finally {
      setLoading(false);
    }
  };

  const getShareUrl = () => {
    return `${window.location.origin}/song/code/${shareCode}`;
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
          <h2>Share Song</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {loading && (
            <div className="share-loading">
              <p>Generating share link...</p>
            </div>
          )}

          {error && (
            <div className="share-error">
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && shareCode && (
            <>
              <div className="share-section">
                <label className="share-label">Share Link</label>
                <div className="share-input-group">
                  <input
                    type="text"
                    className="share-input"
                    value={getShareUrl()}
                    readOnly
                  />
                  <button className="btn-copy" onClick={handleCopyLink}>
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="share-hint">Anyone with this link can view and add this song to their library</p>
              </div>

              <div className="share-section">
                <label className="share-label">Share Code</label>
                <div className="share-code-display">
                  <span className="share-code">{shareCode}</span>
                  <button className="btn-copy" onClick={handleCopyCode}>
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="share-hint">Share this 4-character code for easy access</p>
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
                <p className="share-hint">Scan this QR code with a phone camera to view the song</p>
              </div>

              <div className="share-note">
                <p><strong>Note:</strong> The song "{song.title}" will be visible to anyone with this link or code. They can add it to their own library.</p>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SongShareModal;
