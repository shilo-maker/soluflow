import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import songService from '../services/songService';
import ChordProDisplay from '../components/ChordProDisplay';
import SongEditModal from '../components/SongEditModal';
import SongShareModal from '../components/SongShareModal';
import KeySelectorModal from '../components/KeySelectorModal';
import AddToServiceModal from '../components/AddToServiceModal';
import Toast from '../components/Toast';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { getTransposeDisplay, transposeChord, stripChords, convertKeyToFlat } from '../utils/transpose';
import { generateSongPDF } from '../utils/pdfGenerator';
import { getFriendlyErrorMessage, getSuccessMessage } from '../utils/errorMessages';
import './Library.css';

// Strip Hebrew niqqud (vowel points) from text for search matching
const stripNiqqud = (text) => {
  if (!text) return '';
  // First, normalize to NFD to decompose precomposed Hebrew characters (e.g., U+FB2A שׁ -> ש + combining mark)
  // Then remove Hebrew combining marks (U+0591 to U+05C7) and Hebrew presentation forms vowels
  return text
    .normalize('NFD')
    .replace(/[\u0591-\u05C7]/g, '')
    .normalize('NFC');
};

// Memoized song card component to prevent unnecessary re-renders
const LibrarySongCard = React.memo(({ song, isSelected, onClick, user, activeWorkspace, t }) => {
  return (
    <div
      className={`song-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      role="listitem"
      tabIndex={0}
      aria-label={`Song: ${song.title} by ${song.authors}, Key: ${song.key}`}
      aria-pressed={isSelected}
      onKeyPress={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
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
          <span className="song-key">Key: {convertKeyToFlat(song.key)}</span>
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
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
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
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isAddToServiceModalOpen, setIsAddToServiceModalOpen] = useState(false);
  const [addToServiceSong, setAddToServiceSong] = useState(null);
  const [showSongMenu, setShowSongMenu] = useState(false);
  const songDisplayRef = useRef(null);
  const menuRef = useRef(null);

  // Debounce search query for better performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms debounce delay

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset modal state when selected song changes
  useEffect(() => {
    setShowKeySelectorModal(false);
    setShowSongMenu(false);
  }, [selectedSong?.id]);

  // Close song menu when clicking outside
  useEffect(() => {
    const handleClickOutsideMenu = (event) => {
      if (showSongMenu && menuRef.current && !menuRef.current.contains(event.target)) {
        setShowSongMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutsideMenu);
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideMenu);
    };
  }, [showSongMenu]);

  // Close expanded song when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectedSong && songDisplayRef.current && !songDisplayRef.current.contains(event.target)) {
        // Check if click is not on a song card, key selector modal, or any modal overlay
        const clickedSongCard = event.target.closest('.song-card');
        const clickedModal = event.target.closest('.key-selector-overlay');
        const clickedModalOverlay = event.target.closest('.modal-overlay');
        if (!clickedSongCard && !clickedModal && !clickedModalOverlay) {
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
        setError(getFriendlyErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    fetchSongs();
  }, []); // Empty dependency array - fetch once on mount

  // Parse search query for #tagname patterns
  const parseSearchQuery = (query) => {
    const tagPattern = /#([\u0590-\u05FF\w-]+)/g;
    const tagNames = [];
    let match;
    while ((match = tagPattern.exec(query)) !== null) {
      tagNames.push(stripNiqqud(match[1].toLowerCase()));
    }
    // Remove tag patterns from query to get text search part
    const textQuery = query.replace(tagPattern, '').trim();
    return { tagNames, textQuery };
  };

  const { tagNames: searchTagNames, textQuery } = parseSearchQuery(debouncedSearchQuery);

  // Memoize filtered songs to prevent unnecessary recalculations
  const displayedSongs = useMemo(() => {
    return songs.filter(song => {
      // Strip niqqud from query and content for Hebrew search matching
      const query = stripNiqqud(textQuery.toLowerCase());

      // If there's no text query, don't filter by text (only by tags)
      let textMatch = true;
      if (query) {
        const titleMatch = stripNiqqud(song.title.toLowerCase()).includes(query);
        const authorsMatch = song.authors && stripNiqqud(song.authors.toLowerCase()).includes(query);

        // Search in lyrics content (strip chords and niqqud)
        const strippedContent = stripNiqqud(stripChords(song.content || '').toLowerCase());
        const contentMatch = strippedContent.includes(query);

        textMatch = titleMatch || authorsMatch || contentMatch;
      }

      // Filter by tags if any #tagname patterns were found
      let tagMatch = true;
      if (searchTagNames.length > 0) {
        tagMatch = song.tags && searchTagNames.every(searchTag =>
          song.tags.some(tag => stripNiqqud(tag.name.toLowerCase()).includes(searchTag))
        );
      }

      return textMatch && tagMatch;
    }).map(song => {
      // Assign priority based on what matched (lower number = higher priority)
      const query = stripNiqqud(textQuery.toLowerCase());

      // If no text query, all songs have same priority
      if (!query) {
        return { ...song, searchPriority: 1 };
      }

      const titleMatch = stripNiqqud(song.title.toLowerCase()).includes(query);
      const strippedContent = stripNiqqud(stripChords(song.content || '').toLowerCase());
      const contentMatch = strippedContent.includes(query);
      const authorsMatch = song.authors && stripNiqqud(song.authors.toLowerCase()).includes(query);

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
  }, [songs, textQuery, searchTagNames]);

  const handleSongClick = (song) => {
    // Close any open modal first
    setShowKeySelectorModal(false);

    // Toggle: if clicking the same song, close it; otherwise open the new song
    if (selectedSong?.id === song.id) {
      setSelectedSong(null);
    } else {
      // Update immediately for instant feedback
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

      // Include tag_ids if provided
      if (formData.tag_ids) {
        songData.tag_ids = formData.tag_ids;
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
      throw new Error(getFriendlyErrorMessage(err));
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
      setToastMessage(getFriendlyErrorMessage(err));
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
      setToastMessage(getFriendlyErrorMessage(err));
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

  const handleAddToService = () => {
    setAddToServiceSong(selectedSong);
    setIsAddToServiceModalOpen(true);
  };

  const handleCloseAddToServiceModal = () => {
    setIsAddToServiceModalOpen(false);
    setAddToServiceSong(null);
  };

  const handleAddToServiceSuccess = (message) => {
    setToastMessage(message);
    setShowToast(true);
  };

  const handleDownloadPDF = async (e) => {
    e.stopPropagation(); // Prevent triggering song click

    if (!selectedSong) {
      setToastMessage('No song selected');
      setShowToast(true);
      return;
    }

    try {
      setIsGeneratingPDF(true);
      setToastMessage('Generating PDF...');
      setShowToast(true);

      // Generate PDF with current transposition and font size
      await generateSongPDF(selectedSong, transposition, fontSize);

      setToastMessage('PDF downloaded successfully!');
      setShowToast(true);
    } catch (err) {
      console.error('Error generating PDF:', err);
      setToastMessage(getFriendlyErrorMessage(err));
      setShowToast(true);
    } finally {
      setIsGeneratingPDF(false);
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
          aria-label="Search songs by title, author, or key"
          role="searchbox"
        />
        <button
          className="btn-add"
          onClick={handleAddSong}
          aria-label="Add new song to library"
        >
          {t('library.add')}
        </button>
      </div>

      {loading && (
        <div className="loading-state" role="status" aria-live="polite" aria-label="Loading songs">
          <LoadingSkeleton type="song" count={5} />
        </div>
      )}

      {error && (
        <div className="error-state" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      {!loading && !error && (
      <div className="songs-list" role="list" aria-label="Songs library">
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', position: 'relative', width: '100%' }}>
                <h2 className="song-title-inline">{selectedSong.title}</h2>
                <button
                  className="btn-pdf-library"
                  onClick={handleDownloadPDF}
                  disabled={isGeneratingPDF}
                  title={isGeneratingPDF ? "Generating PDF..." : "Download PDF"}
                >
                  {isGeneratingPDF ? 'Generating...' : 'PDF'}
                </button>
                {/* 3-dot menu button - positioned at top right corner */}
                <div className="song-menu-container" ref={menuRef}>
                  <button
                    className="btn-song-menu"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSongMenu(!showSongMenu);
                    }}
                    aria-label="Song actions menu"
                    title="More actions"
                  >
                    ⋯
                  </button>
                  {showSongMenu && (
                    <div className="song-menu-dropdown">
                      {user && (
                        <button
                          className="menu-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowSongMenu(false);
                            handleAddToService();
                          }}
                        >
                          {t('library.addToService')}
                        </button>
                      )}
                      {(user?.role === 'admin' || selectedSong.created_by === user?.id) && (
                        <button
                          className="menu-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowSongMenu(false);
                            handleEditSong();
                          }}
                        >
                          {t('library.edit')}
                        </button>
                      )}
                      {!selectedSong.is_public && (user?.role === 'admin' || selectedSong.created_by === user?.id) && (
                        <button
                          className="menu-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowSongMenu(false);
                            handleShareSong();
                          }}
                        >
                          {t('library.shareSong')}
                        </button>
                      )}
                      {user?.role === 'admin' && !selectedSong.is_public && (
                        <button
                          className="menu-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowSongMenu(false);
                            handleMakePublic();
                          }}
                        >
                          {t('library.makePublic')}
                        </button>
                      )}
                      {(user?.role === 'admin' || selectedSong.created_by === user?.id) && (
                        <button
                          className="menu-item menu-item-danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowSongMenu(false);
                            handleDeleteSong();
                          }}
                        >
                          {t('library.delete')}
                        </button>
                      )}
                      <button
                        className="menu-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowSongMenu(false);
                          setSelectedSong(null);
                        }}
                      >
                        {t('common.close')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <p className="song-authors-inline">{selectedSong.authors}</p>
            </div>
            <div className="song-meta-inline">
              <div className="transpose-controls-inline">
                <button className="btn-transpose-inline" onClick={transposeDown}>-</button>
                <span
                  className="transpose-display-inline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowKeySelectorModal(true);
                  }}
                  title="Click to select key"
                >
                  {convertKeyToFlat(transposeChord(selectedSong.key, transposition))}
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
              <span className="key-info-inline">Key: {convertKeyToFlat(selectedSong.key)}</span>
              {selectedSong.bpm && <span className="bpm-info-inline">BPM: {selectedSong.bpm}{selectedSong.time_signature && ` (${selectedSong.time_signature})`}</span>}
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
              songKey={selectedSong.key}
              disableColumnCalculation={true}
            />
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

      {/* Add to Service Modal */}
      <AddToServiceModal
        song={addToServiceSong}
        isOpen={isAddToServiceModalOpen}
        onClose={handleCloseAddToServiceModal}
        onSuccess={handleAddToServiceSuccess}
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
