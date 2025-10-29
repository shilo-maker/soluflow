import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import songService from '../services/songService';
import ChordProDisplay from '../components/ChordProDisplay';
import SongEditModal from '../components/SongEditModal';
import SongShareModal from '../components/SongShareModal';
import KeySelectorModal from '../components/KeySelectorModal';
import Toast from '../components/Toast';
import { getTransposeDisplay, transposeChord, stripChords } from '../utils/transpose';
import { generateSongPDF } from '../utils/pdfGenerator';
import './Library.css';

// Memoized song card component to prevent unnecessary re-renders
const LibrarySongCard = React.memo(({ song, isSelected, onClick, user, activeWorkspace, t }) => {
  return (
    <div
      className={`song-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="song-card-content">
        <div className="song-card-left">
          <h3 className="song-card-title">
            {song.title}
            {user && song.isShared && (
              <span className="badge-shared">Shared with me / {song.sharedBy?.username || 'Unknown'}</span>
            )}
            {user && !song.isShared && song.is_public && (
              <span className="badge-public">{t('library.public')}</span>
            )}
            {user && !song.isShared && !song.is_public && (
              <>
                {song.workspace?.id === activeWorkspace?.id && song.workspace?.workspace_type === 'organization' ? (
                  <span className="badge-workspace">{song.workspace.name}</span>
                ) : song.created_by === user.id ? (
                  <span className="badge-personal">{t('workspace.personal')}</span>
                ) : user.role === 'admin' ? (
                  <span className="badge-personal-user">{t('workspace.personal')}/{song.creator?.username || 'Unknown'}</span>
                ) : null}
              </>
            )}
          </h3>
          <p className="song-card-authors">{song.authors}</p>
        </div>
        <div className="song-card-right">
          <span className="song-key">Key: {song.key}</span>
        </div>
      </div>
    </div>
  );
});

LibrarySongCard.displayName = 'LibrarySongCard';

const Library = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { activeWorkspace } = useWorkspace();
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSong, setSelectedSong] = useState(null);
  const [fontSize, setFontSize] = useState(14);
  const [transposition, setTransposition] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSong, setModalSong] = useState(null); // null = create mode, song object = edit mode
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareSong, setShareSong] = useState(null);
  const [showKeySelectorModal, setShowKeySelectorModal] = useState(false);
  const songDisplayRef = useRef(null);

  // Reset modal state when selected song changes
  useEffect(() => {
    setShowKeySelectorModal(false);
  }, [selectedSong?.id]);

  // Close expanded song when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectedSong && songDisplayRef.current && !songDisplayRef.current.contains(event.target)) {
        // Check if click is not on a song card or key selector modal
        const clickedSongCard = event.target.closest('.song-card');
        const clickedModal = event.target.closest('.key-selector-overlay');
        if (!clickedSongCard && !clickedModal) {
          setSelectedSong(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedSong]);

  // Fetch songs on component mount
  useEffect(() => {
    const fetchSongs = async () => {
      // Fetch songs even if user isn't loaded yet - public songs should be visible to everyone
      try {
        setLoading(true);
        // Don't pass workspace_id to show ALL public songs from all workspaces
        const data = await songService.getAllSongs();
        setSongs(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching songs:', err);
        setError('Failed to load songs. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchSongs();
  }, []); // Empty dependency array - fetch once on mount

  const filteredSongs = songs.filter(song => {
    const query = searchQuery.toLowerCase();
    const titleMatch = song.title.toLowerCase().includes(query);
    const authorsMatch = song.authors && song.authors.toLowerCase().includes(query);

    // Search in lyrics content (strip chords first)
    const strippedContent = stripChords(song.content || '').toLowerCase();
    const contentMatch = strippedContent.includes(query);

    return titleMatch || authorsMatch || contentMatch;
  }).map(song => {
    // Assign priority based on what matched (lower number = higher priority)
    const query = searchQuery.toLowerCase();
    const titleMatch = song.title.toLowerCase().includes(query);
    const strippedContent = stripChords(song.content || '').toLowerCase();
    const contentMatch = strippedContent.includes(query);
    const authorsMatch = song.authors && song.authors.toLowerCase().includes(query);

    let priority;
    if (titleMatch) {
      priority = 1;
    } else if (contentMatch) {
      priority = 2;
    } else if (authorsMatch) {
      priority = 3;
    } else {
      priority = 4;
    }

    return { ...song, searchPriority: priority };
  }).sort((a, b) => a.searchPriority - b.searchPriority);

  const displayedSongs = filteredSongs;

  const handleSongClick = (song) => {
    // Close any open modal first
    setShowKeySelectorModal(false);

    // Toggle: if clicking the same song, close it; otherwise open the new song
    if (selectedSong?.id === song.id) {
      setSelectedSong(null);
    } else {
      setSelectedSong(song);
      setFontSize(14); // Reset font size when selecting new song
      setTransposition(0); // Reset transposition when selecting new song
    }
  };

  const zoomIn = () => {
    setFontSize(prev => Math.min(prev + 2, 24));
  };

  const zoomOut = () => {
    setFontSize(prev => Math.max(prev - 2, 10));
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

  const handleSelectKey = (newTransposition) => {
    setTransposition(newTransposition);
  };

  const handleAddSong = () => {
    setModalSong(null); // null indicates create mode
    setIsModalOpen(true);
  };

  const handleEditSong = () => {
    setModalSong(selectedSong);
    setIsModalOpen(true);
  };

  const handleSaveSong = async (formData) => {
    try {
      // Map field names to match backend expectations
      const songData = {
        title: formData.title,
        authors: formData.authors,
        key: formData.key,
        bpm: formData.bpm ? parseInt(formData.bpm) : null,
        time_signature: formData.timeSig,
        content: formData.content,
        listen_url: formData.listen_url,
        workspace_id: activeWorkspace?.id
      };

      // Include workspace_ids if provided
      if (formData.workspace_ids) {
        songData.workspace_ids = formData.workspace_ids;
      }

      if (modalSong) {
        // Edit mode - update existing song
        const updatedSong = await songService.updateSong(modalSong.id, songData);

        // Update the songs list with the edited song
        setSongs(prev => prev.map(song =>
          song.id === updatedSong.id ? updatedSong : song
        ));

        // Update the selected song if it's currently displayed
        if (selectedSong?.id === updatedSong.id) {
          setSelectedSong(updatedSong);
        }

        // Show success toast
        setToastMessage('Song updated successfully!');
        setShowToast(true);
      } else {
        // Create mode - add new song
        const newSong = await songService.createSong(songData);

        // Add the new song to the list
        setSongs(prev => [...prev, newSong].sort((a, b) =>
          a.title.localeCompare(b.title)
        ));

        // Show success toast with workspace info
        if (formData.workspace_ids && formData.workspace_ids.length > 0) {
          setToastMessage(`Song created and made visible in ${formData.workspace_ids.length} workspace(s)!`);
        } else {
          setToastMessage('Song created successfully!');
        }
        setShowToast(true);
      }

      setIsModalOpen(false);
      setModalSong(null);
    } catch (err) {
      console.error('Error saving song:', err);
      throw new Error(err.error || 'Failed to save song');
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalSong(null);
  };

  const handleCloseToast = () => {
    setShowToast(false);
  };

  const handleOpenFullView = () => {
    navigate(`/song/${selectedSong.id}`);
  };

  const handleMakePublic = async () => {
    if (!selectedSong) return;

    try {
      console.log('Making song public:', selectedSong.id);

      const updatedSong = await songService.updateSong(selectedSong.id, {
        title: selectedSong.title,
        content: selectedSong.content,
        key: selectedSong.key,
        bpm: selectedSong.bpm,
        time_signature: selectedSong.time_signature,
        authors: selectedSong.authors,
        copyright_info: selectedSong.copyright_info,
        is_public: true
      });

      console.log('Song updated successfully:', updatedSong);
      console.log('is_public value:', updatedSong.is_public);

      // Update the songs list
      setSongs(prev => prev.map(song =>
        song.id === updatedSong.id ? { ...updatedSong, is_public: true } : song
      ));

      // Update the selected song with is_public explicitly set
      setSelectedSong({ ...updatedSong, is_public: true });

      // Show success toast
      setToastMessage('Song is now public!');
      setShowToast(true);
    } catch (err) {
      console.error('Error making song public:', err);
      setToastMessage('Failed to make song public. Please try again.');
      setShowToast(true);
    }
  };

  const handleDeleteSong = async () => {
    if (!selectedSong) return;

    // Confirm deletion
    if (!window.confirm(`Are you sure you want to delete "${selectedSong.title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await songService.deleteSong(selectedSong.id);

      // Remove from songs list
      setSongs(prev => prev.filter(song => song.id !== selectedSong.id));

      // Clear selection
      setSelectedSong(null);

      // Show success toast
      setToastMessage('Song deleted successfully!');
      setShowToast(true);
    } catch (err) {
      console.error('Error deleting song:', err);
      setToastMessage('Failed to delete song. Please try again.');
      setShowToast(true);
    }
  };

  const handleShareSong = () => {
    setShareSong(selectedSong);
    setIsShareModalOpen(true);
  };

  const handleCloseShareModal = () => {
    setIsShareModalOpen(false);
    setShareSong(null);
  };

  const handleDownloadPDF = async (e) => {
    e.stopPropagation(); // Prevent triggering song click

    if (!selectedSong) {
      setToastMessage('No song selected');
      setShowToast(true);
      return;
    }

    try {
      setToastMessage('Generating PDF...');
      setShowToast(true);

      // Generate PDF with current transposition and font size
      await generateSongPDF(selectedSong, transposition, fontSize);

      setToastMessage('PDF downloaded successfully!');
      setShowToast(true);
    } catch (err) {
      console.error('Error generating PDF:', err);
      setToastMessage('Failed to generate PDF');
      setShowToast(true);
    }
  };

  // Detect if song content has Hebrew characters
  const hasHebrew = (text) => /[\u0590-\u05FF]/.test(text);

  return (
    <div className="library-page">
      <div className="search-section">
        <input
          type="text"
          className="search-input-library"
          placeholder={t('library.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setSelectedSong(null); // Clear selection when searching
          }}
        />
        <button className="btn-add" onClick={handleAddSong}>{t('library.add')}</button>
      </div>

      {loading && (
        <div className="loading-state">Loading songs...</div>
      )}

      {error && (
        <div className="error-state">{error}</div>
      )}

      {!loading && !error && (
      <div className="songs-list">
        {displayedSongs.map(song => (
          <React.Fragment key={song.id}>
            <LibrarySongCard
              song={song}
              isSelected={selectedSong?.id === song.id}
              onClick={() => handleSongClick(song)}
              user={user}
              activeWorkspace={activeWorkspace}
              t={t}
            />

            {/* Display selected song chord sheet right below the clicked song */}
            {selectedSong?.id === song.id && (
              <div className="song-display-inline" ref={songDisplayRef}>
          <div className="song-header-inline">
            <div className="song-info-inline">
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <h2 className="song-title-inline">{selectedSong.title}</h2>
                <button
                  className="btn-pdf-library"
                  onClick={handleDownloadPDF}
                  title="Download PDF"
                >
                  PDF
                </button>
              </div>
              <p className="song-authors-inline">{selectedSong.authors}</p>
            </div>
            <div className="song-meta-inline">
              <div className="transpose-controls-inline">
                <button className="btn-transpose-inline" onClick={transposeDown}>-</button>
                <span
                  className="transpose-display-inline"
                  onClick={(e) => {
                    console.log('Transpose display clicked!');
                    e.stopPropagation();
                    setShowKeySelectorModal(true);
                    console.log('Modal should open now, showKeySelectorModal:', true);
                  }}
                  title="Click to select key"
                >
                  {transposeChord(selectedSong.key, transposition)}
                  {transposition !== 0 && ` (${transposition > 0 ? '+' : ''}${transposition})`}
                </span>
                <button className="btn-transpose-inline" onClick={transposeUp}>+</button>
              </div>
              <div className="zoom-controls">
                <button className="btn-zoom btn-zoom-out" onClick={zoomOut}>
                  <span className="zoom-icon-small">A</span>
                </button>
                <button className="btn-zoom btn-zoom-in" onClick={zoomIn}>
                  <span className="zoom-icon-large">A</span>
                </button>
              </div>
              <span className="key-info-inline">Key: {selectedSong.key}</span>
              {selectedSong.bpm && <span className="bpm-info-inline">BPM: {selectedSong.bpm}</span>}
              {selectedSong.listen_url && (
                <a
                  href={selectedSong.listen_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="listen-link-inline"
                  onClick={(e) => e.stopPropagation()}
                >
                  🎵 Listen
                </a>
              )}
            </div>
          </div>

          <div
            className="song-content-inline clickable"
            onClick={handleOpenFullView}
            title="Click to open in full view"
          >
            <ChordProDisplay
              content={selectedSong.content}
              dir={hasHebrew(selectedSong.content) ? 'rtl' : 'ltr'}
              fontSize={fontSize}
              transposition={transposition}
            />
          </div>

          <div className="song-actions-inline">
            {(user?.role === 'admin' || selectedSong.created_by === user?.id) && (
              <button
                className="btn-edit-song"
                onClick={handleEditSong}
              >
                Edit Song
              </button>
            )}
            {!selectedSong.is_public && (user?.role === 'admin' || selectedSong.created_by === user?.id) && (
              <button
                className="btn-share-song"
                onClick={handleShareSong}
              >
                Share Song
              </button>
            )}
            {user?.role === 'admin' && !selectedSong.is_public && (
              <button
                className="btn-make-public"
                onClick={handleMakePublic}
              >
                Make Public
              </button>
            )}
            {(user?.role === 'admin' || selectedSong.created_by === user?.id) && (
              <button
                className="btn-delete-song"
                onClick={handleDeleteSong}
              >
                Delete Song
              </button>
            )}
            <button
              className="btn-close-song"
              onClick={() => setSelectedSong(null)}
            >
              Close
            </button>
          </div>
        </div>
            )}
          </React.Fragment>
        ))}

        {filteredSongs.length === 0 && (
          <div className="empty-state">
            No songs found matching "{searchQuery}"
          </div>
        )}
      </div>
      )}

      {/* Song Modal (Create/Edit) */}
      <SongEditModal
        song={modalSong}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveSong}
      />

      {/* Song Share Modal */}
      <SongShareModal
        song={shareSong}
        isOpen={isShareModalOpen}
        onClose={handleCloseShareModal}
      />

      {/* Key Selector Modal */}
      {selectedSong && (
        <KeySelectorModal
          isOpen={showKeySelectorModal}
          onClose={() => setShowKeySelectorModal(false)}
          currentKey={selectedSong.key}
          currentTransposition={transposition}
          onSelectKey={handleSelectKey}
        />
      )}

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

export default Library;
