import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import songService from '../services/songService';
import ChordProDisplay from '../components/ChordProDisplay';
import SongEditModal from '../components/SongEditModal';
import Toast from '../components/Toast';
import { getTransposeDisplay } from '../utils/transpose';
import './Library.css';

const Library = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSong, setSelectedSong] = useState(null);
  const [fontSize, setFontSize] = useState(14);
  const [transposition, setTransposition] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSong, setModalSong] = useState(null); // null = create mode, song object = edit mode
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Fetch songs on component mount
  useEffect(() => {
    const fetchSongs = async () => {
      if (!user) return;

      try {
        setLoading(true);
        const data = await songService.getAllSongs(user.workspace_id);
        setSongs(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching songs:', err);
        setError('Failed to load songs. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchSongs();
  }, [user]);

  const filteredSongs = songs.filter(song =>
    song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (song.authors && song.authors.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Show only 3 results when a song is selected
  const displayedSongs = selectedSong ? filteredSongs.slice(0, 3) : filteredSongs;

  const handleSongClick = (song) => {
    setSelectedSong(song);
    setFontSize(14); // Reset font size when selecting new song
    setTransposition(0); // Reset transposition when selecting new song
  };

  const zoomIn = () => {
    setFontSize(prev => Math.min(prev + 2, 24));
  };

  const zoomOut = () => {
    setFontSize(prev => Math.max(prev - 2, 10));
  };

  const transposeUp = () => {
    setTransposition(prev => Math.min(prev + 1, 11));
  };

  const transposeDown = () => {
    setTransposition(prev => Math.max(prev - 1, -11));
  };

  const resetTransposition = () => {
    setTransposition(0);
  };

  const handleAddSong = () => {
    setModalSong(null); // null indicates create mode
    setIsModalOpen(true);
  };

  const handleEditSong = () => {
    setModalSong(selectedSong);
    setIsModalOpen(true);
  };

  const handleSaveSong = async (formData) => {
    try {
      // Map field names to match backend expectations
      const songData = {
        title: formData.title,
        authors: formData.authors,
        key: formData.key,
        bpm: formData.bpm ? parseInt(formData.bpm) : null,
        time_signature: formData.timeSig,
        content: formData.content,
        workspace_id: user.workspace_id
      };

      if (modalSong) {
        // Edit mode - update existing song
        const updatedSong = await songService.updateSong(modalSong.id, songData);

        // Update the songs list with the edited song
        setSongs(prev => prev.map(song =>
          song.id === updatedSong.id ? updatedSong : song
        ));

        // Update the selected song if it's currently displayed
        if (selectedSong?.id === updatedSong.id) {
          setSelectedSong(updatedSong);
        }

        // Show success toast
        setToastMessage('Song updated successfully!');
        setShowToast(true);
      } else {
        // Create mode - add new song
        const newSong = await songService.createSong(songData);

        // Add the new song to the list
        setSongs(prev => [...prev, newSong].sort((a, b) =>
          a.title.localeCompare(b.title)
        ));

        // Show success toast
        setToastMessage('Song created successfully!');
        setShowToast(true);
      }

      setIsModalOpen(false);
      setModalSong(null);
    } catch (err) {
      console.error('Error saving song:', err);
      throw new Error(err.error || 'Failed to save song');
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalSong(null);
  };

  const handleCloseToast = () => {
    setShowToast(false);
  };

  const handleOpenFullView = () => {
    navigate(`/song/${selectedSong.id}`);
  };

  // Detect if song content has Hebrew characters
  const hasHebrew = (text) => /[\u0590-\u05FF]/.test(text);

  return (
    <div className="library-page">
      <div className="search-section">
        <input
          type="text"
          className="search-input-library"
          placeholder="Search Songs..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setSelectedSong(null); // Clear selection when searching
          }}
        />
        <button className="btn-add" onClick={handleAddSong}>ADD</button>
      </div>

      {loading && (
        <div className="loading-state">Loading songs...</div>
      )}

      {error && (
        <div className="error-state">{error}</div>
      )}

      {!loading && !error && (
      <div className="songs-list">
        {displayedSongs.map(song => (
          <div
            key={song.id}
            className={`song-card ${selectedSong?.id === song.id ? 'selected' : ''}`}
            onClick={() => handleSongClick(song)}
          >
            <div className="song-card-content">
              <div className="song-card-left">
                <h3 className="song-card-title">{song.title}</h3>
                <p className="song-card-authors">{song.authors}</p>
              </div>
              <div className="song-card-right">
                <span className="song-key">Key: {song.key}</span>
              </div>
            </div>
          </div>
        ))}

        {filteredSongs.length === 0 && (
          <div className="empty-state">
            No songs found matching "{searchQuery}"
          </div>
        )}
      </div>
      )}

      {/* Display selected song chord sheet */}
      {selectedSong && (
        <div className="song-display-inline">
          <div className="song-header-inline">
            <div className="song-info-inline">
              <h2 className="song-title-inline">{selectedSong.title}</h2>
              <p className="song-authors-inline">{selectedSong.authors}</p>
            </div>
            <div className="song-meta-inline">
              <div className="transpose-controls-inline">
                <button className="btn-transpose-inline" onClick={transposeDown}>-</button>
                <span
                  className="transpose-display-inline"
                  onClick={resetTransposition}
                  title="Click to reset"
                >
                  {getTransposeDisplay(transposition)}
                </span>
                <button className="btn-transpose-inline" onClick={transposeUp}>+</button>
              </div>
              <div className="zoom-controls">
                <button className="btn-zoom" onClick={zoomOut}>A-</button>
                <button className="btn-zoom" onClick={zoomIn}>A+</button>
              </div>
              <span className="key-info-inline">Key: {selectedSong.key}</span>
              {selectedSong.bpm && <span className="bpm-info-inline">BPM: {selectedSong.bpm}</span>}
            </div>
          </div>

          <div
            className="song-content-inline clickable"
            onClick={handleOpenFullView}
            title="Click to open in full view"
          >
            <ChordProDisplay
              content={selectedSong.content}
              dir={hasHebrew(selectedSong.content) ? 'rtl' : 'ltr'}
              fontSize={fontSize}
              transposition={transposition}
            />
          </div>

          <div className="song-actions-inline">
            <button
              className="btn-edit-song"
              onClick={handleEditSong}
            >
              Edit Song
            </button>
            <button
              className="btn-close-song"
              onClick={() => setSelectedSong(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Song Modal (Create/Edit) */}
      <SongEditModal
        song={modalSong}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveSong}
      />

      {/* Success Toast */}
      <Toast
        message={toastMessage}
        type="success"
        isVisible={showToast}
        onClose={handleCloseToast}
      />
    </div>
  );
};

export default Library;
