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

    // If we're back online and not currently syncing, trigger processing
    if (navigator.onLine && !this.syncing) {
      this.processQueue().catch(() => {});
    }
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

  // Increment retry count for an operation
  async _incrementRetries(op) {
    try {
      const db = await this.ensureDb();
      const tx = db.transaction([PENDING_STORE], 'readwrite');
      const store = tx.objectStore(PENDING_STORE);
      await new Promise((resolve, reject) => {
        const req = store.put({ ...op, retries: (op.retries || 0) + 1 });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch { /* best effort */ }
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

  // Deep-replace temp IDs in a data object (URLs + nested payloads)
  _remapData(data, idMap) {
    if (!data || idMap.size === 0) return data;
    // Serialize, replace all temp IDs, deserialize
    let json = JSON.stringify(data);
    for (const [tempId, realId] of idMap) {
      // Use split+join for global replacement (no regex escaping needed)
      json = json.split(tempId).join(String(realId));
    }
    try { return JSON.parse(json); } catch { return data; }
  }

  // Process all queued operations in order
  async processQueue() {
    if (this.syncing || !navigator.onLine) return;
    this.syncing = true;
    this._notify();

    let suppressSet = false;

    try {
      // Dynamic import to avoid circular dependency
      const { default: api, setSuppressAuthRedirect } = await import('../services/api');
      // Suppress 401 redirect during queue processing to prevent kick-out
      setSuppressAuthRedirect(true);
      suppressSet = true;

      // Map temp IDs to real IDs as we process creates
      const idMap = new Map();
      let hadNetworkError = false;

      // Re-fetch ops each iteration to pick up newly enqueued operations
      let ops = await this.getAllPending();
      while (ops.length > 0 && !hadNetworkError) {
        // Sort by autoIncrement id for stable insertion order (tiebreaks same-timestamp)
        ops.sort((a, b) => a.timestamp - b.timestamp || a.id - b.id);

        for (const op of ops) {
          // Rewrite URLs and data payloads that contain temp IDs
          let url = op.url;
          let data = op.data;
          for (const [tempId, realId] of idMap) {
            if (url.includes(tempId)) {
              url = url.split(tempId).join(String(realId));
            }
          }
          data = this._remapData(data, idMap);

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
                // Handle offline-created songs -- clean up temp ID
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
            // Detect 4xx client errors using _httpStatus injected by api.js interceptor
            const status = err?._httpStatus;
            const isClientError = (status >= 400 && status < 500);
            if (isClientError) {
              console.warn('Server rejected operation (HTTP ' + status + '), removing from queue:', op);
              // Clean up ghost temp records from IndexedDB on rejected creates
              if (op.tempId) {
                if (op.url === '/songs') offlineStorage.deleteSong(op.tempId).catch(() => {});
                if (op.url === '/services') offlineStorage.deleteService(op.tempId).catch(() => {});
              }
              await this.dequeue(op.id);
            } else if ((op.retries || 0) >= 5) {
              // Max retries reached (likely permanent 5xx) -- discard to unblock queue
              console.warn('Max retries reached, discarding operation:', op);
              if (op.tempId) {
                if (op.url === '/songs') offlineStorage.deleteSong(op.tempId).catch(() => {});
                if (op.url === '/services') offlineStorage.deleteService(op.tempId).catch(() => {});
              }
              await this.dequeue(op.id);
            } else {
              // Network/server error -- increment retry count and stop for now
              await this._incrementRetries(op);
              hadNetworkError = true;
              break;
            }
          }
        }

        if (hadNetworkError) break;

        // Re-fetch to pick up any ops enqueued during this processing cycle
        const newOps = await this.getAllPending();
        if (newOps.length === 0) break;
        // Only continue if there are genuinely new operations
        const processedIds = new Set(ops.map(o => o.id));
        const hasNew = newOps.some(o => !processedIds.has(o.id));
        if (!hasNew) break;
        ops = newOps;
      }

      // Invalidate in-memory data cache so re-fetches get fresh server data
      const { default: dataCache } = await import('./dataCache');
      dataCache.invalidate();

      // Reset suppressAuthRedirect BEFORE dispatching sync-complete
      setSuppressAuthRedirect(false);
      suppressSet = false;

      // Dispatch event so pages can refresh data after sync
      window.dispatchEvent(new CustomEvent('offline-sync-complete'));
    } catch (err) {
      console.error('Queue processing error:', err);
    } finally {
      // Ensure suppressAuthRedirect is always reset synchronously
      if (suppressSet) {
        try {
          const { setSuppressAuthRedirect } = await import('../services/api');
          setSuppressAuthRedirect(false);
        } catch { /* best effort */ }
      }
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
