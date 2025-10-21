import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import songService from '../services/songService';
import ChordProDisplay from '../components/ChordProDisplay';
import { getTransposeDisplay, transposeChord } from '../utils/transpose';
import './GuestLanding.css';

const GuestLanding = () => {
  const navigate = useNavigate();
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSong, setSelectedSong] = useState(null);
  const [fontSize, setFontSize] = useState(14);
  const [transposition, setTransposition] = useState(0);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [serviceCode, setServiceCode] = useState('');

  // Fetch all songs on component mount (guest-accessible, no workspace restriction)
  useEffect(() => {
    const fetchSongs = async () => {
      try {
        setLoading(true);
        const data = await songService.getAllSongs(); // No workspaceId = fetch all songs
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
  }, []);

  const filteredSongs = songs.filter(song =>
    song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (song.authors && song.authors.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Show only 3 results when a song is selected
  const displayedSongs = selectedSong ? filteredSongs.slice(0, 3) : filteredSongs;

  const handleSongClick = (song) => {
    setSelectedSong(song);
    setFontSize(14);
    setTransposition(0);
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

  const handleOpenFullView = () => {
    navigate(`/song/${selectedSong.id}`);
  };

  const handleJoinService = () => {
    if (serviceCode.trim()) {
      navigate(`/service/code/${serviceCode.trim()}`);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleJoinService();
    }
  };

  // Detect if song content has Hebrew characters
  const hasHebrew = (text) => /[\u0590-\u05FF]/.test(text);

  return (
    <div className="guest-landing-page">
      {/* App Header */}
      <div className="guest-header">
        <h1 className="app-name">SoluFlow</h1>
        <p className="app-subtitle">Worship Service Planning & Chord Sheets</p>
      </div>

      {/* Join Service Button */}
      <div className="join-service-section">
        <button className="btn-join-service" onClick={() => setShowJoinModal(true)}>
          Join Service
        </button>
        <div className="auth-links-inline">
          <button className="btn-auth-link" onClick={() => navigate('/login')}>
            Login
          </button>
          <span className="separator">|</span>
          <button className="btn-auth-link" onClick={() => navigate('/register')}>
            Register
          </button>
        </div>
      </div>

      {/* Search Section */}
      <div className="search-section">
        <input
          type="text"
          className="search-input-library"
          placeholder="Search Songs..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setSelectedSong(null);
          }}
        />
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
                  {transposeChord(selectedSong.key, transposition)}
                  {transposition !== 0 && ` (${transposition > 0 ? '+' : ''}${transposition})`}
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
              className="btn-close-song"
              onClick={() => setSelectedSong(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Join Service Modal */}
      {showJoinModal && (
        <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Join Service</h2>
            <p className="modal-description">Enter the 4-character service code to join</p>
            <input
              type="text"
              className="code-input"
              placeholder="Enter Code"
              value={serviceCode}
              onChange={(e) => setServiceCode(e.target.value.toUpperCase())}
              onKeyPress={handleKeyPress}
              maxLength="4"
              autoFocus
            />
            <div className="modal-actions">
              <button className="btn-modal-cancel" onClick={() => setShowJoinModal(false)}>
                Cancel
              </button>
              <button className="btn-modal-join" onClick={handleJoinService}>
                Join
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuestLanding;
