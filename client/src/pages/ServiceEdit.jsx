import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import Toast from '../components/Toast';
import './ServiceEdit.css';

const hasHebrew = (text) => /[\u0590-\u05FF]/.test(text || '');

const ServiceEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { activeWorkspace } = useWorkspace();
  const { theme } = useTheme();
  const currentPreset = GRADIENT_PRESETS[theme.gradientPreset] || GRADIENT_PRESETS.warm;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [service, setService] = useState(null);

  const [formData, setFormData] = useState({
    datetime: '',
    location: '',
    isPublic: true
  });

  const [setlist, setSetlist] = useState([]);
  const [availableSongs, setAvailableSongs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [listView, setListView] = useState('setlist');
  const [isPrayerModalOpen, setIsPrayerModalOpen] = useState(false);
  const [editingPrayerItem, setEditingPrayerItem] = useState(null);

  // Available songs preview state
  const [previewAvailableSong, setPreviewAvailableSong] = useState(null);
  const [previewTransposition, setPreviewTransposition] = useState(0);
  const [previewFontSize, setPreviewFontSize] = useState(14);

  // Setlist song preview state (per-item transposition tracked on the item itself)
  const [setlistPreviewIndex, setSetlistPreviewIndex] = useState(null);
  const [setlistPreviewFontSize, setSetlistPreviewFontSize] = useState(14);

  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [showToast, setShowToast] = useState(false);

  const fetchingRef = useRef(false);
  const originalSongsRef = useRef([]);

  // Load service data
  useEffect(() => {
    if (!id || !user) return;

    const loadService = async () => {
      try {
        setLoading(true);
        const data = await serviceService.getServiceById(id);
        setService(data);

        let datetime = '';
        if (data.date) {
          datetime = data.date;
          datetime += data.time ? 'T' + data.time : 'T12:00';
        }

        setFormData({
          datetime,
          location: data.location || '',
          isPublic: data.isPublic !== undefined ? data.isPublic : true
        });

        const songs = data.songs || [];
        setSetlist(songs);
        originalSongsRef.current = songs;
        setListView(songs.length > 0 ? 'setlist' : 'database');
      } catch (err) {
        console.error('Error loading service:', err);
        setError('Failed to load service');
      } finally {
        setLoading(false);
      }
    };

    loadService();
  }, [id, user]);

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
    setSaved(false);
  };

  const handleAddSong = (song, transposition = 0) => {
    const songToAdd = { ...song };
    if (transposition !== 0) {
      songToAdd._editTransposition = transposition;
    }
    setSetlist(prev => [...prev, songToAdd]);
    setPreviewAvailableSong(null);
    setPreviewTransposition(0);
    setSaved(false);
  };

  const handleRemoveItem = (item, index) => {
    setSetlist(prev => prev.filter((_, i) => i !== index));
    if (selectedIndex === index) setSelectedIndex(null);
    else if (selectedIndex !== null && selectedIndex > index) setSelectedIndex(selectedIndex - 1);
    setSaved(false);
  };

  const handleSavePrayer = (prayerItem) => {
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
  };

  const handleEditPrayer = (item, e) => {
    e.stopPropagation();
    setEditingPrayerItem(item);
    setIsPrayerModalOpen(true);
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
    setSaved(false);
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
    const query = searchQuery.toLowerCase();
    const available = availableSongs.filter(song => !setlist.some(s => s.segment_type !== 'prayer' && s.id === song.id));
    if (!query) return available;

    const titleMatches = [];
    const authorMatches = [];
    const contentMatches = [];

    available.forEach(song => {
      const titleMatch = song.title.toLowerCase().includes(query);
      const authorMatch = song.authors && song.authors.toLowerCase().includes(query);
      const strippedContent = stripChords(song.content || '').toLowerCase();
      const contentMatch = strippedContent.includes(query);

      if (titleMatch) titleMatches.push(song);
      else if (authorMatch) authorMatches.push(song);
      else if (contentMatch) contentMatches.push(song);
    });

    return [...titleMatches, ...authorMatches, ...contentMatches];
  }, [availableSongs, setlist, searchQuery]);


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

      await serviceService.updateService(id, {
        date,
        time,
        location: formData.location,
        isPublic: formData.isPublic,
        title: generatedTitle,
        workspace_id: activeWorkspace?.id
      });

      // Update setlist: diff against original songs
      const currentItems = originalSongsRef.current;
      // Map original songs by serviceSongId for lookup
      const originalByServiceSongId = new Map();
      for (const s of currentItems) {
        if (s.serviceSongId) originalByServiceSongId.set(s.serviceSongId, s);
      }

      // Determine which original service songs are retained in the new setlist
      const retainedServiceSongIds = new Set();
      for (const item of setlist) {
        if (item.serviceSongId && originalByServiceSongId.has(item.serviceSongId)) {
          retainedServiceSongIds.add(item.serviceSongId);
        }
      }

      // Remove items no longer in setlist
      for (const item of currentItems) {
        if (item.serviceSongId && !retainedServiceSongIds.has(item.serviceSongId)) {
          await serviceService.removeSongFromService(id, item.serviceSongId);
        }
      }

      // Add new items and update positions
      for (let i = 0; i < setlist.length; i++) {
        const item = setlist[i];
        if (item.serviceSongId && retainedServiceSongIds.has(item.serviceSongId)) {
          // Existing item — update position and optionally transposition
          const updateData = { position: i };
          if (item.segment_type === 'prayer') {
            updateData.segment_title = item.segment_title || item.title;
            updateData.segment_content = item.segment_content;
          }
          if (item._editTransposition !== undefined) {
            updateData.transposition = item._editTransposition;
          }
          await serviceService.updateServiceSong(id, item.serviceSongId, updateData);
        } else if (item.segment_type === 'prayer') {
          await serviceService.addSongToService(id, {
            song_id: null,
            position: i,
            segment_type: 'prayer',
            segment_title: item.segment_title || item.title,
            segment_content: item.segment_content
          });
        } else {
          // New song from library
          const addData = {
            song_id: item.song_id || item.id,
            position: i,
            segment_type: 'song'
          };
          if (item._editTransposition) {
            addData.transposition = item._editTransposition;
          }
          await serviceService.addSongToService(id, addData);
        }
      }

      // Refresh original songs ref so subsequent saves diff correctly
      const refreshed = await serviceService.getServiceById(id);
      const refreshedSongs = refreshed.songs || [];
      setSetlist(refreshedSongs);
      originalSongsRef.current = refreshedSongs;

      setToastMessage('Service updated successfully!');
      setToastType('success');
      setShowToast(true);
      setSaved(true);
    } catch (err) {
      console.error('Error saving service:', err);
      setError(err.message || 'Failed to save service');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="service-edit-page"><div className="edit-loading">Loading...</div></div>;
  }

  if (!service) {
    return (
      <div className="service-edit-page">
        <div className="edit-loading">Service not found</div>
      </div>
    );
  }

  return (
    <div className="service-edit-page">
      {/* Header */}
      <div
        className="edit-header-gradient"
        style={{ background: `linear-gradient(135deg, ${currentPreset.colors[0]} 0%, ${currentPreset.colors[1]} 25%, ${currentPreset.colors[2]} 50%, ${currentPreset.colors[3]} 75%, ${currentPreset.colors[4]} 100%)` }}
      >
        <div className="edit-header-content">
          <button className="edit-header-back" onClick={() => navigate(`/services/${id}`)}>
            <ArrowLeft size={20} />
          </button>
          <div className="edit-header-info">
            <h1 className="edit-header-title">{t('serviceEdit.editTitle')}</h1>
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
                className="edit-tab edit-tab-prayer"
                onClick={() => { setEditingPrayerItem(null); setIsPrayerModalOpen(true); }}
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
          ) : (
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
          )}
        </div>

        {/* Save Bar */}
        <div className="edit-save-bar">
          <button
            type="button"
            className="edit-btn-cancel"
            onClick={() => navigate(`/services/${id}`)}
            disabled={saving}
          >
            {t('serviceEdit.cancel')}
          </button>
          <button
            type="submit"
            className="edit-btn-save"
            disabled={saving}
          >
            {saving ? t('serviceEdit.saving') : t('serviceEdit.updateButton')}
          </button>
          {saved && (
            <button
              type="button"
              className="edit-btn-go-to-service"
              onClick={() => navigate(`/services/${id}`)}
            >
              {t('serviceEdit.goToService') || 'לאסיפה'}
            </button>
          )}
        </div>
      </form>

      <PrayerItemModal
        isOpen={isPrayerModalOpen}
        onClose={() => { setIsPrayerModalOpen(false); setEditingPrayerItem(null); }}
        onSave={handleSavePrayer}
        existingItem={editingPrayerItem}
      />

      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />
    </div>
  );
};

export default ServiceEdit;
