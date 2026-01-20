import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook to prevent screen from sleeping using the Wake Lock API
 * Useful for music/chord sheet apps where users need the screen to stay on
 */
const useWakeLock = (enabled = true) => {
  const wakeLockRef = useRef(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);

  // Check if Wake Lock API is supported
  useEffect(() => {
    setIsSupported('wakeLock' in navigator);
  }, []);

  // Release wake lock (stable reference using ref)
  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setIsActive(false);
      } catch (err) {
        // Ignore errors during release
      }
    }
  }, []);

  // Request wake lock (stable reference using ref)
  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator) || !enabled) return;

    // Don't request if we already have an active lock
    if (wakeLockRef.current) return;

    try {
      const lock = await navigator.wakeLock.request('screen');
      wakeLockRef.current = lock;
      setIsActive(true);

      // Listen for release (e.g., when tab becomes hidden)
      lock.addEventListener('release', () => {
        setIsActive(false);
        wakeLockRef.current = null;
      });
    } catch (err) {
      // Wake lock request failed - usually means low battery or permission denied
      setIsActive(false);
    }
  }, [enabled]);

  // Auto-request wake lock when enabled and re-acquire on visibility change
  useEffect(() => {
    if (!isSupported || !enabled) {
      // Release if disabled
      releaseWakeLock();
      return;
    }

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
