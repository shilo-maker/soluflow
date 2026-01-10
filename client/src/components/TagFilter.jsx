import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../services/api';
import './TagFilter.css';

const TagFilter = ({ selectedTags, onChange }) => {
  const { t } = useLanguage();
  const [availableTags, setAvailableTags] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch available tags
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await api.get('/tags');
        setAvailableTags(response.data);
      } catch (err) {
        console.error('Error fetching tags:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTags();
  }, []);

  const handleTagClick = (tagId) => {
    if (selectedTags.includes(tagId)) {
      onChange(selectedTags.filter(id => id !== tagId));
    } else {
      onChange([...selectedTags, tagId]);
    }
  };

  const handleClearAll = () => {
    onChange([]);
  };

  if (loading || availableTags.length === 0) {
    return null;
  }

  return (
    <div className="tag-filter-container">
      <div className="tag-filter-scroll">
        {availableTags.map(tag => (
          <button
            key={tag.id}
            type="button"
            className={`tag-filter-chip ${selectedTags.includes(tag.id) ? 'selected' : ''}`}
            style={{
              '--tag-color': tag.color,
              backgroundColor: selectedTags.includes(tag.id) ? tag.color : 'transparent',
              borderColor: tag.color,
              color: selectedTags.includes(tag.id) ? 'white' : tag.color
            }}
            onClick={() => handleTagClick(tag.id)}
          >
            {tag.name}
          </button>
        ))}
      </div>
      {selectedTags.length > 0 && (
        <button
          type="button"
          className="tag-filter-clear"
          onClick={handleClearAll}
        >
          {t('tags.clearFilter')}
        </button>
      )}
    </div>
  );
};

export default TagFilter;
