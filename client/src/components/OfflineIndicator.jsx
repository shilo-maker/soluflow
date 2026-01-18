import React, { useState, useEffect } from 'react';
import './OfflineIndicator.css';

const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showIndicator, setShowIndicator] = useState(!navigator.onLine);
  const [isCompact, setIsCompact] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowIndicator(true);
      setIsCompact(false);

      // Hide the "back online" message after 3 seconds
      setTimeout(() => {
        setShowIndicator(false);
      }, 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowIndicator(true);
      setIsCompact(false);

      // Collapse to compact mode after 3 seconds when offline
      setTimeout(() => {
        setIsCompact(true);
      }, 3000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // If starting offline, set compact mode after delay
    if (!navigator.onLine) {
      setTimeout(() => {
        setIsCompact(true);
      }, 3000);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showIndicator) {
    return null;
  }

  const handleClick = () => {
    if (isCompact) {
      setIsCompact(false);
      // Re-collapse after 3 seconds
      setTimeout(() => {
        if (!isOnline) {
          setIsCompact(true);
        }
      }, 3000);
    }
  };

  const showExpanded = !isCompact || isHovered;

  return (
    <div
      className={`offline-indicator ${isOnline ? 'online' : 'offline'} ${isCompact && !isHovered ? 'compact' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      <div className="offline-indicator-content">
        {isOnline ? (
          <>
            <span className="offline-indicator-icon">✓</span>
            <span className="offline-indicator-text">Back online</span>
          </>
        ) : (
          <>
            <span className="offline-indicator-icon">!</span>
            {showExpanded && <span className="offline-indicator-text">Offline</span>}
          </>
        )}
      </div>
    </div>
  );
};

export default OfflineIndicator;
