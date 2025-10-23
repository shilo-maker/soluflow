import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import songService from '../services/songService';
import serviceService from '../services/serviceService';
import Toast from '../components/Toast';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [serviceCode, setServiceCode] = useState('');
  const [services, setServices] = useState([]);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Fetch services and songs on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [servicesData, songsData] = await Promise.all([
          serviceService.getAllServices(),
          songService.getAllSongs(1)
        ]);
        setServices(servicesData);
        setSongs(songsData);
        setError(null);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const upcomingServices = services.filter(s => {
    if (!s.date) return false;
    const serviceDate = new Date(s.date);
    const today = new Date();
    // Compare dates only (ignore time)
    serviceDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return serviceDate >= today;
  });

  const handleJoinService = async () => {
    if (!serviceCode.trim()) {
      return;
    }

    const code = serviceCode.trim();

    try {
      // Try to fetch as a service first
      await serviceService.getServiceByCode(code);
      navigate(`/service/code/${code}`);
    } catch (serviceError) {
      // If service fails, try as a song
      try {
        await songService.getSongByCode(code);
        navigate(`/song/code/${code}`);
      } catch (songError) {
        // Both failed - show error
        setToastMessage(t('home.invalidCode'));
        setShowToast(true);
      }
    }
  };

  const handleCreateService = () => {
    navigate('/service/create');
  };

  const handleCloseToast = () => {
    setShowToast(false);
  };

  return (
    <div className="home-page">
      <div className="welcome-section">
        <h1 className="app-name">SoluFlow</h1>
        <h2 className="welcome-text">{t('home.welcome')}</h2>
      </div>

      {loading && (
        <div className="loading-state">{t('common.loading')}</div>
      )}

      {error && (
        <div className="error-state">{error}</div>
      )}

      {/* Upcoming Services */}
      <div className="content-section">
        <div className="section-header">
          <h3>{t('home.upcomingServices')}</h3>
          <button className="btn-view-all" onClick={() => navigate('/services')}>
            {t('home.viewAll')}
          </button>
        </div>
        <div className="section-content">
          {upcomingServices.length > 0 ? (
            upcomingServices.slice(0, 2).map(service => (
              <div
                key={service.id}
                className="service-item"
                onClick={() => navigate(`/service/${service.id}`)}
              >
                <div className="service-info">
                  <div className="service-title">{service.title}</div>
                  <div className="service-details">
                    {service.date} • {service.time}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">{t('home.noServices')}</div>
          )}
        </div>
      </div>

      {/* Search Songs */}
      <div className="content-section">
        <div className="section-header">
          <h3>{t('home.recentSongs')}</h3>
          <button className="btn-view-all" onClick={() => navigate('/library')}>
            {t('home.viewAll')}
          </button>
        </div>
        <div className="section-content">
          <input
            type="text"
            className="search-input"
            placeholder={t('home.searchPlaceholder')}
            onClick={() => navigate('/library')}
            readOnly
          />
          <div className="songs-preview">
            {!loading && songs.slice(0, 3).map(song => (
              <div
                key={song.id}
                className="song-preview-item"
                onClick={() => navigate(`/song/${song.id}`)}
              >
                <div className="song-preview-info">
                  <div className="song-preview-title">{song.title}</div>
                  <div className="song-preview-author">{song.authors}</div>
                </div>
                <div className="song-preview-key">{t('home.key')}: {song.key}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Join with Code (Service or Song) */}
      <div className="join-section">
        <h3>{t('home.joinWithCode')}</h3>
        <div className="join-input-group">
          <input
            type="text"
            className="code-input"
            placeholder="X X X X"
            value={serviceCode}
            onChange={(e) => setServiceCode(e.target.value.toUpperCase())}
            maxLength="4"
          />
          <button className="btn-join" onClick={handleJoinService}>
            {t('home.join')}
          </button>
        </div>
      </div>

      {/* Create Service Button */}
      <div className="create-section">
        <button className="btn-create-service" onClick={handleCreateService}>
          {t('home.createService')}
        </button>
      </div>

      {/* Toast for errors */}
      <Toast
        message={toastMessage}
        type="error"
        isVisible={showToast}
        onClose={handleCloseToast}
      />
    </div>
  );
};

export default Home;
