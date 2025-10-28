import React from 'react';
import { getAllKeys, transposeChord, calculateTransposition } from '../utils/transpose';
import './KeySelectorModal.css';

const KeySelectorModal = ({ isOpen, onClose, currentKey, currentTransposition, onSelectKey }) => {
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

  return (
    <div className="key-selector-overlay" onClick={onClose}>
      <div className="key-selector-modal" onClick={(e) => e.stopPropagation()}>
        <div className="key-selector-header">
          <h3>Select Key</h3>
          <button className="btn-close-modal" onClick={onClose}>×</button>
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
              <button
                key={key.value}
                className={`key-button ${isCurrentKey ? 'active' : ''}`}
                onClick={() => handleKeySelect(key.value)}
              >
                {key.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default KeySelectorModal;
