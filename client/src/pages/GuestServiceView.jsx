import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import serviceService from '../services/serviceService';
import ChordProDisplay from '../components/ChordProDisplay';
import Toast from '../components/Toast';
import KeySelectorModal from '../components/KeySelectorModal';
import { getTransposeDisplay, transposeChord, convertKeyToFlat } from '../utils/transpose';
import io from 'socket.io-client';
import './GuestServiceView.css';

const GuestServiceView = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const socketRef = useRef(null);

  const [serviceDetails, setServiceDetails] = useState(null);
  const [selectedSongIndex, setSelectedSongIndex] = useState(0);
  const [fontSize, setFontSize] = useState(14);
  const [transposition, setTransposition] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState('success');
  const [showKeySelectorModal, setShowKeySelectorModal] = useState(false);

  // Real-time sync state (guests are always followers)
  const [isFollowMode, setIsFollowMode] = useState(true);

  useEffect(() => {
    const fetchServiceByCode = async () => {
      try {
        setLoading(true);
        const data = await serviceService.getServiceByCode(code);

        // Store guest token if provided (for unauthenticated users)
        if (data.guestToken) {
          localStorage.setItem('token', data.guestToken);
          console.log('Guest token stored');
        }

        setServiceDetails(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching service:', err);
        setError('Service not found or not available');
      } finally {
        setLoading(false);
      }
    };

    if (code) {
      fetchServiceByCode();
    }
  }, [code]);

  // Reset transposition when song changes
  useEffect(() => {
    setTransposition(0);
  }, [selectedSongIndex]);

  // Socket.IO connection for real-time sync
  useEffect(() => {
    if (!serviceDetails || !serviceDetails.id) return;

    // Connect to Socket.IO server
    const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:5002';
    socketRef.current = io(serverUrl);

    console.log('Guest connecting to Socket.IO...', serverUrl);

    socketRef.current.on('connect', () => {
      console.log('Guest Socket.IO connected:', socketRef.current.id);

      // Join the service room as follower
      // Use a guest ID if not authenticated, or actual user ID if authenticated
      const guestUserId = user?.id || `guest-${socketRef.current.id}`;

      socketRef.current.emit('join-service', {
        serviceId: serviceDetails.id,
        userId: guestUserId,
        userRole: user?.role || 'guest',
        isLeader: false // Guests are always followers
      });
    });

    // Listen for leader events (only if in follow mode)
    socketRef.current.on('leader-navigated', ({ songId, songIndex }) => {
      if (isFollowMode) {
        console.log('Leader navigated to song:', songId, songIndex);
        setSelectedSongIndex(songIndex);
      }
    });

    socketRef.current.on('leader-transposed', ({ transposition: newTransposition }) => {
      if (isFollowMode) {
        console.log('Leader transposed to:', newTransposition);
        setTransposition(newTransposition);
      }
    });

    socketRef.current.on('leader-changed-font', ({ fontSize: newFontSize }) => {
      if (isFollowMode) {
        console.log('Leader changed font size to:', newFontSize);
        setFontSize(newFontSize);
      }
    });

    socketRef.current.on('sync-state', (state) => {
      console.log('Syncing state from leader:', state);
      if (state.currentSongIndex !== undefined) {
        setSelectedSongIndex(state.currentSongIndex);
      }
      if (state.transposition !== undefined) {
        setTransposition(state.transposition);
      }
      if (state.fontSize !== undefined) {
        setFontSize(state.fontSize);
      }
    });

    socketRef.current.on('room-update', ({ leaderSocketId, followerCount }) => {
      console.log('Room update - Leader:', leaderSocketId, 'Followers:', followerCount);
    });

    // Handle leader disconnection - switch to free mode
    socketRef.current.on('leader-disconnected', ({ message }) => {
      console.log('Leader disconnected from service');
      setIsFollowMode(false); // Automatically switch to free mode
      setToastMessage(message || 'Leader disconnected - switched to free mode');
      setShowToast(true);
    });

    // Handle leader reconnection
    socketRef.current.on('leader-reconnected', ({ message }) => {
      console.log('Leader reconnected to service');
      setToastMessage(message || 'Leader reconnected - you can enable follow mode');
      setShowToast(true);
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        console.log('Guest leaving service room');

        // Remove all event listeners to prevent memory leaks
        socketRef.current.off('connect');
        socketRef.current.off('leader-navigated');
        socketRef.current.off('leader-transposed');
        socketRef.current.off('leader-changed-font');
        socketRef.current.off('sync-state');
        socketRef.current.off('room-update');
        socketRef.current.off('leader-disconnected');
        socketRef.current.off('leader-reconnected');

        socketRef.current.emit('leave-service', { serviceId: serviceDetails.id });
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [serviceDetails, user, isFollowMode]);

  const currentSetList = serviceDetails?.songs || [];
  const currentSong = currentSetList[selectedSongIndex];

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

  const handleAddToMyServices = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    try {
      await serviceService.acceptSharedService(code);
      setToastMessage('Service added to your list!');
      setToastType('success');
      setShowToast(true);
      // Navigate to services page after a delay
      setTimeout(() => {
        navigate('/service');
      }, 2000);
    } catch (err) {
      console.error('Error adding service:', err);
      setToastMessage(err.response?.data?.error || 'Failed to add service');
      setToastType('error');
      setShowToast(true);
    }
  };

  const handleCloseToast = () => {
    setShowToast(false);
  };

  // Toggle follow/free mode
  const toggleFollowMode = () => {
    setIsFollowMode(prev => !prev);
    setToastMessage(isFollowMode ? 'Free mode enabled' : 'Follow mode enabled');
    setToastType('success');
    setShowToast(true);
  };

  // Handle song selection
  const handleSelectSong = (index) => {
    setSelectedSongIndex(index);
  };

  if (loading) {
    return (
      <div className="guest-service-page">
        <div className="loading-state">Loading service...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="guest-service-page">
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

  if (!serviceDetails) {
    return null;
  }

  return (
    <div className="guest-service-page">
      <div className="guest-service-header">
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
        <div className="service-info-banner">
          <div className="service-banner-content">
            <div className="service-title-section">
              <h2>{serviceDetails.title}</h2>
              <div className="service-meta">
                {serviceDetails.date && <span>{serviceDetails.date}</span>}
                {serviceDetails.time && <span>{serviceDetails.time}</span>}
                {serviceDetails.location && <span>{serviceDetails.location}</span>}
              </div>
            </div>
            <button
              className={`btn-follow-mode ${isFollowMode ? 'active' : ''}`}
              onClick={toggleFollowMode}
              title={isFollowMode ? 'Click to enable free mode' : 'Click to follow leader'}
            >
              {isFollowMode ? 'FOLLOWING' : 'FREE MODE'}
            </button>
          </div>
        </div>
      </div>

      {currentSetList.length > 0 ? (
        <div className="guest-service-content">
          {/* Add to My Services Button or Already Added Notice */}
          {serviceDetails.alreadyAdded ? (
            <div className="already-added-section">
              <div className="already-added-notice">
                ✓ {serviceDetails.isOwner ? 'You own this service' : 'Added to your services'}
              </div>
            </div>
          ) : (
            <div className="add-service-section">
              <button
                className="btn-add-service"
                onClick={handleAddToMyServices}
              >
                {isAuthenticated ? 'Add to My Services' : 'Login to Add to Your Services'}
              </button>
            </div>
          )}

          {/* Song Pills */}
          <div className="song-pills">
            {currentSetList.map((song, index) => (
              <button
                key={song.id}
                className={`song-pill ${index === selectedSongIndex ? 'active' : ''}`}
                onClick={() => handleSelectSong(index)}
              >
                {song.title}
              </button>
            ))}
          </div>

          {/* Song Display */}
          {currentSong && (
            <div
              className="song-display"
              onClick={() => navigate(`/song/${currentSong.id}`, {
                state: {
                  setlist: currentSetList,
                  currentIndex: selectedSongIndex,
                  fromService: serviceDetails.title,
                  serviceId: serviceDetails.id,
                  isLeader: false // Guests are never leaders
                }
              })}
              style={{ cursor: 'pointer' }}
            >
              <div className="song-header">
                <div className="song-info">
                  <h2 className="song-title">{currentSong.title}</h2>
                  <p className="song-authors">{currentSong.authors}</p>
                </div>
                <div className="song-meta">
                  <div className="transpose-controls">
                    <button className="btn-transpose" onClick={(e) => { e.stopPropagation(); transposeDown(); }}>-</button>
                    <span
                      className="transpose-display"
                      onClick={(e) => { e.stopPropagation(); setShowKeySelectorModal(true); }}
                      title="Click to select key"
                    >
                      {convertKeyToFlat(transposeChord(currentSong.key, transposition))}
                      {transposition !== 0 && ` (${transposition > 0 ? '+' : ''}${transposition})`}
                    </span>
                    <button className="btn-transpose" onClick={(e) => { e.stopPropagation(); transposeUp(); }}>+</button>
                  </div>
                  <div className="zoom-controls">
                    <button className="btn-zoom" onClick={(e) => { e.stopPropagation(); zoomOut(); }}>A-</button>
                    <button className="btn-zoom" onClick={(e) => { e.stopPropagation(); zoomIn(); }}>A+</button>
                  </div>
                  <span className="key-info">Key: {convertKeyToFlat(currentSong.key)}</span>
                  {currentSong.bpm && <span className="bpm-info">BPM: {currentSong.bpm}{currentSong.time_signature && ` (${currentSong.time_signature})`}</span>}
                </div>
              </div>

              <div className="song-content">
                <ChordProDisplay
                  content={currentSong.content}
                  dir={hasHebrew(currentSong.content) ? 'rtl' : 'ltr'}
                  fontSize={fontSize}
                  transposition={transposition}
                  songKey={currentSong.key}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="guest-service-content">
          <div className="empty-service">
            No songs in this service yet.
          </div>
        </div>
      )}

      {/* Toast */}
      {/* Key Selector Modal */}
      {currentSong && (
        <KeySelectorModal
          isOpen={showKeySelectorModal}
          onClose={() => setShowKeySelectorModal(false)}
          currentKey={currentSong.key}
          currentTransposition={transposition}
          onSelectKey={setTransposition}
        />
      )}

      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={showToast}
        onClose={handleCloseToast}
      />
    </div>
  );
};

export default GuestServiceView;
