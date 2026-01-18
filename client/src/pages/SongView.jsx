import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import songService from '../services/songService';
import serviceService from '../services/serviceService';
import noteService from '../services/noteService';
import ChordProDisplay from '../components/ChordProDisplay';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';
import NotesModal from '../components/NotesModal';
import SongEditModal from '../components/SongEditModal';
import KeySelectorModal from '../components/KeySelectorModal';
import ReportModal from '../components/ReportModal';
import { transposeChord, convertKeyToFlat } from '../utils/transpose';
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
  const isFollowModeRef = useRef(false); // Ref to access current follow mode in socket handlers
  const setlistContextRef = useRef(null); // Ref to access current setlist context in socket handlers
  const currentSongIdRef = useRef(null); // Ref to track current song ID
  const isInternalNavigationRef = useRef(false); // Track if we're navigating within setlist (don't disconnect socket)

  // Store transposition per song ID to remember transposition when navigating
  const songTranspositionsRef = useRef(new Map());

  // Track if we've initialized transposition for current song to prevent race conditions
  const transpositionInitializedRef = useRef(null);

  // Track if we just received a leader command (to prevent initialization override)
  const leaderCommandReceivedRef = useRef(false);

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
  const [columnMode, setColumnMode] = useState(null); // null = auto, 1 = single, 2 = two columns
  const [autoColumnCount, setAutoColumnCount] = useState(1); // tracks what auto mode calculated
  const [transposition, setTransposition] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showKeySelectorModal, setShowKeySelectorModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [showControlsDrawer, setShowControlsDrawer] = useState(false);
  const drawerTouchStartY = useRef(null);
  const [expandedFontSize, setExpandedFontSize] = useState(16);
  const [autoFontSize, setAutoFontSize] = useState(16);
  const [savedFontSize, setSavedFontSize] = useState(null); // to restore when header is shown
  const [savedColumnMode, setSavedColumnMode] = useState(null); // to restore when header is shown
  const contentRef = useRef(null);

  // Real-time sync state
  // Persist follow mode across song navigations using sessionStorage
  const [isFollowMode, setIsFollowMode] = useState(() => {
    const stored = sessionStorage.getItem('followMode');
    return stored !== null ? stored === 'true' : false; // Default to free mode
  });
  const [isLeader, setIsLeader] = useState(false);
  const [socketConnected, setSocketConnected] = useState(true); // Track socket connection status

  // Get previous and next songs from setlist
  const hasPrevious = setlistContext && currentSetlistIndex > 0;
  const hasNext = setlistContext && currentSetlistIndex < setlistContext.setlist.length - 1;
  const nextSong = hasNext ? setlistContext.setlist[currentSetlistIndex + 1] : null;
  const previousSong = hasPrevious ? setlistContext.setlist[currentSetlistIndex - 1] : null;

  // Save follow mode to sessionStorage and keep ref in sync
  useEffect(() => {
    sessionStorage.setItem('followMode', isFollowMode.toString());
    isFollowModeRef.current = isFollowMode;
  }, [isFollowMode]);


  // Keep setlistContext and song ID refs in sync for socket handlers
  useEffect(() => {
    setlistContextRef.current = setlistContext;
  }, [setlistContext]);

  // Keep isLeader state in sync with setlistContext
  useEffect(() => {
    if (setlistContext?.isLeader !== undefined) {
      setIsLeader(setlistContext.isLeader);
    }
  }, [setlistContext?.isLeader]);

  useEffect(() => {
    currentSongIdRef.current = id;
  }, [id]);

  useEffect(() => {
    let isMounted = true;

    const SONG_CACHE_KEY = `soluflow_song_${id}`;

    const getCachedSong = () => {
      try {
        const cached = localStorage.getItem(SONG_CACHE_KEY);
        return cached ? JSON.parse(cached) : null;
      } catch {
        return null;
      }
    };

    const cacheSong = (songData) => {
      try {
        localStorage.setItem(SONG_CACHE_KEY, JSON.stringify(songData));
      } catch (e) {
        console.warn('Failed to cache song to localStorage:', e);
      }
    };

    const fetchSong = async () => {
      try {
        setLoading(true);

        // If offline, use cached data immediately
        if (!navigator.onLine) {
          const cachedSong = getCachedSong();
          if (cachedSong && isMounted) {
            setSong(cachedSong);
            setError(null);
            setLoading(false);
            return;
          }
        }

        const data = await songService.getSongById(id);

        if (isMounted) {
          setSong(data);
          setError(null);
          // Cache song for offline use
          cacheSong(data);
        }
      } catch (err) {
        // Ignore abort errors
        if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return;

        if (isMounted) {
          console.error('Error fetching song:', err);
          // Try to load from cache on error
          const cachedSong = getCachedSong();
          if (cachedSong) {
            setSong(cachedSong);
            setError(null);
          } else {
            setError('Failed to load song. Please try again.');
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchSong();

    return () => {
      isMounted = false;
    };
  }, [id]);

  // Initialize and manage transposition when song ID changes
  useEffect(() => {
    if (!id) return;

    // Check if this is a new song (different from the last initialized one)
    if (transpositionInitializedRef.current === id) {
      // Already initialized for this song, don't reset
      return;
    }


    // If we just received a leader command, wait briefly for leader-transposed event
    // Don't mark as initialized yet - fallback will handle if event doesn't arrive
    if (!isLeader && isFollowMode && leaderCommandReceivedRef.current) {
      // Don't set transpositionInitializedRef here - let leader-transposed or fallback do it
      return;
    }

    // Determine initial transposition value
    let initialTranspose = 0;

    // Priority 1: Check if we have a stored value for this song from previous views
    if (songTranspositionsRef.current.has(id)) {
      initialTranspose = songTranspositionsRef.current.get(id);
    }
    // Priority 2: Check if there's transposition in setlist context
    else if (setlistContext?.setlist) {
      const songInSetlist = setlistContext.setlist.find(s => s.id.toString() === id);
      if (songInSetlist && songInSetlist.transposition !== undefined) {
        initialTranspose = songInSetlist.transposition;
      }
    }

    // Set transposition and mark as initialized
    setTransposition(initialTranspose);
    songTranspositionsRef.current.set(id, initialTranspose);
    transpositionInitializedRef.current = id;

  }, [id, setlistContext, isLeader, isFollowMode]);

  // Save transposition changes to the map (separate from initialization)
  useEffect(() => {
    if (id && transpositionInitializedRef.current === id) {
      // Only update map after initialization is complete for current song
      songTranspositionsRef.current.set(id, transposition);
    }
  }, [transposition, id]);

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

    // Throttled resize handler using requestAnimationFrame
    let resizeTimeout = null;
    const handleResize = () => {
      if (resizeTimeout) return; // Skip if already scheduled
      resizeTimeout = requestAnimationFrame(() => {
        resizeTimeout = null;
        if (!isExpanded) {
          calculateNormalModeFontSize();
        }
      });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      if (resizeTimeout) cancelAnimationFrame(resizeTimeout);
      window.removeEventListener('resize', handleResize);
    };
  }, [song, isExpanded]);

  // Socket.IO connection for real-time sync
  // Extract serviceId to use as a stable dependency - socket stays connected across song navigations
  const serviceId = setlistContext?.serviceId;
  const connectedServiceIdRef = useRef(null); // Track which service we're connected to

  useEffect(() => {
    if (!serviceId) return;

    // In SongView, check if we're passed the isLeader flag from Service page
    // Read directly from setlistContext (not ref) since ref might not be set yet on first render
    const userIsLeader = setlistContext?.isLeader === true;
    setIsLeader(userIsLeader);

    // Skip socket setup if offline - real-time sync not available
    if (!navigator.onLine) {
      console.log('[SongView] Offline - skipping socket connection');
      setSocketConnected(false);
      return;
    }

    // Skip socket setup if already connected to this service
    if (socketRef.current?.connected && connectedServiceIdRef.current === serviceId) {
      console.log('[SongView] Socket already connected to service', serviceId);
      return;
    }

    // Disconnect previous socket if connected to a different service
    if (socketRef.current && connectedServiceIdRef.current !== serviceId) {
      console.log('[SongView] Switching service, disconnecting old socket');
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    connectedServiceIdRef.current = serviceId;

    // Connect to Socket.IO server
    const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:5002';
    socketRef.current = io(serverUrl, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000
    });


    socketRef.current.on('connect', () => {
      setSocketConnected(true);

      // Join the service room
      const userId = user?.id || `guest-${socketRef.current.id}`;

      socketRef.current.emit('join-service', {
        serviceId: serviceId,
        userId: userId,
        userRole: user?.role || 'guest',
        isLeader: userIsLeader
      });
    });

    // Handle disconnection
    socketRef.current.on('disconnect', (reason) => {
      setSocketConnected(false);
    });

    // Handle reconnection
    socketRef.current.on('reconnect', (attemptNumber) => {
      setSocketConnected(true);

      // Rejoin the service room after reconnection
      const userId = user?.id || `guest-${socketRef.current.id}`;
      socketRef.current.emit('join-service', {
        serviceId: serviceId,
        userId: userId,
        userRole: user?.role || 'guest',
        isLeader: userIsLeader
      });
    });

    // Handle reconnection attempts
    socketRef.current.on('reconnect_attempt', (attemptNumber) => {
    });

    // Handle reconnection errors
    socketRef.current.on('reconnect_error', (error) => {
      console.error('Socket.IO reconnection error:', error);
    });

    // Handle reconnection failure
    socketRef.current.on('reconnect_failed', () => {
      console.error('Socket.IO reconnection failed');
      setToastMessage('Connection lost. Please refresh the page.');
      setShowToast(true);
    });

    // Listen for leader events (only if not leader and in follow mode)
    // Use refs to always get the latest values without causing socket reconnection
    socketRef.current.on('leader-navigated', ({ songId, songIndex, transposition: leaderTransposition }) => {
      const currentSetlistContext = setlistContextRef.current;
      const currentSongId = currentSongIdRef.current;

      if (!userIsLeader && isFollowModeRef.current && currentSetlistContext?.setlist) {
        // Navigate to the new song
        const newSong = currentSetlistContext.setlist[songIndex];
        if (newSong && newSong.id.toString() !== currentSongId) {
          // Apply transposition immediately if provided (no need to wait for separate event)
          if (leaderTransposition !== undefined) {
            console.log('[SongView] Applying transposition from leader-navigated:', leaderTransposition);
            setTransposition(leaderTransposition);
            songTranspositionsRef.current.set(newSong.id.toString(), leaderTransposition);
            transpositionInitializedRef.current = newSong.id.toString();
            leaderCommandReceivedRef.current = false;
          } else {
            // Fallback for old clients: wait for leader-transpose event
            leaderCommandReceivedRef.current = true;
            // Failsafe: if leader-transposed doesn't arrive within 2.5s, load from setlist
            setTimeout(() => {
              if (leaderCommandReceivedRef.current) {
                leaderCommandReceivedRef.current = false;
                const fallbackSong = currentSetlistContext?.setlist?.[songIndex];
                if (fallbackSong && fallbackSong.transposition !== undefined) {
                  console.log('[SongView] Fallback: loading transposition from setlist:', fallbackSong.transposition);
                  setTransposition(fallbackSong.transposition);
                  songTranspositionsRef.current.set(fallbackSong.id.toString(), fallbackSong.transposition);
                  transpositionInitializedRef.current = fallbackSong.id.toString();
                }
              }
            }, 2500);
          }

          isInternalNavigationRef.current = true;
          navigate(`/song/${newSong.id}`, {
            state: {
              ...currentSetlistContext,
              currentIndex: songIndex
            },
            replace: true
          });
        }
      }
    });

    socketRef.current.on('leader-transposed', ({ transposition: newTransposition, songId: eventSongId }) => {
      const currentSongId = currentSongIdRef.current;

      if (!userIsLeader && isFollowModeRef.current) {
        // Verify songId matches current song to prevent applying wrong transposition
        if (eventSongId && eventSongId.toString() !== currentSongId) {
          console.log('[SongView] Ignoring transposition for different song:', eventSongId, 'vs current:', currentSongId);
          return;
        }

        setTransposition(newTransposition);
        songTranspositionsRef.current.set(currentSongId, newTransposition);

        // Mark this song as initialized with leader's transposition
        transpositionInitializedRef.current = currentSongId;

        // Clear the flag after applying leader's transposition
        // Use timeout to ensure flag gets cleared even if multiple events arrive
        setTimeout(() => {
          leaderCommandReceivedRef.current = false;
        }, 100);
      }
    });

    // Font size, display mode, and layout are personal preferences - not synced
    // Only navigation and transpose are synced with followers

    socketRef.current.on('sync-state', (state) => {
      const currentSetlistContext = setlistContextRef.current;
      const currentSongId = currentSongIdRef.current;

      if (!userIsLeader && isFollowModeRef.current) {
        if (state.currentSongIndex !== undefined && currentSetlistContext?.setlist) {
          const syncSong = currentSetlistContext.setlist[state.currentSongIndex];
          if (syncSong && syncSong.id.toString() !== currentSongId) {
            isInternalNavigationRef.current = true;
            navigate(`/song/${syncSong.id}`, {
              state: {
                ...currentSetlistContext,
                currentIndex: state.currentSongIndex
              },
              replace: true
            });
          }
        }
        if (state.transposition !== undefined) {
          setTransposition(state.transposition);
        }
        // Font size is personal preference - not synced
      }
    });

    socketRef.current.on('room-update', ({ leaderSocketId, followerCount }) => {
    });

    // Handle leader disconnection - switch to free mode
    socketRef.current.on('leader-disconnected', ({ message }) => {
      if (!userIsLeader) {
        setIsFollowMode(false); // Automatically switch to free mode
        setToastMessage(message || 'Leader disconnected - switched to free mode');
        setShowToast(true);
      }
    });

    // Handle leader reconnection
    socketRef.current.on('leader-reconnected', ({ message }) => {
      if (!userIsLeader) {
        setToastMessage(message || 'Leader reconnected - you can enable follow mode');
        setShowToast(true);
      }
    });

    // Cleanup on unmount or when dependencies change
    return () => {
      // Skip cleanup if we're navigating within the setlist (socket should stay connected)
      if (isInternalNavigationRef.current) {
        console.log('[SongView] Cleanup: internal navigation, keeping socket connected');
        isInternalNavigationRef.current = false; // Reset for next time
        return;
      }

      if (socketRef.current) {
        console.log('[SongView] Cleanup: leaving service, disconnecting socket');

        // Remove all event listeners to prevent memory leaks
        socketRef.current.off('connect');
        socketRef.current.off('disconnect');
        socketRef.current.off('reconnect');
        socketRef.current.off('reconnect_attempt');
        socketRef.current.off('reconnect_error');
        socketRef.current.off('reconnect_failed');
        socketRef.current.off('leader-navigated');
        socketRef.current.off('leader-transposed');
        socketRef.current.off('sync-state');
        socketRef.current.off('room-update');
        socketRef.current.off('leader-disconnected');
        socketRef.current.off('leader-reconnected');

        // Leave service room and disconnect
        socketRef.current.emit('leave-service', { serviceId: serviceId });
        socketRef.current.disconnect();
        socketRef.current = null;
        connectedServiceIdRef.current = null;
      }
    };
  }, [serviceId, user]); // Removed navigate - it's stable and doesn't need to trigger reconnection

  // Keyboard navigation - must be before early returns
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (!setlistContext) return;

      if (e.key === 'ArrowRight' && hasNext) {
        const nextSongId = setlistContext.setlist[currentSetlistIndex + 1].id;
        isInternalNavigationRef.current = true;
        navigate(`/song/${nextSongId}`, {
          state: {
            ...setlistContext,
            currentIndex: currentSetlistIndex + 1
          },
          replace: true
        });
      } else if (e.key === 'ArrowLeft' && hasPrevious) {
        const prevSongId = setlistContext.setlist[currentSetlistIndex - 1].id;
        isInternalNavigationRef.current = true;
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

  // Recalculate font size when song changes in expanded mode
  useEffect(() => {
    if (isExpanded && song) {
      // When navigating to a new song in expanded mode, recalculate optimal font size
      setTimeout(() => {
        calculateOptimalFontSize();
      }, 200); // Give time for new content to render
    }
  }, [id, song, isExpanded]);

  // Calculate optimal font size when header is hidden (fullscreen mode)
  const calculateFullscreenFontSize = () => {
    if (!contentRef.current) return;

    const container = contentRef.current;
    const chordDisplay = container.querySelector('.chordpro-display');
    if (!chordDisplay) return;

    // Use viewport height as available space (full screen mode)
    const availableHeight = window.innerHeight - 20; // small buffer


    // Binary search for the largest font size that fits vertically
    let minSize = 10;
    let maxSize = 50;
    let optimalSize = minSize;

    // Save original font size
    const originalFontSize = chordDisplay.style.fontSize;

    for (let i = 0; i < 10; i++) {
      const testSize = (minSize + maxSize) / 2;

      // Apply test font size
      chordDisplay.style.fontSize = `${testSize}px`;

      // Force reflow
      void chordDisplay.offsetHeight;

      // Check if content fits vertically (height is the constraint, not width)
      const contentHeight = chordDisplay.scrollHeight;

      const fits = contentHeight <= availableHeight;


      if (fits) {
        optimalSize = testSize;
        minSize = testSize;
      } else {
        maxSize = testSize;
      }

      if (maxSize - minSize < 0.5) break;
    }

    // Restore original font size temporarily (React will apply the new one)
    chordDisplay.style.fontSize = originalFontSize;


    return Math.floor(optimalSize);
  };

  // Auto-calculate font size when header is hidden
  useEffect(() => {
    if (!showHeader && song) {
      // Save current settings before changing
      setSavedFontSize(fontSize);
      setSavedColumnMode(columnMode);

      // Force single column in fullscreen mode
      setColumnMode(1);

      // Wait for DOM to update with header-hidden class
      setTimeout(() => {
        const optimalSize = calculateFullscreenFontSize();
        if (optimalSize) {
          setFontSize(optimalSize);
        }
      }, 100);
    } else if (showHeader && savedFontSize !== null) {
      // Restore saved settings when header is shown
      setFontSize(savedFontSize);
      setColumnMode(savedColumnMode);
      setSavedFontSize(null);
      setSavedColumnMode(null);
    }
  }, [showHeader, song]);

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
    const newFontSize = Math.min(fontSize + 2, 28);
    setFontSize(newFontSize);
    // Font size is a personal preference - not synced with followers
  };

  const zoomOut = () => {
    const newFontSize = Math.max(fontSize - 2, 12);
    setFontSize(newFontSize);
    // Font size is a personal preference - not synced with followers
  };

  const transposeUp = async () => {
    const newTransposition = Math.min(transposition + 1, 11);
    setTransposition(newTransposition);

    // Update setlist context in memory
    if (setlistContext?.setlist && currentSetlistIndex >= 0) {
      const updatedSetlist = [...setlistContext.setlist];
      updatedSetlist[currentSetlistIndex] = {
        ...updatedSetlist[currentSetlistIndex],
        transposition: newTransposition
      };
      // Update in place for next navigation
      setlistContext.setlist = updatedSetlist;
    }

    // Save transposition to database immediately
    if (setlistContext?.serviceId && id) {
      try {
        await serviceService.updateSongTransposition(setlistContext.serviceId, id, newTransposition);
      } catch (error) {
        console.error('[SongView] Failed to save transposition:', error);
      }
    }

    // Broadcast to followers if user is leader (include songId for verification)
    if (isLeader && socketRef.current && setlistContext?.serviceId) {
      socketRef.current.emit('leader-transpose', {
        serviceId: setlistContext.serviceId,
        transposition: newTransposition,
        songId: id
      });
    }
  };

  const transposeDown = async () => {
    const newTransposition = Math.max(transposition - 1, -11);
    setTransposition(newTransposition);

    // Update setlist context in memory
    if (setlistContext?.setlist && currentSetlistIndex >= 0) {
      const updatedSetlist = [...setlistContext.setlist];
      updatedSetlist[currentSetlistIndex] = {
        ...updatedSetlist[currentSetlistIndex],
        transposition: newTransposition
      };
      setlistContext.setlist = updatedSetlist;
    }

    // Save transposition to database immediately
    if (setlistContext?.serviceId && id) {
      try {
        await serviceService.updateSongTransposition(setlistContext.serviceId, id, newTransposition);
      } catch (error) {
        console.error('[SongView] Failed to save transposition:', error);
      }
    }

    // Broadcast to followers if user is leader (include songId for verification)
    if (isLeader && socketRef.current && setlistContext?.serviceId) {
      socketRef.current.emit('leader-transpose', {
        serviceId: setlistContext.serviceId,
        transposition: newTransposition,
        songId: id
      });
    }
  };

  const resetTransposition = async () => {
    setTransposition(0);

    // Update setlist context in memory
    if (setlistContext?.setlist && currentSetlistIndex >= 0) {
      const updatedSetlist = [...setlistContext.setlist];
      updatedSetlist[currentSetlistIndex] = {
        ...updatedSetlist[currentSetlistIndex],
        transposition: 0
      };
      setlistContext.setlist = updatedSetlist;
    }

    // Save transposition to database immediately
    if (setlistContext?.serviceId && id) {
      try {
        await serviceService.updateSongTransposition(setlistContext.serviceId, id, 0);
      } catch (error) {
        console.error('[SongView] Failed to save transposition reset:', error);
      }
    }

    // Broadcast to followers if user is leader (include songId for verification)
    if (isLeader && socketRef.current && setlistContext?.serviceId) {
      socketRef.current.emit('leader-transpose', {
        serviceId: setlistContext.serviceId,
        transposition: 0,
        songId: id
      });
    }
  };

  const handleSelectKey = async (newTransposition) => {
    setTransposition(newTransposition);

    // Update setlist context in memory
    if (setlistContext?.setlist && currentSetlistIndex >= 0) {
      const updatedSetlist = [...setlistContext.setlist];
      updatedSetlist[currentSetlistIndex] = {
        ...updatedSetlist[currentSetlistIndex],
        transposition: newTransposition
      };
      setlistContext.setlist = updatedSetlist;
    }

    // Save transposition to database immediately
    if (setlistContext?.serviceId && id) {
      try {
        await serviceService.updateSongTransposition(setlistContext.serviceId, id, newTransposition);
      } catch (error) {
        console.error('[SongView] Failed to save key selection:', error);
      }
    }

    // Broadcast to followers if user is leader (include songId for verification)
    if (isLeader && socketRef.current && setlistContext?.serviceId) {
      socketRef.current.emit('leader-transpose', {
        serviceId: setlistContext.serviceId,
        transposition: newTransposition,
        songId: id
      });
    }
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
    const nextSong = setlistContext.setlist[currentSetlistIndex + 1];
    const nextSongId = nextSong.id;
    const newIndex = currentSetlistIndex + 1;
    setCurrentSetlistIndex(newIndex);

    // Broadcast to followers if user is leader
    // Include transposition in navigation event for immediate sync
    const nextSongTransposition = nextSong.transposition || 0;
    if (isLeader && socketRef.current && setlistContext?.serviceId) {
      socketRef.current.emit('leader-navigate', {
        serviceId: setlistContext.serviceId,
        songId: nextSongId,
        songIndex: newIndex,
        transposition: nextSongTransposition
      });
    }

    // Mark as internal navigation to keep socket connected
    isInternalNavigationRef.current = true;
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
    const prevSong = setlistContext.setlist[currentSetlistIndex - 1];
    const prevSongId = prevSong.id;
    const newIndex = currentSetlistIndex - 1;
    setCurrentSetlistIndex(newIndex);

    // Broadcast to followers if user is leader
    // Include transposition in navigation event for immediate sync
    const prevSongTransposition = prevSong.transposition || 0;
    if (isLeader && socketRef.current && setlistContext?.serviceId) {
      socketRef.current.emit('leader-navigate', {
        serviceId: setlistContext.serviceId,
        songId: prevSongId,
        songIndex: newIndex,
        transposition: prevSongTransposition
      });
    }

    // Mark as internal navigation to keep socket connected
    isInternalNavigationRef.current = true;
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

    if (!isExpanded) {
      // Entering expanded mode - calculate optimal font size
      setIsExpanded(true);

      // Use setTimeout to allow DOM to update first
      setTimeout(() => {
        calculateOptimalFontSize();
      }, 100);
    } else {
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


    // Binary search for optimal font size
    let minSize = 12;
    let maxSize = 28; // Max font size for normal mode
    let optimalSize = minSize;
    const buffer = 20; // Larger buffer for normal mode

    for (let i = 0; i < 10; i++) {
      const testSize = (minSize + maxSize) / 2;

      // Apply test font size
      chordDisplay.style.fontSize = `${testSize}px`;

      // Force reflow
      void chordDisplay.offsetHeight;

      // Check if content fits
      const contentHeight = chordDisplay.scrollHeight;

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


    if (totalLines === 0) {
      console.error('No lines found in content!');
      return;
    }

    // Calculate initial font size estimate
    const neededLineHeight = availableHeight / totalLines;
    const initialFontSize = neededLineHeight / lineHeightRatio;


    // Binary search for the largest font size that doesn't cause scrolling
    let minSize = 10;
    let maxSize = Math.min(100, Math.floor(initialFontSize * 1.2)); // Start slightly above estimate
    let optimalSize = minSize;

    for (let i = 0; i < 10; i++) {
      const testSize = (minSize + maxSize) / 2;

      // Apply test font size
      chordDisplay.style.fontSize = `${testSize}px`;

      // Force reflow
      void chordDisplay.offsetHeight;

      // Check if content fits (no scrolling needed) - both height AND width
      const contentHeight = chordDisplay.scrollHeight;
      const containerHeight = container.clientHeight;
      const contentWidth = chordDisplay.scrollWidth;
      const containerWidth = container.clientWidth;
      const buffer = 10;

      const heightFits = contentHeight <= containerHeight - buffer;
      const widthFits = contentWidth <= containerWidth - buffer;

      if (heightFits && widthFits) {
        optimalSize = testSize;
        minSize = testSize;
      } else {
        maxSize = testSize;
      }

      if (maxSize - minSize < 0.5) {
        break;
      }
    }


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
    <div className={`song-view-page ${!showHeader ? 'header-hidden' : ''}`}>
      {/* Header */}
      {!isExpanded && showHeader && (
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
            {setlistContext?.serviceId && !socketConnected && (
              <div className="connection-status disconnected" title="Connection lost - attempting to reconnect">
                ⚠️ Disconnected
              </div>
            )}
            {isAuthenticated && (user?.role === 'admin' || song.created_by === user?.id) && (
              <>
                <button className="btn-edit-header" onClick={handleEditSong}>Edit</button>
                {user?.role === 'admin' && (
                  <button className="btn-delete-header" onClick={handleDeleteSong}>Delete</button>
                )}
              </>
            )}
            {song.is_public && (
              <button className="btn-report-header" onClick={() => setShowReportModal(true)}>
                Report
              </button>
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
              <span className="control-info" dir="ltr">Key: {convertKeyToFlat(transposeChord(song.key, transposition))}</span>
              {song.bpm && <span className="control-info" dir="ltr">BPM: {song.bpm}{song.time_signature && ` (${song.time_signature})`}</span>}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Controls Button - Opens drawer */}
      <button
        className="btn-controls-toggle"
        onClick={() => setShowControlsDrawer(true)}
        title="Song controls"
      >
        <span className="controls-icon">☰</span>
      </button>

      {/* Controls Drawer */}
      {showControlsDrawer && (
        <div className="controls-drawer-overlay" onClick={() => setShowControlsDrawer(false)}>
          <div
            className="controls-drawer"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => {
              drawerTouchStartY.current = e.touches[0].clientY;
            }}
            onTouchEnd={(e) => {
              if (drawerTouchStartY.current !== null) {
                const touchEndY = e.changedTouches[0].clientY;
                const swipeDistance = touchEndY - drawerTouchStartY.current;
                // If swiped down more than 50px, close the drawer
                if (swipeDistance > 50) {
                  setShowControlsDrawer(false);
                }
                drawerTouchStartY.current = null;
              }
            }}
          >
            <div className="drawer-handle" onClick={() => setShowControlsDrawer(false)} />

            <div className="drawer-section">
              <label className="drawer-label">Key / Transpose</label>
              <div className="transpose-controls-drawer">
                <button className="btn-drawer btn-transpose" onClick={transposeDown}>−</button>
                <span
                  className="transpose-display-drawer"
                  onClick={() => {
                    setShowControlsDrawer(false);
                    setShowKeySelectorModal(true);
                  }}
                >
                  {convertKeyToFlat(transposeChord(song.key, transposition))}
                  {transposition !== 0 && (
                    <span className="transpose-offset">
                      {transposition > 0 ? '+' : ''}{transposition}
                    </span>
                  )}
                </span>
                <button className="btn-drawer btn-transpose" onClick={transposeUp}>+</button>
              </div>
            </div>

            <div className="drawer-section">
              <label className="drawer-label">Display</label>
              <div className="drawer-row">
                <button
                  className={`btn-drawer-toggle ${!isLyricsOnly ? 'active' : ''}`}
                  onClick={() => setIsLyricsOnly(false)}
                >
                  Chords
                </button>
                <button
                  className={`btn-drawer-toggle ${isLyricsOnly ? 'active' : ''}`}
                  onClick={() => setIsLyricsOnly(true)}
                >
                  Lyrics Only
                </button>
              </div>
            </div>

            <div className="drawer-section">
              <label className="drawer-label">Layout</label>
              <div className="drawer-row">
                <button
                  className={`btn-drawer-toggle ${columnMode === null ? 'active' : ''}`}
                  onClick={() => setColumnMode(null)}
                >
                  Auto
                </button>
                <button
                  className={`btn-drawer-toggle ${columnMode === 1 ? 'active' : ''}`}
                  onClick={() => setColumnMode(1)}
                >
                  Single
                </button>
                <button
                  className={`btn-drawer-toggle ${columnMode === 2 ? 'active' : ''}`}
                  onClick={() => setColumnMode(2)}
                >
                  Compact
                </button>
              </div>
            </div>

            <div className="drawer-section">
              <label className="drawer-label">Text Size</label>
              <div className="zoom-controls-drawer">
                <button className="btn-drawer btn-zoom" onClick={zoomOut}>
                  <span className="zoom-a-small">A</span>
                </button>
                <span className="zoom-display">{fontSize}px</span>
                <button className="btn-drawer btn-zoom" onClick={zoomIn}>
                  <span className="zoom-a-large">A</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons - Fixed position */}
      {setlistContext && (
        <>
          {hasPrevious && (
            <button
              className={`btn-nav-song ${isRTL ? 'btn-next-song' : 'btn-prev-song'}`}
              onClick={(e) => {
                e.stopPropagation(); // Prevent triggering toggleExpanded in expanded mode
                goToPreviousSong();
              }}
            >
              ‹
            </button>
          )}
          {hasNext && (
            <button
              className={`btn-nav-song ${isRTL ? 'btn-prev-song' : 'btn-next-song'}`}
              onClick={(e) => {
                e.stopPropagation(); // Prevent triggering toggleExpanded in expanded mode
                goToNextSong();
              }}
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
        className="song-view-content"
        onClick={() => setShowHeader(prev => !prev)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: 'pointer' }}
        title={showHeader ? 'Click to hide header' : 'Click to show header'}
      >
        <ChordProDisplay
          content={song.content}
          isLyricsOnly={isLyricsOnly}
          dir={hasHebrew ? 'rtl' : 'ltr'}
          fontSize={fontSize}
          transposition={transposition}
          songKey={song.key}
          forcedColumnCount={columnMode}
          onAutoColumnCountChange={setAutoColumnCount}
        />
      </div>

      {/* Next Song Indicator - below song content */}
      {!isExpanded && nextSong && (
        <div className="next-song-indicator">
          <span className="next-label">{isRTL ? 'הבא ←' : 'Next:'}</span>
          <span className="next-song-title">{nextSong.title}</span>
          <span className="next-song-meta">
            {convertKeyToFlat(nextSong.key)}{nextSong.bpm ? ` • ${nextSong.bpm} BPM${nextSong.time_signature ? ` (${nextSong.time_signature})` : ''}` : ''}
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

      {/* Key Selector Modal */}
      <KeySelectorModal
        isOpen={showKeySelectorModal}
        onClose={() => setShowKeySelectorModal(false)}
        currentKey={song.key}
        currentTransposition={transposition}
        onSelectKey={handleSelectKey}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Song"
        message={`Are you sure you want to delete "${song.title}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      {/* Report Modal */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        songId={song.id}
        songTitle={song.title}
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
