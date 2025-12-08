import React, { useState, useEffect } from 'react';
import songService from '../services/songService';
import { stripChords } from '../utils/transpose';
import './SetlistBuilder.css';

const SetlistBuilder = ({ service, currentSetlist, isOpen, onClose, onUpdate }) => {
  const [setlist, setSetlist] = useState([]);
  const [availableSongs, setAvailableSongs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchCurrentY, setTouchCurrentY] = useState(null);
  const [longPressTimer, setLongPressTimer] = useState(null);
  const [isDraggingEnabled, setIsDraggingEnabled] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSetlist(currentSetlist || []);
      fetchAvailableSongs();
    }

    // Cleanup timer on unmount
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
    };
  }, [isOpen, currentSetlist]);

  const fetchAvailableSongs = async () => {
    try {
      setLoading(true);
      const songs = await songService.getAllSongs(1); // workspace_id = 1
      setAvailableSongs(songs);
    } catch (err) {
      console.error('Error fetching songs:', err);
    } finally {
      setLoading(false);
    }
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
    const songItem = elements.find(el => el.classList.contains('setlist-song-item'));

    if (songItem) {
      const allItems = Array.from(document.querySelectorAll('.setlist-song-item'));
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

  const handleSave = () => {
    onUpdate(setlist);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="setlist-overlay" onClick={onClose}>
      <div className="setlist-builder" onClick={(e) => e.stopPropagation()}>
        <div className="setlist-header">
          <h2>Edit Setlist - {service?.title}</h2>
          <button className="setlist-close" onClick={onClose}>×</button>
        </div>

        <div className="setlist-content">
          {/* Current Setlist */}
          <div className="setlist-current">
            <h3>Current Setlist ({setlist.length} songs)</h3>
            <div className="setlist-songs">
              {setlist.length === 0 ? (
                <div className="setlist-empty">
                  No songs in setlist yet. Add songs from the library below.
                </div>
              ) : (
                setlist.map((song, index) => (
                  <div
                    key={song.id}
                    className={`setlist-song-item ${draggedIndex === index ? 'dragging' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                  >
                    <div
                      className="drag-handle"
                      onTouchStart={(e) => handleTouchStart(e, index)}
                      onTouchMove={(e) => handleTouchMove(e, index)}
                      onTouchEnd={handleTouchEnd}
                    >
                      ⋮⋮
                    </div>
                    <div className="song-number">{index + 1}</div>
                    <div className="song-details">
                      <div className="song-title">{song.title}</div>
                      <div className="song-meta">
                        {song.authors} • Key: {song.key}
                      </div>
                    </div>
                    <button
                      className="btn-remove-song"
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
          <div className="setlist-available">
            <h3>Add Songs</h3>
            <input
              type="text"
              className="setlist-search"
              placeholder="Search songs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="available-songs">
              {loading ? (
                <div className="loading-songs">Loading songs...</div>
              ) : filteredSongs.length === 0 ? (
                <div className="no-songs">
                  {searchQuery ? 'No songs found' : 'All songs are in the setlist'}
                </div>
              ) : (
                filteredSongs.map(song => (
                  <div key={song.id} className="available-song-item">
                    <div className="song-details">
                      <div className="song-title">{song.title}</div>
                      <div className="song-meta">
                        {song.authors} • Key: {song.key}
                      </div>
                    </div>
                    <button
                      className="btn-add-song"
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

        <div className="setlist-footer">
          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-save-setlist" onClick={handleSave}>
            Save Setlist
          </button>
        </div>
      </div>
    </div>
  );
};

export default SetlistBuilder;
