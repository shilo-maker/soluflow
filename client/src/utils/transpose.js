/**
 * Chord Transposition Utility
 * Supports English notation (C, D, E, F, G, A, B) with sharps/flats
 */

// Chromatic scale - all 12 semitones
const CHROMATIC_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Alternative notations (flats)
const FLAT_NOTES = {
  'Db': 'C#',
  'Eb': 'D#',
  'Gb': 'F#',
  'Ab': 'G#',
  'Bb': 'A#'
};

// Reverse mapping for preferred flat notation
const SHARP_TO_FLAT = {
  'C#': 'Db',
  'D#': 'Eb',
  'F#': 'Gb',
  'G#': 'Ab',
  'A#': 'Bb'
};

// Keys that should always display as flats (uncommon sharp keys)
const KEYS_PREFER_FLAT = ['A#', 'C#', 'D#', 'G#'];

/**
 * Normalizes a note to its sharp equivalent
 * @param {string} note - The note to normalize (e.g., 'Db' -> 'C#')
 * @returns {string} - Normalized note
 */
const normalizeNote = (note) => {
  return FLAT_NOTES[note] || note;
};

/**
 * Determines if we should prefer flat notation based on the original chord
 * @param {string} originalChord - The original chord
 * @returns {boolean} - True if flats are preferred
 */
const preferFlats = (originalChord) => {
  return originalChord.includes('b') && !originalChord.includes('#');
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
 * @param {boolean} useFlats - Whether to use flat notation
 * @returns {string} - Transposed note
 */
const transposeNote = (note, semitones, useFlats = false) => {
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

  const transposedNote = CHROMATIC_SCALE[newIndex];

  // Convert to flat if preferred
  if (useFlats && SHARP_TO_FLAT[transposedNote]) {
    return SHARP_TO_FLAT[transposedNote];
  }

  return transposedNote;
};

/**
 * Transposes a chord by a given number of semitones
 * Supports slash chords (e.g., C/G, Am7/E)
 * @param {string} chord - The chord to transpose (e.g., 'Am7', 'C#maj7', 'C/G')
 * @param {number} semitones - Number of semitones to transpose (can be negative)
 * @returns {string} - Transposed chord
 */
export const transposeChord = (chord, semitones) => {
  if (!chord || semitones === 0) {
    return chord;
  }

  const { root, suffix, bass } = parseChord(chord);
  const useFlats = preferFlats(chord);
  const transposedRoot = transposeNote(root, semitones, useFlats);

  // If there's a bass note (slash chord), transpose it too
  if (bass) {
    const transposedBass = transposeNote(bass, semitones, useFlats);
    return `${transposedRoot}${suffix}/${transposedBass}`;
  }

  return transposedRoot + suffix;
};

/**
 * Transposes all chords in a ChordPro formatted text
 * @param {string} chordProText - The ChordPro formatted text
 * @param {number} semitones - Number of semitones to transpose
 * @returns {string} - Transposed ChordPro text
 */
export const transposeChordPro = (chordProText, semitones) => {
  if (!chordProText || semitones === 0) {
    return chordProText;
  }

  // Replace all chords in [brackets]
  return chordProText.replace(/\[([^\]]+)\]/g, (match, chord) => {
    const transposed = transposeChord(chord, semitones);
    return `[${transposed}]`;
  });
};

/**
 * Updates the key metadata in ChordPro text
 * @param {string} chordProText - The ChordPro formatted text
 * @param {number} semitones - Number of semitones to transpose
 * @returns {string} - ChordPro text with updated key
 */
export const transposeKey = (chordProText, semitones) => {
  if (!chordProText || semitones === 0) {
    return chordProText;
  }

  return chordProText.replace(/\{key:\s*([^}]+)\}/g, (match, key) => {
    const transposedKey = transposeChord(key.trim(), semitones);
    return `{key: ${transposedKey}}`;
  });
};

