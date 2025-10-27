import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import songService from '../services/songService';
import noteService from '../services/noteService';
import ChordProDisplay from '../components/ChordProDisplay';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';
import NotesModal from '../components/NotesModal';
import SongEditModal from '../components/SongEditModal';
import { getTransposeDisplay, transposeChord } from '../utils/transpose';
import io from 'socket.io-client';
import './SongView.css';

const SongView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { isRTL } = useLanguage();
  const touchStartRef = useRef(null);
  const touchEndRef = useRef(null);
  const socketRef = useRef(null);

  // Store transposition per song ID to remember transposition when navigating
  const songTranspositionsRef = useRef(new Map());

  // Get setlist context from navigation state
  const setlistContext = location.state || null;
  const [currentSetlistIndex, setCurrentSetlistIndex] = useState(
    setlistContext?.currentIndex || 0
  );

  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLyricsOnly, setIsLyricsOnly] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [transposition, setTransposition] = useState(() => {
    // Initialize with transposition from setlist context
    const initialTranspose = setlistContext?.initialTransposition || 0;
    // Store it in the Map for this song
    if (id) {
      songTranspositionsRef.current.set(id, initialTranspose);
    }
    return initialTranspose;
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedFontSize, setExpandedFontSize] = useState(16);
  const [autoFontSize, setAutoFontSize] = useState(16);
  const contentRef = useRef(null);

  // Real-time sync state
  // Persist follow mode across song navigations using sessionStorage
  const [isFollowMode, setIsFollowMode] = useState(() => {
    const stored = sessionStorage.getItem('followMode');
    return stored !== null ? stored === 'true' : true;
  });
  const [isLeader, setIsLeader] = useState(false);

  // Get previous and next songs from setlist
  const hasPrevious = setlistContext && currentSetlistIndex > 0;
  const hasNext = setlistContext && currentSetlistIndex < setlistContext.setlist.length - 1;
  const nextSong = hasNext ? setlistContext.setlist[currentSetlistIndex + 1] : null;
  const previousSong = hasPrevious ? setlistContext.setlist[currentSetlistIndex - 1] : null;

  // Save follow mode to sessionStorage whenever it changes
  useEffect(() => {
    sessionStorage.setItem('followMode', isFollowMode.toString());
  }, [isFollowMode]);

  useEffect(() => {
    const fetchSong = async () => {
      try {
        setLoading(true);
        const data = await songService.getSongById(id);
        setSong(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching song:', err);
        setError('Failed to load song. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchSong();
  }, [id]);

  // Update stored transposition whenever it changes (but not when song changes)
  useEffect(() => {
    // Only save if the song is already in the map (i.e., we're updating existing transposition)
    // This prevents saving the previous song's transposition when navigating to a new song
    if (id && songTranspositionsRef.current.has(id)) {
      console.log('[SongView] Updating transposition in map for song', id, ':', transposition);
      songTranspositionsRef.current.set(id, transposition);
    }
  }, [transposition]);

  // Load transposition from storage when song changes
  useEffect(() => {
    if (id) {
      console.log('[SongView] Loading transposition for song ID:', id);
      console.log('[SongView] Setlist context:', setlistContext);
      console.log('[SongView] Song transpositions map:', Array.from(songTranspositionsRef.current.entries()));

      if (songTranspositionsRef.current.has(id)) {
        // Load stored transposition for this song (user changed it in SongView)
        const storedTransposition = songTranspositionsRef.current.get(id);
        console.log('[SongView] Found in map, using stored transposition:', storedTransposition);
        setTransposition(storedTransposition);
      } else {
        // First time viewing this song - check if there's transposition in setlist
        let initialTranspose = 0;

        // Look for this song in the setlist to get its saved transposition
        if (setlistContext?.setlist) {
          console.log('[SongView] Searching in setlist:', setlistContext.setlist.map(s => ({ id: s.id, transposition: s.transposition })));
          const songInSetlist = setlistContext.setlist.find(s => s.id.toString() === id);
          console.log('[SongView] Found song in setlist:', songInSetlist);
          if (songInSetlist && songInSetlist.transposition !== undefined) {
            initialTranspose = songInSetlist.transposition;
            console.log('[SongView] Using transposition from setlist:', initialTranspose);
          }
        }

        console.log('[SongView] Setting initial transposition:', initialTranspose);
        setTransposition(initialTranspose);
        songTranspositionsRef.current.set(id, initialTranspose);
      }
    }
  }, [id, setlistContext]);

  // Fetch notes
  useEffect(() => {
    const fetchNotes = async () => {
      if (!setlistContext?.serviceId || !id || user?.isGuest) {
        return;
      }

      try {
        const data = await noteService.getNotes(id, setlistContext.serviceId);
        if (data && data.content) {
          // Convert old format to plain text if needed
          if (data.content.notes && Array.isArray(data.content.notes)) {
            const plainText = data.content.notes.map(note => note.text).join('\n\n');
            setNotes(plainText);
          } else if (typeof data.content === 'string') {
            setNotes(data.content);
          } else if (data.content.text) {
            setNotes(data.content.text);
          }
        } else {
          setNotes('');
        }
      } catch (err) {
        console.error('Error fetching notes:', err);
        setNotes('');
      }
    };

    fetchNotes();
  }, [id, setlistContext?.serviceId, user]);

  // Auto-size font in normal mode
  useEffect(() => {
    if (!song || isExpanded) return;

    // Calculate after content is rendered
    const timer = setTimeout(() => {
      calculateNormalModeFontSize();
    }, 200);

    // Recalculate on window resize
    const handleResize = () => {
      if (!isExpanded) {
        calculateNormalModeFontSize();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [song, isExpanded]);

  // Socket.IO connection for real-time sync
  useEffect(() => {
    if (!setlistContext?.serviceId) return;

    // In SongView, we're always a follower (leader controls from Service page)
    // Check if we're passed the isLeader flag from Service page
    const userIsLeader = setlistContext.isLeader === true;
    setIsLeader(userIsLeader);

    // Connect to Socket.IO server
    const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:5002';
    socketRef.current = io(serverUrl);

    console.log('SongView connecting to Socket.IO...', serverUrl);

    socketRef.current.on('connect', () => {
      console.log('SongView Socket.IO connected:', socketRef.current.id);

      // Join the service room
      const userId = user?.id || `guest-${socketRef.current.id}`;

      socketRef.current.emit('join-service', {
        serviceId: setlistContext.serviceId,
        userId: userId,
        userRole: user?.role || 'guest',
        isLeader: userIsLeader
      });
    });

    // Listen for leader events (only if not leader and in follow mode)
    socketRef.current.on('leader-navigated', ({ songId, songIndex }) => {
      if (!userIsLeader && isFollowMode && setlistContext?.setlist) {
        console.log('Leader navigated to song:', songId, songIndex);

        // Navigate to the new song
        const newSong = setlistContext.setlist[songIndex];
        if (newSong && newSong.id.toString() !== id) {
          navigate(`/song/${newSong.id}`, {
            state: {
              ...setlistContext,
              currentIndex: songIndex
            },
            replace: true
          });
        }
      }
    });

    socketRef.current.on('leader-transposed', ({ transposition: newTransposition }) => {
      if (!userIsLeader && isFollowMode) {
        console.log('Leader transposed to:', newTransposition);
        setTransposition(newTransposition);
      }
    });

    socketRef.current.on('leader-changed-font', ({ fontSize: newFontSize }) => {
      if (!userIsLeader && isFollowMode) {
        console.log('Leader changed font size to:', newFontSize);
        setFontSize(newFontSize);
      }
    });

    socketRef.current.on('sync-state', (state) => {
      if (!userIsLeader && isFollowMode) {
        console.log('Syncing state from leader:', state);
        if (state.currentSongIndex !== undefined && setlistContext?.setlist) {
          const syncSong = setlistContext.setlist[state.currentSongIndex];
          if (syncSong && syncSong.id.toString() !== id) {
            navigate(`/song/${syncSong.id}`, {
              state: {
                ...setlistContext,
                currentIndex: state.currentSongIndex
              },
              replace: true
            });
          }
        }
        if (state.transposition !== undefined) {
          setTransposition(state.transposition);
        }
        if (state.fontSize !== undefined) {
          setFontSize(state.fontSize);
        }
      }
    });

    socketRef.current.on('room-update', ({ leaderSocketId, followerCount }) => {
      console.log('Room update - Leader:', leaderSocketId, 'Followers:', followerCount);
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        console.log('SongView leaving service room');
        socketRef.current.emit('leave-service', { serviceId: setlistContext.serviceId });
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [setlistContext, user, isFollowMode, id, navigate]);

  // Keyboard navigation - must be before early returns
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (!setlistContext) return;

      if (e.key === 'ArrowRight' && hasNext) {
        const nextSongId = setlistContext.setlist[currentSetlistIndex + 1].id;
        navigate(`/song/${nextSongId}`, {
          state: {
            ...setlistContext,
            currentIndex: currentSetlistIndex + 1
          },
          replace: true
        });
      } else if (e.key === 'ArrowLeft' && hasPrevious) {
        const prevSongId = setlistContext.setlist[currentSetlistIndex - 1].id;
        navigate(`/song/${prevSongId}`, {
          state: {
            ...setlistContext,
            currentIndex: currentSetlistIndex - 1
          },
          replace: true
        });
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [hasNext, hasPrevious, currentSetlistIndex, setlistContext, navigate]);

  if (loading) {
    return (
      <div className="song-view-page">
        <div className="loading-state">Loading song...</div>
      </div>
    );
  }

  if (error || !song) {
    return (
      <div className="song-view-page">
        <div className="error-state">{error || 'Song not found'}</div>
        <button className="btn-back" onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  // Detect if content contains Hebrew characters
  const hasHebrew = /[\u0590-\u05FF]/.test(song.content);

  const zoomIn = () => {
    setFontSize(prev => Math.min(prev + 2, 28));
  };

  const zoomOut = () => {
    setFontSize(prev => Math.max(prev - 2, 12));
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

  const handleDeleteSong = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      await songService.deleteSong(id);

      // Show success toast
      setToastMessage('Song deleted successfully!');
      setShowToast(true);

      // Navigate back to library after a short delay
      setTimeout(() => {
        navigate('/library');
      }, 1000);
    } catch (err) {
      console.error('Error deleting song:', err);
      setToastMessage('Failed to delete song. Please try again.');
      setShowToast(true);
      setShowDeleteConfirm(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const handleEditSong = () => {
    setIsEditModalOpen(true);
  };

  const handleSaveEditedSong = async (updatedSong) => {
    try {
      const saved = await songService.updateSong(id, updatedSong);
      setSong(saved);
      setIsEditModalOpen(false);
      setToastMessage('Song updated successfully!');
      setShowToast(true);
    } catch (err) {
      console.error('Error updating song:', err);
      setToastMessage('Failed to update song. Please try again.');
      setShowToast(true);
    }
  };

  const handleCloseToast = () => {
    setShowToast(false);
  };

  // Navigate to next song in setlist
  const goToNextSong = () => {
    if (!hasNext) return;
    const nextSongId = setlistContext.setlist[currentSetlistIndex + 1].id;
    const newIndex = currentSetlistIndex + 1;
    setCurrentSetlistIndex(newIndex);
    navigate(`/song/${nextSongId}`, {
      state: {
        ...setlistContext,
        currentIndex: newIndex
      },
      replace: true
    });
  };

  // Navigate to previous song in setlist
  const goToPreviousSong = () => {
    if (!hasPrevious) return;
    const prevSongId = setlistContext.setlist[currentSetlistIndex - 1].id;
    const newIndex = currentSetlistIndex - 1;
    setCurrentSetlistIndex(newIndex);
    navigate(`/song/${prevSongId}`, {
      state: {
        ...setlistContext,
        currentIndex: newIndex
      },
      replace: true
    });
  };

  // Touch/swipe handlers
  const handleTouchStart = (e) => {
    touchStartRef.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current || !touchEndRef.current) return;

    const distance = touchStartRef.current - touchEndRef.current;
    const minSwipeDistance = 100;

    // Swipe left (next)
    if (distance > minSwipeDistance && hasNext) {
      goToNextSong();
    }
    // Swipe right (previous)
    else if (distance < -minSwipeDistance && hasPrevious) {
      goToPreviousSong();
    }

    touchStartRef.current = null;
    touchEndRef.current = null;
  };

  // Toggle expanded view
  const toggleExpanded = () => {
    console.log('toggleExpanded called, current isExpanded:', isExpanded);

    if (!isExpanded) {
      console.log('Entering expanded mode...');
      // Entering expanded mode - calculate optimal font size
      setIsExpanded(true);

      // Use setTimeout to allow DOM to update first
      setTimeout(() => {
        console.log('Calling calculateOptimalFontSize...');
        calculateOptimalFontSize();
      }, 100);
    } else {
      console.log('Exiting expanded mode...');
      // Exiting expanded mode
      setIsExpanded(false);
    }
  };

  // Calculate optimal font size for normal mode
  const calculateNormalModeFontSize = () => {
    if (!contentRef.current || isExpanded) return;

    const container = contentRef.current;
    const chordDisplay = container.querySelector('.chordpro-display');
    if (!chordDisplay) return;

    // Get available height (container's actual height)
    const containerHeight = container.clientHeight;

    console.log('=== Normal Mode Font Size Calculation ===');
    console.log('Container height:', containerHeight);

    // Binary search for optimal font size
    let minSize = 12;
    let maxSize = 28; // Max font size for normal mode
    let optimalSize = minSize;
    const buffer = 20; // Larger buffer for normal mode

    for (let i = 0; i < 20; i++) {
      const testSize = (minSize + maxSize) / 2;

      // Apply test font size
      chordDisplay.style.fontSize = `${testSize}px`;

      // Force reflow
      void chordDisplay.offsetHeight;

      // Check if content fits
      const contentHeight = chordDisplay.scrollHeight;

      console.log(`Test ${i + 1}: fontSize=${testSize.toFixed(2)}px, contentHeight=${contentHeight}px, containerHeight=${containerHeight}px`);

      if (contentHeight <= containerHeight - buffer) {
        optimalSize = testSize;
        minSize = testSize;
      } else {
        maxSize = testSize;
      }

      if (maxSize - minSize < 0.5) {
        break;
      }
    }

    const finalSize = Math.floor(optimalSize);
    console.log('Final normal mode font size:', finalSize);
    console.log('=========================================');

    setAutoFontSize(finalSize);
    setFontSize(finalSize);
  };

  // Calculate optimal font size for expanded mode
  const calculateOptimalFontSize = () => {
    if (!contentRef.current) return;

    const container = contentRef.current;
    const chordDisplay = container.querySelector('.chordpro-display');
    if (!chordDisplay) {
      console.error('ChordProDisplay not found!');
      return;
    }

    // Use viewport dimensions since we're in expanded mode (full screen)
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Account for padding in expanded mode
    const isMobile = viewportWidth <= 768;
    const isLargeScreen = viewportWidth >= 1200;

    let paddingVertical, lineHeightRatio;

    if (isMobile) {
      paddingVertical = 40; // 20px top + 20px bottom
      lineHeightRatio = 1.6;
    } else if (isLargeScreen) {
      paddingVertical = 120; // 60px top + 60px bottom
      lineHeightRatio = 2.0;
    } else {
      paddingVertical = 80; // 40px top + 40px bottom
      lineHeightRatio = 1.8;
    }

    const availableHeight = viewportHeight - paddingVertical;

    // Count the number of actual rendered lines
    const lineElements = chordDisplay.querySelectorAll('.line-with-notes');
    const totalLines = lineElements.length;

    console.log('=== Font Size Calculation ===');
    console.log('Viewport dimensions:', { width: viewportWidth, height: viewportHeight });
    console.log('Padding vertical:', paddingVertical);
    console.log('Available height:', availableHeight);
    console.log('Total lines in song:', totalLines);
    console.log('Line height ratio:', lineHeightRatio);

    if (totalLines === 0) {
      console.error('No lines found in content!');
      return;
    }

    // Calculate initial font size estimate
    const neededLineHeight = availableHeight / totalLines;
    const initialFontSize = neededLineHeight / lineHeightRatio;

    console.log('Initial calculated font size:', initialFontSize);

    // Binary search for the largest font size that doesn't cause scrolling
    let minSize = 10;
    let maxSize = Math.min(100, Math.floor(initialFontSize * 1.2)); // Start slightly above estimate
    let optimalSize = minSize;

    for (let i = 0; i < 20; i++) {
      const testSize = (minSize + maxSize) / 2;

      // Apply test font size
      chordDisplay.style.fontSize = `${testSize}px`;

      // Force reflow
      void chordDisplay.offsetHeight;

      // Check if content fits (no scrolling needed)
      // Add a small buffer (10px) to ensure no cutoff
      const contentHeight = chordDisplay.scrollHeight;
      const containerHeight = container.clientHeight;
      const buffer = 10;

      console.log(`Test ${i + 1}: fontSize=${testSize.toFixed(2)}px, contentHeight=${contentHeight}px, containerHeight=${containerHeight}px`);

      if (contentHeight <= containerHeight - buffer) {
        // Content fits with buffer, try larger
        optimalSize = testSize;
        minSize = testSize;
      } else {
        // Content too large, try smaller
        maxSize = testSize;
      }

      // Stop if we're very close
      if (maxSize - minSize < 0.5) {
        break;
      }
    }

    console.log('Final optimal font size:', Math.floor(optimalSize));
    console.log('===============================');

    // Apply the optimal font size
    setExpandedFontSize(Math.floor(optimalSize));
  };

  // Save notes handler
  const handleSaveNotes = async () => {
    if (!setlistContext?.serviceId) return;

    try {
      await noteService.saveNotes(id, setlistContext.serviceId, notes);
      setToastMessage('Notes saved successfully!');
      setShowToast(true);
    } catch (err) {
      console.error('Error saving notes:', err);
      setToastMessage('Failed to save notes');
      setShowToast(true);
    }
  };

  // Toggle follow/free mode
  const toggleFollowMode = () => {
    setIsFollowMode(prev => !prev);
    setToastMessage(isFollowMode ? 'Free mode enabled' : 'Follow mode enabled');
    setShowToast(true);
  };

  return (
    <div className={`song-view-page ${isExpanded ? 'expanded-mode' : ''}`}>
      {/* Header */}
      {!isExpanded && (
      <div className="song-view-header">
        <div className="header-top-row">
          <button className="btn-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div className="header-right-buttons">
            {setlistContext?.serviceId && !isLeader && (
              <button
                className={`btn-follow-header ${isFollowMode ? 'active' : ''}`}
                onClick={toggleFollowMode}
                title={isFollowMode ? 'Click to enable free mode' : 'Click to follow leader'}
              >
                {isFollowMode ? 'Follow' : 'Free'}
              </button>
            )}
            {isAuthenticated && (user?.role === 'admin' || song.created_by === user?.id) && (
              <>
                <button className="btn-edit-header" onClick={handleEditSong}>Edit</button>
                {user?.role === 'admin' && (
                  <button className="btn-delete-header" onClick={handleDeleteSong}>Delete</button>
                )}
              </>
            )}
          </div>
        </div>
        <div className="song-view-title-section">
          <h1 className="song-view-title" dir={hasHebrew ? 'rtl' : 'ltr'}>
            {song.title}
          </h1>
          <div>
            <span className="song-view-subtitle">{song.authors}</span>
            <div className="song-view-controls">
              <span className="control-info">Key: {song.key}</span>
              {song.bpm && <span className="control-info">BPM: {song.bpm}</span>}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Action Buttons */}
      {!isExpanded && (
      <div className="song-view-actions">
        <div className="transpose-controls-view">
          <button className="btn-action btn-transpose-view" onClick={transposeDown}>-</button>
          <span
            className="transpose-display"
            onClick={resetTransposition}
            title="Click to reset"
          >
            {transposeChord(song.key, transposition)}
            {transposition !== 0 && ` (${transposition > 0 ? '+' : ''}${transposition})`}
          </span>
          <button className="btn-action btn-transpose-view" onClick={transposeUp}>+</button>
        </div>
        <button
          className={`btn-action ${isLyricsOnly ? 'active' : ''}`}
          onClick={() => setIsLyricsOnly(!isLyricsOnly)}
        >
          {isLyricsOnly ? 'Chords' : 'Lyrics'}
        </button>
        <div className="zoom-controls-view">
          <button className="btn-action btn-zoom-view btn-zoom-out" onClick={zoomOut}>
            <span className="zoom-icon-small">A</span>
          </button>
          <button className="btn-action btn-zoom-view btn-zoom-in" onClick={zoomIn}>
            <span className="zoom-icon-large">A</span>
          </button>
        </div>
      </div>
      )}

      {/* Navigation Buttons - Fixed position */}
      {!isExpanded && setlistContext && (
        <>
          {hasPrevious && (
            <button
              className={`btn-nav-song ${isRTL ? 'btn-next-song' : 'btn-prev-song'}`}
              onClick={goToPreviousSong}
            >
              ‹
            </button>
          )}
          {hasNext && (
            <button
              className={`btn-nav-song ${isRTL ? 'btn-prev-song' : 'btn-next-song'}`}
              onClick={goToNextSong}
            >
              ›
            </button>
          )}
        </>
      )}

      {/* Floating Follow Button - appears only in expanded mode */}
      {isExpanded && setlistContext?.serviceId && !isLeader && (
        <button
          className={`btn-follow-floating ${isFollowMode ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation(); // Prevent triggering toggleExpanded
            toggleFollowMode();
          }}
          title={isFollowMode ? 'Click to enable free mode' : 'Click to follow leader'}
        >
          {isFollowMode ? 'Follow' : 'Free'}
        </button>
      )}

      {/* Song Content */}
      <div
        ref={contentRef}
        className={`song-view-content ${isExpanded ? 'expanded' : ''}`}
        onClick={toggleExpanded}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: 'pointer' }}
        title={isExpanded ? 'Click to exit expanded view' : 'Click to expand view'}
      >
        <ChordProDisplay
          content={song.content}
          isLyricsOnly={isLyricsOnly}
          dir={hasHebrew ? 'rtl' : 'ltr'}
          fontSize={isExpanded ? expandedFontSize : fontSize}
          transposition={transposition}
        />
      </div>

      {/* Next Song Indicator - below song content */}
      {!isExpanded && nextSong && (
        <div className="next-song-indicator">
          <span className="next-label">{isRTL ? 'הבא ←' : 'Next:'}</span>
          <span className="next-song-title">{nextSong.title}</span>
          <span className="next-song-meta">
            {nextSong.key}{nextSong.bpm ? ` • ${nextSong.bpm} BPM` : ''}
          </span>
        </div>
      )}

      {/* Collapsible Notes Section */}
      {!isExpanded && isAuthenticated && !user?.isGuest && setlistContext?.serviceId && (
        <div className="notes-section">
          <button
            className="notes-toggle"
            onClick={() => setNotesExpanded(!notesExpanded)}
          >
            {notesExpanded ? '▼' : '►'} Show Notes
          </button>
          {notesExpanded && (
            <div className="notes-content">
              <textarea
                className="notes-textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add your notes here..."
                rows={8}
              />
              <button
                className="btn-save-notes"
                onClick={handleSaveNotes}
              >
                Save Notes
              </button>
            </div>
          )}
        </div>
      )}

      {/* Notes Modal */}
      {setlistContext?.serviceId && (
        <NotesModal
          songId={id}
          serviceId={setlistContext.serviceId}
          songTitle={song.title}
          isOpen={showNotesModal}
          onClose={() => setShowNotesModal(false)}
        />
      )}

      {/* Edit Song Modal */}
      <SongEditModal
        song={song}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveEditedSong}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Song"
        message={`Are you sure you want to delete "${song.title}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
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

export default SongView;
