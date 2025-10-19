import React, { useMemo, useRef, useState, useEffect } from 'react';
import './ChordProDisplay.css';
import { transpose } from '../utils/transpose';
import InlineNoteMarker from './InlineNoteMarker';

const ChordProDisplay = ({
  content,
  isLyricsOnly = false,
  dir = 'ltr',
  fontSize = 14,
  transposition = 0,
  notes = [],
  isEditMode = false,
  onAddNote = null,
  onUpdateNote = null,
  onDeleteNote = null
}) => {
  const contentRef = useRef(null);
  const [columnCount, setColumnCount] = useState(1);

  // Transpose the content if needed
  const transposedContent = useMemo(() => {
    return transpose(content, transposition);
  }, [content, transposition]);

  // Calculate if we need 2 columns based on content height
  useEffect(() => {
    if (!contentRef.current) return;

    // Wait for render to complete
    const checkHeight = () => {
      const contentHeight = contentRef.current.scrollHeight;
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // Never use 2 columns on mobile (768px or less)
      if (viewportWidth <= 768) {
        setColumnCount(1);
        return;
      }

      // Use 2 columns if content would require scrolling (leave 200px buffer for headers/controls)
      // This means if content is taller than viewport, we go to 2 columns
      if (contentHeight > viewportHeight - 200) {
        setColumnCount(2);
      } else {
        setColumnCount(1);
      }
    };

    // Small delay to ensure DOM is fully rendered
    const timeoutId = setTimeout(checkHeight, 10);

    // Recalculate on window resize (e.g., device rotation)
    window.addEventListener('resize', checkHeight);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', checkHeight);
    };
  }, [transposedContent, fontSize]);

  const parseChordPro = (text) => {
    const lines = text.split('\n');
    const parsed = [];

    lines.forEach((line, index) => {
      // Skip all ChordPro metadata/directive lines (anything starting with { and ending with })
      // But allow section markers which we handle separately
      if (line.match(/^{(?!soc|eoc)[^}]*}/i)) {
        return;
      }

      // Section start
      if (line.match(/^{soc/i)) {
        const sectionName = line.match(/^{soc[:\s]*(.*)}/i)?.[1]?.trim() || 'Chorus';
        parsed.push({ type: 'section-start', content: sectionName });
        return;
      }

      // Section end
      if (line.match(/^{eoc}/i)) {
        parsed.push({ type: 'section-end' });
        return;
      }

      // Empty line
      if (line.trim() === '') {
        parsed.push({ type: 'empty' });
        return;
      }

      // Line with chords
      if (line.includes('[')) {
        const { chords, lyrics } = parseChordLine(line);
        parsed.push({ type: 'chord-line', chords, lyrics });
      } else {
        // Plain lyrics line
        parsed.push({ type: 'lyrics', content: line });
      }
    });

    return parsed;
  };

  const parseChordLine = (line) => {
    const chords = [];

    // Find all chord positions
    const chordPattern = /\[([^\]]+)\]/g;
    let match;
    const chordMatches = [];

    while ((match = chordPattern.exec(line)) !== null) {
      chordMatches.push({
        chord: match[1],
        position: match.index,
        length: match[0].length
      });
    }

    // Build the chord and lyric lines
    let lyricLine = line;
    chordMatches.forEach(cm => {
      lyricLine = lyricLine.replace(`[${cm.chord}]`, '');
    });

    // Calculate chord positions relative to lyrics
    let offset = 0;
    chordMatches.forEach((cm) => {
      const posInLyrics = cm.position - offset;
      chords.push({
        chord: cm.chord,
        position: posInLyrics
      });
      offset += cm.length;
    });

    return { chords, lyrics: lyricLine };
  };

  const [newNoteLineNumber, setNewNoteLineNumber] = useState(null);
  const [newNoteText, setNewNoteText] = useState('');

  const handleAddNoteClick = (lineNumber) => {
    setNewNoteLineNumber(lineNumber);
    setNewNoteText('');
  };

  const handleSaveNewNote = () => {
    if (newNoteText.trim() && onAddNote) {
      onAddNote(newNoteLineNumber, newNoteText);
      setNewNoteLineNumber(null);
      setNewNoteText('');
    }
  };

  const handleCancelNewNote = () => {
    setNewNoteLineNumber(null);
    setNewNoteText('');
  };

  // Get notes for a specific line
  const getNotesForLine = (lineNumber) => {
    return notes.filter(note => note.lineNumber === lineNumber);
  };

  const renderParsedContent = (parsed) => {
    const result = [];
    let currentSection = [];
    let sectionName = null;
    let sectionKey = 0;
    let lineNumber = 0;

    parsed.forEach((item, index) => {
      if (item.type === 'section-start') {
        // Start a new section
        sectionName = item.content;
        currentSection = [];
        lineNumber++;
      } else if (item.type === 'section-end') {
        // End section - wrap everything in a section container
        result.push(
          <div key={`section-${sectionKey}`} className="section-container">
            <div className="section-header">{sectionName}</div>
            {currentSection}
          </div>
        );
        currentSection = [];
        sectionName = null;
        sectionKey++;
        lineNumber++;
      } else {
        // Add item to current section or to result
        const renderedItem = renderItemWithNotes(item, index, lineNumber);
        if (sectionName !== null) {
          currentSection.push(renderedItem);
        } else {
          result.push(renderedItem);
        }
        lineNumber++;
      }
    });

    // Handle any remaining items in a section
    if (currentSection.length > 0 && sectionName !== null) {
      result.push(
        <div key={`section-${sectionKey}`} className="section-container">
          <div className="section-header">{sectionName}</div>
          {currentSection}
        </div>
      );
    }

    return result;
  };

  const renderItemWithNotes = (item, index, lineNumber) => {
    const lineNotes = getNotesForLine(lineNumber);
    const hasAddButton = isEditMode && newNoteLineNumber !== lineNumber;

    return (
      <div key={index} className="line-with-notes">
        {renderItem(item, index)}
        {lineNotes.map(note => (
          <InlineNoteMarker
            key={note.id}
            note={note}
            isEditMode={isEditMode}
            onUpdate={onUpdateNote}
            onDelete={onDeleteNote}
          />
        ))}
        {isEditMode && newNoteLineNumber === lineNumber && (
          <div className="inline-note-edit">
            <input
              type="text"
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveNewNote();
                if (e.key === 'Escape') handleCancelNewNote();
              }}
              autoFocus
              placeholder="Enter note..."
            />
            <div className="inline-note-actions">
              <button onClick={handleSaveNewNote} className="btn-save-note">✓</button>
              <button onClick={handleCancelNewNote} className="btn-cancel-note">✗</button>
            </div>
          </div>
        )}
        {hasAddButton && (
          <button
            className="btn-add-note-inline"
            onClick={() => handleAddNoteClick(lineNumber)}
          >
            + Note
          </button>
        )}
      </div>
    );
  };

  const renderItem = (item, index) => {
    switch (item.type) {
      case 'empty':
        return <div key={index} className="empty-line"></div>;

      case 'chord-line':
        if (isLyricsOnly) {
          return (
            <div key={index} className="lyric-line">
              {item.lyrics}
            </div>
          );
        }

        // For RTL, use right-aligned positioning
        const isRTL = dir === 'rtl';

        return (
          <div key={index} className="chord-lyric-pair">
            <div className="chord-line">
              {item.chords.map((c, i) => {
                // Calculate position in em units (0.6em per character)
                const chordPos = c.position * 0.6;

                // For RTL, use right positioning; for LTR, use left positioning
                const position = isRTL
                  ? { right: `${chordPos}em` }
                  : { left: `${chordPos}em` };

                return (
                  <span
                    key={i}
                    className="chord"
                    style={{
                      position: 'absolute',
                      ...position,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {c.chord}
                  </span>
                );
              })}
            </div>
            <div className="lyric-line">
              {item.lyrics || '\u00A0'}
            </div>
          </div>
        );

      case 'lyrics':
        return (
          <div key={index} className="lyric-line">
            {item.content}
          </div>
        );

      default:
        return null;
    }
  };

  const parsed = parseChordPro(transposedContent);

  return (
    <div
      ref={contentRef}
      className="chordpro-display"
      dir={dir}
      style={{
        fontSize: `${fontSize}px`,
        columnCount: columnCount,
        columnGap: columnCount === 2 ? '40px' : '0',
        columnRule: columnCount === 2 ? '2px solid #dee2e6' : 'none'
      }}
    >
      {renderParsedContent(parsed)}
    </div>
  );
};

export default ChordProDisplay;
