import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { GRADIENT_PRESETS } from '../contexts/ThemeContext';
import songService from '../services/songService';
import ChordProDisplay from '../components/ChordProDisplay';
import KeySelectorModal from '../components/KeySelectorModal';
import { transposeChord, stripChords, convertKeyToFlat } from '../utils/transpose';
import { generateSongPDF } from '../utils/pdfGenerator';
import './GuestLanding.css';

// Strip Hebrew niqqud (vowel points) from text for search matching
const stripNiqqud = (text) => {
  if (!text) return '';
  // First, normalize to NFD to decompose precomposed Hebrew characters (e.g., U+FB2A שׁ -> ש + combining mark)
  // Then remove Hebrew combining marks (U+0591 to U+05C7)
  return text
    .normalize('NFD')
    .replace(/[\u0591-\u05C7]/g, '')
    .normalize('NFC');
};

// Parse search query for #tagname patterns
// Supports: #מהיר (single word) or #"שירי ילדים" (multi-word with quotes)
const parseSearchQuery = (query) => {
  const tagNames = [];
  let processedQuery = query;

  // First, match quoted tags with various quote styles:
  // English: " ' | Hebrew: ״ ׳ | Smart quotes: " " ' '
  const quotedTagPattern = /#["'״׳""''"]([^"'״׳""''"]+)["'״׳""'']/g;
  let match;
  while ((match = quotedTagPattern.exec(query)) !== null) {
    tagNames.push(stripNiqqud(match[1].toLowerCase().trim()));
  }
  processedQuery = processedQuery.replace(quotedTagPattern, '');

  // Then match unquoted single-word tags: #tagname
  const simpleTagPattern = /#([\u0590-\u05FF\w-]+)/g;
  while ((match = simpleTagPattern.exec(processedQuery)) !== null) {
    tagNames.push(stripNiqqud(match[1].toLowerCase()));
  }

  // Remove all tag patterns from query to get text search part
  const textQuery = processedQuery.replace(simpleTagPattern, '').trim();
  return { tagNames, textQuery };
};

// Helper function to convert hex color to CSS filter
const getColorFilter = (hexColor) => {
  // Remove the # if present
  const hex = hexColor.replace('#', '');

  // Convert hex to RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Calculate hue rotation
  const hue = getHueRotate(r, g, b);

  // Better filter for colorizing: invert to white, then apply color
  return `brightness(0) invert(1) sepia(1) saturate(5) hue-rotate(${hue}deg)`;
};

// Calculate hue rotation based on RGB values
const getHueRotate = (r, g, b) => {
  // Normalize RGB values
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let hue = 0;

  if (delta !== 0) {
    if (max === rNorm) {
      hue = 60 * (((gNorm - bNorm) / delta) % 6);
    } else if (max === gNorm) {
      hue = 60 * (((bNorm - rNorm) / delta) + 2);
    } else {
      hue = 60 * (((rNorm - gNorm) / delta) + 4);
    }
  }

  return Math.round(hue);
};

