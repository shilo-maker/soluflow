import React, { useEffect, useRef, useState } from 'react';
import ChordProDisplay from './ChordProDisplay';
import './A4PDFView.css';

/**
 * A4PDFView Component
 * Renders a song in A4 dimensions (595x842px) optimized for PDF export
 * Automatically scales content to maximize space usage
 * Long songs are split into two columns, each auto-fitted independently
 */
const A4PDFView = ({ song, transposition = 0, fontSize: initialFontSize = 14 }) => {
  const contentRef = useRef(null);
  const leftColumnRef = useRef(null);
  const rightColumnRef = useRef(null);
  const [leftFontSize, setLeftFontSize] = useState(initialFontSize);
  const [rightFontSize, setRightFontSize] = useState(initialFontSize);
  const [singleFontSize, setSingleFontSize] = useState(initialFontSize);

  // Detect if song content has Hebrew characters
  const hasHebrew = (text) => /[\u0590-\u05FF]/.test(text);
  const contentDirection = hasHebrew(song.content) ? 'rtl' : 'ltr';

  // Split content in half (we'll decide whether to use it based on font size)
  const lines = song.content.split('\n');
  const midpoint = Math.ceil(lines.length / 2);
  const leftContent = lines.slice(0, midpoint).join('\n');
  const rightContent = lines.slice(midpoint).join('\n');

  const [useTwoColumns, setUseTwoColumns] = useState(false);

  // Binary search for optimal font size
  const findOptimalFontSize = (element) => {
    const maxHeight = 650;
    const minFontSize = 8;
    const maxFontSize = 18;

    let bestFontSize = minFontSize;
    let low = minFontSize;
    let high = maxFontSize;

    for (let i = 0; i < 15; i++) {
      const testFontSize = Math.floor((low + high) / 2);
      element.style.fontSize = `${testFontSize}px`;

      // Force reflow
      // eslint-disable-next-line no-unused-expressions
      element.offsetHeight;

      const actualHeight = element.scrollHeight;

      if (actualHeight <= maxHeight) {
        bestFontSize = testFontSize;
        low = testFontSize + 1;
      } else {
        high = testFontSize - 1;
      }
    }

    return bestFontSize;
  };

  // Auto-fit for single column layout
  useEffect(() => {
    if (useTwoColumns || !contentRef.current) return;

    setTimeout(() => {
      const display = contentRef.current?.querySelector('.chordpro-display');
      if (!display) return;

      const fontSize = findOptimalFontSize(display);
      console.log(`Single column: ${fontSize}px`);

      // If font is too small (< 15px), switch to two columns
      if (fontSize < 15) {
        console.log(`Font too small (${fontSize}px), switching to two columns`);
        setUseTwoColumns(true);
      } else {
        setSingleFontSize(fontSize);
      }
    }, 200);
  }, [song.content, transposition, useTwoColumns]);

  // Auto-fit for left column
  useEffect(() => {
    if (!useTwoColumns || !leftColumnRef.current) return;

    setTimeout(() => {
      const display = leftColumnRef.current?.querySelector('.chordpro-display');
      if (!display) return;

      const fontSize = findOptimalFontSize(display);
      console.log(`Left column: ${fontSize}px`);
      setLeftFontSize(fontSize);
    }, 300);
  }, [song.content, transposition, useTwoColumns]);

  // Auto-fit for right column
  useEffect(() => {
    if (!useTwoColumns || !rightColumnRef.current) return;

    setTimeout(() => {
      const display = rightColumnRef.current?.querySelector('.chordpro-display');
      if (!display) return;

      const fontSize = findOptimalFontSize(display);
      console.log(`Right column: ${fontSize}px`);
      setRightFontSize(fontSize);
    }, 300);
  }, [song.content, transposition, useTwoColumns]);

  return (
    <div className="a4-pdf-container">
      <div className="a4-page">
        {/* Song Header */}
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

        {/* Song Content */}
        {useTwoColumns ? (
          <div className="a4-two-column-container">
            <div className="a4-column-left" ref={leftColumnRef}>
              <ChordProDisplay
                content={leftContent}
                dir={contentDirection}
                fontSize={leftFontSize}
                transposition={transposition}
              />
            </div>
            <div className="a4-column-right" ref={rightColumnRef}>
              <ChordProDisplay
                content={rightContent}
                dir={contentDirection}
                fontSize={rightFontSize}
                transposition={transposition}
              />
            </div>
          </div>
        ) : (
          <div className="a4-song-content" ref={contentRef}>
            <ChordProDisplay
              content={song.content}
              dir={contentDirection}
              fontSize={singleFontSize}
              transposition={transposition}
            />
          </div>
        )}

        {/* PDF Stamp */}
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
