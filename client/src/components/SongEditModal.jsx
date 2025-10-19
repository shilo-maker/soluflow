import React, { useState, useEffect, useRef } from 'react';
import './SongEditModal.css';

// Chord mappings for each key (diatonic chords)
const KEY_CHORDS = {
  'C': ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim'],
  'C#': ['C#', 'D#m', 'E#m', 'F#', 'G#', 'A#m', 'B#dim'],
  'Db': ['Db', 'Ebm', 'Fm', 'Gb', 'Ab', 'Bbm', 'Cdim'],
  'D': ['D', 'Em', 'F#m', 'G', 'A', 'Bm', 'C#dim'],
  'D#': ['D#', 'E#m', 'F##m', 'G#', 'A#', 'B#m', 'C##dim'],
  'Eb': ['Eb', 'Fm', 'Gm', 'Ab', 'Bb', 'Cm', 'Ddim'],
  'E': ['E', 'F#m', 'G#m', 'A', 'B', 'C#m', 'D#dim'],
  'F': ['F', 'Gm', 'Am', 'Bb', 'C', 'Dm', 'Edim'],
  'F#': ['F#', 'G#m', 'A#m', 'B', 'C#', 'D#m', 'E#dim'],
  'Gb': ['Gb', 'Abm', 'Bbm', 'Cb', 'Db', 'Ebm', 'Fdim'],
  'G': ['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#dim'],
  'G#': ['G#', 'A#m', 'B#m', 'C#', 'D#', 'E#m', 'F##dim'],
  'Ab': ['Ab', 'Bbm', 'Cm', 'Db', 'Eb', 'Fm', 'Gdim'],
  'A': ['A', 'Bm', 'C#m', 'D', 'E', 'F#m', 'G#dim'],
  'A#': ['A#', 'B#m', 'C##m', 'D#', 'E#', 'F##m', 'G##dim'],
  'Bb': ['Bb', 'Cm', 'Dm', 'Eb', 'F', 'Gm', 'Adim'],
  'B': ['B', 'C#m', 'D#m', 'E', 'F#', 'G#m', 'A#dim']
};

const COMMON_KEYS = [
  'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F',
  'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
  'Cm', 'C#m', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m',
  'Gm', 'G#m', 'Am', 'A#m', 'Bbm', 'Bm'
];

