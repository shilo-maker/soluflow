import React, { useState, useEffect, useCallback } from 'react';
import noteService from '../services/noteService';
import './NotesModal.css';

const NotesModal = ({ songId, serviceId, songTitle, isOpen, onClose }) => {
  const [noteContent, setNoteContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  const fetchNote = useCallback(async () => {
    if (!songId || !serviceId) {
      console.error('Missing required IDs - songId:', songId, 'serviceId:', serviceId);
      setError(`Missing required information: ${!songId ? 'song ID' : ''} ${!serviceId ? 'service ID' : ''}`);
      return;
    }

    try {
      setLoading(true);
      setError('');
      console.log('Fetching note with songId:', songId, 'serviceId:', serviceId);
      const data = await noteService.getNote(songId, serviceId);
      console.log('Note data received:', data);
      setNoteContent(data.content || '');
    } catch (err) {
      console.error('Error fetching note:', err);
      setError(`Failed to load note: ${err.error || JSON.stringify(err)}`);
    } finally {
      setLoading(false);
    }
  }, [songId, serviceId]);

  useEffect(() => {
    console.log('NotesModal mounted/updated - isOpen:', isOpen, 'songId:', songId, 'serviceId:', serviceId);
    if (isOpen) {
      fetchNote();
    }
  }, [isOpen, fetchNote, songId, serviceId]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSaveMessage('');

      await noteService.saveNote(songId, serviceId, noteContent);

      setSaveMessage('Note saved successfully!');
      setTimeout(() => {
        setSaveMessage('');
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Error saving note:', err);
      setError('Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setNoteContent('');
    setError('');
    setSaveMessage('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content notes-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Notes for: {songTitle}</h2>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="notes-loading">Loading note...</div>
          ) : error ? (
            <div className="modal-error">{error}</div>
          ) : (
            <>
              {saveMessage && (
                <div className="notes-save-message">{saveMessage}</div>
              )}

              <textarea
                className="notes-textarea"
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Add your notes here... (e.g., tempo changes, cues, reminders)"
                rows={12}
                disabled={saving}
              />

              <p className="notes-hint">
                These notes are personal and specific to this song in this service.
              </p>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn-cancel-modal"
            onClick={handleClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-save-modal"
            onClick={handleSave}
            disabled={loading || saving}
          >
            {saving ? 'Saving...' : 'Save Note'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotesModal;
