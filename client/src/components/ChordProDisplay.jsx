import React, { useMemo, useRef, useState, useEffect } from 'react';
import './ChordProDisplay.css';
import { transpose } from '../utils/transpose';
import InlineNoteMarker from './InlineNoteMarker';
import { useLanguage } from '../contexts/LanguageContext';

// Section name translations (Hebrew <-> English)
const SECTION_TRANSLATIONS = {
  // Hebrew to English
  'בית': 'Verse',
  'בית א': 'Verse 1',
  "בית א'": 'Verse 1',
  'בית א׳': 'Verse 1',
  'בית ב': 'Verse 2',
  "בית ב'": 'Verse 2',
  'בית ב׳': 'Verse 2',
  'בית ג': 'Verse 3',
  "בית ג'": 'Verse 3',
  'בית ג׳': 'Verse 3',
  "בית ד'": 'Verse 4',
  'בית ד׳': 'Verse 4',
  'בית ה׳': 'Verse 5',
  'פזמון': 'Chorus',
  'פזמון א׳': 'Chorus 1',
  'פזמון ב': 'Chorus 2',
  'פזמון ב׳': 'Chorus 2',
  'גשר': 'Bridge',
  'פרי פזמון': 'Pre-Chorus',
  'פרי-פזמון': 'Pre-Chorus',
  'פריקורוס': 'Pre-Chorus',
  'פרי קורוס': 'Pre-Chorus',
  "פרי קורוס א'": 'Pre-Chorus 1',
  'פרי קורוס א׳': 'Pre-Chorus 1',
  "פרי קורס א'": 'Pre-Chorus 1',
  "פרי קורס ב'": 'Pre-Chorus 2',
  'פריקורוס ב׳': 'Pre-Chorus 2',
  'פרי פיזמון': 'Pre-Chorus',
  'פתיחה': 'Intro',
  'הקדמה': 'Intro',
  'מעבר': 'Transition',
  'טאג': 'Tag',
  'פוסט פזמון': 'Post-Chorus',
  'פוסטקורס': 'Post-Chorus',
  'מודולציה': 'Modulation',
  // English to Hebrew
  'Verse': 'בית',
  'Verse 1': 'בית א׳',
  'Verse 2': 'בית ב׳',
  'Verse 3': 'בית ג׳',
  'Verse 4': 'בית ד׳',
  'Verse 5': 'בית ה׳',
  'Chorus': 'פזמון',
  'Bridge': 'גשר',
  'Pre-Chorus': 'פרי פזמון',
  'Pre Chorus': 'פרי פזמון',
  'Intro': 'פתיחה',
  'Outro': 'סיום',
  'Tag': 'טאג',
  'Hook': 'פזמון',
  'Post-Chorus': 'פוסט פזמון',
  'Interlude': 'אינטרלוד',
  'Transition': 'מעבר',
  'Modulation': 'מודולציה'
};

