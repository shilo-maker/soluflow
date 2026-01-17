import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import songService from '../services/songService';
import serviceService from '../services/serviceService';
import Toast from '../components/Toast';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [serviceCode, setServiceCode] = useState(['', '', '', '']);
  const codeInputsRef = useRef([]);
  const [services, setServices] = useState([]);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Fetch services and songs on component mount with cancellation support
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        const [servicesData, songsData] = await Promise.all([
          serviceService.getAllServices(),
          songService.getAllSongs(1)
        ]);

        if (isMounted) {
          setServices(servicesData);
          setSongs(songsData);
          setError(null);
        }
      } catch (err) {
        // Ignore abort errors
        if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return;

        if (isMounted) {
          console.error('Error fetching data:', err);
          setError('Failed to load data. Please try again.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
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

  const handleCodeChange = (index, value) => {
    // Only allow alphanumeric characters
    const sanitized = value.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (sanitized.length <= 1) {
      const newCode = [...serviceCode];
      newCode[index] = sanitized;
      setServiceCode(newCode);

      // Auto-focus next input if current is filled
      if (sanitized && index < 3) {
        codeInputsRef.current[index + 1]?.focus();
      }
    }
  };

  const handleCodeKeyDown = (index, e) => {
    // Handle backspace to move to previous input
    if (e.key === 'Backspace' && !serviceCode[index] && index > 0) {
      codeInputsRef.current[index - 1]?.focus();
    }

    // Handle enter to submit
    if (e.key === 'Enter') {
      handleJoinService();
    }
  };

  const handleCodePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const newCode = [...serviceCode];

    for (let i = 0; i < Math.min(pastedData.length, 4); i++) {
      newCode[i] = pastedData[i];
    }

    setServiceCode(newCode);

    // Focus the next empty input or the last one
    const nextEmptyIndex = newCode.findIndex(c => !c);
    if (nextEmptyIndex !== -1) {
      codeInputsRef.current[nextEmptyIndex]?.focus();
    } else {
      codeInputsRef.current[3]?.focus();
    }
  };

  const handleJoinService = async () => {
    const code = serviceCode.join('');
    if (code.length !== 4) {
      return;
    }

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
                    {service.date} • {service.time?.slice(0, 5)}
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
          <div className="code-input-container">
            {[0, 1, 2, 3].map((index) => (
              <input
                key={index}
                ref={(el) => (codeInputsRef.current[index] = el)}
                type="text"
                className="code-input-box"
                value={serviceCode[index]}
                onChange={(e) => handleCodeChange(index, e.target.value)}
                onKeyDown={(e) => handleCodeKeyDown(index, e)}
                onPaste={index === 0 ? handleCodePaste : undefined}
                onClick={() => codeInputsRef.current[0]?.focus()}
                maxLength="1"
                dir="ltr"
              />
            ))}
          </div>
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
