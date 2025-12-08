import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import './Toast.css';

const Toast = ({ message, type = 'success', isVisible, onClose }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000); // Auto-dismiss after 4 seconds

      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  // Inline styles to guarantee visibility
  const toastStyle = {
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 999999,
    minWidth: '300px',
    maxWidth: '500px',
    padding: '16px 20px',
    borderRadius: '8px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
    backgroundColor: type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#d1ecf1',
    border: `1px solid ${type === 'success' ? '#c3e6cb' : type === 'error' ? '#f5c6cb' : '#bee5eb'}`,
    color: type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#0c5460',
  };

  // Use React Portal to render toast directly to body
  // This ensures it's not affected by any parent CSS transforms or stacking contexts
  return ReactDOM.createPortal(
    <div style={toastStyle}>
      <div className="toast-content">
        <span className="toast-icon" style={{ color: type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8' }}>
          {type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}
        </span>
        <span className="toast-message">{message}</span>
        <button className="toast-close" onClick={onClose}>×</button>
      </div>
    </div>,
    document.body
  );
};

export default Toast;
