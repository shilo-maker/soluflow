import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import serviceService from '../services/serviceService';
import workspaceService from '../services/workspaceService';
import ChordProDisplay from '../components/ChordProDisplay';
import ServiceEditModal from '../components/ServiceEditModal';
import SetlistBuilder from '../components/SetlistBuilder';
import ShareModal from '../components/ShareModal';
import PassLeadershipModal from '../components/PassLeadershipModal';
import KeySelectorModal from '../components/KeySelectorModal';
import Toast from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import { getTransposeDisplay, transposeChord } from '../utils/transpose';
import { generateSetlistPDF, generateSongPDF, generateMultiSongPDF } from '../utils/pdfGenerator';
import io from 'socket.io-client';
import './Service.css';

const Service = () => {
  console.log('[Service] Component render - VERSION 2.0');
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { workspaces, activeWorkspace } = useWorkspace();
  const songPillsRef = useRef(null);
  const socketRef = useRef(null);
  const previousServiceIdRef = useRef(null);

  const [services, setServices] = useState([]);
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
  const [showToast, setShowToast] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [serviceToShare, setServiceToShare] = useState(null);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [serviceToMove, setServiceToMove] = useState(null);
  const [isPassLeadershipModalOpen, setIsPassLeadershipModalOpen] = useState(false);
  const [serviceToPassLeadership, setServiceToPassLeadership] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [showKeySelectorModal, setShowKeySelectorModal] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Real-time sync state
  const [isFollowMode, setIsFollowMode] = useState(true); // Default to follow mode
  const [isLeader, setIsLeader] = useState(false);
  const [isWorkspaceAdmin, setIsWorkspaceAdmin] = useState(false);
  const [socketConnected, setSocketConnected] = useState(true); // Track socket connection status

  // Drag-to-scroll state
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Fetch all services on component mount
  useEffect(() => {
    const fetchServices = async () => {
      if (!user) {
        setLoading(false);
        setError('Please log in to view your services.');
        return;
      }

      try {
        setLoading(true);
        const data = await serviceService.getAllServices();
        setServices(data);
        setError(null);

        // Set initial selected service
        if (data.length > 0) {
          const initialService = id
            ? data.find(s => s.id === parseInt(id)) || data[0]
            : data[0];
          setSelectedService(initialService);
        }
      } catch (err) {
        console.error('Error fetching services:', err);
        setError('Failed to load services. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, [id, user]);

  // Fetch service details (with set list) when selected service changes or when navigating back
  useEffect(() => {
    const fetchServiceDetails = async () => {
      if (!selectedService) return;

      try {
        console.log('[Service] Fetching fresh service details for service:', selectedService.id);
        const details = await serviceService.getServiceById(selectedService.id);
        setServiceDetails(details);

        // Only reset song index if the service changed, not on navigation back
        const serviceChanged = previousServiceIdRef.current !== selectedService.id;
        if (serviceChanged) {
          setSelectedSongIndex(0);
          previousServiceIdRef.current = selectedService.id;
        }
        // Don't reset transposition - it will be loaded from saved state
      } catch (err) {
        console.error('Error fetching service details:', err);
        setError('Failed to load service details.');
      }
    };

    fetchServiceDetails();
  }, [selectedService, location.key]); // Added location.key to refetch when navigating back

  // Load saved transposition when song changes
  useEffect(() => {
    console.log('[Service] useEffect triggered - selectedSongIndex:', selectedSongIndex, 'selectedService:', !!selectedService, 'serviceDetails:', !!serviceDetails, 'songs:', !!serviceDetails?.songs);
    if (!selectedService || !serviceDetails?.songs?.[selectedSongIndex]) {
      console.log('[Service] useEffect early return - condition failed');
      return;
    }

    const currentSong = serviceDetails.songs[selectedSongIndex];
    // Read transposition from song object (loaded from database)
    const savedTransposition = currentSong.transposition || 0;

    console.log('[Service] Song changed - Loading transposition for song', currentSong.id, ':', savedTransposition);
    setTransposition(savedTransposition);

    // Broadcast to followers if user is leader (so they also load this song's saved transposition)
    if (isLeader && socketRef.current) {
      socketRef.current.emit('leader-transpose', {
        serviceId: selectedService.id,
        transposition: savedTransposition
      });
    }
  }, [selectedSongIndex, selectedService, serviceDetails, isLeader]);

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

    // Connect to Socket.IO server
    const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:5002';
    socketRef.current = io(serverUrl);

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
      setToastMessage('Connection lost. Please refresh the page.');
      setShowToast(true);
    });

    // Listen for leader events (only if not leader and in follow mode)
    socketRef.current.on('leader-navigated', ({ songId, songIndex }) => {
      if (!userIsLeader && isFollowMode) {
        console.log('Leader navigated to song:', songId, songIndex);
        setSelectedSongIndex(songIndex);
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
        if (state.currentSongIndex !== undefined) {
          setSelectedSongIndex(state.currentSongIndex);
        }
        // Don't sync transposition here - it should be loaded from database per song
        // Transposition will be synced via leader-transposed event when leader actively changes it
        if (state.fontSize !== undefined) {
          setFontSize(state.fontSize);
        }
      }
    });

    socketRef.current.on('became-leader', ({ serviceId }) => {
      console.log('You are now the leader of service:', serviceId);
      setIsLeader(true);
      setToastMessage('You are now the service leader');
      setShowToast(true);
    });

    socketRef.current.on('leader-changed', ({ newLeaderId }) => {
      console.log('Service leader changed to:', newLeaderId);

      // Update selected service leader_id
      setSelectedService(prev => prev ? { ...prev, leader_id: newLeaderId } : null);

      // Update services list
      setServices(prev => prev.map(s =>
        s.id === selectedService.id
          ? { ...s, leader_id: newLeaderId }
          : s
      ));

      // Update isLeader state for current user
      const newIsLeader = newLeaderId === user.id;
      setIsLeader(newIsLeader);

      // Show toast notification
      if (newIsLeader) {
        setToastMessage('You are now the service leader');
      } else {
        setToastMessage('Service leader has been changed');
      }
      setShowToast(true);
    });

    socketRef.current.on('room-update', ({ leaderSocketId, followerCount }) => {
      console.log('Room update - Leader:', leaderSocketId, 'Followers:', followerCount);
    });

    // Handle leader disconnection - switch to free mode
    socketRef.current.on('leader-disconnected', ({ message }) => {
      console.log('Leader disconnected from service');
      if (!userIsLeader) {
        setIsFollowMode(false); // Automatically switch to free mode
        setToastMessage(message || 'Leader disconnected - switched to free mode');
        setShowToast(true);
      }
    });

    // Handle leader reconnection
    socketRef.current.on('leader-reconnected', ({ message }) => {
      console.log('Leader reconnected to service');
      if (!userIsLeader) {
        setToastMessage(message || 'Leader reconnected - you can enable follow mode');
        setShowToast(true);
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
        socketRef.current.off('leader-changed-font');
        socketRef.current.off('sync-state');
        socketRef.current.off('became-leader');
        socketRef.current.off('leader-changed');
        socketRef.current.off('room-update');
        socketRef.current.off('leader-disconnected');
        socketRef.current.off('leader-reconnected');

        // Leave service room and disconnect
        socketRef.current.emit('leave-service', { serviceId: selectedService.id });
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [selectedService, user, isFollowMode]);

  // Get the set list for the selected service
  const currentSetList = serviceDetails?.songs || [];
  const currentItem = currentSetList[selectedSongIndex];
  const currentSong = currentItem;

  // Detect Hebrew in song content
  const hasHebrew = (text) => /[\u0590-\u05FF]/.test(text);

  // Get preview of song content (first 20 lines)
  const getPreviewContent = (content) => {
    const lines = content.split('\n');
    if (lines.length <= 20) return content;
    return lines.slice(0, 20).join('\n') + '\n...';
  };

  // Handle service selection
  const handleSelectService = (service) => {
    setSelectedService(service);
    setSelectedSongIndex(0); // Reset to first song when changing service
    // Don't reset transposition - it will be loaded from saved state
  };

  const zoomIn = () => {
    const newFontSize = Math.min(fontSize + 2, 24);
    setFontSize(newFontSize);

    // Broadcast to followers if user is leader
    if (isLeader && socketRef.current && selectedService) {
      socketRef.current.emit('leader-font-size', {
        serviceId: selectedService.id,
        fontSize: newFontSize
      });
    }
  };

  const zoomOut = () => {
    const newFontSize = Math.max(fontSize - 2, 10);
    setFontSize(newFontSize);

    // Broadcast to followers if user is leader
    if (isLeader && socketRef.current && selectedService) {
      socketRef.current.emit('leader-font-size', {
        serviceId: selectedService.id,
        fontSize: newFontSize
      });
    }
  };

  const transposeUp = async () => {
    console.log('[Service] ===== TRANSPOSE UP CALLED =====');
    const newTransposition = Math.min(transposition + 1, 11);
    console.log('[Service] Current transposition:', transposition, 'New:', newTransposition);
    setTransposition(newTransposition);

    // Save transposition to database
    if (selectedService && serviceDetails?.songs?.[selectedSongIndex]) {
      const currentSong = serviceDetails.songs[selectedSongIndex];
      console.log('[Service] Transpose UP - Saving song', currentSong.id, 'in service', selectedService.id, 'with transposition', newTransposition);

      try {
        await serviceService.updateSongTransposition(selectedService.id, currentSong.id, newTransposition);
        console.log('[Service] Transposition saved to database');

        // Update local state to reflect the change
        setServiceDetails(prev => ({
          ...prev,
          songs: prev.songs.map((song, idx) =>
            idx === selectedSongIndex ? { ...song, transposition: newTransposition } : song
          )
        }));
      } catch (error) {
        console.error('[Service] Failed to save transposition:', error);
      }
    }

    // Broadcast to followers if user is leader
    if (isLeader && socketRef.current && selectedService) {
      socketRef.current.emit('leader-transpose', {
        serviceId: selectedService.id,
        transposition: newTransposition
      });
    }
  };

  const transposeDown = async () => {
    const newTransposition = Math.max(transposition - 1, -11);
    setTransposition(newTransposition);

    // Save transposition to database
    if (selectedService && serviceDetails?.songs?.[selectedSongIndex]) {
      const currentSong = serviceDetails.songs[selectedSongIndex];
      console.log('[Service] Transpose DOWN - Saving song', currentSong.id, 'in service', selectedService.id, 'with transposition', newTransposition);

      try {
        await serviceService.updateSongTransposition(selectedService.id, currentSong.id, newTransposition);
        console.log('[Service] Transposition saved to database');

        // Update local state to reflect the change
        setServiceDetails(prev => ({
          ...prev,
          songs: prev.songs.map((song, idx) =>
            idx === selectedSongIndex ? { ...song, transposition: newTransposition } : song
          )
        }));
      } catch (error) {
        console.error('[Service] Failed to save transposition:', error);
      }
    }

    // Broadcast to followers if user is leader
    if (isLeader && socketRef.current && selectedService) {
      socketRef.current.emit('leader-transpose', {
        serviceId: selectedService.id,
        transposition: newTransposition
      });
    }
  };

  const resetTransposition = async () => {
    setTransposition(0);

    // Save transposition to database
    if (selectedService && serviceDetails?.songs?.[selectedSongIndex]) {
      const currentSong = serviceDetails.songs[selectedSongIndex];
      console.log('[Service] Reset transposition - Saving song', currentSong.id, 'in service', selectedService.id, 'with transposition 0');

      try {
        await serviceService.updateSongTransposition(selectedService.id, currentSong.id, 0);
        console.log('[Service] Transposition reset saved to database');

        // Update local state to reflect the change
        setServiceDetails(prev => ({
          ...prev,
          songs: prev.songs.map((song, idx) =>
            idx === selectedSongIndex ? { ...song, transposition: 0 } : song
          )
        }));
      } catch (error) {
        console.error('[Service] Failed to save transposition reset:', error);
      }
    }

    // Broadcast to followers if user is leader
    if (isLeader && socketRef.current && selectedService) {
      socketRef.current.emit('leader-transpose', {
        serviceId: selectedService.id,
        transposition: 0
      });
    }
  };

  const handleSelectKey = async (newTransposition) => {
    console.log('[Service] handleSelectKey - Setting transposition to:', newTransposition);
    setTransposition(newTransposition);

    // Save transposition to database
    if (selectedService && serviceDetails?.songs?.[selectedSongIndex]) {
      const currentSong = serviceDetails.songs[selectedSongIndex];
      console.log('[Service] Key selected - Saving song', currentSong.id, 'in service', selectedService.id, 'with transposition', newTransposition);

      try {
        await serviceService.updateSongTransposition(selectedService.id, currentSong.id, newTransposition);
        console.log('[Service] Transposition saved to database');

        // Update local state to reflect the change
        setServiceDetails(prev => ({
          ...prev,
          songs: prev.songs.map((song, idx) =>
            idx === selectedSongIndex ? { ...song, transposition: newTransposition } : song
          )
        }));
      } catch (error) {
        console.error('[Service] Failed to save transposition:', error);
      }
    }

    // Broadcast to followers if user is leader
    if (isLeader && socketRef.current && selectedService) {
      socketRef.current.emit('leader-transpose', {
        serviceId: selectedService.id,
        transposition: newTransposition
      });
    }
  };

  const handleNewService = () => {
    setModalService(null);
    setIsModalOpen(true);
  };

  const handleEditService = (service) => {
    setModalService(service);
    setIsModalOpen(true);
  };

  const handleSaveService = async (formData, setlist = null) => {
    try {
      const serviceData = {
        ...formData,
        workspace_id: activeWorkspace?.id,
        leader_id: user.id,
        created_by: user.id
      };

      if (modalService) {
        // Edit mode - update existing service
        const updatedService = await serviceService.updateService(modalService.id, serviceData);

        // Update the services list
        setServices(prev => prev.map(s =>
          s.id === updatedService.id ? updatedService : s
        ));

        // Update selected service if it's the one being edited
        if (selectedService?.id === updatedService.id) {
          setSelectedService(updatedService);
        }

        setToastMessage('Service updated successfully!');
        setShowToast(true);
      } else {
        // Create mode - add new service
        const newService = await serviceService.createService(serviceData);

        // Add songs to setlist if provided
        if (setlist && setlist.length > 0) {
          for (let i = 0; i < setlist.length; i++) {
            const song = setlist[i];
            await serviceService.addSongToService(newService.id, {
              song_id: song.id,
              position: i,
              segment_type: 'song'
            });
          }
        }

        // Add to services list
        setServices(prev => [...prev, newService]);

        // Select the new service
        setSelectedService(newService);

        setToastMessage('Service created successfully!');
        setShowToast(true);
      }

      setIsModalOpen(false);
      setModalService(null);
    } catch (err) {
      console.error('Error saving service:', err);
      throw new Error(err.error || 'Failed to save service');
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalService(null);
  };

  const handleCloseToast = () => {
    setShowToast(false);
  };

  const handleEditSetlist = () => {
    setIsSetlistBuilderOpen(true);
  };

  const handleEditSetlistFromModal = () => {
    // Close the service edit modal
    setIsModalOpen(false);
    // Open the setlist builder
    setIsSetlistBuilderOpen(true);
  };

  const handleUpdateSetlist = async (newSetlist) => {
    try {
      // Get current songs in the service
      const currentSongs = serviceDetails?.songs || [];
      const currentSongIds = currentSongs.map(s => s.id);
      const newSongIds = newSetlist.map(s => s.id);

      console.log('Current songs:', currentSongs);
      console.log('New setlist:', newSetlist);

      // Remove songs that are no longer in the setlist
      for (const song of currentSongs) {
        if (!newSongIds.includes(song.id)) {
          console.log('Removing song:', song.id);
          await serviceService.removeSongFromService(selectedService.id, song.id);
        }
      }

      // Add new songs and update positions
      for (let i = 0; i < newSetlist.length; i++) {
        const song = newSetlist[i];
        if (currentSongIds.includes(song.id)) {
          // Update position of existing song
          console.log('Updating position for song:', song.id, 'to position:', i);
          await serviceService.updateServiceSong(selectedService.id, song.id, {
            position: i
          });
        } else {
          // Add new song
          console.log('Adding new song:', song.id, 'at position:', i);
          await serviceService.addSongToService(selectedService.id, {
            song_id: song.id,
            position: i,
            segment_type: 'song'
          });
        }
      }

      // Refresh service details
      const updatedDetails = await serviceService.getServiceById(selectedService.id);
      setServiceDetails(updatedDetails);

      setToastMessage('Setlist updated successfully!');
      setShowToast(true);
    } catch (err) {
      console.error('Error updating setlist:', err);
      console.error('Error details:', err.response?.data || err.message);
      setToastMessage(`Failed to update setlist: ${err.response?.data?.error || err.message}`);
      setShowToast(true);
    }
  };

  const handleDeleteService = (service) => {
    setServiceToDelete(service);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!serviceToDelete) return;

    try {
      await serviceService.deleteService(serviceToDelete.id);

      // Remove from services list
      setServices(prev => prev.filter(s => s.id !== serviceToDelete.id));

      // If we deleted the selected service, select the first remaining service
      if (selectedService?.id === serviceToDelete.id) {
        const remainingServices = services.filter(s => s.id !== serviceToDelete.id);
        setSelectedService(remainingServices.length > 0 ? remainingServices[0] : null);
      }

      setToastMessage('Service deleted successfully!');
      setShowToast(true);
      setShowDeleteConfirm(false);
      setServiceToDelete(null);
    } catch (err) {
      console.error('Error deleting service:', err);
      setToastMessage('Failed to delete service');
      setShowToast(true);
      setShowDeleteConfirm(false);
      setServiceToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setServiceToDelete(null);
  };

  const handleShareService = (service) => {
    setServiceToShare(service);
    setIsShareModalOpen(true);
  };

  const handleDownloadPDF = async () => {
    if (!selectedService || !serviceDetails || !serviceDetails.songs) {
      setToastMessage('No songs to download');
      setShowToast(true);
      return;
    }

    if (serviceDetails.songs.length === 0) {
      setToastMessage('No songs in setlist');
      setShowToast(true);
      return;
    }

    try {
      setIsGeneratingPDF(true);

      // Generate PDF for all songs in the setlist using A4PDFView format
      await generateMultiSongPDF(selectedService, serviceDetails.songs, { fontSize });

      setToastMessage('PDF downloaded successfully!');
      setShowToast(true);
    } catch (err) {
      console.error('Error generating PDF:', err);
      setToastMessage('Failed to generate PDF');
      setShowToast(true);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleMoveService = (service) => {
    setServiceToMove(service);
    setShowMoveDialog(true);
  };

  const confirmMove = async (targetWorkspaceId) => {
    if (!serviceToMove) return;

    try {
      const targetWorkspace = workspaces?.find(ws => ws.id === targetWorkspaceId);
      const serviceName = serviceToMove.title;

      await serviceService.moveToWorkspace(serviceToMove.id, targetWorkspaceId);

      // Close dialog first
      setShowMoveDialog(false);

      // Remove from current services list
      setServices(prev => prev.filter(s => s.id !== serviceToMove.id));

      // If we moved the selected service, clear selection
      if (selectedService?.id === serviceToMove.id) {
        const remainingServices = services.filter(s => s.id !== serviceToMove.id);
        setSelectedService(remainingServices.length > 0 ? remainingServices[0] : null);
      }

      // Show success message with workspace name
      const message = targetWorkspace
        ? `"${serviceName}" moved to "${targetWorkspace.name}" successfully!`
        : 'Service moved successfully!';
      setToastMessage(message);
      setShowToast(true);
      setServiceToMove(null);
    } catch (err) {
      console.error('Error moving service:', err);
      setShowMoveDialog(false);
      setToastMessage('Failed to move service');
      setShowToast(true);
      setServiceToMove(null);
    }
  };

  const cancelMove = () => {
    setShowMoveDialog(false);
    setServiceToMove(null);
  };

  const handlePassLeadership = (service) => {
    setServiceToPassLeadership(service);
    setIsPassLeadershipModalOpen(true);
  };

  const handleLeaderChanged = async (newLeaderId) => {
    if (!serviceToPassLeadership) return;

    try {
      await serviceService.changeLeader(serviceToPassLeadership.id, newLeaderId);

      // Update the service in the services list
      setServices(prev => prev.map(s =>
        s.id === serviceToPassLeadership.id
          ? { ...s, leader_id: newLeaderId }
          : s
      ));

      // Update selected service if it's the one being changed
      if (selectedService?.id === serviceToPassLeadership.id) {
        setSelectedService(prev => ({ ...prev, leader_id: newLeaderId }));

        // Update leader status for current user
        setIsLeader(newLeaderId === user.id);

        // Broadcast leader change via socket
        if (socketRef.current) {
          socketRef.current.emit('leader-changed', {
            serviceId: serviceToPassLeadership.id,
            newLeaderId: newLeaderId
          });
        }
      }

      setToastMessage('Service leader changed successfully!');
      setShowToast(true);
      setIsPassLeadershipModalOpen(false);
      setServiceToPassLeadership(null);
    } catch (err) {
      console.error('Error changing leader:', err);
      // Error will be shown by the modal
      throw err;
    }
  };

  // Drag-to-scroll handlers for song pills
  const handleMouseDown = (e) => {
    if (!songPillsRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - songPillsRef.current.offsetLeft);
    setScrollLeft(songPillsRef.current.scrollLeft);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !songPillsRef.current) return;
    e.preventDefault();
    const x = e.pageX - songPillsRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    songPillsRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle song selection (with leader broadcasting)
  const handleSelectSong = (index) => {
    setSelectedSongIndex(index);

    // Broadcast to followers if user is leader
    if (isLeader && socketRef.current && selectedService && currentSetList[index]) {
      socketRef.current.emit('leader-navigate', {
        serviceId: selectedService.id,
        songId: currentSetList[index].id,
        songIndex: index
      });
    }
  };

  // Toggle follow/free mode
  const toggleFollowMode = () => {
    setIsFollowMode(prev => !prev);
    setToastMessage(isFollowMode ? 'Free mode enabled' : 'Follow mode enabled');
    setShowToast(true);
  };

  // Toggle service menu
  const toggleServiceMenu = (serviceId, e) => {
    e.stopPropagation();
    // Toggle this service menu
    setOpenMenuId(openMenuId === serviceId ? null : serviceId);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (openMenuId !== null) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

  return (
    <div className="service-page">
      {/* Service Selector */}
      <div className="service-selector">
        <div className="selector-header">
          <h3>{t('service.chooseService')}</h3>
          <button className="btn-new" onClick={handleNewService}>{t('service.new')}</button>
        </div>

        {loading && (
          <div className="loading-state">Loading services...</div>
        )}

        {error && (
          <div className="error-state">{error}</div>
        )}

        {!loading && !error && (
          <div className="service-list">
            {services.map(service => (
              <div
                key={service.id}
                className={`service-option ${selectedService?.id === service.id ? 'selected' : ''} ${service.isShared ? 'shared' : ''}`}
                onClick={() => handleSelectService(service)}
              >
                <div className="service-option-info">
                  <span className="service-option-title">{service.title}</span>
                  {service.isShared && <span className="shared-label">Shared with me</span>}
                </div>
                {!service.isShared && (
                  <div className="service-option-menu">
                    <button
                      className="btn-menu-toggle"
                      onClick={(e) => toggleServiceMenu(service.id, e)}
                    >
                      ⋮
                    </button>
                    {openMenuId === service.id && (
                      <div className="service-dropdown-menu">
                        <button
                          className="menu-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(null);
                            handleEditService(service);
                          }}
                        >
                          {t('service.edit')}
                        </button>
                        <button
                          className="menu-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(null);
                            handleMoveService(service);
                          }}
                        >
                          {t('service.move')}
                        </button>
                        <button
                          className="menu-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(null);
                            handlePassLeadership(service);
                          }}
                        >
                          Pass Leadership
                        </button>
                        <button
                          className="menu-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(null);
                            // Select service first if not selected
                            if (selectedService?.id !== service.id) {
                              handleSelectService(service);
                            }
                            handleShareService(service);
                          }}
                        >
                          {t('service.share')}
                        </button>
                        <button
                          className="menu-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(null);
                            // Select service first if not selected, then download
                            if (selectedService?.id !== service.id) {
                              handleSelectService(service);
                              // Wait for service to be selected before downloading
                              setTimeout(() => handleDownloadPDF(), 100);
                            } else {
                              handleDownloadPDF();
                            }
                          }}
                        >
                          PDF
                        </button>
                        <button
                          className="menu-item menu-item-delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(null);
                            handleDeleteService(service);
                          }}
                        >
                          {t('service.delete')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Current Service Display */}
      {selectedService && currentSetList.length > 0 ? (
        <div className="current-service">
          <div className="service-header-bar">
            <h3>
              {selectedService.title}
              {selectedService.isShared && <span className="shared-label-header">Shared with me</span>}
              {isLeader && <span className="leader-badge">{t('service.leaderBadge')}</span>}
            </h3>
            <div className="header-buttons">
              {!isLeader && (
                <button
                  className={`btn-follow-mode ${isFollowMode ? 'active' : ''}`}
                  onClick={toggleFollowMode}
                  title={isFollowMode ? 'Click to enable free mode' : 'Click to follow leader'}
                >
                  {isFollowMode ? 'FOLLOWING' : 'FREE MODE'}
                </button>
              )}
              {!socketConnected && (
                <div className="connection-status disconnected" title="Connection lost - attempting to reconnect">
                  ⚠️ Disconnected
                </div>
              )}
            </div>
          </div>

          {/* Song Pills */}
          <div
            ref={songPillsRef}
            className={`song-pills ${isDragging ? 'dragging' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
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
                  serviceId: selectedService.id,
                  serviceTitle: selectedService.title,
                  isLeader: isLeader,
                  initialTransposition: transposition
                }
              })}
            >
              <div className="song-header">
                <div className="song-info">
                  <h2 className="song-title">{currentSong.title}</h2>
                  <p className="song-authors">{currentSong.authors}</p>
                </div>
                <div className="song-meta">
                  <div className="transpose-controls-service">
                    <button className="btn-transpose-service" onClick={(e) => { e.stopPropagation(); transposeDown(); }}>-</button>
                    <span
                      className="transpose-display-service"
                      onClick={(e) => { e.stopPropagation(); setShowKeySelectorModal(true); }}
                      title="Click to select key"
                    >
                      {transposeChord(currentSong.key, transposition)}
                      {transposition !== 0 && ` (${transposition > 0 ? '+' : ''}${transposition})`}
                    </span>
                    <button className="btn-transpose-service" onClick={(e) => { e.stopPropagation(); transposeUp(); }}>+</button>
                  </div>
                  <div className="zoom-controls-service">
                    <button className="btn-zoom-service" onClick={(e) => { e.stopPropagation(); zoomOut(); }}>A-</button>
                    <button className="btn-zoom-service" onClick={(e) => { e.stopPropagation(); zoomIn(); }}>A+</button>
                  </div>
                  <span className="key-info">Key: {transposeChord(currentSong.key, transposition)}</span>
                  {currentSong.bpm && <span className="bpm-info">BPM: {currentSong.bpm}</span>}
                </div>
              </div>

              <div className="song-content-preview">
                <ChordProDisplay
                  content={getPreviewContent(currentSong.content)}
                  dir={hasHebrew(currentSong.content) ? 'rtl' : 'ltr'}
                  fontSize={fontSize}
                  transposition={transposition}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="current-service">
          <div className="empty-service">
            {selectedService ? 'No set list for this service yet.' : 'Please select a service.'}
          </div>
        </div>
      )}

      {/* Service Modal (Create/Edit) */}
      <ServiceEditModal
        service={modalService}
        currentSetlist={modalService ? serviceDetails?.songs || [] : []}
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
        type="success"
        isVisible={showToast}
        onClose={handleCloseToast}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Service"
        message={`Are you sure you want to delete "${serviceToDelete?.title}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      {/* Move to Workspace Dialog */}
      {showMoveDialog && (
        <div className="modal-overlay" onClick={cancelMove}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Move "{serviceToMove?.title}" to Workspace</h2>
            <p>Select a workspace to move this service to:</p>
            <div className="workspace-list">
              {workspaces
                ?.filter(ws => ws.id !== activeWorkspace?.id)
                .map(workspace => (
                  <button
                    key={workspace.id}
                    className="workspace-option"
                    onClick={() => confirmMove(workspace.id)}
                  >
                    {workspace.name}
                  </button>
                ))}
              {(!workspaces || workspaces.filter(ws => ws.id !== activeWorkspace?.id).length === 0) && (
                <p className="no-workspaces">No other workspaces available</p>
              )}
            </div>
            <div className="modal-actions">
              <button onClick={cancelMove} className="btn-cancel">Cancel</button>
            </div>
          </div>
        </div>
      )}

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

      {/* Key Selector Modal */}
      {currentSong && (
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
