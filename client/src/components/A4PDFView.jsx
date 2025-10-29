import React, { useEffect, useRef, useState } from 'react';
import ChordProDisplay from './ChordProDisplay';
import './A4PDFView.css';

/**
 * A4PDFView Component
 * Renders a song in A4 dimensions (595x842px) optimized for PDF export
 * Automatically scales content to maximize space usage
 *
 * A4 Page dimensions:
 * - Width: 595px
 * - Height: 842px
 *
 * pdf_stamp.png positioning:
 * - Original size: 110x50px
 * - Display size: 55x25px (half size)
 * - Position: Centered horizontally, 43px from bottom edge
 * - Calculated position: x=270px, y=774px (from top)
 */
const A4PDFView = ({ song, transposition = 0, fontSize: initialFontSize = 14 }) => {
  const contentRef = useRef(null);
  const [calculatedFontSize, setCalculatedFontSize] = useState(initialFontSize);

  // Detect if song content has Hebrew characters
  const hasHebrew = (text) => /[\u0590-\u05FF]/.test(text);

  const contentDirection = hasHebrew(song.content) ? 'rtl' : 'ltr';

  useEffect(() => {
    if (!contentRef.current) return;

    // Find the actual ChordProDisplay element
    const chordproDisplay = contentRef.current.querySelector('.chordpro-display');
    if (!chordproDisplay) {
      // If not found yet, retry after a short delay
      setTimeout(() => {
        const display = contentRef.current?.querySelector('.chordpro-display');
        if (display) {
          performAutoFit(display);
        }
      }, 100);
      return;
    }

    performAutoFit(chordproDisplay);
  }, [song.content, transposition]);

  const performAutoFit = (chordproDisplay) => {
    // Conservative height: Account for header, padding, and stamp
    // Page: 842px, padding: 80px, header: ~40px, stamp space: ~70px
    // Available: ~650px to be safe
    const maxHeight = 650;
    const minFontSize = 8;
    const maxFontSize = 18;

    let bestFontSize = minFontSize;

    // Binary search for optimal font size
    let low = minFontSize;
    let high = maxFontSize;
    let iterations = 0;
    const maxIterations = 15;

    while (low <= high && iterations < maxIterations) {
      const testFontSize = Math.floor((low + high) / 2);

      // Apply test font size
      chordproDisplay.style.fontSize = `${testFontSize}px`;

      // Force reflow
      // eslint-disable-next-line no-unused-expressions
      chordproDisplay.offsetHeight;

      // Measure the actual rendered height
      const actualHeight = chordproDisplay.scrollHeight;

      console.log(`Iteration ${iterations}: fontSize=${testFontSize}px, height=${actualHeight}px, target=${maxHeight}px`);

      if (actualHeight <= maxHeight) {
        // Content fits, try larger
        bestFontSize = testFontSize;
        low = testFontSize + 1;
      } else {
        // Content too large, try smaller
        high = testFontSize - 1;
      }

      iterations++;
    }

    console.log(`Final font size: ${bestFontSize}px`);
    setCalculatedFontSize(bestFontSize);
  };

  return (
    <div className="a4-pdf-container">
      {/* A4 Page with exact dimensions */}
      <div className="a4-page">
        {/* Song Header - Compact single line */}
        <div className="a4-song-header">
          <h1 className="a4-song-title">
            {song.title}
            {song.authors && <span className="a4-song-authors"> {song.authors}</span>}
            {(song.key || song.bpm) && <span className="a4-song-meta">
              {song.key && ` - ${song.key}`}
              {song.bpm && ` | ${song.bpm}`}
            </span>}
          </h1>
        </div>

        {/* Song Content - Using ChordProDisplay */}
        <div className="a4-song-content" ref={contentRef}>
          <ChordProDisplay
            content={song.content}
            dir={contentDirection}
            fontSize={calculatedFontSize}
            transposition={transposition}
          />
        </div>

        {/* PDF Stamp - Fixed overlay at bottom */}
        <div className="a4-stamp-overlay">
          <img
            src="/pdf_stamp.png"
            alt="SoluFlow"
            className="a4-stamp-image"
          />
        </div>
      </div>
    </div>
  );
};

export default A4PDFView;
