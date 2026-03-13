import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useTheme, GRADIENT_PRESETS } from '../contexts/ThemeContext';
import serviceService from '../services/serviceService';
import songService from '../services/songService';
import ChordProDisplay from '../components/ChordProDisplay';
import { stripChords, getTransposeDisplay, transposeChord, convertKeyToFlat } from '../utils/transpose';
import PrayerItemModal from '../components/PrayerItemModal';
import BibleRefPicker from '../components/BibleRefPicker';
import Toast from '../components/Toast';
import './ServiceEdit.css';

const hasHebrew = (text) => /[\u0590-\u05FF]/.test(text || '');

const ServiceNew = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { activeWorkspace } = useWorkspace();
  const { theme } = useTheme();
  const currentPreset = GRADIENT_PRESETS[theme.gradientPreset] || GRADIENT_PRESETS.warm;

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    datetime: '',
    location: '',
    isPublic: true
  });

  const initialSong = location.state?.initialSong;
  const [setlist, setSetlist] = useState(initialSong ? [initialSong] : []);
  const [availableSongs, setAvailableSongs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [listView, setListView] = useState(initialSong ? 'setlist' : 'database');
  const [editingPrayerItem, setEditingPrayerItem] = useState(null);

  // Inline prayer form state
  const [prayerTitle, setPrayerTitle] = useState('');
  const [prayerTitleTranslation, setPrayerTitleTranslation] = useState('');
  const [sameVerseForAll, setSameVerseForAll] = useState(false);
  const [sharedBibleRef, setSharedBibleRef] = useState('');
  const [prayerPoints, setPrayerPoints] = useState([{ subtitle: '', subtitle_translation: '', description: '', description_translation: '', bible_ref: '' }]);
  const [prayerError, setPrayerError] = useState('');

  // Available songs preview state
  const [previewAvailableSong, setPreviewAvailableSong] = useState(null);
  const [previewTransposition, setPreviewTransposition] = useState(0);
  const [previewFontSize, setPreviewFontSize] = useState(14);

  // Setlist song preview state
  const [setlistPreviewIndex, setSetlistPreviewIndex] = useState(null);
  const [setlistPreviewFontSize, setSetlistPreviewFontSize] = useState(14);

  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [showToast, setShowToast] = useState(false);

  const fetchingRef = useRef(false);

  // Debounce search for available songs
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load available songs
  useEffect(() => {
    if (!user || fetchingRef.current) return;
    fetchingRef.current = true;

    const fetchSongs = async () => {
      try {
        setLoadingSongs(true);
        const songs = await songService.getAllSongs();
        setAvailableSongs(songs);
      } catch (err) {
        console.error('Error fetching songs:', err);
      } finally {
        setLoadingSongs(false);
        fetchingRef.current = false;
      }
    };

    fetchSongs();
  }, [user]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleAddSong = (song, transposition = 0) => {
    const songToAdd = { ...song };
    if (transposition !== 0) {
      songToAdd._editTransposition = transposition;
    }
    setSetlist(prev => [...prev, songToAdd]);
    setPreviewAvailableSong(null);
    setPreviewTransposition(0);
  };

  const handleRemoveItem = (item, index) => {
    setSetlist(prev => prev.filter((_, i) => i !== index));
    if (selectedIndex === index) setSelectedIndex(null);
    else if (selectedIndex !== null && selectedIndex > index) setSelectedIndex(selectedIndex - 1);
  };

  const resetPrayerForm = (data = {}) => {
    setPrayerTitle(data.title || '');
    setPrayerTitleTranslation(data.title_translation || '');
    setSameVerseForAll(data.same_verse_for_all || false);
    setSharedBibleRef(data.shared_bible_ref || '');
    setPrayerPoints(
      data.prayer_points && data.prayer_points.length > 0
        ? data.prayer_points.map(p => ({ ...p }))
        : [{ subtitle: '', subtitle_translation: '', description: '', description_translation: '', bible_ref: '' }]
    );
    setPrayerError('');
  };

  const handleEditPrayer = (item, e) => {
    e.stopPropagation();
    setEditingPrayerItem(item);
    let data = {};
    try {
      data = typeof item.segment_content === 'string'
        ? JSON.parse(item.segment_content)
        : (item.segment_content || {});
    } catch { data = {}; }
    resetPrayerForm({ ...data, title: data.title || item.segment_title || item.title || '' });
    setListView('prayer');
  };

  const handleSavePrayerInline = () => {
    if (!prayerTitle.trim()) {
      setPrayerError(t('prayer.titleRequired'));
      return;
    }
    const prayerData = {
      title: prayerTitle.trim(),
      title_translation: prayerTitleTranslation.trim(),
      same_verse_for_all: sameVerseForAll,
      shared_bible_ref: sameVerseForAll ? sharedBibleRef : '',
      prayer_points: prayerPoints.map(p => ({
        subtitle: (p.subtitle || '').trim(),
        subtitle_translation: (p.subtitle_translation || '').trim(),
        description: (p.description || '').trim(),
        description_translation: (p.description_translation || '').trim(),
        bible_ref: sameVerseForAll ? '' : (p.bible_ref || '')
      }))
    };
    const itemId = editingPrayerItem?.id || editingPrayerItem?.prayer_temp_id || `prayer_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const prayerItem = {
      id: itemId,
      prayer_temp_id: itemId,
      segment_type: 'prayer',
      song_id: null,
      segment_title: prayerTitle.trim(),
      segment_content: JSON.stringify(prayerData),
      title: prayerTitle.trim()
    };

    if (editingPrayerItem) {
      setSetlist(prev => {
        const idx = prev.findIndex(s => s.id === editingPrayerItem.id && s.segment_type === 'prayer');
        if (idx === -1) return [...prev, prayerItem];
        const next = [...prev];
        next[idx] = prayerItem;
        return next;
      });
    } else {
      setSetlist(prev => [...prev, prayerItem]);
    }
    setEditingPrayerItem(null);
    resetPrayerForm();
    setListView('setlist');
  };

  const handleSelectSong = (index) => {
    setSelectedIndex(selectedIndex === index ? null : index);
  };

  const handleMoveUp = () => {
    if (selectedIndex === null || selectedIndex === 0) return;
    const newSetlist = [...setlist];
    [newSetlist[selectedIndex - 1], newSetlist[selectedIndex]] = [newSetlist[selectedIndex], newSetlist[selectedIndex - 1]];
    setSetlist(newSetlist);
    setSelectedIndex(selectedIndex - 1);
  };

  const handleMoveDown = () => {
    if (selectedIndex === null || selectedIndex === setlist.length - 1) return;
    const newSetlist = [...setlist];
    [newSetlist[selectedIndex], newSetlist[selectedIndex + 1]] = [newSetlist[selectedIndex + 1], newSetlist[selectedIndex]];
    setSetlist(newSetlist);
    setSelectedIndex(selectedIndex + 1);
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const newSetlist = [...setlist];
    const draggedItem = newSetlist[draggedIndex];
    newSetlist.splice(draggedIndex, 1);
    newSetlist.splice(index, 0, draggedItem);
    setSetlist(newSetlist);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSetlistTranspose = (index, delta) => {
    setSetlist(prev => {
      const next = [...prev];
      const item = { ...next[index] };
      const currentTransp = item._editTransposition !== undefined ? item._editTransposition : (item.transposition || 0);
      item._editTransposition = currentTransp + delta;
      next[index] = item;
      return next;
    });
  };

  const getItemTransposition = (item) => {
    return item._editTransposition !== undefined ? item._editTransposition : (item.transposition || 0);
  };

  const handlePreviewSong = (song) => {
    if (previewAvailableSong?.id === song.id) {
      setPreviewAvailableSong(null);
      setPreviewTransposition(0);
    } else {
      setPreviewAvailableSong(song);
      setPreviewTransposition(0);
      setPreviewFontSize(14);
    }
  };

  const filteredSongs = useMemo(() => {
    const query = debouncedSearchQuery.toLowerCase();
    const available = availableSongs.filter(song => !setlist.some(s => s.segment_type !== 'prayer' && s.id === song.id));
    if (!query) return available;

    const results = [];
    for (const song of available) {
      const titleMatch = song.title.toLowerCase().includes(query);
      if (titleMatch) { results.push({ ...song, _priority: 1 }); continue; }

      const authorMatch = song.authors && song.authors.toLowerCase().includes(query);
      if (authorMatch) { results.push({ ...song, _priority: 2 }); continue; }

      const contentMatch = stripChords(song.content || '').toLowerCase().includes(query);
      if (contentMatch) { results.push({ ...song, _priority: 3 }); }
    }
    return results.sort((a, b) => a._priority - b._priority);
  }, [availableSongs, setlist, debouncedSearchQuery]);

  const generatedTitle = useMemo(() => {
    if (!formData.datetime || !formData.location) return '';
    const dateObj = new Date(formData.datetime);
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    return `${day}/${month} ${formData.location}`;
  }, [formData.datetime, formData.location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.datetime) { setError('Date and time is required'); return; }
    if (!formData.location.trim()) { setError('Location/Venue is required'); return; }

    const [date, time] = formData.datetime.split('T');

    try {
      setSaving(true);

      // Build setlist data for the create call
      const setlistData = setlist.map((item, i) => {
        if (item.segment_type === 'prayer') {
          return {
            song_id: null, position: i, segment_type: 'prayer',
            segment_title: item.segment_title || item.title,
            segment_content: item.segment_content
          };
        }
        const addData = { song_id: item.id, position: i, segment_type: 'song' };
        if (item._editTransposition !== undefined) {
          addData.transposition = item._editTransposition;
        }
        return addData;
      });

      const serviceData = {
        date,
        time,
        location: formData.location,
        isPublic: formData.isPublic,
        title: generatedTitle,
        workspace_id: activeWorkspace?.id,
        leader_id: user.id,
        created_by: user.id
      };

      // Include setlist so offline create captures it in one queued operation
      if (setlistData.length > 0) {
        serviceData.setlist = setlistData;
      }

      const newService = await serviceService.createService(serviceData);

      if (newService._offline) {
        setToastMessage('Service saved offline — will sync when online');
        setToastType('success');
        setShowToast(true);
        setTimeout(() => navigate('/services'), 1500);
      } else {
        // Online: add setlist items individually
        if (setlistData.length > 0) {
          for (const item of setlistData) {
            await serviceService.addSongToService(newService.id, item);
          }
        }
        navigate(`/services/${newService.id}`);
      }
    } catch (err) {
      console.error('Error creating service:', err);
      setError(err.message || err.error || 'Failed to create service');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="service-edit-page">
      {/* Header */}
      <div
        className="edit-header-gradient"
        style={{ background: `linear-gradient(135deg, ${currentPreset.colors[0]} 0%, ${currentPreset.colors[1]} 25%, ${currentPreset.colors[2]} 50%, ${currentPreset.colors[3]} 75%, ${currentPreset.colors[4]} 100%)` }}
      >
        <div className="edit-header-content">
          <button className="edit-header-back" onClick={() => navigate('/services')}>
            <ArrowLeft size={20} />
          </button>
          <div className="edit-header-info">
            <h1 className="edit-header-title">{t('service.createNew')}</h1>
            {generatedTitle && (
              <span className="edit-header-subtitle">{generatedTitle}</span>
            )}
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="edit-form">
        {error && <div className="edit-error">{error}</div>}

        {/* Service Details Card */}
        <div className="edit-card">
          <h2 className="edit-card-title">{t('serviceEdit.serviceTitle')}</h2>

          <div className="edit-field">
            <label htmlFor="datetime">{t('serviceEdit.dateTime')}</label>
            <input
              type="datetime-local"
              id="datetime"
              name="datetime"
              value={formData.datetime}
              onChange={handleChange}
              required
            />
          </div>

          <div className="edit-field">
            <label htmlFor="location">{t('serviceEdit.venue')}</label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder={t('serviceEdit.venuePlaceholder')}
              required
            />
          </div>

          {generatedTitle && (
            <div className="edit-title-preview">
              {generatedTitle}
            </div>
          )}
        </div>

        {/* Setlist Card */}
        <div className="edit-card">
          <div className="edit-card-header">
            <h2 className="edit-card-title">{t('serviceEdit.currentSetlist')}</h2>
            <div className="edit-tab-bar">
              <button
                type="button"
                className={`edit-tab ${listView === 'setlist' ? 'active' : ''}`}
                onClick={() => { setListView('setlist'); setPreviewAvailableSong(null); }}
              >
                {t('serviceEdit.currentSetlist')}{setlist.length > 0 ? ` (${setlist.length})` : ''}
              </button>
              <button
                type="button"
                className={`edit-tab ${listView === 'database' ? 'active' : ''}`}
                onClick={() => setListView('database')}
              >
                {t('serviceEdit.availableSongs')}
              </button>
              <button
                type="button"
                className={`edit-tab edit-tab-prayer ${listView === 'prayer' ? 'active-prayer' : ''}`}
                onClick={() => {
                  if (listView !== 'prayer') {
                    setEditingPrayerItem(null);
                    resetPrayerForm();
                  }
                  setListView('prayer');
                }}
              >
                + {t('prayer.addPrayer')}
              </button>
            </div>
          </div>

          {listView === 'database' ? (
            <div className="edit-songs-list">
              <input
                type="text"
                className="edit-search"
                placeholder={t('serviceEdit.searchSongs')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <div className="edit-available-songs">
                {loadingSongs ? (
                  <div className="edit-empty">{t('serviceEdit.loading')}</div>
                ) : filteredSongs.length === 0 ? (
                  <div className="edit-empty">
                    {searchQuery ? t('serviceEdit.noSongsFound') : t('serviceEdit.noSongsAvailable')}
                  </div>
                ) : (
                  filteredSongs.map(song => (
                    <React.Fragment key={song.id}>
                      <div
                        className={`edit-available-item ${previewAvailableSong?.id === song.id ? 'expanded' : ''}`}
                        onClick={() => handlePreviewSong(song)}
                      >
                        <div className="edit-available-item-content">
                          <div className="edit-available-item-left">
                            <div className="edit-available-item-title">{song.title}</div>
                            <div className="edit-available-item-meta">{song.authors}</div>
                          </div>
                          <div className="edit-available-item-right">
                            <span className="edit-available-item-key">
                              {convertKeyToFlat(song.key)}
                            </span>
                            <button
                              type="button"
                              className="edit-btn-add"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddSong(song, previewAvailableSong?.id === song.id ? previewTransposition : 0);
                              }}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Inline song display */}
                      {previewAvailableSong?.id === song.id && (
                        <div className="edit-song-display-inline">
                          <div className="edit-song-display-header">
                            <h3 className="edit-song-display-title">{song.title}</h3>
                            <p className="edit-song-display-authors">{song.authors}</p>
                          </div>

                          <div className="edit-song-display-controls">
                            <div className="edit-transpose-controls">
                              <button
                                type="button"
                                className="edit-btn-transpose"
                                onClick={(e) => { e.stopPropagation(); setPreviewTransposition(prev => prev - 1); }}
                              >
                                -
                              </button>
                              <span className="edit-transpose-display">
                                {convertKeyToFlat(transposeChord(song.key, previewTransposition))}
                                {previewTransposition !== 0 && ` (${previewTransposition > 0 ? '+' : ''}${previewTransposition})`}
                              </span>
                              <button
                                type="button"
                                className="edit-btn-transpose"
                                onClick={(e) => { e.stopPropagation(); setPreviewTransposition(prev => prev + 1); }}
                              >
                                +
                              </button>
                            </div>
                            <div className="edit-zoom-controls">
                              <button
                                type="button"
                                className="edit-btn-zoom"
                                onClick={(e) => { e.stopPropagation(); setPreviewFontSize(prev => Math.max(10, prev - 1)); }}
                              >
                                <span className="edit-zoom-small">A</span>
                              </button>
                              <button
                                type="button"
                                className="edit-btn-zoom"
                                onClick={(e) => { e.stopPropagation(); setPreviewFontSize(prev => Math.min(24, prev + 1)); }}
                              >
                                <span className="edit-zoom-large">A</span>
                              </button>
                            </div>
                            <span className="edit-key-info">
                              Key: {convertKeyToFlat(song.key)}
                            </span>
                            <button
                              type="button"
                              className="edit-btn-add-from-preview"
                              onClick={(e) => { e.stopPropagation(); handleAddSong(song, previewTransposition); }}
                            >
                              + {t('serviceEdit.addToSetlist') || 'Add'}
                            </button>
                          </div>

                          <div className="edit-song-display-content">
                            <ChordProDisplay
                              content={song.content}
                              dir={hasHebrew(song.content) ? 'rtl' : 'ltr'}
                              fontSize={previewFontSize}
                              transposition={previewTransposition}
                              songKey={song.key}
                              disableColumnCalculation={true}
                            />
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  ))
                )}
              </div>
            </div>
          ) : listView === 'setlist' ? (
            <div className="edit-setlist-view">
              <div className="edit-setlist-controls">
                <button
                  type="button"
                  className="edit-btn-reorder"
                  onClick={handleMoveUp}
                  disabled={selectedIndex === null || selectedIndex === 0}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="edit-btn-reorder"
                  onClick={handleMoveDown}
                  disabled={selectedIndex === null || selectedIndex === setlist.length - 1}
                >
                  ▼
                </button>
              </div>
              <div className="edit-songs-scroll">
                {setlist.length === 0 ? (
                  <div className="edit-empty">{t('serviceEdit.noSongsSelected')}</div>
                ) : (
                  setlist.map((item, index) => (
                    <div
                      key={item.segment_type === 'prayer' ? `prayer-${item.id || index}-${index}` : `song-${item.id}-${index}`}
                      className={`edit-song-item ${item.segment_type === 'prayer' ? 'prayer' : ''} ${draggedIndex === index ? 'dragging' : ''} ${selectedIndex === index ? 'selected' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="edit-song-row" onClick={() => {
                        handleSelectSong(index);
                        if (item.segment_type !== 'prayer') {
                          setSetlistPreviewIndex(setlistPreviewIndex === index ? null : index);
                        }
                      }}>
                        <span className={`edit-song-number ${item.segment_type === 'prayer' ? 'prayer' : ''}`}>{index + 1}</span>
                        <div className="edit-song-info">
                          <div className="edit-song-title">
                            {item.segment_type === 'prayer' && '🙏 '}
                            {item.title || item.segment_title}
                          </div>
                          <div className="edit-song-meta">
                            {item.segment_type === 'prayer' ? t('prayer.prayer') : item.authors}
                            {item.segment_type !== 'prayer' && getItemTransposition(item) !== 0 && (
                              <span className="edit-transpose-badge">
                                {' '}({convertKeyToFlat(transposeChord(item.key, getItemTransposition(item)))})
                              </span>
                            )}
                          </div>
                        </div>
                        {item.segment_type === 'prayer' && (
                          <button
                            type="button"
                            className="edit-btn-action"
                            onClick={(e) => handleEditPrayer(item, e)}
                            title={t('prayer.editPrayer')}
                          >
                            ✎
                          </button>
                        )}
                        <button
                          type="button"
                          className="edit-btn-remove"
                          onClick={(e) => { e.stopPropagation(); handleRemoveItem(item, index); }}
                        >
                          ×
                        </button>
                      </div>
                      {item.segment_type !== 'prayer' && setlistPreviewIndex === index && (
                        <div className="edit-song-display-inline">
                          <div className="edit-song-display-header">
                            <h3 className="edit-song-display-title">{item.title}</h3>
                            <p className="edit-song-display-authors">{item.authors}</p>
                          </div>

                          <div className="edit-song-display-controls">
                            <div className="edit-transpose-controls">
                              <button
                                type="button"
                                className="edit-btn-transpose"
                                onClick={(e) => { e.stopPropagation(); handleSetlistTranspose(index, -1); }}
                              >
                                -
                              </button>
                              <span className="edit-transpose-display">
                                {convertKeyToFlat(transposeChord(item.key, getItemTransposition(item)))}
                                {getItemTransposition(item) !== 0 && ` (${getItemTransposition(item) > 0 ? '+' : ''}${getItemTransposition(item)})`}
                              </span>
                              <button
                                type="button"
                                className="edit-btn-transpose"
                                onClick={(e) => { e.stopPropagation(); handleSetlistTranspose(index, 1); }}
                              >
                                +
                              </button>
                            </div>
                            <div className="edit-zoom-controls">
                              <button
                                type="button"
                                className="edit-btn-zoom"
                                onClick={(e) => { e.stopPropagation(); setSetlistPreviewFontSize(prev => Math.max(10, prev - 1)); }}
                              >
                                <span className="edit-zoom-small">A</span>
                              </button>
                              <button
                                type="button"
                                className="edit-btn-zoom"
                                onClick={(e) => { e.stopPropagation(); setSetlistPreviewFontSize(prev => Math.min(24, prev + 1)); }}
                              >
                                <span className="edit-zoom-large">A</span>
                              </button>
                            </div>
                            <span className="edit-key-info">
                              Key: {convertKeyToFlat(item.key)}
                            </span>
                          </div>

                          <div className="edit-song-display-content">
                            <ChordProDisplay
                              content={item.content}
                              dir={hasHebrew(item.content) ? 'rtl' : 'ltr'}
                              fontSize={setlistPreviewFontSize}
                              transposition={getItemTransposition(item)}
                              songKey={item.key}
                              disableColumnCalculation={true}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
              {setlist.length > 0 && (
                <div className="edit-hint">{t('serviceEdit.reorderHint')}</div>
              )}
            </div>
          ) : listView === 'prayer' ? (
            <div className="edit-prayer-form">
              {prayerError && <div className="edit-error">{prayerError}</div>}

              <div className="edit-field">
                <label>{t('prayer.prayerTitle')} *</label>
                <input
                  type="text"
                  value={prayerTitle}
                  onChange={(e) => { setPrayerTitle(e.target.value); if (prayerError) setPrayerError(''); }}
                  placeholder={t('prayer.prayerTitle')}
                />
              </div>

              <div className="edit-field">
                <label>{t('prayer.titleTranslation')}</label>
                <input
                  type="text"
                  value={prayerTitleTranslation}
                  onChange={(e) => setPrayerTitleTranslation(e.target.value)}
                  placeholder={t('prayer.titleTranslationPlaceholder')}
                />
              </div>

              <div className="edit-prayer-checkbox">
                <input
                  type="checkbox"
                  id="sameVerseForAll"
                  checked={sameVerseForAll}
                  onChange={(e) => setSameVerseForAll(e.target.checked)}
                />
                <label htmlFor="sameVerseForAll">{t('prayer.sameVerseForAll')}</label>
              </div>

              {sameVerseForAll && (
                <div className="edit-field">
                  <label>{t('prayer.sharedBibleRef')}</label>
                  <BibleRefPicker
                    value={sharedBibleRef}
                    onChange={(formatted) => setSharedBibleRef(formatted)}
                  />
                </div>
              )}

              <div className="edit-prayer-points-header">
                <span className="edit-prayer-points-label">{t('prayer.prayerPoints')}</span>
                <button
                  type="button"
                  className="edit-btn-add-point"
                  onClick={() => setPrayerPoints(prev => [...prev, { subtitle: '', subtitle_translation: '', description: '', description_translation: '', bible_ref: '' }])}
                >
                  + {t('prayer.addPoint')}
                </button>
              </div>

              {prayerPoints.map((point, idx) => (
                <div key={idx} className="edit-prayer-point">
                  <div className="edit-prayer-point-header">
                    <span className="edit-prayer-point-number">#{idx + 1}</span>
                    {prayerPoints.length > 1 && (
                      <button
                        type="button"
                        className="edit-btn-remove-point"
                        onClick={() => setPrayerPoints(prev => prev.filter((_, i) => i !== idx))}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className="edit-field">
                    <label>{t('prayer.pointTitle')}</label>
                    <input
                      type="text"
                      value={point.subtitle}
                      onChange={(e) => setPrayerPoints(prev => prev.map((p, i) => i === idx ? { ...p, subtitle: e.target.value } : p))}
                      placeholder={t('prayer.pointTitle')}
                    />
                  </div>
                  <div className="edit-field">
                    <label>{t('prayer.pointTitleTranslation')}</label>
                    <input
                      type="text"
                      value={point.subtitle_translation}
                      onChange={(e) => setPrayerPoints(prev => prev.map((p, i) => i === idx ? { ...p, subtitle_translation: e.target.value } : p))}
                      placeholder={t('prayer.pointTitleTranslationPlaceholder')}
                    />
                  </div>
                  <div className="edit-field">
                    <label>{t('prayer.description')}</label>
                    <textarea
                      value={point.description}
                      onChange={(e) => setPrayerPoints(prev => prev.map((p, i) => i === idx ? { ...p, description: e.target.value } : p))}
                      placeholder={t('prayer.description')}
                      rows={2}
                      className="edit-textarea"
                    />
                  </div>
                  <div className="edit-field">
                    <label>{t('prayer.descriptionTranslation')}</label>
                    <textarea
                      value={point.description_translation}
                      onChange={(e) => setPrayerPoints(prev => prev.map((p, i) => i === idx ? { ...p, description_translation: e.target.value } : p))}
                      placeholder={t('prayer.descriptionTranslationPlaceholder')}
                      rows={2}
                      className="edit-textarea"
                    />
                  </div>
                  {!sameVerseForAll && (
                    <div className="edit-field">
                      <label>{t('prayer.bibleReference')}</label>
                      <BibleRefPicker
                        value={point.bible_ref}
                        onChange={(formatted) => setPrayerPoints(prev => prev.map((p, i) => i === idx ? { ...p, bible_ref: formatted } : p))}
                      />
                    </div>
                  )}
                </div>
              ))}

              <div className="edit-prayer-actions">
                <button
                  type="button"
                  className="edit-btn-cancel"
                  onClick={() => { resetPrayerForm(); setEditingPrayerItem(null); setListView('setlist'); }}
                >
                  {t('prayer.cancel')}
                </button>
                <button
                  type="button"
                  className="edit-btn-save-prayer"
                  onClick={handleSavePrayerInline}
                >
                  {editingPrayerItem ? t('prayer.save') : t('prayer.addPrayer')}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Save Bar */}
        <div className="edit-save-bar">
          <button
            type="button"
            className="edit-btn-cancel"
            onClick={() => navigate('/services')}
            disabled={saving}
          >
            {t('serviceEdit.cancel')}
          </button>
          <button
            type="submit"
            className="edit-btn-save"
            disabled={saving}
          >
            {saving ? t('serviceEdit.saving') : t('home.createService')}
          </button>
        </div>
      </form>

      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />
    </div>
  );
};

export default ServiceNew;
