import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import songService from '../services/songService';
import serviceService from '../services/serviceService';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();
  const [serviceCode, setServiceCode] = useState('');
  const [services, setServices] = useState([]);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const handleJoinService = () => {
    if (serviceCode.trim()) {
      navigate(`/service/code/${serviceCode}`);
    }
  };

  const handleCreateService = () => {
    navigate('/service/create');
  };

  return (
    <div className="home-page">
      <div className="welcome-section">
        <h1 className="app-name">SoluFlow</h1>
        <h2 className="welcome-text">Welcome</h2>
      </div>

      {loading && (
        <div className="loading-state">Loading...</div>
      )}

      {error && (
        <div className="error-state">{error}</div>
      )}

      {/* Upcoming Services */}
      <div className="content-section">
        <div className="section-header">
          <h3>Upcoming Services</h3>
          <button className="btn-view-all" onClick={() => navigate('/services')}>
            VIEW ALL
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
            <div className="empty-state">No upcoming services</div>
          )}
        </div>
      </div>

      {/* Search Songs */}
      <div className="content-section">
        <div className="section-header">
          <h3>Recent Songs</h3>
          <button className="btn-view-all" onClick={() => navigate('/library')}>
            VIEW ALL
          </button>
        </div>
        <div className="section-content">
          <input
            type="text"
            className="search-input"
            placeholder="Search Songs..."
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
                <div className="song-preview-key">Key: {song.key}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Join Service by Code */}
      <div className="join-section">
        <h3>Service</h3>
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
            JOIN
          </button>
        </div>
      </div>

      {/* Create Service Button */}
      <div className="create-section">
        <button className="btn-create-service" onClick={handleCreateService}>
          CREATE SERVICE
        </button>
      </div>
    </div>
  );
};

export default Home;
