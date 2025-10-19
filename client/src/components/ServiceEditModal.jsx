import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import songService from '../services/songService';
import './ServiceEditModal.css';

const ServiceEditModal = ({ service, isOpen, onClose, onSave, onEditSetlist }) => {
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
      setSetlist([]); // Reset setlist for edit mode
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
  }, [service, isOpen]);

  const fetchAvailableSongs = async () => {
    if (!user) return;

    try {
      setLoadingSongs(true);
      const songs = await songService.getAllSongs(user.workspace_id);
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
      await onSave({
        ...formData,
        title: generatedTitle
      }, service ? null : setlist); // Pass setlist only for new services
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save service');
    } finally {
      setSaving(false);
    }
  };

  const handleEditSetlistClick = () => {
    if (onEditSetlist) {
      onEditSetlist();
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

            {/* Setlist Section - Only show when creating new service */}
            {!service && (
              <div className="setlist-section">
                <h3 className="setlist-section-title">Add Songs to Setlist (Optional)</h3>

                <div className="setlist-mini-builder">
                  {/* Current Setlist */}
                  <div className="setlist-current-mini">
                    <h4>Selected Songs ({setlist.length})</h4>
                    <div className="selected-songs-list">
                      {setlist.length === 0 ? (
                        <div className="no-songs-selected">No songs selected yet</div>
                      ) : (
                        setlist.map((song, index) => (
                          <div key={song.id} className="selected-song-item">
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
                        filteredSongs.slice(0, 10).map(song => (
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
            )}
          </div>

          <div className="modal-footer">
            {service && onEditSetlist && (
              <button
                type="button"
                className="btn-edit-setlist-modal"
                onClick={handleEditSetlistClick}
                disabled={saving}
              >
                Edit Setlist
              </button>
            )}
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