const ChordProDisplay = React.memo(({
  content,
  isLyricsOnly = false,
  dir = 'ltr',
  fontSize = 14,
  transposition = 0,
  songKey = null,
  notes = [],
  isEditMode = false,
  onAddNote = null,
  onUpdateNote = null,
  onDeleteNote = null,
  disableColumnCalculation = false
}) => {
  const contentRef = useRef(null);
  const canvasRef = useRef(null);
  const [columnCount, setColumnCount] = useState(1);
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  // Helper function to translate section names based on current language
  const translateSectionName = (name) => {
    if (!name) return name;

    // Check if the name contains Hebrew characters
    const hasHebrew = /[\u0590-\u05FF]/.test(name);

    // If app is in Hebrew and name is in English, translate to Hebrew
    // If app is in English and name is in Hebrew, translate to English
    if ((isHebrew && !hasHebrew) || (!isHebrew && hasHebrew)) {
      return SECTION_TRANSLATIONS[name] || name;
    }

    return name;
  };

  // Transpose the content if needed, using key-based notation (sharps or flats)
  const transposedContent = useMemo(() => {
    // The transpose function now handles key-based notation internally
    return transpose(content, transposition, songKey);
  }, [content, transposition, songKey]);

  // Calculate if we need 2 columns based on content height
  useEffect(() => {
    if (!contentRef.current || disableColumnCalculation) return;

    let rafId = null;

    // Wait for render to complete
    const checkHeight = () => {
      // Cancel any pending RAF to avoid stacking up requests
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        if (!contentRef.current) return;

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

        rafId = null;
      });
    };

    // Initial check
    checkHeight();

    // Recalculate on window resize (e.g., device rotation)
    window.addEventListener('resize', checkHeight);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener('resize', checkHeight);
    };
  }, [content, fontSize, transposition]);

  // Cleanup canvas on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (canvasRef.current) {
        canvasRef.current = null;
      }
    };
  }, []);

  const parseChordPro = (text) => {
    const lines = text.split('\n');
    const parsed = [];

    lines.forEach((line, index) => {
      // Handle {c:...} or {comment:...} tags as section labels
      const commentMatch = line.match(/^{c(?:omment)?[:\s]+([^}]+)}/i);
      if (commentMatch) {
        const label = commentMatch[1].trim();
        parsed.push({ type: 'section-label', content: label });
        return;
      }

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

  // Normalize chord notation (uppercase M to lowercase m for minor chords)
  const normalizeChord = (chord) => {
    // Replace uppercase M with lowercase m for minor chords
    // Use negative lookahead to avoid converting "Maj" (major) chords
    // Pattern: Match chord root followed by M that's NOT followed by 'a' (as in Maj)
    return chord.replace(/([A-G][#b]?)M(?!aj)/g, '$1m');
  };

  const parseChordLine = (line) => {
    const chords = [];

    // Find all chord positions
    const chordPattern = /\[([^\]]+)\]/g;
    let match;
    const chordMatches = [];

    while ((match = chordPattern.exec(line)) !== null) {
      chordMatches.push({
        chord: normalizeChord(match[1]),
        position: match.index,
        length: match[0].length
      });
    }

    // Build the chord and lyric lines
    let lyricLine = line;
    chordMatches.forEach(cm => {
      // Use original chord from match for replacement
      const originalChordPattern = /\[([^\]]+)\]/;
      const originalMatch = line.substring(cm.position).match(originalChordPattern);
      if (originalMatch) {
        lyricLine = lyricLine.replace(`[${originalMatch[1]}]`, '');
      }
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
            <div className="section-header">{translateSectionName(sectionName)}</div>
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
          <div className="section-header">{translateSectionName(sectionName)}</div>
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

  // Helper function to measure text width (reuses canvas for performance)
  const measureTextWidth = (text, fontSize, fontFamily) => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const context = canvasRef.current.getContext('2d');
    context.font = `${fontSize}px ${fontFamily}`;
    return context.measureText(text).width;
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
        const fontFamily = "'Heebo', 'Rubik', 'Assistant', 'Arial Hebrew', Arial, sans-serif";

        // Calculate positions for all chords, preventing overlaps
        const chordPositions = [];
        const minSpacing = 5; // Minimum pixels between chords

        // Calculate the total lyrics width for positioning reference
        const lyricsWidth = measureTextWidth(item.lyrics, fontSize, fontFamily);

        // For RTL, we need to position chords differently
        // Instead of using right: Xpx (which positions from right edge),
        // we'll calculate positions that work within the container
        const maxSafePosition = Math.max(lyricsWidth + 50, 300);

        item.chords.forEach((c, i) => {
          // Measure actual text width up to this chord position
          const textBeforeChord = item.lyrics.substring(0, c.position);
          const textWidth = measureTextWidth(textBeforeChord, fontSize, fontFamily);

          // Measure the width of this chord
          const chordWidth = measureTextWidth(c.chord, fontSize, fontFamily);

          let position = textWidth;

          // Check for overlap with previous chord
          if (i > 0) {
            const prevChord = chordPositions[i - 1];
            const prevEnd = prevChord.position + prevChord.width + minSpacing;

            // If this chord would overlap, push it to the right (or left for RTL)
            if (position < prevEnd) {
              position = prevEnd;
            }
          }

          // Clamp position to prevent extreme overflow
          // Leave room for the chord itself plus some padding
          const maxPosition = maxSafePosition - chordWidth - 10;
          if (position > maxPosition && maxPosition > 0) {
            position = maxPosition;
          }

          chordPositions.push({
            chord: c.chord,
            position: position,
            width: chordWidth
          });
        });

        return (
          <div key={index} className="chord-lyric-pair">
            <div className="chord-line">
              {chordPositions.map((c, i) => {
                // For RTL, use right positioning; for LTR, use left positioning
                const position = isRTL
                  ? { right: `${c.position}px` }
                  : { left: `${c.position}px` };

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

      case 'section-label':
        return (
          <div key={index} className="section-label">
            {translateSectionName(item.content)}
          </div>
        );

      default:
        return null;
    }
  };

  // Memoize the parsed content to avoid re-parsing on every render
  const parsed = useMemo(() => parseChordPro(transposedContent), [transposedContent]);

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
});

ChordProDisplay.displayName = 'ChordProDisplay';

export default ChordProDisplay;
