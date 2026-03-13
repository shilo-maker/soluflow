import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, GRADIENT_PRESETS } from '../contexts/ThemeContext';
import { transposeChordPro, transposeChord, calculateTransposition } from '../utils/transpose';
import songService from '../services/songService';
import TagInput from '../components/TagInput';
import Toast from '../components/Toast';
import './ServiceEdit.css';
import './SongEdit.css';

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

// Strip ChordPro directives from content (they're in form fields now)
const stripDirectives = (content) => {
  if (!content) return '';
  return content
    .split('\n')
    .filter(line => !line.match(/^\{(title|subtitle|artist|key|bpm|time):/i))
    .join('\n')
    .trim();
};

const SongEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { workspaces, activeWorkspace } = useWorkspace();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { theme } = useTheme();
  const currentPreset = GRADIENT_PRESETS[theme.gradientPreset] || GRADIENT_PRESETS.warm;

  const isEditMode = !!id;

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [song, setSong] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    authors: '',
    listen_url: '',
    key: '',
    bpm: '',
    timeSig: '4/4',
    content: ''
  });
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedWorkspaces, setSelectedWorkspaces] = useState([]);
  const [chordInput, setChordInput] = useState('');
  const [detailsCollapsed, setDetailsCollapsed] = useState(isEditMode);
  const contentTextareaRef = useRef(null);

  // Auto-resize textarea to fit content
  useEffect(() => {
    const textarea = contentTextareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    }
  }, [formData.content]);

  // Check if admin editing a public song
  const isAdminEditingPublic = isEditMode && user?.role === 'admin' && song?.is_public;

  // Load song data (edit mode only)
  useEffect(() => {
    if (!isEditMode) return;
    const fetchSong = async () => {
      try {
        setLoading(true);
        const songData = await songService.getSongById(id);
        setSong(songData);
        setFormData({
          title: songData.title || '',
          authors: songData.authors || '',
          listen_url: songData.listen_url || '',
          key: songData.key || '',
          bpm: songData.bpm || '',
          timeSig: songData.timeSig || songData.time_signature || '',
          content: stripDirectives(songData.content) || ''
        });
        setSelectedTags(songData.flow_tags || songData.tags || []);
      } catch (err) {
        console.error('Error loading song:', err);
        setError(t('songEdit.errorSaveFailed'));
      } finally {
        setLoading(false);
      }
    };
    fetchSong();
  }, [id]);

  const handleWorkspaceToggle = (workspaceId) => {
    setSelectedWorkspaces(prev =>
      prev.includes(workspaceId) ? prev.filter(wid => wid !== workspaceId) : [...prev, workspaceId]
    );
  };

  // Get suggested chords based on selected key
  const getSuggestedChords = () => {
    const key = formData.key;
    if (key && key.endsWith('m')) {
      const rootKey = key.slice(0, -1);
      return KEY_CHORDS[rootKey] || [];
    }
    return KEY_CHORDS[key] || [];
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'key' && isAdminEditingPublic && formData.key && value) {
      const semitones = calculateTransposition(formData.key, value);
      if (semitones !== 0) {
        const newContent = transposeChordPro(formData.content, semitones);
        setFormData(prev => ({ ...prev, key: value, content: newContent }));
        return;
      }
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Insert chord at cursor position
  const insertChord = (chordName = null) => {
    const chordToInsert = chordName || chordInput.trim();
    if (!chordToInsert) return;
    const textarea = contentTextareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const chord = `[${chordToInsert}]`;
    const newContent = formData.content.substring(0, start) + chord + formData.content.substring(end);
    setFormData(prev => ({ ...prev, content: newContent }));
    setChordInput('');
    setTimeout(() => {
      const scrollY = window.scrollY;
      textarea.focus({ preventScroll: true });
      const newPosition = start + chord.length;
      textarea.setSelectionRange(newPosition, newPosition);
      window.scrollTo(0, scrollY);
    }, 0);
  };

  // Insert section marker
  const insertSection = (sectionName) => {
    const textarea = contentTextareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const prefix = start > 0 && !formData.content.substring(0, start).endsWith('\n\n') ? '\n\n' : '';
    const section = `${prefix}[${sectionName}]\n`;
    const newContent = formData.content.substring(0, start) + section + formData.content.substring(start);
    setFormData(prev => ({ ...prev, content: newContent }));
    setTimeout(() => {
      const scrollY = window.scrollY;
      textarea.focus({ preventScroll: true });
      const newPosition = start + section.length;
      textarea.setSelectionRange(newPosition, newPosition);
      window.scrollTo(0, scrollY);
    }, 0);
  };

  // Permanently transpose all chords
  const handlePermanentTranspose = (semitones) => {
    const currentKey = formData.key;
    if (!currentKey) return;
    const newContent = transposeChordPro(formData.content, semitones);
    const isMinor = currentKey.endsWith('m') && !currentKey.endsWith('maj');
    const rootKey = isMinor ? currentKey.slice(0, -1) : currentKey;
    const newRoot = transposeChord(rootKey, semitones);
    const newKey = isMinor ? newRoot + 'm' : newRoot;
    setFormData(prev => ({ ...prev, content: newContent, key: newKey }));
  };

  const validateForm = () => {
    if (!formData.title.trim()) return t('songEdit.errorTitleRequired');
    if (formData.title.length > 200) return t('songEdit.errorTitleTooLong');
    if (!formData.content.trim()) return t('songEdit.errorContentRequired');
    if (formData.content.length > 50000) return t('songEdit.errorContentTooLong');
    if (formData.authors && formData.authors.length > 200) return t('songEdit.errorAuthorsTooLong');
    if (formData.listen_url && formData.listen_url.trim()) {
      try { new URL(formData.listen_url); } catch { return t('songEdit.errorInvalidUrl'); }
    }
    if (formData.bpm) {
      const bpmNum = parseInt(formData.bpm);
      if (isNaN(bpmNum) || bpmNum < 20 || bpmNum > 300) return t('songEdit.errorInvalidBpm');
    }
    if (formData.key && !COMMON_KEYS.includes(formData.key)) return t('songEdit.errorInvalidKey');
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    // Build full ChordPro content with directives
    let fullContent = '';
    if (formData.title) fullContent += `{title: ${formData.title}}\n`;
    if (formData.key) fullContent += `{key: ${formData.key}}\n`;
    if (formData.authors) fullContent += `{subtitle: ${formData.authors}}\n`;
    fullContent += '\n' + formData.content;

    const songData = {
      title: formData.title,
      authors: formData.authors,
      key: formData.key,
      bpm: formData.bpm ? parseInt(formData.bpm) : null,
      time_signature: formData.timeSig,
      content: fullContent,
      listen_url: formData.listen_url,
      workspace_id: activeWorkspace?.id,
      tag_ids: selectedTags.map(t => t.id)
    };

    if (!isEditMode && selectedWorkspaces.length > 0) {
      songData.workspace_ids = selectedWorkspaces;
    }

    setSaving(true);
    try {
      if (isEditMode) {
        await songService.updateSong(id, songData);
        navigate(`/song/${id}`);
      } else {
        const newSong = await songService.createSong(songData);
        navigate(`/song/${newSong.id}`);
      }
    } catch (err) {
      console.error('Error saving song:', err);
      setError(err.response?.data?.error || err.message || t('songEdit.errorSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="song-edit-page"><div className="edit-loading">{t('common.loading')}</div></div>;
  }

  if (isEditMode && !song) {
    return <div className="song-edit-page"><div className="edit-loading">{t('songEdit.errorSaveFailed')}</div></div>;
  }

  return (
    <div className="song-edit-page">
      {/* Header */}
      <div
        className="edit-header-gradient"
        style={{ background: `linear-gradient(135deg, ${currentPreset.colors[0]} 0%, ${currentPreset.colors[1]} 25%, ${currentPreset.colors[2]} 50%, ${currentPreset.colors[3]} 75%, ${currentPreset.colors[4]} 100%)` }}
      >
        <div className="edit-header-content">
          <button className="edit-header-back" onClick={() => navigate(isEditMode ? `/song/${id}` : '/library')}>
            <ArrowLeft size={20} />
          </button>
          <div className="edit-header-info">
            <h1 className="edit-header-title">{isEditMode ? t('songEdit.titleEdit') : t('songEdit.titleAdd')}</h1>
            {formData.title && (
              <span className="edit-header-subtitle">{formData.title}</span>
            )}
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="edit-form">
        {error && <div className="edit-error">{error}</div>}

        {/* Song Details Card - Collapsible */}
        <div className="edit-card">
          <h2
            className="edit-card-title edit-card-title-collapsible"
            onClick={() => setDetailsCollapsed(!detailsCollapsed)}
          >
            <span className={`collapse-arrow ${detailsCollapsed ? 'collapsed' : ''}`}>▼</span>
            {t('serviceEdit.serviceDetails')}
            {detailsCollapsed && formData.title && (
              <span className="edit-card-title-preview">
                {formData.title}{formData.authors ? ` · ${formData.authors}` : ''}{formData.key ? ` · ${formData.key}` : ''}
              </span>
            )}
          </h2>

          {!detailsCollapsed && (
            <>
              <div className="edit-field">
                <label htmlFor="title">{t('songEdit.fieldTitle')} <span className="se-required">{t('songEdit.required')}</span> <span className="se-char-count">({formData.title.length}/200)</span></label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  maxLength={200}
                />
              </div>

              <div className="edit-field">
                <label htmlFor="authors">{t('songEdit.fieldAuthors')} <span className="se-char-count">({formData.authors.length}/200)</span></label>
                <input
                  type="text"
                  id="authors"
                  name="authors"
                  value={formData.authors}
                  onChange={handleChange}
                  placeholder={t('songEdit.placeholderAuthors')}
                  maxLength={200}
                />
              </div>

              <div className="edit-field">
                <label htmlFor="listen_url">{t('songEdit.fieldListenUrl')}</label>
                <input
                  type="url"
                  id="listen_url"
                  name="listen_url"
                  value={formData.listen_url}
                  onChange={handleChange}
                  placeholder={t('songEdit.placeholderListenUrl')}
                />
              </div>

              {/* Tags - edit mode only */}
              {isEditMode && song && (
                <TagInput
                  songId={song.id}
                  songTags={selectedTags}
                  isPublicSong={song.is_public}
                  songOwnerId={song.created_by_id}
                  onChange={setSelectedTags}
                />
              )}

              {/* Workspace Selection - create mode only */}
              {!isEditMode && workspaces && workspaces.length > 1 && (
                <div className="edit-field">
                  <label>{t('songEdit.workspaceSelection')}</label>
                  <div className="se-workspace-checkboxes">
                    {workspaces
                      .filter(ws => ws.id !== activeWorkspace?.id)
                      .map(workspace => (
                        <label key={workspace.id} className="se-workspace-label">
                          <input
                            type="checkbox"
                            checked={selectedWorkspaces.includes(workspace.id)}
                            onChange={() => handleWorkspaceToggle(workspace.id)}
                          />
                          <span>{workspace.name}</span>
                        </label>
                      ))}
                  </div>
                  <div className="se-editor-hint">
                    {t('songEdit.workspaceHint').replace('{workspace}', activeWorkspace?.name || '')}
                  </div>
                </div>
              )}

              <div className="se-row-three">
                <div className="edit-field">
                  <label htmlFor="key">{t('songEdit.fieldKey')} <span className="se-required">{t('songEdit.required')}</span></label>
                  <div className="se-key-row">
                    <select
                      id="key"
                      name="key"
                      value={formData.key}
                      onChange={handleChange}
                      required
                    >
                      <option value="">{t('songEdit.selectKey')}</option>
                      {COMMON_KEYS.map(key => (
                        <option key={key} value={key}>{key}</option>
                      ))}
                    </select>
                    {isAdminEditingPublic && formData.key && (
                      <div className="se-transpose-btns">
                        <button type="button" className="se-btn-transpose" onClick={() => handlePermanentTranspose(-1)} title={t('songEdit.transposeDown') || 'Transpose down'}>−</button>
                        <button type="button" className="se-btn-transpose" onClick={() => handlePermanentTranspose(1)} title={t('songEdit.transposeUp') || 'Transpose up'}>+</button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="edit-field">
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
                  />
                </div>

                <div className="edit-field">
                  <label htmlFor="timeSig">{t('songEdit.fieldTimeSig')}</label>
                  <select id="timeSig" name="timeSig" value={formData.timeSig} onChange={handleChange}>
                    <option value="4/4">4/4</option>
                    <option value="6/8">6/8</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Content Section */}
        <div className="edit-card se-content-card-title">
          <h2 className="edit-card-title">{t('songEdit.fieldContent')} <span className="se-required">{t('songEdit.required')}</span></h2>
        </div>

        <div className="se-editor-helpers">
            <div className="se-chord-helper">
              <div className="se-chord-input-row">
                <input
                  type="text"
                  className="se-chord-input"
                  placeholder={t('songEdit.chordInputPlaceholder')}
                  value={chordInput}
                  onChange={(e) => setChordInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); insertChord(); }
                  }}
                />
                <button type="button" className="se-btn-insert" onClick={() => insertChord()}>
                  {t('songEdit.btnAddChord')}
                </button>
              </div>
              <div className="se-suggested-chords">
                {formData.key ? (
                  <>
                    <span className="se-helper-label">{t('songEdit.labelChordsIn')} {formData.key}:</span>
                    {getSuggestedChords().map(chord => (
                      <button key={chord} type="button" className="se-btn-chord" onClick={() => insertChord(chord)}>
                        {chord}
                      </button>
                    ))}
                  </>
                ) : (
                  <span className="se-helper-label-muted">{t('songEdit.labelSelectKeyFirst')}</span>
                )}
              </div>
            </div>
            <div className="se-section-helpers">
              <span className="se-helper-label">{t('songEdit.labelSections')}</span>
              <button type="button" className="se-btn-section" onClick={() => insertSection('Verse 1')}>{t('songEdit.btnVerse')}</button>
              <button type="button" className="se-btn-section" onClick={() => insertSection('Chorus')}>{t('songEdit.btnChorus')}</button>
              <button type="button" className="se-btn-section" onClick={() => insertSection('Bridge')}>{t('songEdit.btnBridge')}</button>
              <button type="button" className="se-btn-section" onClick={() => insertSection('Intro')}>{t('songEdit.btnIntro')}</button>
              <button type="button" className="se-btn-section" onClick={() => insertSection('Outro')}>{t('songEdit.btnOutro')}</button>
            </div>
        </div>

        <div className="se-content-area">
          <textarea
            ref={contentTextareaRef}
            id="content"
            name="content"
            value={formData.content}
            onChange={handleChange}
            required
            rows="20"
            className="se-lyrics-textarea"
            placeholder={t('songEdit.placeholderContent')}
          />
          <div className="se-editor-hint">{t('songEdit.editorHint')}</div>
        </div>

        {/* Save Bar */}
        <div className="edit-save-bar">
          <button type="button" className="edit-btn-cancel" onClick={() => navigate(isEditMode ? `/song/${id}` : '/library')} disabled={saving}>
            {t('songEdit.btnCancel')}
          </button>
          <button type="submit" className="edit-btn-save" disabled={saving}>
            {saving ? t('songEdit.btnSaving') : (isEditMode ? t('songEdit.btnSave') : t('songEdit.btnCreate'))}
          </button>
        </div>
      </form>

      {showToast && (
        <Toast message={toastMessage} onClose={() => setShowToast(false)} />
      )}
    </div>
  );
};

export default SongEdit;
