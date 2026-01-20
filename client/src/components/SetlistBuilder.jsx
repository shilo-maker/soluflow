import React, { useState, useEffect } from 'react';
import songService from '../services/songService';
import { stripChords } from '../utils/transpose';
import './SetlistBuilder.css';

// Strip Hebrew niqqud (vowel points) from text for search matching
const stripNiqqud = (text) => {
  if (!text) return '';
  // First, normalize to NFD to decompose precomposed Hebrew characters (e.g., U+FB2A שׁ -> ש + combining mark)
  // Then remove Hebrew combining marks (U+0591 to U+05C7)
  return text
    .normalize('NFD')
    .replace(/[\u0591-\u05C7]/g, '')
    .normalize('NFC');
};

const SetlistBuilder = ({ service, currentSetlist, isOpen, onClose, onUpdate }) => {
  const [setlist, setSetlist] = useState([]);
  const [availableSongs, setAvailableSongs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setSetlist(currentSetlist || []);
      fetchAvailableSongs();
    }
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
    // Strip niqqud from query for Hebrew search matching
    const query = stripNiqqud(searchQuery.toLowerCase());

    // Filter out songs already in setlist
    const available = availableSongs.filter(song => !setlist.some(s => s.id === song.id));

    if (!query) return available;

    // Categorize matches by priority
    const titleMatches = [];
    const authorMatches = [];
    const contentMatches = [];

    available.forEach(song => {
      const titleMatch = stripNiqqud(song.title.toLowerCase()).includes(query);
      const authorMatch = song.authors && stripNiqqud(song.authors.toLowerCase()).includes(query);
      // Strip chords and niqqud from content before searching
      const strippedContent = stripNiqqud(stripChords(song.content || '').toLowerCase());
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

  const handleMoveUp = (index) => {
    if (index === 0) return;
    const newSetlist = [...setlist];
    [newSetlist[index - 1], newSetlist[index]] = [newSetlist[index], newSetlist[index - 1]];
    setSetlist(newSetlist);
  };

  const handleMoveDown = (index) => {
    if (index === setlist.length - 1) return;
    const newSetlist = [...setlist];
    [newSetlist[index], newSetlist[index + 1]] = [newSetlist[index + 1], newSetlist[index]];
    setSetlist(newSetlist);
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
                    <div className="reorder-buttons">
                      <button
                        className="btn-reorder btn-move-up"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        aria-label="Move up"
                      >
                        ▲
                      </button>
                      <button
                        className="btn-reorder btn-move-down"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === setlist.length - 1}
                        aria-label="Move down"
                      >
                        ▼
                      </button>
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
