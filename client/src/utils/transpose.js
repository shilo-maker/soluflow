/**
 * Chord Transposition Utility
 * Supports English notation (C, D, E, F, G, A, B) with sharps/flats
 * Uses music theory standard: each key has specific sharp/flat notation
 */

// Chromatic scale - all 12 semitones (using sharps as canonical)
const CHROMATIC_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Alternative notations (flats to sharps)
const FLAT_NOTES = {
  'Db': 'C#',
  'Eb': 'D#',
  'Gb': 'F#',
  'Ab': 'G#',
  'Bb': 'A#'
};

/**
 * Key-based accidental notation mapping
 * Based on standard music theory - each key determines how accidentals are written
 *
 * | Key     | Accidentals used                    |
 * |---------|-------------------------------------|
 * | C       | None (all natural)                  |
 * | G       | F#                                  |
 * | D       | F#, C#                              |
 * | A       | F#, C#, G#                          |
 * | E       | F#, C#, G#, D#                      |
 * | B       | F#, C#, G#, D#, A#                  |
 * | F#/Gb   | All sharps (F#, C#, G#, D#, A#, E#) |
 * | C#/Db   | All sharps                          |
 * | F       | Bb                                  |
 * | Bb      | Bb, Eb                              |
 * | Eb      | Bb, Eb, Ab                          |
 * | Ab      | Bb, Eb, Ab, Db                      |
 */

// Keys that use FLAT notation (based on circle of fifths)
// Index: 0=C, 1=C#, 2=D, 3=Eb, 4=E, 5=F, 6=F#, 7=G, 8=Ab, 9=A, 10=Bb, 11=B
const FLAT_KEYS = new Set([3, 5, 8, 10]); // Eb, F, Ab, Bb

// Chromatic scale using flats
const CHROMATIC_SCALE_FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Gets the correct chromatic scale based on the key
 * @param {number} keyIndex - The key index (0-11)
 * @returns {Array} - The appropriate chromatic scale (sharps or flats)
 */
const getScaleForKey = (keyIndex) => {
  return FLAT_KEYS.has(keyIndex) ? CHROMATIC_SCALE_FLATS : CHROMATIC_SCALE;
};

/**
 * Normalizes a note to its sharp equivalent
 * @param {string} note - The note to normalize (e.g., 'Db' -> 'C#')
 * @returns {string} - Normalized note
 */
const normalizeNote = (note) => {
  return FLAT_NOTES[note] || note;
};

/**
 * Parses a chord into root note, suffix, and optional bass note (for slash chords)
 * @param {string} chord - The chord to parse (e.g., 'Am7', 'C#maj7', 'C/G', 'D/F#')
 * @returns {object} - {root: string, suffix: string, bass: string|null}
 */
