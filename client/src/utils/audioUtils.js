// Audio utility for playing musical notes

// Frequency mapping for musical notes (A4 = 440 Hz)
const noteFrequencies = {
  'C': 261.63,
  'C#': 277.18,
  'Db': 277.18,
  'D': 293.66,
  'D#': 311.13,
  'Eb': 311.13,
  'E': 329.63,
  'F': 349.23,
  'F#': 369.99,
  'Gb': 369.99,
  'G': 392.00,
  'G#': 415.30,
  'Ab': 415.30,
  'A': 440.00,
  'A#': 466.16,
  'Bb': 466.16,
  'B': 493.88
};

let audioContext = null;

// Initialize audio context (lazy initialization)
const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
};

/**
 * Play a musical note for a specified duration
 * @param {string} note - The note to play (e.g., 'C', 'C#', 'D')
 * @param {number} duration - Duration in seconds (default: 0.5)
 * @param {number} volume - Volume level 0-1 (default: 0.3)
 */
export const playNote = (note, duration = 0.5, volume = 0.3) => {
  const context = getAudioContext();

  // Get frequency for the note
  const frequency = noteFrequencies[note];
  if (!frequency) {
    console.warn(`Unknown note: ${note}`);
    return;
  }

  // Create oscillator for the main tone
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  // Use a sine wave for a clean, musical tone
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, context.currentTime);

  // Set up gain (volume) with attack and decay for smoother sound
  gainNode.gain.setValueAtTime(0, context.currentTime);
  gainNode.gain.linearRampToValueAtTime(volume, context.currentTime + 0.01); // Attack
  gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + duration); // Decay

  // Connect nodes
  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  // Play the note
  oscillator.start(context.currentTime);
  oscillator.stop(context.currentTime + duration);
};

/**
 * Play a chord (root note + major third + perfect fifth)
 * @param {string} rootNote - The root note of the chord
 * @param {number} duration - Duration in seconds (default: 0.8)
 * @param {number} volume - Volume level 0-1 (default: 0.2)
 */
export const playChord = (rootNote, duration = 0.8, volume = 0.2) => {
  const context = getAudioContext();

  const rootFreq = noteFrequencies[rootNote];
  if (!rootFreq) {
    console.warn(`Unknown note: ${rootNote}`);
    return;
  }

  // Major chord intervals: root, major third (+4 semitones), perfect fifth (+7 semitones)
  const majorThirdRatio = Math.pow(2, 4/12);
  const perfectFifthRatio = Math.pow(2, 7/12);

  const frequencies = [
    rootFreq,                        // Root
    rootFreq * majorThirdRatio,      // Major third
    rootFreq * perfectFifthRatio     // Perfect fifth
  ];

  frequencies.forEach((freq, index) => {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(freq, context.currentTime);

    // Slightly reduce volume for chord notes to avoid clipping
    const noteVolume = volume * (index === 0 ? 1 : 0.7);
    gainNode.gain.setValueAtTime(0, context.currentTime);
    gainNode.gain.linearRampToValueAtTime(noteVolume, context.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + duration);
  });
};

/**
 * Play a major scale (8 notes ascending from root to octave)
 * @param {string} rootNote - The root note of the scale
 * @param {number} noteDuration - Duration of each note in seconds (default: 0.3)
 * @param {number} volume - Volume level 0-1 (default: 0.3)
 */
