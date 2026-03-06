// Offline Queue - stores pending API mutations in IndexedDB and syncs when online
// Operations are processed in FIFO order when connectivity returns
// Shares IndexedDB connection with offlineStorage to avoid upgrade race conditions

import offlineStorage from './offlineStorage';

const PENDING_STORE = 'pending_ops';

class OfflineQueue {
  constructor() {
    this.syncing = false;
    this.listeners = new Set();

    // Auto-sync when coming back online
    window.addEventListener('online', () => this.processQueue());
  }

  async ensureDb() {
    // Reuse the shared DB connection from offlineStorage
    return offlineStorage.ensureDb();
  }

  // Add a pending operation to the queue
  async enqueue(operation) {
    const db = await this.ensureDb();
    const tx = db.transaction([PENDING_STORE], 'readwrite');
    const store = tx.objectStore(PENDING_STORE);

    const op = {
      ...operation,
      timestamp: Date.now(),
      retries: 0
    };

    await new Promise((resolve, reject) => {
      const req = store.add(op);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    this._notify();
  }

  // Get count of pending operations
  async getPendingCount() {
    try {
      const db = await this.ensureDb();
      const tx = db.transaction([PENDING_STORE], 'readonly');
      const store = tx.objectStore(PENDING_STORE);

      return new Promise((resolve, reject) => {
        const req = store.count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return 0;
    }
  }

  // Get all pending operations
  async getAllPending() {
    try {
      const db = await this.ensureDb();
      const tx = db.transaction([PENDING_STORE], 'readonly');
      const store = tx.objectStore(PENDING_STORE);

      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  // Remove a completed operation
  async dequeue(id) {
    const db = await this.ensureDb();
    const tx = db.transaction([PENDING_STORE], 'readwrite');
    const store = tx.objectStore(PENDING_STORE);

    await new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    this._notify();
  }

  // Process all queued operations in order
  async processQueue() {
    if (this.syncing || !navigator.onLine) return;
    this.syncing = true;
    this._notify();

    try {
      const ops = await this.getAllPending();
      if (ops.length === 0) {
        this.syncing = false;
        this._notify();
        return;
      }

      // Sort by timestamp to process in order
      ops.sort((a, b) => a.timestamp - b.timestamp);

      // Dynamic import to avoid circular dependency
      const { default: api, setSuppressAuthRedirect } = await import('../services/api');
      // Suppress 401 redirect during queue processing to prevent kick-out
      setSuppressAuthRedirect(true);

      // Map temp IDs to real IDs as we process creates
      const idMap = new Map();

      for (const op of ops) {
        // Rewrite URLs that contain temp IDs with real IDs from prior creates
        let url = op.url;
        let data = op.data;
        for (const [tempId, realId] of idMap) {
          if (url.includes(tempId)) {
            url = url.replace(tempId, realId);
          }
        }

        try {
          let response;
          switch (op.method) {
            case 'POST':
              response = await api.post(url, data);
              // Handle offline-created services with embedded setlist
              if (op.url === '/services' && response?.data) {
                const newService = response.data.service || response.data;
                if (newService?.id && op.tempId) {
                  idMap.set(op.tempId, newService.id);
                  // Process embedded setlist if present
                  if (op.data?.setlist?.length > 0) {
                    for (const item of op.data.setlist) {
                      try {
                        await api.post(`/services/${newService.id}/songs`, item);
                      } catch (e) {
                        console.warn('Failed to add setlist item during sync:', e);
                      }
                    }
                  }
                  // Clean up the offline temp service from IndexedDB
                  offlineStorage.deleteService(op.tempId).catch(() => {});
                  offlineStorage.saveService(newService).catch(() => {});
                }
              }
              // Handle offline-created songs — clean up temp ID
              if (op.url === '/songs' && op.tempId && response?.data) {
                const newSong = response.data.song || response.data;
                if (newSong?.id) {
                  idMap.set(op.tempId, newSong.id);
                  offlineStorage.deleteSong(op.tempId).catch(() => {});
                  offlineStorage.saveSong(newSong).catch(() => {});
                }
              }
              break;
            case 'PUT':
              await api.put(url, data);
              break;
            case 'DELETE':
              await api.delete(url);
              break;
            default:
              console.warn('Unknown queued operation method:', op.method);
          }
          await this.dequeue(op.id);
        } catch (err) {
          console.error('Failed to sync operation:', op, err);
          // Check if this is a server rejection (4xx) vs network error
          const status = err?.response?.status || err?.status;
          const isClientError = (status >= 400 && status < 500) ||
            err?.error === 'Not Found' || err?.error === 'Access denied';
          if (isClientError) {
            console.warn('Server rejected operation, removing from queue:', op);
            await this.dequeue(op.id);
          } else {
            // Network error — stop processing, will retry next time
            break;
          }
        }
      }

      // Dispatch event so pages can refresh data after sync
      window.dispatchEvent(new CustomEvent('offline-sync-complete'));
    } catch (err) {
      console.error('Queue processing error:', err);
    } finally {
      // Re-enable auth redirect
      import('../services/api').then(({ setSuppressAuthRedirect }) => {
        setSuppressAuthRedirect(false);
      }).catch(() => {});
      this.syncing = false;
      this._notify();
    }
  }

  // Subscribe to queue changes (for UI updates)
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  _notify() {
    this.getPendingCount().then(count => {
      for (const cb of this.listeners) {
        cb({ count, syncing: this.syncing });
      }
    });
  }
}

const offlineQueue = new OfflineQueue();
export default offlineQueue;