const SongEditModal = ({ song, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    title: '',
    authors: '',
    key: '',
    bpm: '',
    timeSig: '4/4',
    content: ''
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [chordInput, setChordInput] = useState('');
  const [showChordHelper, setShowChordHelper] = useState(false);
  const contentTextareaRef = useRef(null);

  // Determine if this is create or edit mode
  const isEditMode = !!song;

  // Get suggested chords based on selected key
  const getSuggestedChords = () => {
    const key = formData.key;
    // Handle minor keys by using their relative major
    if (key && key.endsWith('m')) {
      const rootKey = key.slice(0, -1);
      // Use relative major or return empty if not found
      return KEY_CHORDS[rootKey] || [];
    }
    return KEY_CHORDS[key] || [];
  };

  // Strip ChordPro directives from content (they're in form fields now)
  const stripDirectives = (content) => {
    if (!content) return '';
    return content
      .split('\n')
      .filter(line => !line.match(/^\{(title|subtitle|artist|key|bpm|time):/i))
      .join('\n')
      .trim();
  };

  // Populate form when song changes
  useEffect(() => {
    if (song) {
      setFormData({
        title: song.title || '',
        authors: song.authors || '',
        key: song.key || '',
        bpm: song.bpm || '',
        timeSig: song.timeSig || song.time_signature || '',
        content: stripDirectives(song.content) || ''
      });
    } else {
      // Reset form for create mode
      setFormData({
        title: '',
        authors: '',
        key: '',
        bpm: '',
        timeSig: '',
        content: ''
      });
    }
  }, [song]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Insert chord at cursor position (from input or button)
  const insertChord = (chordName = null) => {
    const chordToInsert = chordName || chordInput.trim();
    if (!chordToInsert) return;

    const textarea = contentTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentContent = formData.content;

    const chord = `[${chordToInsert}]`;
    const newContent =
      currentContent.substring(0, start) +
      chord +
      currentContent.substring(end);

    setFormData(prev => ({ ...prev, content: newContent }));
    setChordInput('');

    // Move cursor after inserted chord
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + chord.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  // Insert section marker
  const insertSection = (sectionName) => {
    const textarea = contentTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const currentContent = formData.content;

    // Add newlines if not at the start
    const prefix = start > 0 && !currentContent.substring(0, start).endsWith('\n\n') ? '\n\n' : '';
    const section = `${prefix}[${sectionName}]\n`;

    const newContent =
      currentContent.substring(0, start) +
      section +
      currentContent.substring(start);

    setFormData(prev => ({ ...prev, content: newContent }));

    // Move cursor after section marker
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + section.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    if (!formData.content.trim()) {
      setError('Song content is required');
      return;
    }

    // Build full ChordPro content with directives from form fields
    let fullContent = '';
    if (formData.title) fullContent += `{title: ${formData.title}}\n`;
    if (formData.key) fullContent += `{key: ${formData.key}}\n`;
    if (formData.authors) fullContent += `{subtitle: ${formData.authors}}\n`;
    fullContent += '\n' + formData.content;

    const finalFormData = {
      ...formData,
      content: fullContent
    };

    setSaving(true);
    try {
      await onSave(finalFormData);
      onClose();
    } catch (err) {
      console.error('Error saving song:', err);
      setError(err.message || 'Failed to save song. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditMode ? 'Edit Song' : 'Add New Song'}</h2>
          <button className="modal-close-btn" onClick={handleClose}>×</button>
        </div>

        {error && (
          <div className="modal-error">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="song-edit-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="title">Title *</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="authors">Authors</label>
              <input
                type="text"
                id="authors"
                name="authors"
                value={formData.authors}
                onChange={handleChange}
                placeholder="e.g., John Doe"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="key">Key *</label>
              <select
                id="key"
                name="key"
                value={formData.key}
                onChange={handleChange}
                required
              >
                <option value="">Select Key</option>
                {COMMON_KEYS.map(key => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="bpm">BPM</label>
              <input
                type="number"
                id="bpm"
                name="bpm"
                value={formData.bpm}
                onChange={handleChange}
                placeholder="e.g., 120"
                min="1"
              />
            </div>

            <div className="form-group">
              <label htmlFor="timeSig">Time Signature</label>
              <select
                id="timeSig"
                name="timeSig"
                value={formData.timeSig}
                onChange={handleChange}
              >
                <option value="4/4">4/4</option>
                <option value="6/8">6/8</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="content">Lyrics & Chords *</label>
            <div className="editor-helpers">
              <div className="chord-helper">
                <div className="chord-input-row">
                  <input
                    type="text"
                    className="chord-input"
                    placeholder="Or type custom chord"
                    value={chordInput}
                    onChange={(e) => setChordInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        insertChord();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn-insert-chord"
                    onClick={() => insertChord()}
                    title="Insert chord at cursor position"
                  >
                    Add
                  </button>
                </div>
                <div className="suggested-chords">
                  {formData.key ? (
                    <>
                      <span className="helper-label">Chords in {formData.key}:</span>
                      {getSuggestedChords().map(chord => (
                        <button
                          key={chord}
                          type="button"
                          className="btn-suggested-chord"
                          onClick={() => insertChord(chord)}
                          title={`Insert ${chord} chord`}
                        >
                          {chord}
                        </button>
                      ))}
                    </>
                  ) : (
                    <span className="helper-label-muted">Select a key above to see suggested chords</span>
                  )}
                </div>
              </div>
              <div className="section-helpers">
                <span className="helper-label">Sections:</span>
                <button type="button" className="btn-section" onClick={() => insertSection('Verse 1')}>Verse</button>
                <button type="button" className="btn-section" onClick={() => insertSection('Chorus')}>Chorus</button>
                <button type="button" className="btn-section" onClick={() => insertSection('Bridge')}>Bridge</button>
                <button type="button" className="btn-section" onClick={() => insertSection('Intro')}>Intro</button>
                <button type="button" className="btn-section" onClick={() => insertSection('Outro')}>Outro</button>
              </div>
            </div>
            <textarea
              ref={contentTextareaRef}
              id="content"
              name="content"
              value={formData.content}
              onChange={handleChange}
              required
              rows="15"
              className="lyrics-textarea-rtl"
              placeholder="הקלד את מילות השיר כאן. השתמש בכפתורים למעלה כדי להוסיף אקורדים וקטעים.

דוגמה:
[Verse 1]
אלוהים עוז וחוסן
מבטחי ומגיני

Example in English:
[Verse 1]
Amazing grace how sweet the sound
That saved a wretch like me"
            />
            <div className="editor-hint">
              Tip: Click on a chord button to insert it at your cursor position, or type a custom chord and click Add
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={handleClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-save"
              disabled={saving}
            >
              {saving ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Create Song')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SongEditModal;
