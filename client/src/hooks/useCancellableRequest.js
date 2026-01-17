import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook that provides an AbortController for cancelling API requests on unmount.
 * Returns a function to get the current signal for API calls.
 *
 * Usage:
 * const getSignal = useCancellableRequest();
 *
 * useEffect(() => {
 *   const fetchData = async () => {
 *     try {
 *       const response = await api.get('/endpoint', { signal: getSignal() });
 *     } catch (error) {
 *       if (error.name === 'AbortError' || error.name === 'CanceledError') return;
 *       // Handle other errors
 *     }
 *   };
 *   fetchData();
 * }, [getSignal]);
 */
export const useCancellableRequest = () => {
  const abortControllerRef = useRef(null);

  // Create a new AbortController and return its signal
  const getSignal = useCallback(() => {
    // Abort any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    // Create new controller
    abortControllerRef.current = new AbortController();
    return abortControllerRef.current.signal;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return getSignal;
};

/**
 * Hook to check if a request was cancelled
 */
export const isCancelledError = (error) => {
  return error?.name === 'AbortError' ||
         error?.name === 'CanceledError' ||
         error?.code === 'ERR_CANCELED';
};

export default useCancellableRequest;