// Memoized song card component to prevent unnecessary re-renders
const SongCard = React.memo(({ song, isSelected, onClick }) => {
  return (
    <div
      className={`song-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="song-card-content">
        <div className="song-card-left">
          <h3 className="song-card-title">{song.title}</h3>
          <p className="song-card-authors">{song.authors}</p>
        </div>
        <div className="song-card-right">
          <span className="song-key">Key: {convertKeyToFlat(song.key)}</span>
        </div>
      </div>
    </div>
  );
});

SongCard.displayName = 'SongCard';

const GuestLanding = () => {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const { theme } = useTheme();
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSong, setSelectedSong] = useState(null);
  const [fontSize, setFontSize] = useState(14);
  const [transposition, setTransposition] = useState(0);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [serviceCode, setServiceCode] = useState(['', '', '', '']);
  const [showKeySelectorModal, setShowKeySelectorModal] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const codeInputsRef = useRef([]);
  const songDisplayRef = useRef(null);

  // Get current theme accent color
  const currentPreset = GRADIENT_PRESETS[theme?.gradientPreset] || GRADIENT_PRESETS.professional;

  // Reset modal state when selected song changes
  useEffect(() => {
    setShowKeySelectorModal(false);
  }, [selectedSong?.id]);

  // Fetch all songs on component mount (guest-accessible, no workspace restriction)
  useEffect(() => {
    let isMounted = true;

    const fetchSongs = async () => {
      try {
        setLoading(true);
        const data = await songService.getAllSongs(); // No workspaceId = fetch all songs

        if (isMounted) {
          setSongs(data);
          setError(null);
        }
      } catch (err) {
        // Ignore abort errors
        if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return;

        if (isMounted) {
          console.error('Error fetching songs:', err);
          setError('Failed to load songs. Please try again.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchSongs();

    return () => {
      isMounted = false;
    };
  }, []);

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

  // Parse search query for tags and text
  const { tagNames: searchTagNames, textQuery } = parseSearchQuery(searchQuery);

  const filteredSongs = songs.filter(song => {
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

    // If only searching by tags (no text query), all matches have equal priority
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

  const displayedSongs = filteredSongs;

  const handleSongClick = (song) => {
    // Close any open modal first
    setShowKeySelectorModal(false);

    // Toggle: if clicking the same song, close it; otherwise open the new song
    if (selectedSong?.id === song.id) {
      setSelectedSong(null);
    } else {
      setSelectedSong(song);
      setFontSize(14);
      setTransposition(0);
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

  const handleOpenFullView = () => {
    navigate(`/song/${selectedSong.id}`);
  };

  const handleExportPdf = async () => {
    if (!selectedSong || generatingPdf) return;

    try {
      setGeneratingPdf(true);
      await generateSongPDF(selectedSong, transposition, fontSize);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert(t('common.error') + ': ' + error.message);
    } finally {
      setGeneratingPdf(false);
    }
  };

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

  const handleJoinService = () => {
    const fullCode = serviceCode.join('');
    if (fullCode.length === 4) {
      navigate(`/service/code/${fullCode}`);
    }
  };

  // Detect if song content has Hebrew characters
  const hasHebrew = (text) => /[\u0590-\u05FF]/.test(text);

  return (
    <div className="guest-landing-page">
      {/* Sticky Header Bar */}
      <div className="guest-sticky-header">
        {/* App Name Group */}
        <div className="header-name-group">
          <img
            src="/neutral_logo.png"
            alt="SoluFlow"
            className="guest-logo"
            style={{ filter: getColorFilter(currentPreset.accentColor) }}
          />
          <h1 className="app-name" style={{ color: currentPreset.accentColor }}>SoluFlow</h1>
        </div>

        {/* Search Row */}
        <div className="header-search-row">
          <input
            type="text"
            className="search-input-library"
            placeholder={t('library.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedSong(null);
            }}
          />
        </div>

        {/* Actions */}
        <div className="header-actions">
          <div className="language-switcher-compact">
            <button
              className={`lang-option ${language === 'en' ? 'active' : ''}`}
              onClick={() => setLanguage('en')}
            >
              EN
            </button>
            <span className="lang-divider">|</span>
            <button
              className={`lang-option ${language === 'he' ? 'active' : ''}`}
              onClick={() => setLanguage('he')}
            >
              עב
            </button>
          </div>
          <button className="btn-join-service" onClick={() => setShowJoinModal(true)}>
            {t('guestLanding.accessService')}
          </button>
          <button className="btn-auth-link" onClick={() => navigate('/login')}>
            {t('common.login')}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="guest-content">
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
              <SongCard
                song={song}
                isSelected={selectedSong?.id === song.id}
                onClick={() => handleSongClick(song)}
              />

              {/* Display selected song chord sheet inline */}
              {selectedSong?.id === song.id && (
                <div className="song-display-inline" ref={songDisplayRef} onClick={(e) => e.stopPropagation()}>
          <div className="song-header-inline">
            <div className="song-info-inline">
              <h2 className="song-title-inline">
                {selectedSong.title}
                <button
                  className="btn-pdf-inline"
                  onClick={(e) => { e.stopPropagation(); handleExportPdf(); }}
                  disabled={generatingPdf}
                >
                  {generatingPdf ? '...' : 'PDF'}
                </button>
              </h2>
              <p className="song-authors-inline">{selectedSong.authors}</p>
            </div>
            <div className="song-meta-inline">
              <div className="transpose-controls-inline">
                <button className="btn-transpose-inline" onClick={(e) => { e.stopPropagation(); transposeDown(); }}>-</button>
                <span
                  className="transpose-display-inline"
                  onClick={(e) => { e.stopPropagation(); setShowKeySelectorModal(true); }}
                  title="Click to select key"
                >
                  {convertKeyToFlat(transposeChord(selectedSong.key, transposition))}
                  {transposition !== 0 && ` (${transposition > 0 ? '+' : ''}${transposition})`}
                </span>
                <button className="btn-transpose-inline" onClick={(e) => { e.stopPropagation(); transposeUp(); }}>+</button>
              </div>
              <div className="zoom-controls">
                <button className="btn-zoom btn-zoom-out" onClick={(e) => { e.stopPropagation(); zoomOut(); }}>
                  <span className="zoom-icon-small">A</span>
                </button>
                <button className="btn-zoom btn-zoom-in" onClick={(e) => { e.stopPropagation(); zoomIn(); }}>
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
            onClick={(e) => { e.stopPropagation(); handleOpenFullView(); }}
            title="Click to open in full view"
          >
            <ChordProDisplay
              content={selectedSong.content}
              dir={hasHebrew(selectedSong.content) ? 'rtl' : 'ltr'}
              fontSize={fontSize}
              transposition={transposition}
              songKey={selectedSong.key}
            />
          </div>

          <div className="song-actions-inline">
            <button
              className="btn-close-song"
              onClick={() => setSelectedSong(null)}
            >
              {t('common.close')}
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
      </div>

      {/* Join Service Modal */}
      {showJoinModal && (
        <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">{t('guestLanding.accessService')}</h2>
            <p className="modal-description">{t('guestLanding.enterCode')}</p>
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
                  autoFocus={index === 0}
                  dir="ltr"
                />
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn-modal-cancel" onClick={() => setShowJoinModal(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn-modal-join" onClick={handleJoinService}>
                {t('guestLanding.accessButton')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Key Selector Modal */}
      {selectedSong && (
        <KeySelectorModal
          isOpen={showKeySelectorModal}
          onClose={() => setShowKeySelectorModal(false)}
          currentKey={selectedSong.key}
          currentTransposition={transposition}
          onSelectKey={setTransposition}
        />
      )}
    </div>
  );
};

export default GuestLanding;