/**
 * Main transpose function - transposes both chords and key in ChordPro text
 * @param {string} chordProText - The ChordPro formatted text
 * @param {number} semitones - Number of semitones to transpose (-11 to +11)
 * @returns {string} - Fully transposed ChordPro text
 */
export const transpose = (chordProText, semitones) => {
  if (!chordProText || semitones === 0) {
    return chordProText;
  }

  // Clamp semitones to reasonable range
  const clampedSemitones = Math.max(-11, Math.min(11, semitones));

  let result = chordProText;
  result = transposeChordPro(result, clampedSemitones);
  result = transposeKey(result, clampedSemitones);

  return result;
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
 * Checks if a key should use flat notation
 * @param {string} key - The key to check (e.g., 'A#', 'Bb')
 * @returns {boolean} - True if flat notation should be used
 */
export const shouldUseFlats = (key) => {
  if (!key) return false;
  const normalizedKey = normalizeNote(key);
  return KEYS_PREFER_FLAT.includes(normalizedKey);
};

/**
 * Converts a key to its flat equivalent if it's a sharp key that should display as flat
 * @param {string} key - The key to convert (e.g., 'A#' -> 'Bb', 'A#m' -> 'Bbm')
 * @returns {string} - The converted key
 */
export const convertKeyToFlat = (key) => {
  if (!key) return key;

  // Parse the key to get root and suffix (e.g., 'A#m' -> 'A#' + 'm')
  const match = key.match(/^([A-G][#b]?)(.*)/);
  if (!match) return key;

  const [, root, suffix] = match;
  const normalizedRoot = normalizeNote(root);

  // Only convert if this root should prefer flats
  if (KEYS_PREFER_FLAT.includes(normalizedRoot) && SHARP_TO_FLAT[normalizedRoot]) {
    return SHARP_TO_FLAT[normalizedRoot] + suffix;
  }

  return key;
};

/**
 * Converts a single chord to flat notation if needed
 * @param {string} chord - The chord to convert (e.g., 'A#m7' -> 'Bbm7', 'D#/G#' -> 'Eb/Ab')
 * @param {boolean} useFlats - Whether to use flat notation
 * @returns {string} - The converted chord
 */
export const convertChordToFlat = (chord, useFlats = false) => {
  if (!chord || !useFlats) return chord;

  // Handle slash chords
  const slashIndex = chord.indexOf('/');
  if (slashIndex !== -1) {
    const mainChord = chord.substring(0, slashIndex);
    const bassNote = chord.substring(slashIndex + 1);
    return convertChordToFlat(mainChord, true) + '/' + convertSingleNoteToFlat(bassNote);
  }

  // Parse the chord root and suffix
  const match = chord.match(/^([A-G][#b]?)(.*)/);
  if (!match) return chord;

  const [, root, suffix] = match;
  const flatRoot = convertSingleNoteToFlat(root);

  return flatRoot + suffix;
};

/**
 * Converts a single note to flat if it's a sharp
 * @param {string} note - The note to convert
 * @returns {string} - The converted note
 */
const convertSingleNoteToFlat = (note) => {
  if (!note) return note;
  const normalizedNote = normalizeNote(note);
  return SHARP_TO_FLAT[normalizedNote] || note;
};

/**
 * Converts all chords in ChordPro text to flat notation based on the key
 * @param {string} chordProText - The ChordPro formatted text
 * @param {string} key - The song's key
 * @returns {string} - ChordPro text with chords in flat notation if needed
 */
export const convertToFlatNotation = (chordProText, key) => {
  if (!chordProText || !shouldUseFlats(key)) {
    return chordProText;
  }

  // Replace all chords in [brackets] with flat equivalents
  return chordProText.replace(/\[([^\]]+)\]/g, (match, chord) => {
    const flatChord = convertChordToFlat(chord, true);
    return `[${flatChord}]`;
  });
};
