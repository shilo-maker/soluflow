import React, { useState, useEffect, useRef } from 'react';
import { getAllKeys, transposeChord, calculateTransposition } from '../utils/transpose';
import { playChordProgression } from '../utils/audioUtils';
import './KeySelectorModal.css';

const KeySelectorModal = ({ isOpen, onClose, currentKey, currentTransposition, onSelectKey }) => {
  const [playingKey, setPlayingKey] = useState(null);
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);

  // Handle Escape key and focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Focus trap
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Focus close button when modal opens
    setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const keys = getAllKeys();

  // Calculate the actual current key (original key + transposition)
  const displayedKey = transposeChord(currentKey, currentTransposition);

  const handleKeySelect = (targetKey) => {
    // Calculate how many semitones we need to transpose from the original key
    const newTransposition = calculateTransposition(currentKey, targetKey);
    onSelectKey(newTransposition);
    onClose();
  };

  const handleOverlayClick = () => {
    onClose();
  };

  const handleModalClick = (e) => {
    e.stopPropagation();
  };

  const handlePlayKey = (e, key) => {
    e.stopPropagation();
    setPlayingKey(key);
    const progressionDuration = playChordProgression(key, 0.8, 0.25);
    // Reset playing state after progression finishes
    setTimeout(() => setPlayingKey(null), progressionDuration * 1000);
  };

  return (
    <div className="key-selector-overlay" onClick={handleOverlayClick} role="presentation">
      <div
        ref={modalRef}
        className="key-selector-modal"
        onClick={handleModalClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby="key-selector-title"
      >
        <div className="key-selector-header">
          <h3 id="key-selector-title">Select Key</h3>
          <button
            ref={closeButtonRef}
            className="btn-close-modal"
            onClick={onClose}
            aria-label="Close key selector"
          >
            ×
          </button>
        </div>
        <div className="key-selector-info">
          <span className="original-key">Original: {currentKey}</span>
          <span className="current-key">Current: {displayedKey}</span>
        </div>
        <div className="keys-grid">
          {keys.map((key) => {
            const transposedKey = transposeChord(currentKey, currentTransposition);
            const isCurrentKey = key.value === transposedKey ||
                                 (key.value === 'C#' && transposedKey === 'Db') ||
                                 (key.value === 'D#' && transposedKey === 'Eb') ||
                                 (key.value === 'F#' && transposedKey === 'Gb') ||
                                 (key.value === 'G#' && transposedKey === 'Ab') ||
                                 (key.value === 'A#' && transposedKey === 'Bb');

            return (
              <div key={key.value} className="key-button-wrapper">
                <button
                  className={`key-button ${isCurrentKey ? 'active' : ''}`}
                  onClick={() => handleKeySelect(key.value)}
                >
                  {key.label}
                </button>
                <button
                  className={`play-key-button ${playingKey === key.value ? 'playing' : ''}`}
                  onClick={(e) => handlePlayKey(e, key.value)}
                  title={`Play ${key.label} chord progression (I-V-vi-IV)`}
                >
                  🔊
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default KeySelectorModal;
