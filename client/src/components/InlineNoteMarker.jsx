import React, { useState } from 'react';
import './InlineNoteMarker.css';

const InlineNoteMarker = ({ note, isEditMode, onUpdate, onDelete, onClick }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(note?.text || '');
  const [showPopup, setShowPopup] = useState(false);

  const handleSave = () => {
    if (editText.trim()) {
      onUpdate(note.id, editText);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditText(note?.text || '');
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (window.confirm('Delete this note?')) {
      onDelete(note.id);
    }
  };

  const handleIconClick = (e) => {
    e.stopPropagation();
    setShowPopup(!showPopup);
    if (onClick) onClick();
  };

  if (isEditing) {
    return (
      <div className="inline-note-edit">
        <input
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
          autoFocus
          placeholder="Enter note..."
        />
        <div className="inline-note-actions">
          <button onClick={handleSave} className="btn-save-note">✓</button>
          <button onClick={handleCancel} className="btn-cancel-note">✗</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {showPopup && (
        <div
          className="note-popup-backdrop"
          onClick={(e) => { e.stopPropagation(); setShowPopup(false); }}
        />
      )}
      <div className="inline-note-marker" onClick={handleIconClick}>
        <span className="note-icon">📝</span>
        <div className={`note-popup ${showPopup ? 'show-mobile' : ''}`}>
          <div className="note-text">{note.text}</div>
          {isEditMode && (
            <div className="note-edit-actions">
              <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className="btn-edit-note">Edit</button>
              <button onClick={(e) => { e.stopPropagation(); handleDelete(); }} className="btn-delete-note">Delete</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default InlineNoteMarker;
