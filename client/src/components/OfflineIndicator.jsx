import React, { useState, useEffect } from 'react';
import './OfflineIndicator.css';

const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showIndicator, setShowIndicator] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowIndicator(true);

      // Hide the "back online" message after 3 seconds
      setTimeout(() => {
        setShowIndicator(false);
      }, 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowIndicator(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showIndicator) {
    return null;
  }

  return (
    <div className={`offline-indicator ${isOnline ? 'online' : 'offline'}`}>
      <div className="offline-indicator-content">
        {isOnline ? (
          <>
            <span className="offline-indicator-icon">✓</span>
            <span className="offline-indicator-text">Back online</span>
          </>
        ) : (
          <>
            <span className="offline-indicator-icon">⚠</span>
            <span className="offline-indicator-text">Offline mode</span>
          </>
        )}
      </div>
    </div>
  );
};

export default OfflineIndicator;
