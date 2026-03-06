import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import BibleRefPicker from './BibleRefPicker';
import './PrayerItemModal.css';

const EMPTY_POINT = {
  subtitle: '',
  subtitle_translation: '',
  description: '',
  description_translation: '',
  bible_ref: ''
};

const PrayerItemModal = ({ isOpen, onClose, onSave, existingItem }) => {
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [titleTranslation, setTitleTranslation] = useState('');
  const [sameVerseForAll, setSameVerseForAll] = useState(false);
  const [sharedBibleRef, setSharedBibleRef] = useState('');
  const [prayerPoints, setPrayerPoints] = useState([{ ...EMPTY_POINT }]);
  const [error, setError] = useState('');

  const resetForm = (data = {}) => {
    setTitle(data.title || '');
    setTitleTranslation(data.title_translation || '');
    setSameVerseForAll(data.same_verse_for_all || false);
    setSharedBibleRef(data.shared_bible_ref || '');
    setPrayerPoints(
      data.prayer_points && data.prayer_points.length > 0
        ? data.prayer_points.map(p => ({ ...p }))
        : [{ ...EMPTY_POINT }]
    );
    setError('');
  };

  useEffect(() => {
    if (!isOpen) return;

    if (existingItem) {
      // Parse existing prayer data from segment_content
      let data = {};
      try {
        data = typeof existingItem.segment_content === 'string'
          ? JSON.parse(existingItem.segment_content)
          : (existingItem.segment_content || {});
      } catch {
        data = {};
      }

      resetForm({
        ...data,
        title: data.title || existingItem.segment_title || existingItem.title || ''
      });
    } else {
      resetForm();
    }
  }, [isOpen, existingItem]);

  const handleAddPoint = () => {
    setPrayerPoints(prev => [...prev, { ...EMPTY_POINT }]);
  };

  const handleRemovePoint = (index) => {
    if (prayerPoints.length <= 1) return;
    setPrayerPoints(prev => prev.filter((_, i) => i !== index));
  };

  const handlePointChange = (index, field, value) => {
    setPrayerPoints(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const handleSave = () => {
    if (!title.trim()) {
      setError(t('prayer.titleRequired'));
      return;
    }

    const prayerData = {
      title: title.trim(),
      title_translation: titleTranslation.trim(),
      same_verse_for_all: sameVerseForAll,
      shared_bible_ref: sameVerseForAll ? sharedBibleRef : '',
      prayer_points: prayerPoints.map(p => ({
        subtitle: p.subtitle.trim(),
        subtitle_translation: p.subtitle_translation.trim(),
        description: p.description.trim(),
        description_translation: p.description_translation.trim(),
        bible_ref: sameVerseForAll ? '' : p.bible_ref
      }))
    };

    // Build a unique id for the prayer item in the setlist
    const itemId = existingItem?.id || existingItem?.prayer_temp_id || `prayer_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    onSave({
      id: itemId,
      prayer_temp_id: itemId,
      segment_type: 'prayer',
      song_id: null,
      segment_title: title.trim(),
      segment_content: JSON.stringify(prayerData),
      title: title.trim()
    });
    onClose();
  };

  const handleConfirmClose = () => {
    // Only prompt if user has entered new data (not just loaded existing data)
    if (!existingItem && (title.trim() || prayerPoints.some(p => p.subtitle.trim() || p.description.trim()))) {
      if (!window.confirm(t('serviceEdit.confirmClose'))) return;
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="prayer-modal-overlay" onClick={handleConfirmClose}>
      <div className="prayer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="prayer-modal-header">
          <h2>{existingItem ? t('prayer.editPrayer') : t('prayer.addPrayer')}</h2>
          <button className="prayer-modal-close" onClick={handleConfirmClose}>&times;</button>
        </div>

        <div className="prayer-modal-body">
          {error && <div className="prayer-form-error">{error}</div>}

          {/* Title row */}
          <div className="prayer-form-row">
            <div className="prayer-form-group">
              <label>{t('prayer.prayerTitle')} *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); if (error) setError(''); }}
                placeholder={t('prayer.prayerTitle')}
              />
            </div>
            <div className="prayer-form-group">
              <label>{t('prayer.titleTranslation')}</label>
              <input
                type="text"
                value={titleTranslation}
                onChange={(e) => setTitleTranslation(e.target.value)}
                placeholder={t('prayer.titleTranslationPlaceholder')}
              />
            </div>
          </div>

          {/* Same verse checkbox */}
          <div className="prayer-checkbox-group">
            <input
              type="checkbox"
              id="sameVerseForAll"
              checked={sameVerseForAll}
              onChange={(e) => setSameVerseForAll(e.target.checked)}
            />
            <label htmlFor="sameVerseForAll">{t('prayer.sameVerseForAll')}</label>
          </div>

          {/* Shared bible ref */}
          {sameVerseForAll && (
            <div className="prayer-shared-ref">
              <label>{t('prayer.sharedBibleRef')}</label>
              <BibleRefPicker
                value={sharedBibleRef}
                onChange={(formatted) => setSharedBibleRef(formatted)}
              />
            </div>
          )}

          {/* Prayer points */}
          <div className="prayer-points-header">
            <h3>{t('prayer.prayerPoints')}</h3>
            <button type="button" className="btn-add-point" onClick={handleAddPoint}>
              + {t('prayer.addPoint')}
            </button>
          </div>

          {prayerPoints.map((point, index) => (
            <div key={index} className="prayer-point">
              <div className="prayer-point-header">
                <span className="prayer-point-number">#{index + 1}</span>
                {prayerPoints.length > 1 && (
                  <button
                    type="button"
                    className="btn-remove-point"
                    onClick={() => handleRemovePoint(index)}
                  >
                    &times;
                  </button>
                )}
              </div>

              {/* Subtitle row */}
              <div className="prayer-form-row">
                <div className="prayer-form-group">
                  <label>{t('prayer.pointTitle')}</label>
                  <input
                    type="text"
                    value={point.subtitle}
                    onChange={(e) => handlePointChange(index, 'subtitle', e.target.value)}
                    placeholder={t('prayer.pointTitle')}
                  />
                </div>
                <div className="prayer-form-group">
                  <label>{t('prayer.pointTitleTranslation')}</label>
                  <input
                    type="text"
                    value={point.subtitle_translation}
                    onChange={(e) => handlePointChange(index, 'subtitle_translation', e.target.value)}
                    placeholder={t('prayer.pointTitleTranslationPlaceholder')}
                  />
                </div>
              </div>

              {/* Description row */}
              <div className="prayer-form-row">
                <div className="prayer-form-group">
                  <label>{t('prayer.description')}</label>
                  <textarea
                    value={point.description}
                    onChange={(e) => handlePointChange(index, 'description', e.target.value)}
                    placeholder={t('prayer.description')}
                    rows={2}
                  />
                </div>
                <div className="prayer-form-group">
                  <label>{t('prayer.descriptionTranslation')}</label>
                  <textarea
                    value={point.description_translation}
                    onChange={(e) => handlePointChange(index, 'description_translation', e.target.value)}
                    placeholder={t('prayer.descriptionTranslationPlaceholder')}
                    rows={2}
                  />
                </div>
              </div>

              {/* Per-point bible ref (shown when NOT using shared verse) */}
              {!sameVerseForAll && (
                <div className="prayer-point-bible-ref">
                  <label>{t('prayer.bibleReference')}</label>
                  <BibleRefPicker
                    value={point.bible_ref}
                    onChange={(formatted) => handlePointChange(index, 'bible_ref', formatted)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="prayer-modal-footer">
          <button type="button" className="prayer-btn-cancel" onClick={handleConfirmClose}>
            {t('prayer.cancel')}
          </button>
          <button type="button" className="prayer-btn-save" onClick={handleSave}>
            {t('prayer.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrayerItemModal;
