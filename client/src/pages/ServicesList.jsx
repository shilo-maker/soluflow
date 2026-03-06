import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import serviceService from '../services/serviceService';
import ServiceEditModal from '../components/ServiceEditModal';
import ShareModal from '../components/ShareModal';
import PassLeadershipModal from '../components/PassLeadershipModal';
import Toast from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import { transposeChord, convertKeyToFlat } from '../utils/transpose';
import { generateMultiSongPDFBlob } from '../utils/pdfGenerator';
import './ServicesList.css';

const stripNiqqud = (text) => {
  if (!text) return '';
  return text.replace(/[\u0591-\u05C7]/g, '');
};

const ServicesList = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { workspaces, activeWorkspace } = useWorkspace();

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showPastServices, setShowPastServices] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalService, setModalService] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [serviceToShare, setServiceToShare] = useState(null);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [serviceToMove, setServiceToMove] = useState(null);
  const [isPassLeadershipModalOpen, setIsPassLeadershipModalOpen] = useState(false);
  const [serviceToPassLeadership, setServiceToPassLeadership] = useState(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [showToast, setShowToast] = useState(false);

  // Track fetched setlist for edit modal
  const [editSetlist, setEditSetlist] = useState([]);

  // Enrich service with computed flags
  const enrichService = useCallback((s) => {
    const today = new Date().toISOString().split('T')[0];
    const creatorId = s.created_by_id || s.createdById || s.created_by;
    const leaderId = s.leader_id || s.leaderId;
    const isCreator = creatorId === user?.id;
    const isLeaderOfService = leaderId === user?.id;
    return {
      ...s,
      isCreator,
      canEdit: s.canEdit || isCreator || isLeaderOfService || user?.role === 'admin',
      isToday: s.isToday || s.date === today,
      isPast: s.isPast || (s.date ? s.date < today : false),
      isShared: s.is_shared || s.isShared || false,
      isFromSharedLink: s.is_from_shared_link || s.isFromSharedLink || false,
    };
  }, [user]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch services
  useEffect(() => {
    let isMounted = true;

    const fetchServices = async () => {
      if (!user) {
        if (isMounted) { setLoading(false); setError('Please log in.'); }
        return;
      }
      try {
        setLoading(true);
        const data = await serviceService.getAllServices(activeWorkspace?.id);
        if (isMounted) {
          setServices(data.map(enrichService));
          setError(null);
        }
      } catch (err) {
        if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return;
        if (isMounted) { setError('Failed to load services.'); }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchServices();
    return () => { isMounted = false; };
  }, [user, activeWorkspace?.id, enrichService]);

  // Filter and group services
  const filteredServices = useMemo(() => {
    if (!debouncedSearch) return services;
    const query = stripNiqqud(debouncedSearch.toLowerCase());
    return services.filter(s => {
      const titleMatch = stripNiqqud((s.title || '').toLowerCase()).includes(query);
      const locationMatch = stripNiqqud((s.location || '').toLowerCase()).includes(query);
      const dateMatch = (s.date || '').includes(query);
      const setlistMatch = (s.setlist_summary || []).some(item =>
        item.title && stripNiqqud(item.title.toLowerCase()).includes(query)
      );
      return titleMatch || locationMatch || dateMatch || setlistMatch;
    });
  }, [services, debouncedSearch]);

  const upcomingServices = useMemo(() =>
    filteredServices.filter(s => !s.isPast).sort((a, b) => {
      const da = new Date(a.date || 0);
      const db = new Date(b.date || 0);
      return da - db; // Ascending: soonest first
    }),
    [filteredServices]
  );

  const pastServices = useMemo(() =>
    filteredServices.filter(s => s.isPast).sort((a, b) => {
      const da = new Date(a.date || 0);
      const db = new Date(b.date || 0);
      return db - da; // Descending: most recent first
    }),
    [filteredServices]
  );

  // Close menu on outside click
  useEffect(() => {
    const handler = () => setOpenMenuId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Refresh services after offline sync completes
  useEffect(() => {
    const handleSyncComplete = async () => {
      if (!user) return;
      try {
        const data = await serviceService.getAllServices(activeWorkspace?.id);
        setServices(data.map(enrichService));
      } catch { /* ignore */ }
    };
    window.addEventListener('offline-sync-complete', handleSyncComplete);
    return () => window.removeEventListener('offline-sync-complete', handleSyncComplete);
  }, [user, activeWorkspace?.id, enrichService]);

  const showToastMsg = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setShowToast(true);
  };

  // --- Action handlers ---

  const handleNewService = () => { setModalService(null); setIsModalOpen(true); };

  const handleEditService = (service) => {
    navigate(`/services/${service.id}/edit`);
  };

  const handleSaveService = async (formData, setlist = null) => {
    try {
      if (modalService) {
        // Edit mode — don't overwrite leader_id or created_by
        const serviceData = { ...formData, workspace_id: activeWorkspace?.id };
        const updated = enrichService(await serviceService.updateService(modalService.id, serviceData));
        setServices(prev => prev.map(s => s.id === updated.id ? updated : s));
        showToastMsg('Service updated successfully!');
      } else {
        // Create mode
        const serviceData = {
          ...formData,
          workspace_id: activeWorkspace?.id,
          leader_id: user.id,
          created_by: user.id
        };
        // Include setlist in serviceData so offline create captures it in one queued operation
        if (setlist && setlist.length > 0) {
          serviceData.setlist = setlist.map((item, i) => {
            if (item.segment_type === 'prayer') {
              return {
                song_id: null, position: i, segment_type: 'prayer',
                segment_title: item.segment_title || item.title,
                segment_content: item.segment_content
              };
            }
            return { song_id: item.id, position: i, segment_type: 'song' };
          });
        }

        const newService = enrichService(await serviceService.createService(serviceData));

        // For offline-created services, skip setlist API calls (setlist is in the queued create data)
        if (newService._offline) {
          setServices(prev => [...prev, enrichService(newService)]);
          showToastMsg('Service saved offline — will sync when online');
        } else {
          // Online: add setlist items individually
          if (setlist && setlist.length > 0) {
            for (let i = 0; i < setlist.length; i++) {
              const item = setlist[i];
              if (item.segment_type === 'prayer') {
                await serviceService.addSongToService(newService.id, {
                  song_id: null, position: i, segment_type: 'prayer',
                  segment_title: item.segment_title || item.title,
                  segment_content: item.segment_content
                });
              } else {
                await serviceService.addSongToService(newService.id, {
                  song_id: item.id, position: i, segment_type: 'song'
                });
              }
            }
          }
          navigate(`/services/${newService.id}`);
        }
      }
      // Modal closes itself via onClose after onSave completes
    } catch (err) {
      console.error('Error saving service:', err);
      throw new Error(err.error || 'Failed to save service');
    }
  };

  // Handle setlist update from ServiceEditModal (edit mode)
  const handleUpdateSetlist = async (newSetlist) => {
    if (!modalService) return;
    try {
      const currentItems = editSetlist;
      const currentServiceSongIds = new Set(currentItems.map(s => s.id));

      // Determine which current items are retained in the new setlist.
      // Normalized items from the DB have a 'song_id' property; raw library songs don't.
      const retainedIds = new Set();
      for (const item of newSetlist) {
        if (currentServiceSongIds.has(item.id) && 'song_id' in item) {
          retainedIds.add(item.id);
        }
      }

      // Remove items no longer retained
      for (const item of currentItems) {
        if (!retainedIds.has(item.id)) {
          await serviceService.removeSongFromService(modalService.id, item.id);
        }
      }

      // Add/update items
      for (let i = 0; i < newSetlist.length; i++) {
        const item = newSetlist[i];
        if (retainedIds.has(item.id)) {
          // Existing item — update position
          const updateData = { position: i };
          if (item.segment_type === 'prayer') {
            updateData.segment_title = item.segment_title || item.title;
            updateData.segment_content = item.segment_content;
          }
          await serviceService.updateServiceSong(modalService.id, item.id, updateData);
        } else if (item.segment_type === 'prayer') {
          await serviceService.addSongToService(modalService.id, {
            song_id: null, position: i, segment_type: 'prayer',
            segment_title: item.segment_title || item.title,
            segment_content: item.segment_content
          });
        } else {
          // New song from library — item.id is the library song ID
          await serviceService.addSongToService(modalService.id, {
            song_id: item.song_id || item.id, position: i, segment_type: 'song'
          });
        }
      }

      // Refresh the services list to get updated setlist_summary
      const data = await serviceService.getAllServices(activeWorkspace?.id);
      setServices(data.map(enrichService));
    } catch (err) {
      console.error('Error updating setlist:', err);
      showToastMsg('Failed to update setlist', 'error');
    }
  };

  const handleDeleteService = (service) => { setServiceToDelete(service); setShowDeleteConfirm(true); };

  const confirmDelete = async () => {
    if (!serviceToDelete) return;
    try {
      await serviceService.deleteService(serviceToDelete.id);
      setServices(prev => prev.filter(s => s.id !== serviceToDelete.id));
      showToastMsg('Service deleted successfully!');
    } catch (err) {
      console.error('Error deleting service:', err);
      showToastMsg('Failed to delete service', 'error');
    } finally {
      setShowDeleteConfirm(false);
      setServiceToDelete(null);
    }
  };

  const handleShareService = (service) => { setServiceToShare(service); setIsShareModalOpen(true); };

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
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      showToastMsg('SoluCast link copied!');
    } catch (err) {
      console.error('Failed to copy SoluCast link:', err);
      showToastMsg('Failed to copy link', 'error');
    }
  };

  const handleDownloadPDF = async (service) => {
    try {
      setIsGeneratingPDF(true);
      const details = await serviceService.getServiceById(service.id);
      if (!details?.songs?.length) {
        showToastMsg('No songs in setlist', 'error');
        setIsGeneratingPDF(false);
        return;
      }
      const { blob, filename } = await generateMultiSongPDFBlob(service, details.songs, { fontSize: 14 });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToastMsg('PDF downloaded!');
    } catch (err) {
      console.error('Error generating PDF:', err);
      showToastMsg('Failed to generate PDF', 'error');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleSharePDFWhatsApp = async (service) => {
    try {
      setIsGeneratingPDF(true);
      const details = await serviceService.getServiceById(service.id);
      if (!details?.songs?.length) {
        showToastMsg('No songs in setlist', 'error');
        setIsGeneratingPDF(false);
        return;
      }
      const { blob, filename } = await generateMultiSongPDFBlob(service, details.songs, { fontSize: 14 });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${service.venue || service.title || 'Setlist'}\n\nGenerated with SoluFlow`)}`;
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      showToastMsg('PDF downloaded. Attach it in WhatsApp!');
    } catch (err) {
      console.error('Error sharing PDF:', err);
      showToastMsg('Failed to share PDF', 'error');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleMoveService = (service) => { setServiceToMove(service); setShowMoveDialog(true); };

  const confirmMove = async (targetWorkspaceId) => {
    if (!serviceToMove) return;
    try {
      const targetWorkspace = workspaces?.find(ws => ws.id === targetWorkspaceId);
      await serviceService.moveToWorkspace(serviceToMove.id, targetWorkspaceId);
      setServices(prev => prev.filter(s => s.id !== serviceToMove.id));
      const message = targetWorkspace
        ? `"${serviceToMove.title}" moved to "${targetWorkspace.name}"!`
        : 'Service moved successfully!';
      showToastMsg(message);
    } catch (err) {
      console.error('Error moving service:', err);
      showToastMsg('Failed to move service', 'error');
    } finally {
      setShowMoveDialog(false);
      setServiceToMove(null);
    }
  };

  const handleUnshareService = async (service) => {
    try {
      await serviceService.unshareService(service.id);
      setServices(prev => prev.filter(s => s.id !== service.id));
      showToastMsg('Shared service removed!');
    } catch (err) {
      console.error('Error removing shared service:', err);
      showToastMsg('Failed to remove shared service', 'error');
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
      setServices(prev => prev.map(s =>
        s.id === serviceToPassLeadership.id ? enrichService({ ...s, leader_id: newLeaderId }) : s
      ));
      showToastMsg('Service leader changed!');
      // PassLeadershipModal calls onClose() itself after this resolves — don't double-close
    } catch (err) {
      console.error('Error changing leader:', err);
      throw err;
    }
  };

  // Format date for card display
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return dateStr; }
  };

  const formatShortDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    } catch { return ''; }
  };

  // --- Card render ---
  const renderCard = (service) => {
    const shortDate = formatShortDate(service.date);
    const titleDisplay = `${shortDate}${service.location ? ' - ' + service.location : (service.title ? ' - ' + service.title : '')}`;

    return (
      <div
        key={service.id}
        className={`service-card ${service.isPast ? 'past-card' : ''}`}
        onClick={() => navigate(`/services/${service.id}`)}
      >
        {/* Header: title + 3-dot menu */}
        <div className="service-card-header">
          <h3 className="service-card-title">{titleDisplay}</h3>
          <div className="service-card-menu-container">
            <button
              className="service-card-menu-btn"
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenuId(openMenuId === service.id ? null : service.id);
              }}
            >
              ⋮
            </button>
            {openMenuId === service.id && (
              <div className="service-card-dropdown">
                {service.isFromSharedLink ? (
                  <button className="menu-item menu-item-delete" onClick={(e) => {
                    e.stopPropagation(); setOpenMenuId(null); handleUnshareService(service);
                  }}>Remove</button>
                ) : (
                  <>
                    {service.canEdit && (
                      <button className="menu-item" onClick={(e) => {
                        e.stopPropagation(); setOpenMenuId(null); handleEditService(service);
                      }}>{t('service.edit')}</button>
                    )}
                    {service.isCreator && (
                      <button className="menu-item" onClick={(e) => {
                        e.stopPropagation(); setOpenMenuId(null); handleShareService(service);
                      }}>{t('service.share')}</button>
                    )}
                    {service.isCreator && (
                      <button className="menu-item" onClick={(e) => {
                        e.stopPropagation(); setOpenMenuId(null); handleCopySolucastLink(service);
                      }}>{t('service.solucastLink')}</button>
                    )}
                    <button className="menu-item" onClick={(e) => {
                      e.stopPropagation(); setOpenMenuId(null); handleDownloadPDF(service);
                    }}>PDF</button>
                    <button className="menu-item menu-item-whatsapp" onClick={(e) => {
                      e.stopPropagation(); setOpenMenuId(null); handleSharePDFWhatsApp(service);
                    }}>{t('service.whatsapp')}</button>
                    {service.isCreator && (
                      <button className="menu-item" onClick={(e) => {
                        e.stopPropagation(); setOpenMenuId(null); handleMoveService(service);
                      }}>{t('service.move')}</button>
                    )}
                    {service.canEdit && (
                      <button className="menu-item" onClick={(e) => {
                        e.stopPropagation(); setOpenMenuId(null); handlePassLeadership(service);
                      }}>{t('service.passLeadership')}</button>
                    )}
                    {service.canEdit && (
                      <button className="menu-item menu-item-delete" onClick={(e) => {
                        e.stopPropagation(); setOpenMenuId(null); handleDeleteService(service);
                      }}>{t('service.delete')}</button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Meta: date + location */}
        <div className="service-card-meta">
          {service.date && (
            <div className="service-card-meta-row">
              <span className="icon">📅</span>
              <span>{formatDate(service.date)}{service.time ? ` · ${service.time}` : ''}</span>
            </div>
          )}
          {service.location && (
            <div className="service-card-meta-row">
              <span className="icon">📍</span>
              <span>{service.location}</span>
            </div>
          )}
        </div>

        {/* Setlist summary */}
        {service.setlist_summary && service.setlist_summary.length > 0 && (
          <div className="service-card-setlist">
            {service.setlist_summary.slice(0, 5).map((item, idx) => (
              <div key={idx} className="service-card-setlist-item">
                <span className="item-icon">{item.segment_type === 'prayer' ? '🙏' : '🎵'}</span>
                <span className="item-title">{item.title || 'Untitled'}</span>
                {item.key && (
                  <span className="item-key">
                    {convertKeyToFlat(transposeChord(item.key, item.transposition || 0))}
                  </span>
                )}
              </div>
            ))}
            {service.setlist_summary.length > 5 && (
              <div className="service-card-setlist-item" style={{ color: '#999', fontStyle: 'italic' }}>
                +{service.setlist_summary.length - 5} more
              </div>
            )}
          </div>
        )}

        {/* Badges */}
        {(service.isToday || service.isShared) && (
          <div className="service-card-badges">
            {service.isToday && <span className="badge-today">{t('service.todayBadge')}</span>}
            {service.isShared && <span className="badge-shared">{t('service.sharedBadge')}</span>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="services-list-page">
      {/* Header */}
      <div className="services-list-header">
        <h1>{t('service.title')}</h1>
        <button className="btn-create-service" onClick={handleNewService}>
          + {t('service.createNew')}
        </button>
      </div>

      {/* Search */}
      <div className="services-search-card">
        <input
          type="text"
          className="services-search-input"
          placeholder={`🔍 ${t('service.searchPlaceholder')}`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="services-loading">
          <div className="services-spinner" />
        </div>
      ) : error ? (
        <div className="services-empty-state">
          <p>{error}</p>
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="services-empty-state">
          <h3>{t('service.noServicesFound')}</h3>
          <p>{debouncedSearch ? t('service.tryAdjustingSearch') : t('service.getStarted')}</p>
          {!debouncedSearch && (
            <button className="btn-create-service" onClick={handleNewService}>
              + {t('service.createNew')}
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Upcoming */}
          {upcomingServices.length > 0 && (
            <div>
              <div className="services-section-heading">
                {t('service.upcomingServices')} <span className="count">({upcomingServices.length})</span>
              </div>
              <div className="services-grid">
                {upcomingServices.map(renderCard)}
              </div>
            </div>
          )}

          {/* Past */}
          {pastServices.length > 0 && (
            <div>
              <button
                className="services-past-toggle"
                onClick={() => setShowPastServices(!showPastServices)}
              >
                <span className={`chevron ${showPastServices ? 'open' : ''}`}>▶</span>
                {t('service.pastServices')} <span className="count">({pastServices.length})</span>
              </button>
              {showPastServices && (
                <div className="services-grid">
                  {pastServices.map(renderCard)}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <ServiceEditModal
        service={modalService}
        currentSetlist={modalService ? editSetlist : []}
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setModalService(null); setEditSetlist([]); }}
        onSave={handleSaveService}
        onUpdate={handleUpdateSetlist}
      />

      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Service"
        message={`Are you sure you want to delete "${serviceToDelete?.title || serviceToDelete?.location || 'this service'}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => { setShowDeleteConfirm(false); setServiceToDelete(null); }}
      />

      {/* Move Dialog */}
      {showMoveDialog && (
        <div className="modal-overlay" onClick={() => { setShowMoveDialog(false); setServiceToMove(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Move "{serviceToMove?.title}" to Workspace</h2>
            <p>Select a workspace to move this service to:</p>
            <div className="workspace-list">
              {workspaces
                ?.filter(ws => ws.id !== activeWorkspace?.id)
                .map(ws => (
                  <button key={ws.id} className="workspace-option" onClick={() => confirmMove(ws.id)}>
                    {ws.name}
                  </button>
                ))}
              {(!workspaces || workspaces.filter(ws => ws.id !== activeWorkspace?.id).length === 0) && (
                <p style={{ textAlign: 'center', color: '#999', fontStyle: 'italic' }}>No other workspaces available</p>
              )}
            </div>
            <div className="modal-actions">
              <button onClick={() => { setShowMoveDialog(false); setServiceToMove(null); }} className="btn-cancel">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <ShareModal
        service={serviceToShare}
        isOpen={isShareModalOpen}
        onClose={() => { setIsShareModalOpen(false); setServiceToShare(null); }}
      />

      <PassLeadershipModal
        service={serviceToPassLeadership}
        isOpen={isPassLeadershipModalOpen}
        onClose={() => { setIsPassLeadershipModalOpen(false); setServiceToPassLeadership(null); }}
        onLeaderChanged={handleLeaderChanged}
      />

      {/* PDF Loading Overlay */}
      {isGeneratingPDF && (
        <div className="pdf-overlay">
          <div className="pdf-spinner" />
          <div className="pdf-text">Generating PDF...</div>
        </div>
      )}
    </div>
  );
};

export default ServicesList;