const parseChord = (chord) => {
  // Check for slash chord (e.g., C/G, Am7/E)
  const slashIndex = chord.indexOf('/');

  if (slashIndex !== -1) {
    // Split into main chord and bass note
    const mainChord = chord.substring(0, slashIndex);
    const bassNote = chord.substring(slashIndex + 1);

    // Parse the main chord part
    const match = mainChord.match(/^([A-G][#b]?)(.*)/);

    if (!match) {
      return { root: chord, suffix: '', bass: null };
    }

    return {
      root: match[1],
      suffix: match[2],
      bass: bassNote
    };
  }

  // No slash - standard chord
  const match = chord.match(/^([A-G][#b]?)(.*)/);

  if (!match) {
    // If we can't parse it, return as-is
    return { root: chord, suffix: '', bass: null };
  }

  return {
    root: match[1],
    suffix: match[2],
    bass: null
  };
};

/**
 * Transposes a single note by a given number of semitones
 * @param {string} note - The note to transpose (e.g., 'C', 'F#', 'Bb')
 * @param {number} semitones - Number of semitones to transpose (positive or negative)
 * @param {number|null} targetKeyIndex - The target key index for notation (0-11), null to use legacy behavior
 * @returns {string} - Transposed note
 */
const transposeNote = (note, semitones, targetKeyIndex = null) => {
  const normalizedNote = normalizeNote(note);
  const currentIndex = CHROMATIC_SCALE.indexOf(normalizedNote);

  if (currentIndex === -1) {
    // Unknown note, return as-is
    return note;
  }

  // Calculate new index (mod 12 to wrap around)
  let newIndex = (currentIndex + semitones) % 12;
  if (newIndex < 0) {
    newIndex += 12;
  }

  // If we have a target key, use its scale for notation
  if (targetKeyIndex !== null) {
    const scale = getScaleForKey(targetKeyIndex);
    return scale[newIndex];
  }

  // Legacy behavior: return sharp notation
  return CHROMATIC_SCALE[newIndex];
};

/**
 * Transposes a chord by a given number of semitones
 * Supports slash chords (e.g., C/G, Am7/E)
 * @param {string} chord - The chord to transpose (e.g., 'Am7', 'C#maj7', 'C/G')
 * @param {number} semitones - Number of semitones to transpose (can be negative)
 * @param {number|null} targetKeyIndex - The target key index for notation (0-11)
 * @returns {string} - Transposed chord
 */
export const transposeChord = (chord, semitones, targetKeyIndex = null) => {
  if (!chord) {
    return chord;
  }

  // If no transposition and no key context, return as-is
  if (semitones === 0 && targetKeyIndex === null) {
    return chord;
  }

  const { root, suffix, bass } = parseChord(chord);
  const transposedRoot = transposeNote(root, semitones, targetKeyIndex);

  // If there's a bass note (slash chord), transpose it too
  if (bass) {
    const transposedBass = transposeNote(bass, semitones, targetKeyIndex);
    return `${transposedRoot}${suffix}/${transposedBass}`;
  }

  return transposedRoot + suffix;
};

/**
 * Gets the chromatic index of a key (0-11)
 * @param {string} key - The key name (e.g., 'C', 'F#', 'Bb')
 * @returns {number} - The index (0-11) or -1 if not found
 */
export const getKeyIndex = (key) => {
  if (!key) return -1;
  const normalizedKey = normalizeNote(key.replace(/m.*$/, '')); // Remove minor suffix
  return CHROMATIC_SCALE.indexOf(normalizedKey);
};

/**
 * Transposes all chords in a ChordPro formatted text
 * @param {string} chordProText - The ChordPro formatted text
 * @param {number} semitones - Number of semitones to transpose
 * @param {number|null} targetKeyIndex - The target key index for notation
 * @returns {string} - Transposed ChordPro text
 */
export const transposeChordPro = (chordProText, semitones, targetKeyIndex = null) => {
  if (!chordProText) {
    return chordProText;
  }

  // If no transposition and no key context, return as-is
  if (semitones === 0 && targetKeyIndex === null) {
    return chordProText;
  }

  // Replace all chords in [brackets]
  return chordProText.replace(/\[([^\]]+)\]/g, (match, chord) => {
    const transposed = transposeChord(chord, semitones, targetKeyIndex);
    return `[${transposed}]`;
  });
};

/**
 * Updates the key metadata in ChordPro text
 * @param {string} chordProText - The ChordPro formatted text
 * @param {number} semitones - Number of semitones to transpose
 * @param {number|null} targetKeyIndex - The target key index for notation
 * @returns {string} - ChordPro text with updated key
 */
export const transposeKey = (chordProText, semitones, targetKeyIndex = null) => {
  if (!chordProText || semitones === 0) {
    return chordProText;
  }

  return chordProText.replace(/\{key:\s*([^}]+)\}/g, (match, key) => {
    const transposedKey = transposeChord(key.trim(), semitones, targetKeyIndex);
    return `{key: ${transposedKey}}`;
  });
};

/**
 * Main transpose function - transposes both chords and key in ChordPro text
 * Uses key-based notation (sharps or flats) according to music theory
 * @param {string} chordProText - The ChordPro formatted text
 * @param {number} semitones - Number of semitones to transpose (-11 to +11)
 * @param {string|null} songKey - The original song key (e.g., 'G', 'Bb') for determining notation
 * @returns {string} - Fully transposed ChordPro text
 */
export const transpose = (chordProText, semitones, songKey = null) => {
  if (!chordProText) {
    return chordProText;
  }

  // Clamp semitones to reasonable range
  const clampedSemitones = Math.max(-11, Math.min(11, semitones));

  // Calculate target key index for proper notation
  let targetKeyIndex = null;
  if (songKey) {
    const originalKeyIndex = getKeyIndex(songKey);
    if (originalKeyIndex !== -1) {
      targetKeyIndex = (originalKeyIndex + clampedSemitones + 12) % 12;
    }
  }

  // If no transposition and no key context, return as-is
  if (clampedSemitones === 0 && targetKeyIndex === null) {
    return chordProText;
  }

  let result = chordProText;
  result = transposeChordPro(result, clampedSemitones, targetKeyIndex);
  result = transposeKey(result, clampedSemitones, targetKeyIndex);

  return result;
};

/**
 * Applies key-based notation to ChordPro text without transposition
 * Converts all accidentals to match the key's standard notation (sharps or flats)
 * @param {string} chordProText - The ChordPro formatted text
 * @param {string} songKey - The song key (e.g., 'G', 'Bb', 'F#')
 * @returns {string} - ChordPro text with standardized notation
 */
export const applyKeyNotation = (chordProText, songKey) => {
  if (!chordProText || !songKey) {
    return chordProText;
  }

  const keyIndex = getKeyIndex(songKey);
  if (keyIndex === -1) {
    return chordProText;
  }

  // Use transposeChordPro with 0 semitones but with key context
  return transposeChordPro(chordProText, 0, keyIndex);
};

/**
 * Gets the display text for transposition amount
 * @param {number} semitones - Number of semitones
 * @returns {string} - Display text (e.g., '+2', '-3', 'Original')
 */
export const getTransposeDisplay = (semitones) => {
  if (semitones === 0) return 'Original';
  if (semitones > 0) return `+${semitones}`;
  return `${semitones}`;
};

/**
 * Strips ChordPro chord markup from text, leaving only lyrics
 * @param {string} chordProText - The ChordPro formatted text
 * @returns {string} - Plain text without chord markup
 */
export const stripChords = (chordProText) => {
  if (!chordProText) return '';

  // Remove all chord brackets [chord]
  return chordProText.replace(/\[([^\]]+)\]/g, '');
};

/**
 * Calculates the number of semitones needed to transpose from one key to another
 * @param {string} fromKey - The original key (e.g., 'C', 'D#', 'Bb')
 * @param {string} toKey - The target key
 * @returns {number} - Number of semitones to transpose (-11 to +11)
 */
export const calculateTransposition = (fromKey, toKey) => {
  const normalizedFrom = normalizeNote(fromKey);
  const normalizedTo = normalizeNote(toKey);

  const fromIndex = CHROMATIC_SCALE.indexOf(normalizedFrom);
  const toIndex = CHROMATIC_SCALE.indexOf(normalizedTo);

  if (fromIndex === -1 || toIndex === -1) {
    return 0;
  }

  let semitones = toIndex - fromIndex;

  // Normalize to range -6 to +6 (prefer smaller transpositions)
  if (semitones > 6) {
    semitones -= 12;
  } else if (semitones < -6) {
    semitones += 12;
  }

  return semitones;
};

/**
 * Gets all available keys with their display names
 * @returns {Array<{value: string, label: string}>} - Array of key options
 */
export const getAllKeys = () => {
  return [
    { value: 'C', label: 'C' },
    { value: 'C#', label: 'C# / Db' },
    { value: 'D', label: 'D' },
    { value: 'D#', label: 'D# / Eb' },
    { value: 'E', label: 'E' },
    { value: 'F', label: 'F' },
    { value: 'F#', label: 'F# / Gb' },
    { value: 'G', label: 'G' },
    { value: 'G#', label: 'G# / Ab' },
    { value: 'A', label: 'A' },
    { value: 'A#', label: 'A# / Bb' },
    { value: 'B', label: 'B' }
  ];
};

/**
 * Checks if a key index should use flat notation
 * Based on standard music theory key signatures
 * @param {number} keyIndex - The key index (0-11)
 * @returns {boolean} - True if flat notation should be used
 */
export const shouldUseFlats = (key) => {
  if (!key) return false;
  const keyIndex = getKeyIndex(key);
  return FLAT_KEYS.has(keyIndex);
};

// Preferred display name for each key index
// Based on user's table: C#/Db→C#, Eb (not D#), F#/Gb→F#, Ab (not G#), Bb (not A#)
const KEY_DISPLAY_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Converts a key to its standard display name
 * Uses music theory conventions: Eb (not D#), Ab (not G#), Bb (not A#)
 * @param {string} key - The key to convert (e.g., 'A#' -> 'Bb', 'D#m' -> 'Ebm')
 * @returns {string} - The converted key with standard display name
 */
export const convertKeyToFlat = (key) => {
  if (!key) return key;

  // Parse the key to get root and suffix (e.g., 'A#m' -> 'A#' + 'm')
  const match = key.match(/^([A-G][#b]?)(.*)/);
  if (!match) return key;

  const [, root, suffix] = match;
  const keyIndex = getKeyIndex(root);

  if (keyIndex === -1) return key;

  // Return the preferred display name with the suffix
  return KEY_DISPLAY_NAMES[keyIndex] + suffix;
};

