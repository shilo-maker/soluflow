import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useTheme, GRADIENT_PRESETS } from '../contexts/ThemeContext';
import useWakeLock from '../hooks/useWakeLock';
import serviceService from '../services/serviceService';
import workspaceService from '../services/workspaceService';
import ChordProDisplay from '../components/ChordProDisplay';
import ServiceEditModal from '../components/ServiceEditModal';
import SetlistBuilder from '../components/SetlistBuilder';
import ShareModal from '../components/ShareModal';
import PassLeadershipModal from '../components/PassLeadershipModal';
import KeySelectorModal from '../components/KeySelectorModal';
import Toast from '../components/Toast';
import { transposeChord, convertKeyToFlat } from '../utils/transpose';
import { generateMultiSongPDF, generateMultiSongPDFBlob } from '../utils/pdfGenerator';
import { ArrowLeft, MoreVertical, Calendar, MapPin } from 'lucide-react';
import io from 'socket.io-client';
import './Service.css';

// Stable empty array reference to prevent re-render loops in child components
const EMPTY_ARRAY = [];

// Pure helpers — defined outside component to avoid re-creation on every render
const hasHebrew = (text) => /[\u0590-\u05FF]/.test(text || '');

const getPreviewContent = (content) => {
  if (!content) return '';
  const lines = content.split('\n');
  if (lines.length <= 20) return content;
  return lines.slice(0, 20).join('\n') + '\n...';
};

const parsePrayerContent = (segmentContent) => {
  if (!segmentContent) return {};
  try {
    return typeof segmentContent === 'string'
      ? JSON.parse(segmentContent)
      : segmentContent;
  } catch { return {}; }
};

