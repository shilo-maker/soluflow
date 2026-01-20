import React from 'react';
import ChordProDisplay from './ChordProDisplay';
import { transposeChord } from '../utils/transpose';
import './A4PDFView.css';

/**
 * A4PDFView Component
 * Renders a song optimized for PDF export
 * Content flows naturally and PDF generator handles pagination
 */
const A4PDFView = ({ song, transposition = 0, fontSize = 14 }) => {
  // Detect if song content has Hebrew characters
  const hasHebrew = (text) => /[\u0590-\u05FF]/.test(text);
  const contentDirection = hasHebrew(song.content) ? 'rtl' : 'ltr';

  return (
    <div className="a4-pdf-container">
      <div className="a4-page">
        {/* Song Header */}
        <div className="a4-song-header">
          <h1 className="a4-song-title">
            {song.title}
            {song.authors && <span className="a4-song-authors"> {song.authors}</span>}
            {(song.key || song.bpm) && <span className="a4-song-meta">
              {song.key && ` - ${transposition !== 0 ? transposeChord(song.key, transposition) : song.key}`}
              {song.bpm && ` | ${song.bpm}`}
            </span>}
          </h1>
        </div>

        {/* Song Content - flows naturally */}
        <div className="a4-song-content">
          <ChordProDisplay
            content={song.content}
            dir={contentDirection}
            fontSize={fontSize}
            transposition={transposition}
            disableColumnCalculation={true}
            forcedColumnCount={1}
          />
        </div>

        {/* PDF Stamp - will be added by PDF generator on each page */}
      </div>
    </div>
  );
};

export default A4PDFView;
