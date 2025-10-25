import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import songService from '../services/songService';
import ChordProDisplay from '../components/ChordProDisplay';
import { getTransposeDisplay, transposeChord, stripChords } from '../utils/transpose';
import './GuestLanding.css';

const GuestLanding = () => {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSong, setSelectedSong] = useState(null);
  const [fontSize, setFontSize] = useState(14);
  const [transposition, setTransposition] = useState(0);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [serviceCode, setServiceCode] = useState('');
  const songDisplayRef = useRef(null);

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

  // Close expanded song when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectedSong && songDisplayRef.current && !songDisplayRef.current.contains(event.target)) {
        // Check if click is not on a song card
        const clickedSongCard = event.target.closest('.song-card');
        if (!clickedSongCard) {
          setSelectedSong(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedSong]);

  const filteredSongs = songs.filter(song => {
    const query = searchQuery.toLowerCase();
    const titleMatch = song.title.toLowerCase().includes(query);
    const authorsMatch = song.authors && song.authors.toLowerCase().includes(query);

    // Search in lyrics content (strip chords first)
    const strippedContent = stripChords(song.content || '').toLowerCase();
    const contentMatch = strippedContent.includes(query);

    return titleMatch || authorsMatch || contentMatch;
  }).map(song => {
    // Assign priority based on what matched (lower number = higher priority)
    const query = searchQuery.toLowerCase();
    const titleMatch = song.title.toLowerCase().includes(query);
    const strippedContent = stripChords(song.content || '').toLowerCase();
    const contentMatch = strippedContent.includes(query);
    const authorsMatch = song.authors && song.authors.toLowerCase().includes(query);

    let priority;
    if (titleMatch) {
      priority = 1;
    } else if (contentMatch) {
      priority = 2;
    } else if (authorsMatch) {
      priority = 3;
    } else {
      priority = 4;
    }

    return { ...song, searchPriority: priority };
  }).sort((a, b) => a.searchPriority - b.searchPriority);

  const displayedSongs = filteredSongs;

  const handleSongClick = (song) => {
    // Toggle: if clicking the same song, close it; otherwise open the new song
    if (selectedSong?.id === song.id) {
      setSelectedSong(null);
    } else {
      setSelectedSong(song);
      setFontSize(14);
      setTransposition(0);
    }
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
      {/* Sticky Header Bar */}
      <div className="guest-sticky-header">
        {/* App Name Group */}
        <div className="header-name-group">
          <img src="/new_logo.png" alt="SoluFlow" className="guest-logo" />
          <h1 className="app-name">SoluFlow</h1>
        </div>

        {/* Search Row */}
        <div className="header-search-row">
          <input
            type="text"
            className="search-input-library"
            placeholder={t('library.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedSong(null);
            }}
          />
        </div>

        {/* Actions */}
        <div className="header-actions">
          <div className="language-switcher">
            <button
              className={`lang-btn ${language === 'en' ? 'active' : ''}`}
              onClick={() => setLanguage('en')}
            >
              EN
            </button>
            <button
              className={`lang-btn ${language === 'he' ? 'active' : ''}`}
              onClick={() => setLanguage('he')}
            >
              HE
            </button>
          </div>
          <button className="btn-join-service" onClick={() => setShowJoinModal(true)}>
            {t('guestLanding.accessService')}
          </button>
          <div className="auth-links-inline">
            <button className="btn-auth-link" onClick={() => navigate('/login')}>
              {t('common.login')}
            </button>
            <span className="separator">|</span>
            <button className="btn-auth-link" onClick={() => navigate('/register')}>
              {t('common.register')}
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="guest-content">
        {loading && (
          <div className="loading-state">Loading songs...</div>
        )}

        {error && (
          <div className="error-state">{error}</div>
        )}

        {!loading && !error && (
          <div className="songs-list">
          {displayedSongs.map(song => (
            <React.Fragment key={song.id}>
              <div
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

              {/* Display selected song chord sheet inline */}
              {selectedSong?.id === song.id && (
                <div className="song-display-inline" ref={songDisplayRef}>
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
                <button className="btn-zoom btn-zoom-out" onClick={zoomOut}>
                  <span className="zoom-icon-small">A</span>
                </button>
                <button className="btn-zoom btn-zoom-in" onClick={zoomIn}>
                  <span className="zoom-icon-large">A</span>
                </button>
              </div>
              <span className="key-info-inline">Key: {selectedSong.key}</span>
              {selectedSong.bpm && <span className="bpm-info-inline">BPM: {selectedSong.bpm}</span>}
              {selectedSong.listen_url && (
                <a
                  href={selectedSong.listen_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="listen-link-inline"
                  onClick={(e) => e.stopPropagation()}
                >
                  🎵 Listen
                </a>
              )}
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
              {t('common.close')}
            </button>
          </div>
                </div>
              )}
            </React.Fragment>
          ))}

          {filteredSongs.length === 0 && (
            <div className="empty-state">
              No songs found matching "{searchQuery}"
            </div>
          )}
          </div>
        )}
      </div>

      {/* Join Service Modal */}
      {showJoinModal && (
        <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">{t('guestLanding.accessService')}</h2>
            <p className="modal-description">{t('guestLanding.enterCode')}</p>
            <input
              type="text"
              className="code-input"
              placeholder={t('guestLanding.codePlaceholder')}
              value={serviceCode}
              onChange={(e) => setServiceCode(e.target.value.toUpperCase())}
              onKeyPress={handleKeyPress}
              maxLength="4"
              autoFocus
            />
            <div className="modal-actions">
              <button className="btn-modal-cancel" onClick={() => setShowJoinModal(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn-modal-join" onClick={handleJoinService}>
                {t('guestLanding.accessButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuestLanding;
