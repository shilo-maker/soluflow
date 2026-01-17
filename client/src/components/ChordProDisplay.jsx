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
  disableColumnCalculation = false,
  forcedColumnCount = null, // null = auto, 1 = single column, 2 = two columns
  onAutoColumnCountChange = null // callback to report auto-calculated column count
}) => {
  const contentRef = useRef(null);
  const [autoColumnCount, setAutoColumnCount] = useState(1);

  // Use forced column count if provided, otherwise use auto-calculated
  const columnCount = forcedColumnCount !== null ? forcedColumnCount : autoColumnCount;
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

    let timeoutId = null;

    const checkHeight = () => {
      if (!contentRef.current) return;

      // Temporarily force single column to measure true content height
      const element = contentRef.current;
      const originalColumnCount = element.style.columnCount;
      element.style.columnCount = '1';

      // Force reflow to get accurate measurement
      const contentHeight = element.scrollHeight;
      const viewportHeight = window.innerHeight;

      // Restore original column count
      element.style.columnCount = originalColumnCount;

      // Use 2 columns (compact) if content would require scrolling (leave 150px buffer for headers/controls)
      // This applies to both mobile and desktop - if content is taller than viewport, go to 2 columns
      if (contentHeight > viewportHeight - 150) {
        setAutoColumnCount(2);
      } else {
        setAutoColumnCount(1);
      }
    };

    // Initial check after a short delay to ensure content is rendered
    timeoutId = setTimeout(checkHeight, 100);

    // Recalculate on window resize (e.g., device rotation)
    const handleResize = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(checkHeight, 100);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, [content, fontSize, transposition, disableColumnCalculation]);

  // Report auto column count changes to parent
  useEffect(() => {
    if (onAutoColumnCountChange) {
      onAutoColumnCountChange(autoColumnCount);
    }
  }, [autoColumnCount, onAutoColumnCountChange]);

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

  // Build inline chord-lyric segments so chords follow text when it wraps
  const buildChordLyricSegments = (chords, lyrics) => {
    const segments = [];
    let lastPosition = 0;

    // Sort chords by position to ensure correct order
    const sortedChords = [...chords].sort((a, b) => a.position - b.position);

    sortedChords.forEach((chord, i) => {
      // Add text before this chord (if any)
      if (chord.position > lastPosition) {
        const textBefore = lyrics.substring(lastPosition, chord.position);
        if (textBefore) {
          segments.push({ type: 'text', content: textBefore });
        }
      }

      // Add the chord with its following text
      // Find where the next chord starts (or end of string)
      const nextChordPos = sortedChords[i + 1]?.position ?? lyrics.length;
      const textAfterChord = lyrics.substring(chord.position, nextChordPos);

      segments.push({
        type: 'chord-text',
        chord: chord.chord,
        text: textAfterChord
      });

      lastPosition = nextChordPos;
    });

    // Add any remaining text after the last chord
    if (lastPosition < lyrics.length) {
      const remainingText = lyrics.substring(lastPosition);
      if (remainingText) {
        segments.push({ type: 'text', content: remainingText });
      }
    }

    // If no chords at all, just return the lyrics as a single text segment
    if (segments.length === 0 && lyrics) {
      segments.push({ type: 'text', content: lyrics });
    }

    return segments;
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

        // Build segments where each chord is attached to its text
        const segments = buildChordLyricSegments(item.chords, item.lyrics);

        // Check if there are MULTIPLE trailing chords with no lyrics (for line break)
        // Only break if there are 2+ trailing chords, not for a single trailing chord
        let trailingChordsStartIndex = -1;
        let trailingChordCount = 0;
        for (let i = segments.length - 1; i >= 0; i--) {
          const seg = segments[i];
          if (seg.type === 'chord-text') {
            const trimmed = (seg.text || '').trim();
            // Check if this is a chord with no real lyrics (empty, space, or just punctuation)
            if (trimmed === '' || /^[\s.,!?;:]+$/.test(trimmed)) {
              trailingChordsStartIndex = i;
              trailingChordCount++;
            } else {
              break; // Found a chord with real lyrics, stop
            }
          } else {
            break;
          }
        }
        // Only use line break if there are multiple trailing chords
        if (trailingChordCount < 2) {
          trailingChordsStartIndex = -1;
        }

        return (
          <div key={index} className="chord-lyric-line">
            {segments.map((segment, i) => {
              // Add line break before trailing chords without lyrics
              const needsLineBreak = trailingChordsStartIndex !== -1 && i === trailingChordsStartIndex;

              if (segment.type === 'text') {
                return (
                  <span key={i} className="text-segment">
                    {segment.content}
                  </span>
                );
              } else {
                // chord-text segment
                const nextSegment = segments[i + 1];
                let connector = '';
                let spacingClass = '';

                if (nextSegment && nextSegment.type === 'chord-text') {
                  const currentText = segment.text || '';
                  const textLength = currentText.length;
                  const trimmedLength = currentText.trim().length;
                  const endsWithSpace = /\s$/.test(currentText);
                  const nextText = nextSegment.text || '';
                  const nextStartsWithSpace = /^\s/.test(nextText);

                  // Determine spacing needed
                  // Latin bold chords are ~1.3x wider per character than Hebrew text
                  // So we compare chord pixel width (estimated) vs text pixel width
                  const chordLength = segment.chord.length;
                  const chordPixelEstimate = chordLength * 1.3; // bold Latin chars are wider
                  const extraSpaceNeeded = chordPixelEstimate - trimmedLength;

                  if (trimmedLength === 0 || /^[\s.,!?;:]+$/.test(currentText.trim())) {
                    // No real text - need wide spacing for chord
                    spacingClass = ' chord-segment-wide';
                  } else if (!endsWithSpace && !nextStartsWithSpace) {
                    // Word is split across chord segments - check if we need hyphens
                    // Scale pixel estimates based on font size (base estimates are for 16px)
                    const scaleFactor = fontSize / 16;
                    const chordWidth = chordLength * 10 * scaleFactor; // ~10px per chord char at 16px

                    // Count only base characters (exclude Hebrew vowels/nikkud which don't add width)
                    // Hebrew combining marks are in range U+0591 to U+05C7
                    const baseCharsOnly = currentText.trim().replace(/[\u0591-\u05C7]/g, '');
                    const visualCharCount = baseCharsOnly.length;
                    const textWidth = visualCharCount * 10 * scaleFactor; // ~10px per base char at 16px

                    // Only add hyphens if chord width is close to or exceeds text width
                    if (chordWidth >= textWidth - (8 * scaleFactor)) {
                      const gapNeeded = Math.max(0, chordWidth - textWidth) + (10 * scaleFactor); // min gap
                      const hyphenWidth = 6 * scaleFactor;
                      const hyphenCount = Math.max(2, Math.ceil(gapNeeded / hyphenWidth));
                      connector = '-'.repeat(Math.min(hyphenCount, 8));
                    }
                  }

                  // Add word joiner to prevent line break between segments of the same word
                  if (!endsWithSpace && !nextStartsWithSpace && trimmedLength > 0) {
                    connector += '\u2060'; // Word Joiner - prevents line break
                  }
                }

                return (
                  <React.Fragment key={i}>
                    {needsLineBreak && <span className="chord-line-break"></span>}
                    <span className={`chord-segment${spacingClass}`}>
                      <span className="chord">{segment.chord}</span>
                      <span className="text-segment">{segment.text || '\u200B'}{connector}</span>
                    </span>
                  </React.Fragment>
                );
              }
            })}
            {/* Add non-breaking space if line is empty to maintain height */}
            {segments.length === 0 && '\u00A0'}
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

  // Build class name with column indicators
  const className = [
    'chordpro-display',
    columnCount === 2 ? 'two-columns' : '',
    forcedColumnCount === 2 ? 'columns-forced-2' : '',
    forcedColumnCount === 1 ? 'columns-forced-1' : ''
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={contentRef}
      className={className}
      dir={dir}
      style={{
        fontSize: `${fontSize}px`,
        columnCount: columnCount
      }}
    >
      {renderParsedContent(parsed)}
    </div>
  );
});

ChordProDisplay.displayName = 'ChordProDisplay';

export default ChordProDisplay;