export const playScale = (rootNote, noteDuration = 0.3, volume = 0.3) => {
  const context = getAudioContext();

  const rootFreq = noteFrequencies[rootNote];
  if (!rootFreq) {
    console.warn(`Unknown note: ${rootNote}`);
    return;
  }

  // Major scale intervals in semitones: W-W-H-W-W-W-H
  // 0, 2, 4, 5, 7, 9, 11, 12 (octave)
  const scaleIntervals = [0, 2, 4, 5, 7, 9, 11, 12];

  scaleIntervals.forEach((semitones, index) => {
    const ratio = Math.pow(2, semitones / 12);
    const frequency = rootFreq * ratio;

    // Calculate start time for this note (with slight overlap for smooth sound)
    const startTime = context.currentTime + (index * noteDuration * 0.85);
    const endTime = startTime + noteDuration;

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, startTime);

    // Envelope for smooth attack and decay
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start(startTime);
    oscillator.stop(endTime);
  });

  // Return the total duration of the scale
  return scaleIntervals.length * noteDuration * 0.85;
};

/**
 * Play a single chord at a specific time
 * @param {number} rootFreq - Root frequency
 * @param {Array<number>} intervals - Array of semitone intervals for the chord
 * @param {number} startTime - When to start the chord
 * @param {number} duration - Duration of the chord
 * @param {number} volume - Volume level
 */
const playChordAtTime = (context, rootFreq, intervals, startTime, duration, volume) => {
  intervals.forEach((semitones, index) => {
    const ratio = Math.pow(2, semitones / 12);
    const frequency = rootFreq * ratio;

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, startTime);

    // Slightly reduce volume for chord notes to avoid clipping
    const noteVolume = volume * (index === 0 ? 1 : 0.7);
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(noteVolume, startTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  });
};

/**
 * Chord progressions for each key (I-V-vi-IV)
 */
const getChordProgression = (rootNote) => {
  const progressions = {
    'C': ['C', 'G', 'Am', 'F'],
    'C#': ['C#', 'G#', 'A#m', 'F#'],
    'Db': ['Db', 'Ab', 'Bbm', 'Gb'],
    'D': ['D', 'A', 'Bm', 'G'],
    'D#': ['D#', 'A#', 'Cm', 'G#'],
    'Eb': ['Eb', 'Bb', 'Cm', 'Ab'],
    'E': ['E', 'B', 'C#m', 'A'],
    'F': ['F', 'C', 'Dm', 'Bb'],
    'F#': ['F#', 'C#', 'D#m', 'B'],
    'Gb': ['Gb', 'Db', 'Ebm', 'B'],
    'G': ['G', 'D', 'Em', 'C'],
    'G#': ['G#', 'D#', 'Fm', 'C#'],
    'Ab': ['Ab', 'Eb', 'Fm', 'Db'],
    'A': ['A', 'E', 'F#m', 'D'],
    'A#': ['A#', 'F', 'Gm', 'D#'],
    'Bb': ['Bb', 'F', 'Gm', 'Eb'],
    'B': ['B', 'F#', 'G#m', 'E']
  };

  return progressions[rootNote] || progressions['C'];
};

/**
 * Play a chord progression for a given key (I-V-vi-IV)
 * @param {string} rootNote - The root note of the key
 * @param {number} chordDuration - Duration of each chord in seconds (default: 0.8)
 * @param {number} volume - Volume level 0-1 (default: 0.25)
 */
export const playChordProgression = (rootNote, chordDuration = 0.8, volume = 0.25) => {
  const context = getAudioContext();

  const progression = getChordProgression(rootNote);

  progression.forEach((chordName, index) => {
    // Parse chord name to get root and type (major/minor)
    const isMinor = chordName.includes('m');
    const chordRoot = isMinor ? chordName.replace('m', '') : chordName;

    const rootFreq = noteFrequencies[chordRoot];
    if (!rootFreq) {
      console.warn(`Unknown chord: ${chordName}`);
      return;
    }

    // Major chord: root, major third (+4), perfect fifth (+7)
    // Minor chord: root, minor third (+3), perfect fifth (+7)
    const intervals = isMinor ? [0, 3, 7] : [0, 4, 7];

    const startTime = context.currentTime + (index * chordDuration);
    playChordAtTime(context, rootFreq, intervals, startTime, chordDuration, volume);
  });

  // Return the total duration of the progression
  return progression.length * chordDuration;
};
