import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import songService from '../services/songService';
import './ServiceEditModal.css';

const ServiceEditModal = ({ service, currentSetlist = [], isOpen, onClose, onSave, onUpdate }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    time: '',
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
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchCurrentY, setTouchCurrentY] = useState(null);
  const [longPressTimer, setLongPressTimer] = useState(null);
  const [isDraggingEnabled, setIsDraggingEnabled] = useState(false);

  useEffect(() => {
    if (service) {
      // Edit mode - populate with existing service data
      setFormData({
        title: service.title || '',
        date: service.date || '',
        time: service.time || '',
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
      // Create mode - default date to today and time to next round hour
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD

      // Get next round hour
      const nextHour = new Date();
      nextHour.setHours(nextHour.getHours() + 1);
      nextHour.setMinutes(0);
      nextHour.setSeconds(0);
      const timeStr = nextHour.toTimeString().slice(0, 5); // Format: HH:MM

      setFormData({
        title: '',
        date: todayStr,
        time: timeStr,
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

    // Cleanup timer on unmount
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
    };
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

  const handleRemoveSong = (songId) => {
    setSetlist(prev => prev.filter(s => s.id !== songId));
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

  // Touch handlers for mobile support with long press
  const handleTouchStart = (e, index) => {
    const touch = e.touches[0];
    setTouchStartY(touch.clientY);

    // Start long press timer (500ms)
    const timer = setTimeout(() => {
      setIsDraggingEnabled(true);
      setDraggedIndex(index);
      // Optional: Add haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500);

    setLongPressTimer(timer);
  };

  const handleTouchMove = (e, index) => {
    const touch = e.touches[0];

    // If dragging hasn't been enabled yet, check if user is scrolling
    if (!isDraggingEnabled) {
      // If user moved more than 10px, cancel the long press timer (they're scrolling)
      if (touchStartY && Math.abs(touch.clientY - touchStartY) > 10) {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          setLongPressTimer(null);
        }
      }
      return; // Allow normal scrolling
    }

    // Only if dragging is enabled (after long press)
    if (draggedIndex === null) return;

    e.preventDefault(); // Prevent scrolling while dragging
    setTouchCurrentY(touch.clientY);

    // Find which item the touch is currently over
    const elements = document.elementsFromPoint(touch.clientX, touch.clientY);
    const songItem = elements.find(el => el.classList.contains('selected-song-item'));

    if (songItem) {
      const allItems = Array.from(document.querySelectorAll('.selected-song-item'));
      const hoverIndex = allItems.indexOf(songItem);

      if (hoverIndex !== -1 && hoverIndex !== draggedIndex) {
        const newSetlist = [...setlist];
        const draggedItem = newSetlist[draggedIndex];
        newSetlist.splice(draggedIndex, 1);
        newSetlist.splice(hoverIndex, 0, draggedItem);

        setSetlist(newSetlist);
        setDraggedIndex(hoverIndex);
      }
    }
  };

  const handleTouchEnd = () => {
    // Clear long press timer if it's still running
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    setDraggedIndex(null);
    setTouchStartY(null);
    setTouchCurrentY(null);
    setIsDraggingEnabled(false);
  };

  const filteredSongs = availableSongs.filter(song => {
    const inSetlist = setlist.some(s => s.id === song.id);
    if (inSetlist) return false;

    if (!searchQuery) return true;
    return song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (song.authors && song.authors.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.date) {
      setError('Date is required');
      return;
    }
    if (!formData.location.trim()) {
      setError('Location/Venue is required');
      return;
    }

    // Auto-generate title from date and location
    const dateObj = new Date(formData.date);
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const generatedTitle = `${day}/${month} ${formData.location}`;

    try {
      setSaving(true);

      // Save service metadata
      await onSave({
        ...formData,
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

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="date">Date *</label>
                <input
                  type="date"
                  id="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="time">Time</label>
                <input
                  type="time"
                  id="time"
                  name="time"
                  value={formData.time}
                  onChange={handleChange}
                />
              </div>
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

            {formData.date && formData.location && (
              <div className="title-preview">
                <strong>Service Title:</strong> {(() => {
                  const dateObj = new Date(formData.date);
                  const day = String(dateObj.getDate()).padStart(2, '0');
                  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                  return `${day}/${month} ${formData.location}`;
                })()}
              </div>
            )}

            <div className="form-group-checkbox">
              <label>
                <input
                  type="checkbox"
                  name="isPublic"
                  checked={formData.isPublic}
                  onChange={handleChange}
                />
                Make service public (accessible via share code)
              </label>
            </div>

            {/* Setlist Section - Show for both create and edit modes */}
            <div className="setlist-section">
              <h3 className="setlist-section-title">
                {service ? 'Edit Setlist' : 'Add Songs to Setlist (Optional)'}
              </h3>

              <div className="setlist-mini-builder">
                {/* Current Setlist */}
                <div className="setlist-current-mini">
                  <h4>Selected Songs ({setlist.length})</h4>
                  <div className="selected-songs-list">
                    {setlist.length === 0 ? (
                      <div className="no-songs-selected">No songs selected yet</div>
                    ) : (
                      setlist.map((song, index) => (
                        <div
                          key={song.id}
                          className={`selected-song-item ${draggedIndex === index ? 'dragging' : ''}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragEnd={handleDragEnd}
                        >
                          <span
                            className="drag-handle-mini"
                            onTouchStart={(e) => handleTouchStart(e, index)}
                            onTouchMove={(e) => handleTouchMove(e, index)}
                            onTouchEnd={handleTouchEnd}
                          >
                            ⋮⋮
                          </span>
                          <span className="song-number-mini">{index + 1}</span>
                          <div className="song-info-mini">
                            <div className="song-title-mini">{song.title}</div>
                            <div className="song-meta-mini">{song.authors}</div>
                          </div>
                          <button
                            type="button"
                            className="btn-remove-mini"
                            onClick={() => handleRemoveSong(song.id)}
                          >
                            ×
                          </button>
                        </div>
                      ))
                    )}
                  </div>
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