const Service = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { activeWorkspace } = useWorkspace();
  const { theme } = useTheme();
  const currentPreset = GRADIENT_PRESETS[theme.gradientPreset] || GRADIENT_PRESETS.warm;

  // Keep screen awake while in service view
  useWakeLock(true);

  const songPillsRef = useRef(null);
  const tabsScrollRef = useRef(null);
  const tabsFadeRef = useRef(null);
  const socketRef = useRef(null);
  const previousServiceIdRef = useRef(null);
  const isFollowModeRef = useRef(false); // Ref to access current follow mode in socket handlers
  const transpositionSaveTimerRef = useRef(null); // Debounce timer for transposition saves
  const currentSongIdRef = useRef(null); // Track current song ID for socket handler validation

  const [selectedService, setSelectedService] = useState(null);
  const [serviceDetails, setServiceDetails] = useState(null);
  const [selectedSongIndex, setSelectedSongIndex] = useState(0);
  const [fontSize, setFontSize] = useState(14);
  const [transposition, setTransposition] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalService, setModalService] = useState(null);
  const [isSetlistBuilderOpen, setIsSetlistBuilderOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [showToast, setShowToast] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [serviceToShare, setServiceToShare] = useState(null);
  const [isPassLeadershipModalOpen, setIsPassLeadershipModalOpen] = useState(false);
  const [serviceToPassLeadership, setServiceToPassLeadership] = useState(null);
  const [showKeySelectorModal, setShowKeySelectorModal] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [showControlsDrawer, setShowControlsDrawer] = useState(false);
  const [isLyricsOnly, setIsLyricsOnly] = useState(false);
  const [columnMode, setColumnMode] = useState(null); // null = auto, 1 = single, 2 = two columns
  const drawerTouchStartY = useRef(null);

  // Real-time sync state
  const [isFollowMode, setIsFollowMode] = useState(false); // Default to free mode

  // Keep ref in sync with state for socket handlers
  useEffect(() => {
    isFollowModeRef.current = isFollowMode;
  }, [isFollowMode]);
  const [isLeader, setIsLeader] = useState(false);
  const [isWorkspaceAdmin, setIsWorkspaceAdmin] = useState(false);
  const [socketConnected, setSocketConnected] = useState(true); // Track socket connection status

  // Drag-to-scroll state
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);


  // If no :id param, redirect to /services list
  useEffect(() => {
    if (!id) {
      navigate('/services', { replace: true });
    }
  }, [id, navigate]);

  // Fetch service by ID from URL param
  useEffect(() => {
    let isMounted = true;

    const fetchServiceById = async () => {
      if (!id || !user) {
        if (isMounted) { setLoading(false); }
        return;
      }

      try {
        setLoading(true);
        const data = await serviceService.getServiceById(id);
        if (isMounted) {
          const today = new Date().toISOString().split('T')[0];
          const enriched = {
            ...data,
            isCreator: data.created_by === user?.id,
            canEdit: data.created_by === user?.id || data.leader_id === user?.id || user?.role === 'admin',
            isToday: data.date === today,
            isPast: data.date ? data.date < today : false,
            isShared: data.isShared || false,
          };
          setSelectedService(enriched);
          setServiceDetails(data);
          setError(null);
        }
      } catch (err) {
        if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return;
        if (isMounted) {
          console.error('Error fetching service:', err);
          setError('Failed to load service.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchServiceById();
    return () => { isMounted = false; };
  }, [id, user]);

  // Debounced transposition save to database
  // Fixed: Capture song ID at timer creation and verify it still matches at save time
  useEffect(() => {
    // Clear any existing timer
    if (transpositionSaveTimerRef.current) {
      clearTimeout(transpositionSaveTimerRef.current);
    }

    // Don't save if no service or song selected
    if (!selectedService || !serviceDetails?.songs?.[selectedSongIndex]) {
      return;
    }

    const currentSong = serviceDetails.songs[selectedSongIndex];

    // Skip transposition saves for prayer items (they don't have transposition)
    if (currentSong.segment_type === 'prayer') return;

    const currentTransposition = transposition;
    const currentSongId = currentSong.id;
    const currentServiceId = selectedService.id;
    const currentSongIdx = selectedSongIndex;

    // Skip if transposition matches what's already saved
    if (currentSong.transposition === currentTransposition) {
      return;
    }

    // Debounce the save - wait 800ms after last change
    transpositionSaveTimerRef.current = setTimeout(async () => {
      try {
        // Save using the captured song ID (correct song even if user switched)
        await serviceService.updateSongTransposition(currentServiceId, currentSongId, currentTransposition);
        // Update local state - find song by ID to handle index changes
        setServiceDetails(prev => {
          if (!prev?.songs) return prev;
          return {
            ...prev,
            songs: prev.songs.map((song) =>
              song.id === currentSongId ? { ...song, transposition: currentTransposition } : song
            )
          };
        });
        console.log(`[Service] Saved transposition ${currentTransposition} for song ${currentSongId}`);
      } catch (error) {
        console.error('[Service] Failed to save transposition:', error);
      }
    }, 800);

    return () => {
      if (transpositionSaveTimerRef.current) {
        clearTimeout(transpositionSaveTimerRef.current);
      }
    };
  }, [transposition, selectedService, serviceDetails, selectedSongIndex]);

  // Re-fetch service details when navigating back (location.key changes)
  useEffect(() => {
    if (!selectedService || !location.key) return;
    // Skip if this is the initial load (previousServiceIdRef not set yet)
    if (previousServiceIdRef.current === null) {
      previousServiceIdRef.current = selectedService.id;
      return;
    }

    const refetchDetails = async () => {
      try {
        console.log('[Service] Refetching service details on navigation back');
        const details = await serviceService.getServiceById(selectedService.id);
        setServiceDetails(details);
      } catch (err) {
        console.error('Error refetching service details:', err);
      }
    };

    refetchDetails();
  }, [location.key]); // Only re-run when location.key changes (navigation)

  // Load saved transposition when song changes
  useEffect(() => {
    console.log('[Service] useEffect triggered - selectedSongIndex:', selectedSongIndex, 'selectedService:', !!selectedService, 'serviceDetails:', !!serviceDetails, 'songs:', !!serviceDetails?.songs);
    if (!selectedService || !serviceDetails?.songs?.[selectedSongIndex]) {
      console.log('[Service] useEffect early return - condition failed');
      return;
    }

    const currentSong = serviceDetails.songs[selectedSongIndex];
    // Update ref for socket handler validation
    currentSongIdRef.current = currentSong.id?.toString();

    // Read transposition from song object (loaded from database)
    const savedTransposition = currentSong.transposition || 0;

    console.log('[Service] Song changed - Loading transposition for song', currentSong.id, ':', savedTransposition);
    setTransposition(savedTransposition);

    // Broadcast to followers if user is leader (include songId for verification)
    if (isLeader && socketRef.current?.connected && socketConnected && selectedService) {
      socketRef.current.emit('leader-transpose', {
        serviceId: selectedService.id,
        transposition: savedTransposition,
        songId: currentSong.id
      });
    }
  }, [selectedSongIndex, selectedService, serviceDetails, isLeader, socketConnected]);

  // Socket.IO connection and real-time sync
  useEffect(() => {
    if (!selectedService || !user) return;

    // Determine if current user is the leader
    const userIsLeader = selectedService.leader_id === user.id;
    setIsLeader(userIsLeader);

    // Check if user is an admin of the service's workspace
    const checkWorkspaceAdmin = async () => {
      try {
        const members = await workspaceService.getWorkspaceMembers(selectedService.workspace_id);
        const userMembership = members.find(m => m.user_id === user.id);
        setIsWorkspaceAdmin(userMembership?.role === 'admin');
      } catch (err) {
        console.error('Error checking workspace admin status:', err);
        setIsWorkspaceAdmin(false);
      }
    };

    checkWorkspaceAdmin();

    // Connect to Socket.IO server with reconnection config
    const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:5002';
    socketRef.current = io(serverUrl, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000
    });

    console.log('Connecting to Socket.IO...', serverUrl);

    socketRef.current.on('connect', () => {
      console.log('Socket.IO connected:', socketRef.current.id);
      setSocketConnected(true);

      // Join the service room
      socketRef.current.emit('join-service', {
        serviceId: selectedService.id,
        userId: user.id,
        userRole: user.role,
        isLeader: userIsLeader
      });
    });

    // Handle disconnection
    socketRef.current.on('disconnect', (reason) => {
      console.log('Socket.IO disconnected:', reason);
      setSocketConnected(false);
    });

    // Handle reconnection
    socketRef.current.on('reconnect', (attemptNumber) => {
      console.log('Socket.IO reconnected after', attemptNumber, 'attempts');
      setSocketConnected(true);

      // Rejoin the service room after reconnection
      socketRef.current.emit('join-service', {
        serviceId: selectedService.id,
        userId: user.id,
        userRole: user.role,
        isLeader: userIsLeader
      });
    });

    // Handle reconnection attempts
    socketRef.current.on('reconnect_attempt', (attemptNumber) => {
      console.log('Socket.IO reconnection attempt', attemptNumber);
    });

    // Handle reconnection errors
    socketRef.current.on('reconnect_error', (error) => {
      console.error('Socket.IO reconnection error:', error);
    });

    // Handle reconnection failure
    socketRef.current.on('reconnect_failed', () => {
      console.error('Socket.IO reconnection failed');
      showToastMsg('Connection lost. Please refresh the page.', 'error');
    });

    // Listen for leader events (only if not leader and in follow mode)
    // Use isFollowModeRef.current to always get the latest value without causing socket reconnection
    socketRef.current.on('leader-navigated', ({ songId, songIndex, transposition: leaderTransposition }) => {
      if (!userIsLeader && isFollowModeRef.current) {
        console.log('Leader navigated to song:', songId, songIndex, 'transposition:', leaderTransposition);
        setSelectedSongIndex(songIndex);
        // Apply transposition immediately if provided (no race condition)
        if (leaderTransposition !== undefined) {
          setTransposition(leaderTransposition);
        }
      }
    });

    socketRef.current.on('leader-transposed', ({ transposition: newTransposition, songId: eventSongId }) => {
      if (!userIsLeader && isFollowModeRef.current) {
        // Verify songId matches current song to prevent applying wrong transposition
        if (eventSongId && eventSongId.toString() !== currentSongIdRef.current) {
          console.log('[Service] Ignoring transposition for different song:', eventSongId, 'vs current:', currentSongIdRef.current);
          return;
        }
        console.log('Leader transposed to:', newTransposition, 'for song:', eventSongId);
        setTransposition(newTransposition);
      }
    });

    // Font size, display mode, and layout are personal preferences - not synced
    // Only navigation and transpose are synced with followers

    socketRef.current.on('sync-state', (state) => {
      if (!userIsLeader) {
        console.log('Syncing state from leader:', state);
        if (state.currentSongIndex !== undefined) {
          setSelectedSongIndex(state.currentSongIndex);
        }
        // Don't sync transposition here - it should be loaded from database per song
        // Transposition will be synced via leader-transposed event when leader actively changes it
        // Font size is personal preference - not synced
      }
    });

    socketRef.current.on('became-leader', ({ serviceId }) => {
      console.log('You are now the leader of service:', serviceId);
      setIsLeader(true);
    });

    socketRef.current.on('leader-changed', ({ newLeaderId }) => {
      console.log('Service leader changed to:', newLeaderId);

      // Update selected service leader_id
      setSelectedService(prev => prev ? { ...prev, leader_id: newLeaderId } : null);

      // Update isLeader state for current user
      const newIsLeader = newLeaderId === user.id;
      setIsLeader(newIsLeader);

      // Show toast notification only when someone else becomes leader
      if (!newIsLeader) {
        showToastMsg('Service leader has been changed');
      }
    });

    socketRef.current.on('room-update', ({ leaderSocketId, followerCount }) => {
      console.log('Room update - Leader:', leaderSocketId, 'Followers:', followerCount);
    });

    // Handle leader disconnection - switch to free mode
    socketRef.current.on('leader-disconnected', ({ message }) => {
      console.log('Leader disconnected from service');
      if (!userIsLeader) {
        setIsFollowMode(false); // Automatically switch to free mode
        showToastMsg(message || 'Leader disconnected - switched to free mode');
      }
    });

    // Handle leader reconnection
    socketRef.current.on('leader-reconnected', ({ message }) => {
      console.log('Leader reconnected to service');
      if (!userIsLeader) {
        showToastMsg(message || 'Leader reconnected - you can enable follow mode');
      }
    });

    // Cleanup on unmount or service change
    return () => {
      if (socketRef.current) {
        console.log('Service cleaning up socket listeners');

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
        socketRef.current.off('became-leader');
        socketRef.current.off('leader-changed');
        socketRef.current.off('room-update');
        socketRef.current.off('leader-disconnected');
        socketRef.current.off('leader-reconnected');

        // Leave service room and disconnect
        if (selectedService?.id) {
          socketRef.current.emit('leave-service', { serviceId: selectedService.id });
        }
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [selectedService, user]); // Removed isFollowMode - using ref instead to prevent socket reconnection

  // Handle online/offline events for socket connection
  useEffect(() => {
    if (!selectedService) return;

    const handleOnline = () => {
      console.log('[Service] Back online - attempting socket reconnect');
      if (socketRef.current && !socketRef.current.connected) {
        socketRef.current.connect();
      }
    };

    const handleOffline = () => {
      console.log('[Service] Went offline - socket disconnected');
      setSocketConnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [selectedService]);

  // Get the set list for the selected service
  const currentSetList = serviceDetails?.songs || EMPTY_ARRAY;
  const currentItem = currentSetList[selectedSongIndex];
  const currentSong = currentItem;

  // Memoize parsed prayer data to avoid double-parsing on every render
  const parsedPrayerData = useMemo(() => {
    if (currentSong?.segment_type !== 'prayer') return null;
    return parsePrayerContent(currentSong.segment_content);
  }, [currentSong]);

  const zoomIn = () => {
    const newFontSize = Math.min(fontSize + 2, 24);
    setFontSize(newFontSize);
    // Font size is a personal preference - not synced with followers
  };

  const zoomOut = () => {
    const newFontSize = Math.max(fontSize - 2, 10);
    setFontSize(newFontSize);
    // Font size is a personal preference - not synced with followers
  };

  const transposeUp = () => {
    const newTransposition = Math.min(transposition + 1, 11);
    setTransposition(newTransposition);

    // Broadcast to followers if user is leader (include songId for verification)
    const currentSong = currentSetList[selectedSongIndex];
    if (isLeader && socketRef.current?.connected && socketConnected && selectedService && currentSong) {
      socketRef.current.emit('leader-transpose', {
        serviceId: selectedService.id,
        transposition: newTransposition,
        songId: currentSong.id
      });
    }
  };

  const transposeDown = () => {
    const newTransposition = Math.max(transposition - 1, -11);
    setTransposition(newTransposition);

    // Broadcast to followers if user is leader (include songId for verification)
    const currentSong = currentSetList[selectedSongIndex];
    if (isLeader && socketRef.current?.connected && socketConnected && selectedService && currentSong) {
      socketRef.current.emit('leader-transpose', {
        serviceId: selectedService.id,
        transposition: newTransposition,
        songId: currentSong.id
      });
    }
  };

  const resetTransposition = () => {
    setTransposition(0);

    // Broadcast to followers if user is leader (include songId for verification)
    const currentSong = currentSetList[selectedSongIndex];
    if (isLeader && socketRef.current?.connected && socketConnected && selectedService && currentSong) {
      socketRef.current.emit('leader-transpose', {
        serviceId: selectedService.id,
        transposition: 0,
        songId: currentSong.id
      });
    }
  };

  const handleSelectKey = (newTransposition) => {
    setTransposition(newTransposition);

    // Broadcast to followers if user is leader (include songId for verification)
    const currentSong = currentSetList[selectedSongIndex];
    if (isLeader && socketRef.current?.connected && socketConnected && selectedService && currentSong) {
      socketRef.current.emit('leader-transpose', {
        serviceId: selectedService.id,
        transposition: newTransposition,
        songId: currentSong.id
      });
    }
  };

  const handleEditService = () => {
    navigate(`/services/${id}/edit`);
  };

  const handleSaveService = async (formData) => {
    try {
      // Edit mode only — don't overwrite leader_id or created_by
      const serviceData = { ...formData, workspace_id: activeWorkspace?.id };
      const updated = await serviceService.updateService(modalService.id, serviceData);

      // Merge updated fields while preserving enriched flags
      setSelectedService(prev => {
        const today = new Date().toISOString().split('T')[0];
        const merged = { ...prev, ...updated };
        return {
          ...merged,
          isCreator: (merged.created_by) === user?.id,
          canEdit: (merged.created_by) === user?.id || (merged.leader_id) === user?.id || user?.role === 'admin',
          isToday: (merged.date) === today,
          isPast: merged.date ? merged.date < today : false,
          isShared: merged.isShared || prev.isShared || false,
        };
      });

      showToastMsg('Service updated successfully!');
    } catch (err) {
      console.error('Error saving service:', err);
      throw new Error(err.error || 'Failed to save service');
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalService(null);
  };

  const showToastMsg = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setShowToast(true);
  };

  const handleCloseToast = () => {
    setShowToast(false);
  };

  const handleEditSetlist = () => {
    setIsSetlistBuilderOpen(true);
  };

  const handleUpdateSetlist = async (newSetlist) => {
    try {
      // Get current items in the service
      const currentItems = serviceDetails?.songs || [];
      // Map original songs by serviceSongId for lookup
      const originalByServiceSongId = new Map();
      for (const s of currentItems) {
        if (s.serviceSongId) originalByServiceSongId.set(s.serviceSongId, s);
      }

      // Determine which original service songs are retained in the new setlist
      const retainedServiceSongIds = new Set();
      for (const item of newSetlist) {
        if (item.serviceSongId && originalByServiceSongId.has(item.serviceSongId)) {
          retainedServiceSongIds.add(item.serviceSongId);
        }
      }

      // Remove items that are no longer retained
      for (const item of currentItems) {
        if (item.serviceSongId && !retainedServiceSongIds.has(item.serviceSongId)) {
          await serviceService.removeSongFromService(selectedService.id, item.serviceSongId);
        }
      }

      // Add new items and update positions
      for (let i = 0; i < newSetlist.length; i++) {
        const item = newSetlist[i];
        if (item.serviceSongId && retainedServiceSongIds.has(item.serviceSongId)) {
          // Existing item — update position
          const updateData = { position: i };
          if (item.segment_type === 'prayer') {
            updateData.segment_title = item.segment_title || item.title;
            updateData.segment_content = item.segment_content;
          }
          await serviceService.updateServiceSong(selectedService.id, item.serviceSongId, updateData);
        } else if (item.segment_type === 'prayer') {
          // New prayer item
          await serviceService.addSongToService(selectedService.id, {
            song_id: null,
            position: i,
            segment_type: 'prayer',
            segment_title: item.segment_title || item.title,
            segment_content: item.segment_content
          });
        } else {
          // New song from library — item.id is the library song ID
          await serviceService.addSongToService(selectedService.id, {
            song_id: item.song_id || item.id,
            position: i,
            segment_type: 'song'
          });
        }
      }

      // Refresh service details
      const updatedDetails = await serviceService.getServiceById(selectedService.id);
      setServiceDetails(updatedDetails);

      showToastMsg('Setlist updated successfully!');
    } catch (err) {
      console.error('Error updating setlist:', err);
      console.error('Error details:', err.response?.data || err.message);
      showToastMsg(`Failed to update setlist: ${err.response?.data?.error || err.message}`, 'error');
    }
  };

  const handleShareService = (service) => {
    setServiceToShare(service);
    setIsShareModalOpen(true);
  };

  const handleCopySolucastLink = async (service) => {
    try {
      const data = await serviceService.getShareLink(service.id);
      const link = `${window.location.origin}/open/${data.code}`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = link;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!successful) throw new Error('Copy command failed');
      }
      showToastMsg('SoluCast link copied!');
    } catch (err) {
      console.error('Failed to copy SoluCast link:', err);
      showToastMsg('Failed to copy link', 'error');
    }
  };

  const handleDownloadPDF = async () => {
    if (!selectedService || !serviceDetails || !serviceDetails.songs) {
      showToastMsg('No songs to download', 'error');
      return;
    }

    if (serviceDetails.songs.length === 0) {
      showToastMsg('No songs in setlist', 'error');
      return;
    }

    try {
      setIsGeneratingPDF(true);

      // Generate PDF for all songs in the setlist using A4PDFView format
      await generateMultiSongPDF(selectedService, serviceDetails.songs, { fontSize });

      showToastMsg('PDF downloaded successfully!');
    } catch (err) {
      console.error('Error generating PDF:', err);
      showToastMsg('Failed to generate PDF', 'error');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleSharePDFWhatsApp = async (serviceToShare = null) => {
    // Use provided service or fall back to selected service
    const service = serviceToShare || selectedService;

    if (!service) {
      showToastMsg('No service selected', 'error');
      return;
    }

    try {
      setIsGeneratingPDF(true);

      // Fetch fresh service details to ensure we have the songs
      const details = await serviceService.getServiceById(service.id);

      if (!details || !details.songs || details.songs.length === 0) {
        showToastMsg('No songs in setlist', 'error');
        setIsGeneratingPDF(false);
        return;
      }

      // Generate PDF as blob
      const { blob, filename } = await generateMultiSongPDFBlob(service, details.songs, { fontSize });

      // Download the PDF file
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Open WhatsApp with a message
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${service.venue || service.title || 'Setlist'}\n\nGenerated with SoluFlow`)}`;
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

      showToastMsg('PDF downloaded. Attach it in WhatsApp!');
    } catch (err) {
      console.error('Error sharing PDF:', err);
      console.error('Error stack:', err.stack);
      if (err.name === 'AbortError') {
        showToastMsg('Share cancelled');
      } else {
        showToastMsg(`Failed to share PDF: ${err.message}`, 'error');
      }
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handlePassLeadership = (service) => {
    setServiceToPassLeadership(service);
    setIsPassLeadershipModalOpen(true);
  };

  const handleLeaderChanged = async (newLeaderId) => {
    if (!serviceToPassLeadership) return;

    try {
      await serviceService.changeLeader(serviceToPassLeadership.id, newLeaderId);

      // Update selected service
      setSelectedService(prev => prev ? { ...prev, leader_id: newLeaderId } : null);
      if (selectedService?.id === serviceToPassLeadership.id) {

        // Update leader status for current user
        setIsLeader(newLeaderId === user.id);

        // Broadcast leader change via socket
        if (socketRef.current?.connected && socketConnected) {
          socketRef.current.emit('leader-changed', {
            serviceId: serviceToPassLeadership.id,
            newLeaderId: newLeaderId
          });
        }
      }

      showToastMsg('Service leader changed successfully!');
      // PassLeadershipModal calls onClose() itself after this resolves — don't double-close
    } catch (err) {
      console.error('Error changing leader:', err);
      // Error will be shown by the modal
      throw err;
    }
  };

  // Drag-to-scroll handlers for song tabs
  const didDragRef = useRef(false);

  const handleMouseDown = (e) => {
    if (!tabsScrollRef.current) return;
    setIsDragging(true);
    didDragRef.current = false;
    setStartX(e.pageX - tabsScrollRef.current.offsetLeft);
    setScrollLeft(tabsScrollRef.current.scrollLeft);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !tabsScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - tabsScrollRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    if (Math.abs(walk) > 3) didDragRef.current = true;
    tabsScrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Swipe between song tabs with follow-finger animation
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeTransition, setSwipeTransition] = useState(false);
  const swipeRef = useRef({ startX: 0, startY: 0, locked: null, swiping: false });
  const songDisplayRef = useRef(null);

  const handleSwipeTouchStart = (e) => {
    if (swipeTransition) return;
    swipeRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, locked: null, swiping: false };
  };

  const handleSwipeTouchMove = (e) => {
    if (swipeTransition) return;
    const dx = e.touches[0].clientX - swipeRef.current.startX;
    const dy = e.touches[0].clientY - swipeRef.current.startY;

    // Lock direction after 10px of movement
    if (swipeRef.current.locked === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      swipeRef.current.locked = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    }

    if (swipeRef.current.locked !== 'h') return;

    e.preventDefault();
    swipeRef.current.swiping = true;

    const isRtl = document.documentElement.dir === 'rtl' || document.body.dir === 'rtl';
    const directedDx = isRtl ? -dx : dx;

    // Add resistance at boundaries
    const atStart = selectedSongIndex === 0 && directedDx > 0;
    const atEnd = selectedSongIndex === currentSetList.length - 1 && directedDx < 0;
    const dampened = (atStart || atEnd) ? dx * 0.2 : dx;

    setSwipeOffset(dampened);
  };

  const handleSwipeTouchEnd = (e) => {
    if (!swipeRef.current.swiping) {
      setSwipeOffset(0);
      return;
    }

    const dx = e.changedTouches[0].clientX - swipeRef.current.startX;
    const isRtl = document.documentElement.dir === 'rtl' || document.body.dir === 'rtl';
    const threshold = 60;
    const goNext = isRtl ? dx > threshold : dx < -threshold;
    const goPrev = isRtl ? dx < -threshold : dx > threshold;
    const width = songDisplayRef.current?.offsetWidth || 400;

    if (goNext && selectedSongIndex < currentSetList.length - 1) {
      // Animate out then switch
      setSwipeTransition(true);
      setSwipeOffset(isRtl ? width : -width);
      setTimeout(() => {
        setSwipeTransition(false);
        setSwipeOffset(0);
        handleSelectSong(selectedSongIndex + 1);
      }, 250);
    } else if (goPrev && selectedSongIndex > 0) {
      setSwipeTransition(true);
      setSwipeOffset(isRtl ? -width : width);
      setTimeout(() => {
        setSwipeTransition(false);
        setSwipeOffset(0);
        handleSelectSong(selectedSongIndex - 1);
      }, 250);
    } else {
      // Snap back
      setSwipeTransition(true);
      setSwipeOffset(0);
      setTimeout(() => setSwipeTransition(false), 250);
    }
  };

  // Handle song selection (with leader broadcasting)
  const handleSelectSong = (index) => {
    setSelectedSongIndex(index);

    // Scroll the active tab into view
    if (tabsScrollRef.current) {
      const tab = tabsScrollRef.current.children[index];
      if (tab) tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    // Broadcast to followers if user is leader (include transposition for immediate sync)
    if (isLeader && socketRef.current?.connected && socketConnected && selectedService && currentSetList[index]) {
      socketRef.current.emit('leader-navigate', {
        serviceId: selectedService.id,
        songId: currentSetList[index].id,
        songIndex: index,
        transposition: currentSetList[index].transposition || 0
      });
    }
  };

  // Toggle follow/free mode
  const toggleFollowMode = () => {
    setIsFollowMode(prev => !prev);
    showToastMsg(isFollowMode ? 'Free mode enabled' : 'Follow mode enabled');
  };

  // Close header menu on outside click
  useEffect(() => {
    if (!headerMenuOpen) return;
    const handler = () => setHeaderMenuOpen(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [headerMenuOpen]);

  // Detect tab scroll position to show/hide fade indicators
  useEffect(() => {
    const scrollEl = tabsScrollRef.current;
    const fadeEl = tabsFadeRef.current;
    if (!scrollEl || !fadeEl) return;

    const updateFades = () => {
      const { scrollLeft, scrollWidth, clientWidth } = scrollEl;
      const isRtl = getComputedStyle(scrollEl).direction === 'rtl';
      const canScrollStart = isRtl ? scrollLeft < -1 : scrollLeft > 1;
      const canScrollEnd = isRtl
        ? scrollLeft > -(scrollWidth - clientWidth - 1)
        : scrollLeft < scrollWidth - clientWidth - 1;

      fadeEl.classList.toggle('can-scroll-start', canScrollStart);
      fadeEl.classList.toggle('can-scroll-end', canScrollEnd);
    };

    updateFades();
    scrollEl.addEventListener('scroll', updateFades, { passive: true });
    const ro = new ResizeObserver(updateFades);
    ro.observe(scrollEl);
    return () => {
      scrollEl.removeEventListener('scroll', updateFades);
      ro.disconnect();
    };
  }, [currentSetList]);

  // Format date for banner display
  const formatBannerDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return dateStr; }
  };

  return (
    <div className="service-page">
      {/* Loading */}
      {loading && (
        <div className="empty-service">Loading...</div>
      )}

      {/* Error */}
      {error && (
        <div className="empty-service">{error}</div>
      )}

      {/* Detail Banner - SoluEvents-style gradient header */}
      {selectedService && !loading && (
        <>
          <div className="service-header-gradient" style={{ background: `linear-gradient(135deg, ${currentPreset.colors[0]} 0%, ${currentPreset.colors[1]} 25%, ${currentPreset.colors[2]} 50%, ${currentPreset.colors[3]} 75%, ${currentPreset.colors[4]} 100%)` }}>
            {/* Animated waves */}
            <div className="service-header-waves">
              <svg className="wave wave-slow" viewBox="0 0 1440 100" preserveAspectRatio="none">
                <path d="M0,50 Q180,90 360,50 Q540,10 720,50 Q900,90 1080,50 Q1260,10 1440,50 L1440,100 L0,100Z" fill="white" />
              </svg>
              <svg className="wave wave-mid" viewBox="0 0 1440 100" preserveAspectRatio="none">
                <path d="M0,50 Q120,85 240,50 Q360,15 480,50 Q600,85 720,50 Q840,15 960,50 Q1080,85 1200,50 Q1320,15 1440,50 L1440,100 L0,100Z" fill="white" />
              </svg>
              <svg className="wave wave-fast" viewBox="0 0 1440 100" preserveAspectRatio="none">
                <path d="M0,50 Q90,80 180,50 Q270,20 360,50 Q450,80 540,50 Q630,20 720,50 Q810,80 900,50 Q990,20 1080,50 Q1170,80 1260,50 Q1350,20 1440,50 L1440,100 L0,100Z" fill="white" />
              </svg>
            </div>
            <div className="service-header-content">
              <button
                className="service-header-back"
                onClick={() => navigate('/services')}
              >
                <ArrowLeft size={20} />
              </button>
              <div className="service-header-info">
                <div className="service-header-title-row">
                  <h1 className="service-header-title">
                    {selectedService.title}
                  </h1>
                  {isLeader && <span className="service-header-badge leader">{t('service.leaderBadge')}</span>}
                  {selectedService.isToday && <span className="service-header-badge today">{t('service.todayBadge')}</span>}
                  {selectedService.isShared && <span className="service-header-badge shared">{t('service.sharedBadge')}</span>}
                  {!isLeader && (
                    <button
                      className={`service-header-badge follow-toggle ${isFollowMode ? 'following' : ''}`}
                      onClick={toggleFollowMode}
                      title={isFollowMode ? 'Click to enable free mode' : 'Click to follow leader'}
                    >
                      {isFollowMode ? 'FOLLOWING' : 'FREE MODE'}
                    </button>
                  )}
                </div>
                <div className="service-header-meta">
                  {selectedService.date && (
                    <span className="service-meta-item">
                      <Calendar size={14} className="service-meta-icon" />
                      {formatBannerDate(selectedService.date)}{selectedService.time ? ` · ${selectedService.time}` : ''}
                    </span>
                  )}
                  {selectedService.location && (
                    <span className="service-meta-item">
                      <MapPin size={14} className="service-meta-icon" />
                      {selectedService.location}
                    </span>
                  )}
                </div>
              </div>
              {!socketConnected && (
                <div className="connection-status disconnected" title="Connection lost">
                  ⚠️
                </div>
              )}
              <div className="header-menu-container">
                <button
                  className="service-header-menu-btn"
                  onClick={(e) => { e.stopPropagation(); setHeaderMenuOpen(!headerMenuOpen); }}
                >
                  <MoreVertical size={20} />
                </button>
                {headerMenuOpen && (
                  <div className="header-dropdown-menu">
                    {selectedService.canEdit && (
                      <button className="menu-item" onClick={() => { setHeaderMenuOpen(false); handleEditService(); }}>
                        {t('service.edit')}
                      </button>
                    )}
                    {currentSetList.length > 0 && selectedService.canEdit && (
                      <button className="menu-item" onClick={() => { setHeaderMenuOpen(false); handleEditSetlist(); }}>
                        {t('service.editSetlist')}
                      </button>
                    )}
                    {selectedService.isCreator && (
                      <button className="menu-item" onClick={() => { setHeaderMenuOpen(false); handleShareService(selectedService); }}>
                        {t('service.share')}
                      </button>
                    )}
                    {selectedService.isCreator && (
                      <button className="menu-item" onClick={() => { setHeaderMenuOpen(false); handleCopySolucastLink(selectedService); }}>
                        SoluCast Link
                      </button>
                    )}
                    {currentSetList.length > 0 && (
                      <button className="menu-item" onClick={() => { setHeaderMenuOpen(false); handleDownloadPDF(); }}>
                        PDF
                      </button>
                    )}
                    {currentSetList.length > 0 && (
                      <button className="menu-item menu-item-whatsapp" onClick={() => { setHeaderMenuOpen(false); handleSharePDFWhatsApp(); }}>
                        WhatsApp
                      </button>
                    )}
                    {selectedService.canEdit && (
                      <button className="menu-item" onClick={() => { setHeaderMenuOpen(false); handlePassLeadership(selectedService); }}>
                        {t('service.passLeadership')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Song Tabs - SoluEvents-style tab bar */}
          {currentSetList.length > 0 && (
            <div className="service-song-tabs">
              <div className="service-tabs-fade-wrapper" ref={tabsFadeRef}>
                <div
                  className={`service-tabs-scroll ${isDragging ? 'dragging' : ''}`}
                  ref={tabsScrollRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  {currentSetList.map((item, index) => (
                    <button
                      key={`${item.segment_type || 'song'}-${item.id}`}
                      className={`service-tab ${index === selectedSongIndex ? 'active' : ''} ${item.segment_type === 'prayer' ? 'prayer-tab' : ''}`}
                      onClick={() => { if (!didDragRef.current) handleSelectSong(index); }}
                    >
                      {item.segment_type === 'prayer' && '🙏 '}
                      {item.title || item.segment_title}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Current Service Display */}
      {selectedService && !loading && currentSetList.length > 0 ? (
        <>
          {/* Song/Prayer Display */}
          {currentSong && currentSong.segment_type === 'prayer' ? (
            <div
              className="song-display prayer-display"
              ref={songDisplayRef}
              onTouchStart={handleSwipeTouchStart}
              onTouchMove={handleSwipeTouchMove}
              onTouchEnd={handleSwipeTouchEnd}
              style={{
                transform: swipeOffset ? `translateX(${swipeOffset}px)` : undefined,
                transition: swipeTransition ? 'transform 0.25s ease-out' : undefined,
                opacity: swipeTransition ? 0.6 : 1 - Math.min(Math.abs(swipeOffset) / 600, 0.3),
              }}
            >
              <div className="song-header">
                <div className="song-info">
                  <div className="song-title-row">
                    <h2 className="song-title">🙏 {currentSong.title || currentSong.segment_title}</h2>
                  </div>
                  {parsedPrayerData?.title_translation && (
                    <p className="song-authors prayer-translation">{parsedPrayerData.title_translation}</p>
                  )}
                </div>
                <div className="song-meta">
                  <div className="zoom-controls-service">
                    <button className="btn-zoom-service" onClick={(e) => { e.stopPropagation(); zoomOut(); }}>A-</button>
                    <button className="btn-zoom-service" onClick={(e) => { e.stopPropagation(); zoomIn(); }}>A+</button>
                  </div>
                </div>
              </div>

              <div className="prayer-content-display" style={{ fontSize: `${fontSize}px` }}>
                {parsedPrayerData?.same_verse_for_all && parsedPrayerData.shared_bible_ref && (
                  <div className="prayer-shared-verse">
                    📖 {parsedPrayerData.shared_bible_ref}
                  </div>
                )}
                {(parsedPrayerData?.prayer_points || []).map((point, idx) => (
                  <div key={idx} className="prayer-point-display">
                    {point.subtitle && (
                      <div className="prayer-point-subtitle">
                        <strong>{idx + 1}. {point.subtitle}</strong>
                        {point.subtitle_translation && (
                          <span className="prayer-point-subtitle-translation"> — {point.subtitle_translation}</span>
                        )}
                      </div>
                    )}
                    {point.description && (
                      <div className="prayer-point-description">
                        {point.description}
                        {point.description_translation && (
                          <div className="prayer-point-description-translation">{point.description_translation}</div>
                        )}
                      </div>
                    )}
                    {!parsedPrayerData?.same_verse_for_all && point.bible_ref && (
                      <div className="prayer-point-verse">📖 {point.bible_ref}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : currentSong && (
            <div
              className="song-display"
              ref={songDisplayRef}
              onTouchStart={handleSwipeTouchStart}
              onTouchMove={handleSwipeTouchMove}
              onTouchEnd={handleSwipeTouchEnd}
              style={{
                transform: swipeOffset ? `translateX(${swipeOffset}px)` : undefined,
                transition: swipeTransition ? 'transform 0.25s ease-out' : undefined,
                opacity: swipeTransition ? 0.6 : 1 - Math.min(Math.abs(swipeOffset) / 600, 0.3),
              }}
            >
              <ChordProDisplay
                content={currentSong.content}
                dir={hasHebrew(currentSong.content) ? 'rtl' : 'ltr'}
                fontSize={fontSize}
                transposition={transposition}
                songKey={currentSong.key}
                isLyricsOnly={isLyricsOnly}
                forcedColumnCount={columnMode}
              />
            </div>
          )}
        </>
      ) : selectedService && !loading ? (
        <div>
          <div className="empty-service">
            No set list for this service yet.
          </div>
        </div>
      ) : null}

      {/* Service Modal (Create/Edit) */}
      <ServiceEditModal
        service={modalService}
        currentSetlist={modalService ? (serviceDetails?.songs || EMPTY_ARRAY) : EMPTY_ARRAY}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveService}
        onUpdate={handleUpdateSetlist}
      />

      {/* Setlist Builder */}
      <SetlistBuilder
        service={selectedService}
        currentSetlist={currentSetList}
        isOpen={isSetlistBuilderOpen}
        onClose={() => setIsSetlistBuilderOpen(false)}
        onUpdate={handleUpdateSetlist}
      />

      {/* Success Toast */}
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={showToast}
        onClose={handleCloseToast}
      />

      {/* Share Modal */}
      <ShareModal
        service={serviceToShare}
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />

      {/* Pass Leadership Modal */}
      <PassLeadershipModal
        service={serviceToPassLeadership}
        isOpen={isPassLeadershipModalOpen}
        onClose={() => {
          setIsPassLeadershipModalOpen(false);
          setServiceToPassLeadership(null);
        }}
        onLeaderChanged={handleLeaderChanged}
      />

      {/* Controls Button + Drawer */}
      {selectedService && !loading && currentSetList.length > 0 && currentSong && currentSong.segment_type !== 'prayer' && (
        <>
          <button
            className="btn-controls-toggle"
            onClick={() => setShowControlsDrawer(true)}
            title="Song controls"
          >
            <span className="controls-icon">☰</span>
          </button>

          {showControlsDrawer && (
            <div className="controls-drawer-overlay" onClick={() => setShowControlsDrawer(false)}>
              <div
                className="controls-drawer"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => { drawerTouchStartY.current = e.touches[0].clientY; }}
                onTouchEnd={(e) => {
                  if (drawerTouchStartY.current !== null) {
                    const swipeDistance = e.changedTouches[0].clientY - drawerTouchStartY.current;
                    if (swipeDistance > 50) setShowControlsDrawer(false);
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
                      onClick={() => { setShowControlsDrawer(false); setShowKeySelectorModal(true); }}
                    >
                      {convertKeyToFlat(transposeChord(currentSong.key, transposition))}
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
        </>
      )}

      {/* Key Selector Modal */}
      {currentSong && currentSong.segment_type !== 'prayer' && (
        <KeySelectorModal
          isOpen={showKeySelectorModal}
          onClose={() => setShowKeySelectorModal(false)}
          currentKey={currentSong.key}
          currentTransposition={transposition}
          onSelectKey={handleSelectKey}
        />
      )}

      {/* PDF Generation Loading Overlay */}
      {isGeneratingPDF && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          gap: '20px'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '6px solid rgba(255, 255, 255, 0.3)',
            borderTop: '6px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <div style={{
            color: 'white',
            fontSize: '20px',
            fontWeight: '600',
            textAlign: 'center'
          }}>
            Generating PDF...
          </div>
        </div>
      )}
    </div>
  );
};

export default Service;
