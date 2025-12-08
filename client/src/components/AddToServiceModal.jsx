import React, { useState, useEffect } from 'react';
import serviceService from '../services/serviceService';
import { useLanguage } from '../contexts/LanguageContext';
import './AddToServiceModal.css';

const AddToServiceModal = ({ song, isOpen, onClose, onSuccess }) => {
  const { t } = useLanguage();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [addedToServices, setAddedToServices] = useState(new Set()); // Track which services we've added to

  useEffect(() => {
    if (isOpen) {
      fetchServicesWithSongs();
      setSearchQuery('');
      setError('');
      setAddedToServices(new Set());
    }
  }, [isOpen]);

  const fetchServicesWithSongs = async () => {
    try {
      setLoading(true);
      const allServices = await serviceService.getAllServices();

      // Filter to only include services that are today or in the future
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const upcomingServices = allServices.filter(service => {
        if (!service.date) return true; // Include services without a date
        const serviceDate = new Date(service.date);
        serviceDate.setHours(0, 0, 0, 0);
        return serviceDate >= today;
      });

      // Check if backend provides song_ids (optimized path)
      if (upcomingServices.length > 0 && upcomingServices[0].song_ids !== undefined) {
        // Use song_ids from backend
        const servicesWithSongs = upcomingServices.map(service => ({
          ...service,
          songs: (service.song_ids || []).map(id => ({ id }))
        }));
        setServices(servicesWithSongs);
      } else {
        // Fallback: fetch each service's details to get songs
        const servicesWithSongs = await Promise.all(
          upcomingServices.map(async (service) => {
            try {
              const fullService = await serviceService.getServiceById(service.id);
              return {
                ...service,
                songs: fullService.songs || []
              };
            } catch (err) {
              return { ...service, songs: [] };
            }
          })
        );
        setServices(servicesWithSongs);
      }

      setError('');
    } catch (err) {
      console.error('Error fetching services:', err);
      setError(t('library.failedToAddSong'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddToService = async (service) => {
    if (!song || !service || adding) {
      return;
    }

    // Check if song is already in this service
    const songAlreadyInService = service.songs?.some(s => s.id === song.id);

    if (songAlreadyInService) {
      setError(`"${song.title}" ${t('library.alreadyInService')} "${service.title}"`);
      return;
    }

    try {
      setAdding(true);
      setError('');

      // Calculate the next position (at the end of the setlist)
      // Use song_count from backend if available, otherwise fall back to songs array length
      const nextPosition = service.song_count ?? service.songs?.length ?? 0;

      await serviceService.addSongToService(service.id, {
        song_id: song.id,
        position: nextPosition
      });

      // Mark this service as added to
      setAddedToServices(prev => new Set([...prev, service.id]));

      // Update the local state to show the song was added
      setServices(prevServices =>
        prevServices.map(s =>
          s.id === service.id
            ? {
                ...s,
                songs: [...(s.songs || []), { id: song.id, title: song.title }],
                song_count: (s.song_count ?? s.songs?.length ?? 0) + 1
              }
            : s
        )
      );

      // Call onSuccess first, then close with a small delay to ensure toast appears
      onSuccess(`"${song.title}" ${t('library.addedToService')} "${service.title}"`);
      setTimeout(() => {
        onClose();
      }, 100);
    } catch (err) {
      console.error('Error adding song to service:', err);
      setError(err.response?.data?.error || t('library.failedToAddSong'));
    } finally {
      setAdding(false);
    }
  };

  // Filter services based on search
  const filteredServices = services.filter(service => {
    const query = searchQuery.toLowerCase();
    return service.title.toLowerCase().includes(query) ||
           (service.location && service.location.toLowerCase().includes(query));
  });

  // Check if song is already in a service
  const isSongInService = (service) => {
    return service.songs?.some(s => s.id === song?.id) || addedToServices.has(service.id);
  };

  if (!isOpen) return null;

  return (
    <div className="add-to-service-modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('library.addToService')}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {error && <div className="modal-error">{error}</div>}

          <div className="song-being-added">
            <span className="label">{t('library.addingSong')}:</span>
            <span className="song-name">{song?.title}</span>
          </div>

          <input
            type="text"
            className="service-search-input"
            placeholder={t('library.searchServices')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="services-list">
            {loading ? (
              <div className="loading-services">{t('common.loading')}</div>
            ) : filteredServices.length === 0 ? (
              <div className="no-services">
                {searchQuery
                  ? t('library.noServicesFound')
                  : t('library.noServicesYet')}
              </div>
            ) : (
              filteredServices.map(service => {
                const alreadyAdded = isSongInService(service);
                return (
                  <div
                    key={service.id}
                    className={`service-item ${alreadyAdded ? 'already-added' : ''} ${adding ? 'disabled' : ''}`}
                    onClick={() => !alreadyAdded && !adding && handleAddToService(service)}
                  >
                    <div className="service-info">
                      <div className="service-title">{service.title}</div>
                      <div className="service-meta">
                        {service.date && <span>{service.date}</span>}
                        {service.location && <span>{service.location}</span>}
                        <span>{service.song_count ?? service.songs?.length ?? 0} {t('library.songs')}</span>
                      </div>
                    </div>
                    <div className="service-action">
                      {alreadyAdded ? (
                        <span className="already-added-badge">{t('library.alreadyAdded')}</span>
                      ) : (
                        <button
                          className="btn-modal-add"
                          disabled={adding}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToService(service);
                          }}
                        >
                          +
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose} disabled={adding}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddToServiceModal;
