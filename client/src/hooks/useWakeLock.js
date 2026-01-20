import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to prevent screen from sleeping using the Wake Lock API
 * Useful for music/chord sheet apps where users need the screen to stay on
 */
const useWakeLock = (enabled = true) => {
  const [wakeLock, setWakeLock] = useState(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);

  // Check if Wake Lock API is supported
  useEffect(() => {
    setIsSupported('wakeLock' in navigator);
  }, []);

  // Request wake lock
  const requestWakeLock = useCallback(async () => {
    if (!isSupported || !enabled) return;

    try {
      const lock = await navigator.wakeLock.request('screen');
      setWakeLock(lock);
      setIsActive(true);

      // Listen for release (e.g., when tab becomes hidden)
      lock.addEventListener('release', () => {
        setIsActive(false);
        setWakeLock(null);
      });

      console.log('[WakeLock] Screen wake lock acquired');
    } catch (err) {
      // Wake lock request failed - usually means low battery or permission denied
      console.log('[WakeLock] Could not acquire wake lock:', err.message);
      setIsActive(false);
    }
  }, [isSupported, enabled]);

  // Release wake lock
  const releaseWakeLock = useCallback(async () => {
    if (wakeLock) {
      try {
        await wakeLock.release();
        setWakeLock(null);
        setIsActive(false);
        console.log('[WakeLock] Screen wake lock released');
      } catch (err) {
        console.log('[WakeLock] Error releasing wake lock:', err.message);
      }
    }
  }, [wakeLock]);

  // Auto-request wake lock when enabled and re-acquire on visibility change
  useEffect(() => {
    if (!isSupported || !enabled) return;

    // Request wake lock initially
    requestWakeLock();

    // Re-acquire wake lock when page becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [isSupported, enabled, requestWakeLock, releaseWakeLock]);

  return {
    isSupported,
    isActive,
    requestWakeLock,
    releaseWakeLock
  };
};

export default useWakeLock;
