import React, { useState, useEffect, useRef } from 'react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useLanguage } from '../contexts/LanguageContext';
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
  const { workspaces, activeWorkspace } = useWorkspace();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    title: '',
    authors: '',
    listen_url: '',
    key: '',
    bpm: '',
    timeSig: '4/4',
    content: ''
  });
  const [selectedWorkspaces, setSelectedWorkspaces] = useState([]);
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
        listen_url: song.listen_url || '',
        key: song.key || '',
        bpm: song.bpm || '',
        timeSig: song.timeSig || song.time_signature || '',
        content: stripDirectives(song.content) || ''
      });
      // TODO: Load existing workspace selections for edit mode if needed
      setSelectedWorkspaces([]);
    } else {
      // Reset form for create mode
      setFormData({
        title: '',
        authors: '',
        listen_url: '',
        key: '',
        bpm: '',
        timeSig: '',
        content: ''
      });
      setSelectedWorkspaces([]);
    }
  }, [song]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleWorkspaceToggle = (workspaceId) => {
    setSelectedWorkspaces(prev => {
      if (prev.includes(workspaceId)) {
        return prev.filter(id => id !== workspaceId);
      } else {
        return [...prev, workspaceId];
      }
    });
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

  const validateForm = () => {
    // Title validation
    if (!formData.title.trim()) {
      return t('songEdit.errorTitleRequired');
    }
    if (formData.title.length > 200) {
      return t('songEdit.errorTitleTooLong');
    }

    // Content validation
    if (!formData.content.trim()) {
      return t('songEdit.errorContentRequired');
    }
    if (formData.content.length > 50000) {
      return t('songEdit.errorContentTooLong');
    }

    // Authors validation
    if (formData.authors && formData.authors.length > 200) {
      return t('songEdit.errorAuthorsTooLong');
    }

    // URL validation
    if (formData.listen_url && formData.listen_url.trim()) {
      try {
        new URL(formData.listen_url);
      } catch {
        return t('songEdit.errorInvalidUrl');
      }
    }

    // BPM validation
    if (formData.bpm) {
      const bpmNum = parseInt(formData.bpm);
      if (isNaN(bpmNum) || bpmNum < 20 || bpmNum > 300) {
        return t('songEdit.errorInvalidBpm');
      }
    }

    // Key validation
    if (formData.key && !COMMON_KEYS.includes(formData.key)) {
      return t('songEdit.errorInvalidKey');
    }

    return null; // No errors
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validate form
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
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
      content: fullContent,
      workspace_ids: selectedWorkspaces.length > 0 ? selectedWorkspaces : undefined
    };

    setSaving(true);
    try {
      await onSave(finalFormData);
      onClose();
    } catch (err) {
      console.error('Error saving song:', err);
      setError(err.message || t('songEdit.errorSaveFailed'));
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
    <div className="song-edit-modal modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditMode ? t('songEdit.titleEdit') : t('songEdit.titleAdd')}</h2>
          <button className="modal-close-btn" onClick={handleClose}>×</button>
        </div>

        {error && (
          <div className="modal-error">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="song-edit-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="title">{t('songEdit.fieldTitle')} {t('songEdit.required')} <span className="char-count">({formData.title.length}/200)</span></label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                maxLength={200}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="authors">{t('songEdit.fieldAuthors')} <span className="char-count">({formData.authors.length}/200)</span></label>
              <input
                type="text"
                id="authors"
                name="authors"
                value={formData.authors}
                onChange={handleChange}
                placeholder={t('songEdit.placeholderAuthors')}
                maxLength={200}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="listen_url">{t('songEdit.fieldListenUrl')}</label>
              <input
                type="url"
                id="listen_url"
                name="listen_url"
                value={formData.listen_url}
                onChange={handleChange}
                placeholder={t('songEdit.placeholderListenUrl')}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div className="form-row three-cols">
            <div className="form-group">
              <label htmlFor="key">{t('songEdit.fieldKey')} {t('songEdit.required')}</label>
              <select
                id="key"
                name="key"
                value={formData.key}
                onChange={handleChange}
                required
                style={{ width: '100%', boxSizing: 'border-box' }}
              >
                <option value="">{t('songEdit.selectKey')}</option>
                {COMMON_KEYS.map(key => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="bpm">{t('songEdit.fieldBpm')}</label>
              <input
                type="number"
                id="bpm"
                name="bpm"
                value={formData.bpm}
                onChange={handleChange}
                placeholder={t('songEdit.placeholderBpm')}
                min="20"
                max="300"
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="timeSig">{t('songEdit.fieldTimeSig')}</label>
              <select
                id="timeSig"
                name="timeSig"
                value={formData.timeSig}
                onChange={handleChange}
                style={{ width: '100%', boxSizing: 'border-box' }}
              >
                <option value="4/4">4/4</option>
                <option value="6/8">6/8</option>
              </select>
            </div>
          </div>

          {/* Workspace Selection */}
          {!isEditMode && workspaces && workspaces.length > 1 && (
            <div className="form-group workspace-selection">
              <label>{t('songEdit.workspaceSelection')}</label>
              <div className="workspace-checkboxes">
                {workspaces
                  .filter(ws => ws.id !== activeWorkspace?.id)
                  .map(workspace => (
                    <label key={workspace.id} className="workspace-checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedWorkspaces.includes(workspace.id)}
                        onChange={() => handleWorkspaceToggle(workspace.id)}
                      />
                      <span>{workspace.name}</span>
                    </label>
                  ))}
              </div>
              <div className="workspace-hint">
                {t('songEdit.workspaceHint').replace('{workspace}', activeWorkspace?.name || '')}
              </div>
            </div>
          )}

          <div className="form-group full-width">
            <label htmlFor="content">{t('songEdit.fieldContent')} {t('songEdit.required')}</label>
            <div className="editor-helpers">
              <div className="chord-helper">
                <div className="chord-input-row">
                  <input
                    type="text"
                    className="chord-input"
                    placeholder={t('songEdit.chordInputPlaceholder')}
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
                    {t('songEdit.btnAddChord')}
                  </button>
                </div>
                <div className="suggested-chords">
                  {formData.key ? (
                    <>
                      <span className="helper-label">{t('songEdit.labelChordsIn')} {formData.key}:</span>
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
                    <span className="helper-label-muted">{t('songEdit.labelSelectKeyFirst')}</span>
                  )}
                </div>
              </div>
              <div className="section-helpers">
                <span className="helper-label">{t('songEdit.labelSections')}</span>
                <button type="button" className="btn-section" onClick={() => insertSection('Verse 1')}>{t('songEdit.btnVerse')}</button>
                <button type="button" className="btn-section" onClick={() => insertSection('Chorus')}>{t('songEdit.btnChorus')}</button>
                <button type="button" className="btn-section" onClick={() => insertSection('Bridge')}>{t('songEdit.btnBridge')}</button>
                <button type="button" className="btn-section" onClick={() => insertSection('Intro')}>{t('songEdit.btnIntro')}</button>
                <button type="button" className="btn-section" onClick={() => insertSection('Outro')}>{t('songEdit.btnOutro')}</button>
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
              style={{ width: '100%', boxSizing: 'border-box' }}
              placeholder={t('songEdit.placeholderContent')}
            />
            <div className="editor-hint">
              {t('songEdit.editorHint')}
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={handleClose}
              disabled={saving}
            >
              {t('songEdit.btnCancel')}
            </button>
            <button
              type="submit"
              className="btn-save"
              disabled={saving}
            >
              {saving ? t('songEdit.btnSaving') : (isEditMode ? t('songEdit.btnSave') : t('songEdit.btnCreate'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SongEditModal;
