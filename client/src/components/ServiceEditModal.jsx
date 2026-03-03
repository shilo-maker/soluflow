import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import songService from '../services/songService';
import { stripChords } from '../utils/transpose';
import PrayerItemModal from './PrayerItemModal';
import './ServiceEditModal.css';

const ServiceEditModal = ({ service, currentSetlist = [], isOpen, onClose, onSave, onUpdate, prefill }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    title: '',
    datetime: '',
    location: '',
    isPublic: true
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [setlist, setSetlist] = useState([]);
  const [availableSongs, setAvailableSongs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [listView, setListView] = useState('database');
  const [previewSongId, setPreviewSongId] = useState(null);
  const [isPrayerModalOpen, setIsPrayerModalOpen] = useState(false);
  const [editingPrayerItem, setEditingPrayerItem] = useState(null);
  const fetchingRef = useRef(false);
  const prevIsOpenRef = useRef(false);

  useEffect(() => {
    // Only run when isOpen transitions to true (not on every dep change)
    const justOpened = isOpen && !prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;
    if (!isOpen) return;

    if (service) {
      // Edit mode - populate with existing service data
      // Combine date and time into datetime-local format
      let datetime = '';
      if (service.date) {
        datetime = service.date;
        if (service.time) {
          datetime += 'T' + service.time;
        } else {
          datetime += 'T12:00';
        }
      }
      setFormData({
        title: service.title || '',
        datetime: datetime,
        location: service.location || '',
        isPublic: service.isPublic !== undefined ? service.isPublic : true
      });
      // Load current setlist for edit mode
      setSetlist(currentSetlist || []);
      // Default to setlist tab if editing with existing songs
      setListView((currentSetlist && currentSetlist.length > 0) ? 'setlist' : 'database');
    } else {
      // Create mode - use prefill values if available, otherwise default to next round hour
      let datetimeStr;
      let locationStr = '';

      if (prefill) {
        datetimeStr = prefill.datetime || '';
        locationStr = prefill.location || '';
      } else {
        const nextHour = new Date();
        nextHour.setHours(nextHour.getHours() + 1);
        nextHour.setMinutes(0);
        nextHour.setSeconds(0);
        // Format for datetime-local: YYYY-MM-DDTHH:MM (local time)
        const year = nextHour.getFullYear();
        const month = String(nextHour.getMonth() + 1).padStart(2, '0');
        const day = String(nextHour.getDate()).padStart(2, '0');
        const hours = String(nextHour.getHours()).padStart(2, '0');
        const minutes = String(nextHour.getMinutes()).padStart(2, '0');
        datetimeStr = `${year}-${month}-${day}T${hours}:${minutes}`;
      }

      setFormData({
        title: '',
        datetime: datetimeStr,
        location: locationStr,
        isPublic: true
      });
      setSetlist([]); // Reset setlist for new service
      setListView('database');
    }
    setError('');
    setSearchQuery('');
    setSelectedIndex(null);
    setIsPrayerModalOpen(false);
    setEditingPrayerItem(null);

    // Only fetch songs when the modal first opens
    if (justOpened) {
      fetchAvailableSongs();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const fetchAvailableSongs = async () => {
    if (!user || fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      setLoadingSongs(true);
      const songs = await songService.getAllSongs();  // Gets all public songs + user's private songs
      setAvailableSongs(songs);
    } catch (err) {
      console.error('Error fetching songs:', err);
    } finally {
      setLoadingSongs(false);
      fetchingRef.current = false;
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleAddSong = (song) => {
    setSetlist(prev => [...prev, song]);
  };

  const handleRemoveItem = (item, index) => {
    setSetlist(prev => prev.filter((_, i) => i !== index));
    if (selectedIndex === index) {
      setSelectedIndex(null);
    } else if (selectedIndex !== null && selectedIndex > index) {
      setSelectedIndex(selectedIndex - 1);
    }
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

  const filteredSongs = React.useMemo(() => {
    const query = searchQuery.toLowerCase();

    // Filter out songs already in setlist (skip prayer items which have no matching song id)
    const available = availableSongs.filter(song => !setlist.some(s => s.segment_type !== 'prayer' && s.id === song.id));

    if (!query) return available;

    // Categorize matches by priority
    const titleMatches = [];
    const authorMatches = [];
    const contentMatches = [];

    available.forEach(song => {
      const titleMatch = song.title.toLowerCase().includes(query);
      const authorMatch = song.authors && song.authors.toLowerCase().includes(query);
      // Strip chords from content before searching (chords like [Am] split words)
      const strippedContent = stripChords(song.content || '').toLowerCase();
      const contentMatch = strippedContent.includes(query);

      if (titleMatch) {
        titleMatches.push(song);
      } else if (authorMatch) {
        authorMatches.push(song);
      } else if (contentMatch) {
        contentMatches.push(song);
      }
    });

    // Return with priority: title > author > content
    return [...titleMatches, ...authorMatches, ...contentMatches];
  }, [availableSongs, setlist, searchQuery]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.datetime) {
      setError('Date and time is required');
      return;
    }
    if (!formData.location.trim()) {
      setError('Location/Venue is required');
      return;
    }

    // Parse datetime into separate date and time
    const [date, time] = formData.datetime.split('T');

    // Auto-generate title from date and location
    const dateObj = new Date(formData.datetime);
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const generatedTitle = `${day}/${month} ${formData.location}`;

    try {
      setSaving(true);

      // Save service metadata
      const result = await onSave({
        date,
        time,
        location: formData.location,
        isPublic: formData.isPublic,
        title: generatedTitle
      }, service ? null : setlist); // Pass setlist only for new services

      // If editing existing service, also update setlist
      if (service && onUpdate) {
        await onUpdate(setlist);
      }

      // Allow callers to prevent auto-close (e.g. CreateForSoluPlan shows a success screen)
      if (!result?.skipClose) {
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to save service');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmClose = () => {
    if (window.confirm(t('serviceEdit.confirmClose'))) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleConfirmClose}>
      <div className="modal-content service-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{service ? t('serviceEdit.editTitle') : t('serviceEdit.createTitle')}</h2>
          <button className="modal-close" onClick={handleConfirmClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="modal-error">{error}</div>}

            <div className="form-group">
              <label htmlFor="datetime">{t('serviceEdit.dateTime')} *</label>
              <input
                type="datetime-local"
                id="datetime"
                name="datetime"
                value={formData.datetime}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="location">{t('serviceEdit.venue')} *</label>
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

            {formData.datetime && formData.location && (
              <div className="title-preview">
                <strong>{t('serviceEdit.serviceTitle')}:</strong> {(() => {
                  const dateObj = new Date(formData.datetime);
                  const day = String(dateObj.getDate()).padStart(2, '0');
                  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                  return `${day}/${month} ${formData.location}`;
                })()}
              </div>
            )}

            {/* Setlist Section */}
            <div className="setlist-section">
              <div className="setlist-toggle-bar">
                <button
                  type="button"
                  className={`setlist-toggle-btn ${listView === 'database' ? 'active' : ''}`}
                  onClick={() => setListView('database')}
                >
                  {t('serviceEdit.availableSongs')}
                </button>
                <button
                  type="button"
                  className={`setlist-toggle-btn ${listView === 'setlist' ? 'active' : ''}`}
                  onClick={() => setListView('setlist')}
                >
                  {t('serviceEdit.currentSetlist')}{setlist.length > 0 ? ` (${setlist.length})` : ''}
                </button>
                <button
                  type="button"
                  className="setlist-toggle-btn setlist-add-prayer-btn"
                  onClick={() => { setEditingPrayerItem(null); setIsPrayerModalOpen(true); }}
                >
                  + {t('prayer.addPrayer')}
                </button>
              </div>

              <div className="setlist-mini-builder">
                {listView === 'database' ? (
                  <div className="available-songs-mini">
                    <input
                      type="text"
                      className="song-search-mini"
                      placeholder={t('serviceEdit.searchSongs')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <div className="available-songs-list">
                      {loadingSongs ? (
                        <div className="loading-songs-mini">{t('serviceEdit.loading')}</div>
                      ) : filteredSongs.length === 0 ? (
                        <div className="no-songs-mini">
                          {searchQuery ? t('serviceEdit.noSongsFound') : t('serviceEdit.noSongsAvailable')}
                        </div>
                      ) : (
                        filteredSongs.map(song => (
                          <div key={song.id} className={`available-song-item-mini ${previewSongId === song.id ? 'expanded' : ''}`}>
                            <div className="song-row-mini" onClick={() => setPreviewSongId(previewSongId === song.id ? null : song.id)}>
                              <div className="song-info-mini">
                                <div className="song-title-mini">{song.title}</div>
                                <div className="song-meta-mini">{song.authors}</div>
                              </div>
                              <button
                                type="button"
                                className="btn-add-mini"
                                onClick={(e) => { e.stopPropagation(); handleAddSong(song); }}
                              >
                                +
                              </button>
                            </div>
                            {previewSongId === song.id && (
                              <div className="song-preview-content">
                                {stripChords(song.content || '').replace(/\{[^}]*\}/g, '').replace(/^\s*\n/gm, '\n').trim()}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="setlist-current-mini">
                    <div className="setlist-with-controls-mini">
                      <div className="reorder-controls-side-mini">
                        <button
                          type="button"
                          className="btn-reorder-main-mini"
                          onClick={handleMoveUp}
                          disabled={selectedIndex === null || selectedIndex === 0}
                          aria-label="Move up"
                          title="Move selected song up"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="btn-reorder-main-mini"
                          onClick={handleMoveDown}
                          disabled={selectedIndex === null || selectedIndex === setlist.length - 1}
                          aria-label="Move down"
                          title="Move selected song down"
                        >
                          ▼
                        </button>
                      </div>
                      <div className="selected-songs-list">
                        {setlist.length === 0 ? (
                          <div className="no-songs-selected">{t('serviceEdit.noSongsSelected')}</div>
                        ) : (
                          setlist.map((item, index) => (
                            <div
                              key={item.segment_type === 'prayer' ? `prayer-${item.id || index}-${index}` : `song-${item.id}-${index}`}
                              className={`selected-song-item ${item.segment_type === 'prayer' ? 'prayer-item' : ''} ${draggedIndex === index ? 'dragging' : ''} ${selectedIndex === index ? 'selected' : ''}`}
                              draggable
                              onDragStart={(e) => handleDragStart(e, index)}
                              onDragOver={(e) => handleDragOver(e, index)}
                              onDragEnd={handleDragEnd}
                            >
                              <div className="song-row-mini" onClick={() => { handleSelectSong(index); setPreviewSongId(previewSongId === item.id ? null : item.id); }}>
                                <span className={`song-number-mini ${item.segment_type === 'prayer' ? 'prayer-number' : ''}`}>{index + 1}</span>
                                <div className="song-info-mini">
                                  <div className="song-title-mini">
                                    {item.segment_type === 'prayer' && <span className="prayer-icon">🙏 </span>}
                                    {item.title || item.segment_title}
                                  </div>
                                  <div className="song-meta-mini">
                                    {item.segment_type === 'prayer' ? t('prayer.prayer') : item.authors}
                                  </div>
                                </div>
                                {item.segment_type === 'prayer' && (
                                  <button
                                    type="button"
                                    className="btn-edit-prayer-mini"
                                    onClick={(e) => handleEditPrayer(item, e)}
                                    title={t('prayer.editPrayer')}
                                  >
                                    ✎
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="btn-remove-mini"
                                  onClick={(e) => { e.stopPropagation(); handleRemoveItem(item, index); }}
                                >
                                  ×
                                </button>
                              </div>
                              {item.segment_type !== 'prayer' && previewSongId === item.id && (
                                <div className="song-preview-content">
                                  {stripChords(item.content || '').replace(/\{[^}]*\}/g, '').replace(/^\s*\n/gm, '\n').trim()}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    {setlist.length > 0 && (
                      <div className="setlist-hint-mini">
                        {t('serviceEdit.reorderHint')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <div className="modal-footer-right">
              <button
                type="button"
                className="btn-cancel"
                onClick={handleConfirmClose}
                disabled={saving}
              >
                {t('serviceEdit.cancel')}
              </button>
              <button
                type="submit"
                className="btn-save"
                disabled={saving}
              >
                {saving ? t('serviceEdit.saving') : (service ? t('serviceEdit.updateButton') : t('serviceEdit.createButton'))}
              </button>
            </div>
          </div>
        </form>

        <PrayerItemModal
          isOpen={isPrayerModalOpen}
          onClose={() => { setIsPrayerModalOpen(false); setEditingPrayerItem(null); }}
          onSave={handleSavePrayer}
          existingItem={editingPrayerItem}
        />
      </div>
    </div>
  );
};

export default ServiceEditModal;
