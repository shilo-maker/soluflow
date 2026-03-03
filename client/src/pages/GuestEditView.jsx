import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import useWakeLock from '../hooks/useWakeLock';
import serviceService from '../services/serviceService';
import ChordProDisplay from '../components/ChordProDisplay';
import SetlistBuilder from '../components/SetlistBuilder';
import Toast from '../components/Toast';
import KeySelectorModal from '../components/KeySelectorModal';
import { transposeChord, convertKeyToFlat } from '../utils/transpose';
import './GuestServiceView.css';

const hasHebrew = (text) => /[\u0590-\u05FF]/.test(text || '');

const GuestEditView = () => {
  const { editToken } = useParams();

  useWakeLock(true);

  const [serviceDetails, setServiceDetails] = useState(null);
  const [selectedSongIndex, setSelectedSongIndex] = useState(0);
  const [fontSize, setFontSize] = useState(14);
  const [transposition, setTransposition] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState('success');
  const [showKeySelectorModal, setShowKeySelectorModal] = useState(false);
  const [isSetlistBuilderOpen, setIsSetlistBuilderOpen] = useState(false);

  const fetchService = async () => {
    try {
      setLoading(true);
      const data = await serviceService.getServiceByEditToken(editToken);

      // Store guest editor token for API calls
      if (data.guestEditorToken) {
        localStorage.setItem('token', data.guestEditorToken);
      }

      setServiceDetails(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching service:', err);
      setError('Service not found or link is invalid');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (editToken) {
      fetchService();
    }
  }, [editToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load saved transposition when song changes
  useEffect(() => {
    if (serviceDetails?.songs?.[selectedSongIndex]) {
      const currentSong = serviceDetails.songs[selectedSongIndex];
      setTransposition(currentSong.transposition || 0);
    }
  }, [selectedSongIndex, serviceDetails]);

  const currentSetList = serviceDetails?.songs || [];
  const currentSong = currentSetList[selectedSongIndex];

  // Memoize parsed prayer data to avoid double-parsing on every render
  const parsedPrayerData = useMemo(() => {
    if (currentSong?.segment_type !== 'prayer') return null;
    if (!currentSong.segment_content) return {};
    try {
      return typeof currentSong.segment_content === 'string'
        ? JSON.parse(currentSong.segment_content)
        : currentSong.segment_content;
    } catch { return {}; }
  }, [currentSong]);

  const zoomIn = () => setFontSize(prev => Math.min(prev + 2, 24));
  const zoomOut = () => setFontSize(prev => Math.max(prev - 2, 10));
  const transposeUp = () => setTransposition(prev => Math.min(prev + 1, 11));
  const transposeDown = () => setTransposition(prev => Math.max(prev - 1, -11));

  const handleUpdateSetlist = async (newSetlist) => {
    try {
      const currentItemIds = currentSetList.map(s => s.id);
      const newItemIds = newSetlist.map(s => s.id);

      // Remove items no longer in setlist
      for (const item of currentSetList) {
        if (!newItemIds.includes(item.id)) {
          await serviceService.removeSongFromService(serviceDetails.id, item.id);
        }
      }

      // Update positions and add new items
      for (let i = 0; i < newSetlist.length; i++) {
        const item = newSetlist[i];

        if (currentItemIds.includes(item.id)) {
          // Update position (and content for prayer items)
          const updateData = { position: i };
          if (item.segment_type === 'prayer') {
            updateData.segment_title = item.segment_title || item.title;
            updateData.segment_content = item.segment_content;
          }
          await serviceService.updateServiceSong(serviceDetails.id, item.id, updateData);
        } else if (item.segment_type === 'prayer') {
          // Add new prayer item
          await serviceService.addSongToService(serviceDetails.id, {
            song_id: null,
            position: i,
            segment_type: 'prayer',
            segment_title: item.segment_title || item.title,
            segment_content: item.segment_content
          });
        } else {
          // Add new song
          await serviceService.addSongToService(serviceDetails.id, {
            song_id: item.song_id || item.id,
            position: i,
            segment_type: 'song'
          });
        }
      }

      // Refresh service data
      await fetchService();

      // Clamp selectedSongIndex to new bounds
      setSelectedSongIndex(prev => Math.min(prev, Math.max(newSetlist.length - 1, 0)));

      setToastMessage('Setlist updated successfully!');
      setToastType('success');
      setShowToast(true);
    } catch (err) {
      console.error('Error updating setlist:', err);
      setToastMessage('Failed to update setlist');
      setToastType('error');
      setShowToast(true);
    }
  };

  if (loading) {
    return (
      <div className="guest-service-page">
        <div className="loading-state">Loading service...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="guest-service-page">
        <div className="error-state">
          <h2>{error}</h2>
          <p>Please check the link and try again.</p>
        </div>
      </div>
    );
  }

  if (!serviceDetails) return null;

  return (
    <div className="guest-service-page">
      <div className="guest-service-header">
        <div className="header-top">
          <h1>SoluFlow</h1>
        </div>
        <div className="service-info-banner">
          <div className="service-banner-content">
            <div className="service-title-section">
              <h2>{serviceDetails.title}</h2>
              <div className="service-meta">
                {serviceDetails.date && <span>{serviceDetails.date}</span>}
                {serviceDetails.time && <span>{serviceDetails.time}</span>}
                {serviceDetails.location && <span>{serviceDetails.location}</span>}
              </div>
            </div>
            <div className="header-buttons">
              <button
                className="btn-follow-mode active"
                onClick={() => setIsSetlistBuilderOpen(true)}
              >
                Edit Setlist
              </button>
            </div>
          </div>
        </div>
      </div>

      {currentSetList.length > 0 ? (
        <div className="guest-service-content">
          {/* Song Pills */}
          <div className="song-pills">
            {currentSetList.map((item, index) => (
              <button
                key={`${item.segment_type || 'song'}-${item.id}`}
                className={`song-pill ${index === selectedSongIndex ? 'active' : ''} ${item.segment_type === 'prayer' ? 'prayer-pill' : ''}`}
                onClick={() => setSelectedSongIndex(index)}
              >
                {item.segment_type === 'prayer' && '🙏 '}
                {item.title || item.segment_title}
              </button>
            ))}
          </div>

          {/* Song/Prayer Display */}
          {currentSong && currentSong.segment_type === 'prayer' ? (
            <div className="song-display prayer-display">
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
                  <div className="zoom-controls">
                    <button className="btn-zoom" onClick={zoomOut}>A-</button>
                    <button className="btn-zoom" onClick={zoomIn}>A+</button>
                  </div>
                </div>
              </div>
              <div className="prayer-content-display" style={{ fontSize: `${fontSize}px` }}>
                {parsedPrayerData?.same_verse_for_all && parsedPrayerData.shared_bible_ref && (
                  <div className="prayer-shared-verse">📖 {parsedPrayerData.shared_bible_ref}</div>
                )}
                {(parsedPrayerData?.prayer_points || []).map((point, idx) => (
                  <div key={idx} className="prayer-point-display">
                    {point.subtitle && (
                      <div className="prayer-point-subtitle">
                        <strong>{idx + 1}. {point.subtitle}</strong>
                        {point.subtitle_translation && <span className="prayer-point-subtitle-translation"> — {point.subtitle_translation}</span>}
                      </div>
                    )}
                    {point.description && (
                      <div className="prayer-point-description">
                        {point.description}
                        {point.description_translation && <div className="prayer-point-description-translation">{point.description_translation}</div>}
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
            <div className="song-display">
              <div className="song-header">
                <div className="song-info">
                  <div className="song-title-row">
                    <h2 className="song-title">{currentSong.title}</h2>
                    {currentSong.listen_url && (
                      <a
                        href={currentSong.listen_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="listen-link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Listen
                      </a>
                    )}
                  </div>
                  <p className="song-authors">{currentSong.authors}</p>
                </div>
                <div className="song-meta">
                  <div className="transpose-controls">
                    <button className="btn-transpose" onClick={transposeDown}>-</button>
                    <span
                      className="transpose-display"
                      onClick={() => setShowKeySelectorModal(true)}
                      title="Click to select key"
                    >
                      {convertKeyToFlat(transposeChord(currentSong.key, transposition))}
                      {transposition !== 0 && ` (${transposition > 0 ? '+' : ''}${transposition})`}
                    </span>
                    <button className="btn-transpose" onClick={transposeUp}>+</button>
                  </div>
                  <div className="zoom-controls">
                    <button className="btn-zoom" onClick={zoomOut}>A-</button>
                    <button className="btn-zoom" onClick={zoomIn}>A+</button>
                  </div>
                  <span className="key-info">Key: {convertKeyToFlat(transposeChord(currentSong.key, transposition))}</span>
                  {currentSong.bpm && <span className="bpm-info">BPM: {currentSong.bpm}{currentSong.time_signature && ` (${currentSong.time_signature})`}</span>}
                </div>
              </div>

              <div className="song-content">
                <ChordProDisplay
                  content={currentSong.content}
                  dir={hasHebrew(currentSong.content) ? 'rtl' : 'ltr'}
                  fontSize={fontSize}
                  transposition={transposition}
                  songKey={currentSong.key}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="guest-service-content">
          <div className="empty-service">
            <p>No songs in this service yet.</p>
            <button
              className="btn-add-service"
              onClick={() => setIsSetlistBuilderOpen(true)}
              style={{ marginTop: '15px' }}
            >
              Add Songs
            </button>
          </div>
        </div>
      )}

      {/* Setlist Builder Modal */}
      <SetlistBuilder
        service={serviceDetails}
        currentSetlist={currentSetList}
        isOpen={isSetlistBuilderOpen}
        onClose={() => setIsSetlistBuilderOpen(false)}
        onUpdate={handleUpdateSetlist}
      />

      {/* Key Selector Modal */}
      {currentSong && currentSong.segment_type !== 'prayer' && (
        <KeySelectorModal
          isOpen={showKeySelectorModal}
          onClose={() => setShowKeySelectorModal(false)}
          currentKey={currentSong.key}
          currentTransposition={transposition}
          onSelectKey={setTransposition}
        />
      )}

      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />
    </div>
  );
};

export default GuestEditView;
