import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../services/api';
import './TagInput.css';

const TagInput = ({ songId, songTags = [], isPublicSong, songOwnerId, onChange }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState(songTags);
  const [showDropdown, setShowDropdown] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6c5ce7');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const dropdownRef = useRef(null);

  const isAdmin = user?.role === 'admin';
  const isOwner = user?.id === songOwnerId;

  // Check if user can edit tags on this song
  const canEditTags = isPublicSong ? isAdmin : (isOwner || isAdmin);

  // Fetch available tags
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await api.get('/tags');
        setAvailableTags(response.data);
      } catch (err) {
        console.error('Error fetching tags:', err);
      }
    };
    fetchTags();
  }, []);

  // Update selected tags when songTags prop changes
  useEffect(() => {
    setSelectedTags(songTags);
  }, [songTags]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
        setShowCreateForm(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddTag = async (tag) => {
    if (selectedTags.find(t => t.id === tag.id)) {
      return; // Already selected
    }

    const updatedTags = [...selectedTags, tag];
    setSelectedTags(updatedTags);
    setShowDropdown(false);

    if (onChange) {
      onChange(updatedTags);
    }
  };

  const handleRemoveTag = (tagId) => {
    const updatedTags = selectedTags.filter(t => t.id !== tagId);
    setSelectedTags(updatedTags);

    if (onChange) {
      onChange(updatedTags);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/tags', {
        name: newTagName.trim(),
        color: newTagColor
      });

      const newTag = response.data;
      setAvailableTags([...availableTags, newTag]);
      handleAddTag(newTag);
      setNewTagName('');
      setNewTagColor('#6c5ce7');
      setShowCreateForm(false);
    } catch (err) {
      setError(err.error || t('tags.createError'));
    } finally {
      setLoading(false);
    }
  };

  // Filter out already selected tags from dropdown
  const unselectedTags = availableTags.filter(
    tag => !selectedTags.find(t => t.id === tag.id)
  );

  if (!canEditTags && selectedTags.length === 0) {
    return null; // Don't show anything if user can't edit and there are no tags
  }

  return (
    <div className="tag-input-container" ref={dropdownRef}>
      <label className="tag-input-label">{t('tags.label')}</label>

      <div className="tag-input-wrapper">
        {/* Selected tags */}
        <div className="selected-tags">
          {selectedTags.map(tag => (
            <span
              key={tag.id}
              className="tag-chip"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
              {canEditTags && (
                <button
                  type="button"
                  className="tag-remove-btn"
                  onClick={() => handleRemoveTag(tag.id)}
                  aria-label={t('tags.remove')}
                >
                  ×
                </button>
              )}
            </span>
          ))}

          {/* Add tag button */}
          {canEditTags && (
            <button
              type="button"
              className="add-tag-btn"
              onClick={() => setShowDropdown(!showDropdown)}
            >
              + {t('tags.add')}
            </button>
          )}
        </div>

        {/* Dropdown */}
        {showDropdown && (
          <div className="tag-dropdown">
            {error && <div className="tag-error">{error}</div>}

            {unselectedTags.length > 0 && (
              <div className="tag-dropdown-list">
                {unselectedTags.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    className="tag-dropdown-item"
                    onClick={() => handleAddTag(tag)}
                  >
                    <span
                      className="tag-color-dot"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                    {tag.is_public && <span className="tag-public-badge">{t('tags.public')}</span>}
                  </button>
                ))}
              </div>
            )}

            {/* Create new tag */}
            {!showCreateForm ? (
              <button
                type="button"
                className="create-tag-btn"
                onClick={() => setShowCreateForm(true)}
              >
                + {t('tags.createNew')}
              </button>
            ) : (
              <div className="create-tag-form">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCreateTag();
                    }
                  }}
                  placeholder={t('tags.namePlaceholder')}
                  maxLength={50}
                  autoFocus
                />
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="color-picker"
                />
                <div className="create-tag-actions">
                  <button
                    type="button"
                    className="btn-cancel-small"
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewTagName('');
                    }}
                  >
                    {t('tags.cancel')}
                  </button>
                  <button
                    type="button"
                    className="btn-create-small"
                    disabled={loading || !newTagName.trim()}
                    onClick={handleCreateTag}
                  >
                    {loading ? '...' : t('tags.create')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TagInput;
