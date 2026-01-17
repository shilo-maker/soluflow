import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import './ReportModal.css';

const REPORT_TYPES = [
  { value: 'lyrics_error', labelEn: 'Lyrics Error', labelHe: 'שגיאה במילים' },
  { value: 'chord_error', labelEn: 'Chord Error', labelHe: 'שגיאה באקורדים' },
  { value: 'wrong_key', labelEn: 'Wrong Key', labelHe: 'טונליות שגויה' },
  { value: 'missing_info', labelEn: 'Missing Information', labelHe: 'מידע חסר' },
  { value: 'other', labelEn: 'Other', labelHe: 'אחר' }
];

const ReportModal = ({ isOpen, onClose, songId, songTitle }) => {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);

  const [formData, setFormData] = useState({
    report_type: 'lyrics_error',
    description: '',
    reporter_email: '',
    reporter_name: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Handle Escape key and focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Focus trap
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Focus close button when modal opens
    setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/reports/songs/${songId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.errors?.[0]?.msg || 'Failed to submit report');
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setFormData({
          report_type: 'lyrics_error',
          description: '',
          reporter_email: '',
          reporter_name: ''
        });
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="report-modal-overlay" onClick={onClose} role="presentation">
      <div
        ref={modalRef}
        className="report-modal"
        onClick={(e) => e.stopPropagation()}
        dir={isHebrew ? 'rtl' : 'ltr'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
      >
        <div className="report-modal-header">
          <h2 id="report-modal-title">{isHebrew ? 'דיווח על בעיה' : 'Report an Issue'}</h2>
          <button
            ref={closeButtonRef}
            className="report-modal-close"
            onClick={onClose}
            aria-label={isHebrew ? 'סגור' : 'Close report modal'}
          >
            &times;
          </button>
        </div>

        {success ? (
          <div className="report-success">
            <div className="success-icon">✓</div>
            <p>{isHebrew ? 'הדיווח נשלח בהצלחה! תודה על המשוב.' : 'Report submitted successfully! Thank you for your feedback.'}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="report-form">
            <div className="report-song-info">
              <span className="report-song-label">{isHebrew ? 'שיר:' : 'Song:'}</span>
              <span className="report-song-title">{songTitle}</span>
            </div>

            <div className="form-group">
              <label htmlFor="report_type">
                {isHebrew ? 'סוג הבעיה' : 'Issue Type'}
              </label>
              <select
                id="report_type"
                name="report_type"
                value={formData.report_type}
                onChange={handleChange}
                required
              >
                {REPORT_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {isHebrew ? type.labelHe : type.labelEn}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="description">
                {isHebrew ? 'תיאור הבעיה' : 'Description'}
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder={isHebrew
                  ? 'אנא תאר את הבעיה בפירוט (לפחות 10 תווים)...'
                  : 'Please describe the issue in detail (at least 10 characters)...'}
                required
                minLength={10}
                maxLength={2000}
                rows={4}
              />
            </div>

            <div className="form-group">
              <label htmlFor="reporter_email">
                {isHebrew ? 'אימייל' : 'Email'} *
              </label>
              <input
                type="email"
                id="reporter_email"
                name="reporter_email"
                value={formData.reporter_email}
                onChange={handleChange}
                placeholder={isHebrew ? 'האימייל שלך' : 'Your email'}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="reporter_name">
                {isHebrew ? 'שם (אופציונלי)' : 'Name (optional)'}
              </label>
              <input
                type="text"
                id="reporter_name"
                name="reporter_name"
                value={formData.reporter_name}
                onChange={handleChange}
                placeholder={isHebrew ? 'השם שלך' : 'Your name'}
                maxLength={100}
              />
            </div>

            {error && (
              <div className="report-error">
                {error}
              </div>
            )}

            <div className="report-modal-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={onClose}
                disabled={isSubmitting}
              >
                {isHebrew ? 'ביטול' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="btn-submit"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? (isHebrew ? 'שולח...' : 'Submitting...')
                  : (isHebrew ? 'שלח דיווח' : 'Submit Report')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ReportModal;
