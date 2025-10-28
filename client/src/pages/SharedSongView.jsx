import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import songService from '../services/songService';
import ChordProDisplay from '../components/ChordProDisplay';
import Toast from '../components/Toast';
import KeySelectorModal from '../components/KeySelectorModal';
import { transposeChord } from '../utils/transpose';
import './SharedSongView.css';

const SharedSongView = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [song, setSong] = useState(null);
  const [fontSize, setFontSize] = useState(14);
  const [transposition, setTransposition] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState('success');
  const [showKeySelectorModal, setShowKeySelectorModal] = useState(false);

  useEffect(() => {
    const fetchSongByCode = async () => {
      try {
        setLoading(true);
        const data = await songService.getSongByCode(code);
        setSong(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching song:', err);
        setError('Song not found or not available');
      } finally {
        setLoading(false);
      }
    };

    if (code) {
      fetchSongByCode();
    }
  }, [code]);

  // Detect Hebrew in song content
  const hasHebrew = (text) => /[\u0590-\u05FF]/.test(text);

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

  const handleAddToMyLibrary = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    try {
      await songService.acceptSharedSong(code);
      setToastMessage('Song added to your library!');
      setToastType('success');
      setShowToast(true);
      // Navigate to library page after a delay
      setTimeout(() => {
        navigate('/library');
      }, 2000);
    } catch (err) {
      console.error('Error adding song:', err);
      setToastMessage(err.response?.data?.error || 'Failed to add song');
      setToastType('error');
      setShowToast(true);
    }
  };

  const handleCloseToast = () => {
    setShowToast(false);
  };

  const handleOpenFullView = () => {
    if (song?.id) {
      navigate(`/song/${song.id}`);
    }
  };

  if (loading) {
    return (
      <div className="shared-song-page">
        <div className="loading-state">Loading song...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="shared-song-page">
        <div className="error-state">
          <h2>{error}</h2>
          <p>Please check the code and try again.</p>
          {!isAuthenticated && (
            <button className="btn-login" onClick={() => navigate('/login')}>
              Login
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!song) {
    return null;
  }

  return (
    <div className="shared-song-page">
      <div className="shared-song-header">
        <div className="header-top">
          {isAuthenticated && (
            <button className="btn-back" onClick={() => navigate('/')}>
              ← Back to Home
            </button>
          )}
          <h1>SoluFlow</h1>
          {!isAuthenticated && (
            <button className="btn-login-small" onClick={() => navigate('/login')}>
              Login
            </button>
          )}
        </div>
      </div>

      <div className="shared-song-content">
        {/* Add to My Library Button or Already Added Notice */}
        {song.alreadyAdded ? (
          <div className="already-added-section">
            <div className="already-added-notice">
              ✓ {song.isOwner ? 'You own this song' : 'Added to your library'}
            </div>
          </div>
        ) : (
          <div className="add-song-section">
            <button
              className="btn-add-song"
              onClick={handleAddToMyLibrary}
            >
              {isAuthenticated ? 'Add to My Library' : 'Login to Add to Your Library'}
            </button>
          </div>
        )}

        {/* Song Display */}
        <div className="song-display">
          <div className="song-header">
            <div className="song-info">
              <h2 className="song-title">{song.title}</h2>
              {song.authors && <p className="song-authors">{song.authors}</p>}
              {song.creator && (
                <p className="song-creator">Shared by: {song.creator.username}</p>
              )}
            </div>
            <div className="song-meta">
              <div className="transpose-controls">
                <button className="btn-transpose" onClick={transposeDown}>-</button>
                <span
                  className="transpose-display"
                  onClick={() => setShowKeySelectorModal(true)}
                  title="Click to select key"
                >
                  {transposeChord(song.key, transposition)}
                  {transposition !== 0 && ` (${transposition > 0 ? '+' : ''}${transposition})`}
                </span>
                <button className="btn-transpose" onClick={transposeUp}>+</button>
              </div>
              <div className="zoom-controls">
                <button className="btn-zoom btn-zoom-out" onClick={zoomOut}>
                  <span className="zoom-icon-small">A</span>
                </button>
                <button className="btn-zoom btn-zoom-in" onClick={zoomIn}>
                  <span className="zoom-icon-large">A</span>
                </button>
              </div>
              <span className="key-info">Key: {song.key}</span>
              {song.bpm && <span className="bpm-info">BPM: {song.bpm}</span>}
            </div>
          </div>

          <div
            className="song-content clickable"
            onClick={handleOpenFullView}
            title="Click to open in full view"
          >
            <ChordProDisplay
              content={song.content}
              dir={hasHebrew(song.content) ? 'rtl' : 'ltr'}
              fontSize={fontSize}
              transposition={transposition}
            />
          </div>
        </div>
      </div>

      {/* Key Selector Modal */}
      <KeySelectorModal
        isOpen={showKeySelectorModal}
        onClose={() => setShowKeySelectorModal(false)}
        currentKey={song.key}
        currentTransposition={transposition}
        onSelectKey={setTransposition}
      />

      {/* Toast */}
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={showToast}
        onClose={handleCloseToast}
      />
    </div>
  );
};

export default SharedSongView;
