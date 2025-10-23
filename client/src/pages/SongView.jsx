import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
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
  const [inlineNotes, setInlineNotes] = useState([]);
  const [notesVisible, setNotesVisible] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Real-time sync state
  const [isFollowMode, setIsFollowMode] = useState(true);
  const [isLeader, setIsLeader] = useState(false);

  // Get previous and next songs from setlist
  const hasPrevious = setlistContext && currentSetlistIndex > 0;
  const hasNext = setlistContext && currentSetlistIndex < setlistContext.setlist.length - 1;
  const nextSong = hasNext ? setlistContext.setlist[currentSetlistIndex + 1] : null;
  const previousSong = hasPrevious ? setlistContext.setlist[currentSetlistIndex - 1] : null;

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

  // Fetch inline notes
  useEffect(() => {
    const fetchNotes = async () => {
      if (!setlistContext?.serviceId || !id || user?.isGuest) {
        return;
      }

      try {
        const data = await noteService.getNotes(id, setlistContext.serviceId);
        if (data && data.content && data.content.notes) {
          setInlineNotes(data.content.notes);
          setNotesVisible(data.is_visible);
        } else {
          setInlineNotes([]);
        }
      } catch (err) {
        console.error('Error fetching notes:', err);
        setInlineNotes([]);
      }
    };

    fetchNotes();
  }, [id, setlistContext?.serviceId, user]);

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
      if (!userIsLeader) {
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

  // Inline note handlers
  const handleAddNote = async (lineNumber, text) => {
    if (!setlistContext?.serviceId) return;

    try {
      const data = await noteService.addNote(id, setlistContext.serviceId, lineNumber, text);
      if (data && data.content && data.content.notes) {
        setInlineNotes(data.content.notes);
      }
      setToastMessage('Note added successfully!');
      setShowToast(true);
    } catch (err) {
      console.error('Error adding note:', err);
      setToastMessage('Failed to add note');
      setShowToast(true);
    }
  };

  const handleUpdateNote = async (noteId, text) => {
    if (!setlistContext?.serviceId) return;

    try {
      const data = await noteService.updateNote(id, setlistContext.serviceId, noteId, text);
      if (data && data.content && data.content.notes) {
        setInlineNotes(data.content.notes);
      }
      setToastMessage('Note updated successfully!');
      setShowToast(true);
    } catch (err) {
      console.error('Error updating note:', err);
      setToastMessage('Failed to update note');
      setShowToast(true);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!setlistContext?.serviceId) return;

    try {
      const data = await noteService.deleteNote(id, setlistContext.serviceId, noteId);
      if (data && data.content && data.content.notes) {
        setInlineNotes(data.content.notes);
      }
      setToastMessage('Note deleted successfully!');
      setShowToast(true);
    } catch (err) {
      console.error('Error deleting note:', err);
      setToastMessage('Failed to delete note');
      setShowToast(true);
    }
  };

  const handleToggleNotesVisibility = async () => {
    if (!setlistContext?.serviceId) return;

    try {
      const data = await noteService.toggleVisibility(id, setlistContext.serviceId);
      setNotesVisible(data.is_visible);
      setToastMessage(data.is_visible ? 'Notes visible' : 'Notes hidden');
      setShowToast(true);
    } catch (err) {
      console.error('Error toggling notes visibility:', err);
    }
  };

  // Toggle follow/free mode
  const toggleFollowMode = () => {
    setIsFollowMode(prev => !prev);
    setToastMessage(isFollowMode ? 'Free mode enabled' : 'Follow mode enabled');
    setShowToast(true);
  };

  return (
    <div className="song-view-page">
      {/* Header */}
      <div className="song-view-header">
        <div className="header-top-row">
          <button className="btn-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
          {isAuthenticated && (user?.role === 'admin' || song.created_by === user?.id) && (
            <>
              <button className="btn-edit-header" onClick={handleEditSong}>Edit</button>
              {user?.role === 'admin' && (
                <button className="btn-delete-header" onClick={handleDeleteSong}>Delete</button>
              )}
            </>
          )}
        </div>
        <div className="song-view-title-section">
          <h1 className="song-view-title" dir={hasHebrew ? 'rtl' : 'ltr'}>
            {song.title}
          </h1>
          <p className="song-view-subtitle">{song.authors}</p>
        </div>
        <div className="song-view-controls">
          <span className="control-info">Key: {song.key}</span>
          <span className="control-info">BPM: {song.bpm}</span>
          <span className="control-info">{song.timeSig}</span>
        </div>
      </div>

      {/* Action Buttons */}
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
          {isLyricsOnly ? 'Show Chords' : 'Lyrics Only'}
        </button>
        <div className="zoom-controls-view">
          <button className="btn-action btn-zoom-view btn-zoom-out" onClick={zoomOut}>
            <span className="zoom-icon-small">A</span>
          </button>
          <button className="btn-action btn-zoom-view btn-zoom-in" onClick={zoomIn}>
            <span className="zoom-icon-large">A</span>
          </button>
        </div>
        {setlistContext?.serviceId && !isLeader && (
          <button
            className={`btn-action ${isFollowMode ? 'active' : ''}`}
            onClick={toggleFollowMode}
            title={isFollowMode ? 'Click to enable free mode' : 'Click to follow leader'}
          >
            {isFollowMode ? 'Following' : 'Free Mode'}
          </button>
        )}
        {isAuthenticated && !user?.isGuest && setlistContext?.serviceId && (
          <>
            <button
              className={`btn-action btn-icon-action ${isEditMode ? 'active' : ''}`}
              onClick={() => setIsEditMode(!isEditMode)}
              title={isEditMode ? 'Done editing notes' : 'Edit notes'}
            >
              <span className="btn-icon">{isEditMode ? '✓' : '✎'}</span>
              <span className="btn-text">{isEditMode ? 'Done' : 'Edit'}</span>
            </button>
            <button
              className={`btn-action btn-icon-action ${!notesVisible ? 'active' : ''}`}
              onClick={handleToggleNotesVisibility}
              title={notesVisible ? 'Hide notes' : 'Show notes'}
            >
              <span className="btn-icon">{notesVisible ? '👁' : '⊘'}</span>
              <span className="btn-text">{notesVisible ? 'Hide' : 'Show'}</span>
            </button>
          </>
        )}
      </div>

      {/* Next Song Indicator - at top */}
      {nextSong && (
        <div className="next-song-indicator">
          <span className="next-label">Next:</span>
          <span className="next-song-title">{nextSong.title}</span>
          <span className="next-song-key">Key: {nextSong.key}</span>
        </div>
      )}

      {/* Navigation Buttons - Fixed position */}
      {setlistContext && (
        <>
          {hasPrevious && (
            <button className="btn-nav-song btn-prev-song" onClick={goToPreviousSong}>
              ‹
            </button>
          )}
          {hasNext && (
            <button className="btn-nav-song btn-next-song" onClick={goToNextSong}>
              ›
            </button>
          )}
        </>
      )}

      {/* Song Content */}
      <div
        className="song-view-content"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <ChordProDisplay
          content={song.content}
          isLyricsOnly={isLyricsOnly}
          dir={hasHebrew ? 'rtl' : 'ltr'}
          fontSize={fontSize}
          transposition={transposition}
          notes={notesVisible ? inlineNotes : []}
          isEditMode={isEditMode}
          onAddNote={handleAddNote}
          onUpdateNote={handleUpdateNote}
          onDeleteNote={handleDeleteNote}
        />
      </div>

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
