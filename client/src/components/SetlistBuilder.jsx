import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import songService from '../services/songService';
import { stripChords } from '../utils/transpose';
import PrayerItemModal from './PrayerItemModal';
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
  const { t } = useLanguage();
  const [setlist, setSetlist] = useState([]);
  const [availableSongs, setAvailableSongs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [isPrayerModalOpen, setIsPrayerModalOpen] = useState(false);
  const [editingPrayerItem, setEditingPrayerItem] = useState(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setSetlist(currentSetlist || []);
      setSelectedIndex(null);
      fetchAvailableSongs();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const fetchAvailableSongs = async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      setLoading(true);
      // Guest editors (canEdit via edit token) see all songs; normal users scope to workspace
      const wsId = service?.can_edit ? null : (service?.workspace_id || service?.workspaceId || 1);
      const songs = await songService.getAllSongs(wsId);
      setAvailableSongs(songs);
    } catch (err) {
      console.error('Error fetching songs:', err);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  const filteredSongs = React.useMemo(() => {
    // Strip niqqud from query for Hebrew search matching
    const query = stripNiqqud(searchQuery.toLowerCase());

    // Filter out songs already in setlist (skip prayer items which have no song_id)
    const available = availableSongs.filter(song => !setlist.some(s => s.segment_type !== 'prayer' && (s.song_id || s.id) === song.id));

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
            <div className="setlist-current-header">
              <h3>Current Setlist ({setlist.length} items)</h3>
              <button
                className="btn-add-prayer-setlist"
                onClick={() => { setEditingPrayerItem(null); setIsPrayerModalOpen(true); }}
              >
                + {t('prayer.addPrayer')}
              </button>
            </div>
            <div className="setlist-with-controls">
              <div className="reorder-controls-side">
                <button
                  className="btn-reorder-main"
                  onClick={handleMoveUp}
                  disabled={selectedIndex === null || selectedIndex === 0}
                  aria-label="Move up"
                  title="Move selected item up"
                >
                  ▲
                </button>
                <button
                  className="btn-reorder-main"
                  onClick={handleMoveDown}
                  disabled={selectedIndex === null || selectedIndex === setlist.length - 1}
                  aria-label="Move down"
                  title="Move selected item down"
                >
                  ▼
                </button>
              </div>
              <div className="setlist-songs">
              {setlist.length === 0 ? (
                <div className="setlist-empty">
                  No songs in setlist yet. Add songs from the library below.
                </div>
              ) : (
                setlist.map((item, index) => (
                  <div
                    key={item.segment_type === 'prayer' ? `prayer-${item.id || index}-${index}` : `song-${item.id}-${index}`}
                    className={`setlist-song-item ${item.segment_type === 'prayer' ? 'prayer-item' : ''} ${draggedIndex === index ? 'dragging' : ''} ${selectedIndex === index ? 'selected' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    onClick={() => handleSelectSong(index)}
                  >
                    <div className={`song-number ${item.segment_type === 'prayer' ? 'prayer-number' : ''}`}>{index + 1}</div>
                    <div className="song-details">
                      <div className="song-title">
                        {item.segment_type === 'prayer' && <span className="prayer-icon">🙏 </span>}
                        {item.title || item.segment_title}
                      </div>
                      <div className="song-meta">
                        {item.segment_type === 'prayer' ? t('prayer.prayer') : `${item.authors} • Key: ${item.key}`}
                      </div>
                    </div>
                    {item.segment_type === 'prayer' && (
                      <button
                        className="btn-edit-prayer"
                        onClick={(e) => handleEditPrayer(item, e)}
                        title={t('prayer.editPrayer')}
                      >
                        ✎
                      </button>
                    )}
                    <button
                      className="btn-remove-song"
                      onClick={(e) => { e.stopPropagation(); handleRemoveItem(item, index); }}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
              </div>
            </div>
            {setlist.length > 0 && (
              <div className="setlist-hint">
                Tap an item to select, then use arrows to reorder
              </div>
            )}
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

export default SetlistBuilder;
