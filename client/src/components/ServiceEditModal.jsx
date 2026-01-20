import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import songService from '../services/songService';
import { stripChords } from '../utils/transpose';
import './ServiceEditModal.css';

const ServiceEditModal = ({ service, currentSetlist = [], isOpen, onClose, onSave, onUpdate }) => {
  const { user } = useAuth();
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

  useEffect(() => {
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

      // Fetch available songs for edit mode
      if (isOpen) {
        fetchAvailableSongs();
      }
    } else {
      // Create mode - default to today with next round hour (local time)
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
      const datetimeStr = `${year}-${month}-${day}T${hours}:${minutes}`;

      setFormData({
        title: '',
        datetime: datetimeStr,
        location: '',
        isPublic: true
      });
      setSetlist([]); // Reset setlist for new service

      // Fetch available songs for new service
      if (isOpen) {
        fetchAvailableSongs();
      }
    }
    setError('');
    setSearchQuery('');
    setSelectedIndex(null);
  }, [service, isOpen, currentSetlist]);

  const fetchAvailableSongs = async () => {
    if (!user) return;

    try {
      setLoadingSongs(true);
      const songs = await songService.getAllSongs();  // Gets all public songs + user's private songs
      setAvailableSongs(songs);
    } catch (err) {
      console.error('Error fetching songs:', err);
    } finally {
      setLoadingSongs(false);
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

  const handleRemoveSong = (songId, index) => {
    setSetlist(prev => prev.filter(s => s.id !== songId));
    if (selectedIndex === index) {
      setSelectedIndex(null);
    } else if (selectedIndex !== null && selectedIndex > index) {
      setSelectedIndex(selectedIndex - 1);
    }
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

    // Filter out songs already in setlist
    const available = availableSongs.filter(song => !setlist.some(s => s.id === song.id));

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
      await onSave({
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

      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save service');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content service-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{service ? 'Edit Service' : 'Create Service'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="modal-error">{error}</div>}

            <div className="form-group">
              <label htmlFor="datetime">Date & Time *</label>
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
              <label htmlFor="location">Venue *</label>
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="e.g., Oasis Church"
                required
              />
            </div>

            {formData.datetime && formData.location && (
              <div className="title-preview">
                <strong>Service Title:</strong> {(() => {
                  const dateObj = new Date(formData.datetime);
                  const day = String(dateObj.getDate()).padStart(2, '0');
                  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                  return `${day}/${month} ${formData.location}`;
                })()}
              </div>
            )}

            {/* Setlist Section - Show for both create and edit modes */}
            <div className="setlist-section">
              <h3 className="setlist-section-title">
                {service ? 'Edit Setlist' : 'Add Songs to Setlist'}
              </h3>

              <div className="setlist-mini-builder">
                {/* Current Setlist */}
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
                      <div className="no-songs-selected">No songs selected yet</div>
                    ) : (
                      setlist.map((song, index) => (
                        <div
                          key={song.id}
                          className={`selected-song-item ${draggedIndex === index ? 'dragging' : ''} ${selectedIndex === index ? 'selected' : ''}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragEnd={handleDragEnd}
                          onClick={() => handleSelectSong(index)}
                        >
                          <span className="song-number-mini">{index + 1}</span>
                          <div className="song-info-mini">
                            <div className="song-title-mini">{song.title}</div>
                            <div className="song-meta-mini">{song.authors}</div>
                          </div>
                          <button
                            type="button"
                            className="btn-remove-mini"
                            onClick={(e) => { e.stopPropagation(); handleRemoveSong(song.id, index); }}
                          >
                            ×
                          </button>
                        </div>
                      ))
                    )}
                    </div>
                  </div>
                  {setlist.length > 0 && (
                    <div className="setlist-hint-mini">
                      Tap a song to select, then use arrows to reorder
                    </div>
                  )}
                </div>

                  {/* Available Songs */}
                  <div className="available-songs-mini">
                    <h4>Available Songs</h4>
                    <input
                      type="text"
                      className="song-search-mini"
                      placeholder="Search songs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <div className="available-songs-list">
                      {loadingSongs ? (
                        <div className="loading-songs-mini">Loading...</div>
                      ) : filteredSongs.length === 0 ? (
                        <div className="no-songs-mini">
                          {searchQuery ? 'No songs found' : 'No songs available'}
                        </div>
                      ) : (
                        filteredSongs.map(song => (
                          <div key={song.id} className="available-song-item-mini">
                            <div className="song-info-mini">
                              <div className="song-title-mini">{song.title}</div>
                              <div className="song-meta-mini">{song.authors}</div>
                            </div>
                            <button
                              type="button"
                              className="btn-add-mini"
                              onClick={() => handleAddSong(song)}
                            >
                              +
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          <div className="modal-footer">
            <div className="modal-footer-right">
              <button
                type="button"
                className="btn-cancel"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-save"
                disabled={saving}
              >
                {saving ? 'Saving...' : (service ? 'Update Service' : 'Create Service')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ServiceEditModal;
