import React, { useState, useEffect } from 'react';
import offlineQueue from '../utils/offlineQueue';
import './OfflineIndicator.css';

const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showIndicator, setShowIndicator] = useState(!navigator.onLine);
  const [isCompact, setIsCompact] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowIndicator(true);
      setIsCompact(false);

      // Hide the "back online" message after 3 seconds (if no pending ops)
      setTimeout(() => {
        setPendingCount(prev => {
          if (prev === 0) setShowIndicator(false);
          return prev;
        });
      }, 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowIndicator(true);
      setIsCompact(false);

      setTimeout(() => {
        setIsCompact(true);
      }, 3000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (!navigator.onLine) {
      setTimeout(() => setIsCompact(true), 3000);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Subscribe to queue changes
  useEffect(() => {
    // Get initial count
    offlineQueue.getPendingCount().then(count => {
      setPendingCount(count);
      if (count > 0) setShowIndicator(true);
    });

    const unsubscribe = offlineQueue.subscribe(({ count, syncing: isSyncing }) => {
      setPendingCount(count);
      setSyncing(isSyncing);
      if (count > 0 || isSyncing) {
        setShowIndicator(true);
      } else if (count === 0 && !isSyncing && navigator.onLine) {
        // All synced, hide after brief delay
        setTimeout(() => setShowIndicator(false), 2000);
      }
    });

    return unsubscribe;
  }, []);

  if (!showIndicator) {
    return null;
  }

  const handleClick = () => {
    if (isCompact) {
      setIsCompact(false);
      setTimeout(() => {
        if (!navigator.onLine) {
          setIsCompact(true);
        }
      }, 3000);
    }
  };

  const showExpanded = !isCompact || isHovered;

  const getStatusText = () => {
    if (syncing) return 'Syncing...';
    if (!isOnline && pendingCount > 0) return `Offline · ${pendingCount} pending`;
    if (!isOnline) return 'Offline';
    if (pendingCount > 0) return `Syncing ${pendingCount}...`;
    return 'Back online';
  };

  const getStatusClass = () => {
    if (syncing) return 'syncing';
    if (!isOnline) return 'offline';
    if (pendingCount > 0) return 'syncing';
    return 'online';
  };

  return (
    <div
      className={`offline-indicator ${getStatusClass()} ${isCompact && !isHovered ? 'compact' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      <div className="offline-indicator-content">
        {isOnline && pendingCount === 0 && !syncing ? (
          <>
            <span className="offline-indicator-icon">✓</span>
            <span className="offline-indicator-text">Back online</span>
          </>
        ) : (
          <>
            <span className="offline-indicator-icon">
              {syncing ? '↻' : '!'}
            </span>
            {showExpanded && (
              <span className="offline-indicator-text">{getStatusText()}</span>
            )}
            {showExpanded && pendingCount > 0 && !syncing && (
              <span className="offline-indicator-badge">{pendingCount}</span>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default OfflineIndicator;
