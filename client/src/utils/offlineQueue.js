// Offline Queue - stores pending API mutations in IndexedDB and syncs when online
// Operations are processed in FIFO order when connectivity returns

const DB_NAME = 'SoluFlowOfflineDB';
const DB_VERSION = 2; // Bump from 1 to add pending_ops store
const PENDING_STORE = 'pending_ops';

class OfflineQueue {
  constructor() {
    this.db = null;
    this.syncing = false;
    this.listeners = new Set();
    this.initPromise = this.init();

    // Auto-sync when coming back online
    window.addEventListener('online', () => this.processQueue());
  }

  async init() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Preserve existing stores from v1
        if (!db.objectStoreNames.contains('songs')) {
          const songsStore = db.createObjectStore('songs', { keyPath: 'id' });
          songsStore.createIndex('title', 'title', { unique: false });
          songsStore.createIndex('workspace_id', 'workspace_id', { unique: false });
        }

        if (!db.objectStoreNames.contains('services')) {
          const servicesStore = db.createObjectStore('services', { keyPath: 'id' });
          servicesStore.createIndex('code', 'code', { unique: false });
          servicesStore.createIndex('date', 'date', { unique: false });
        }

        // New store for pending operations
        if (!db.objectStoreNames.contains(PENDING_STORE)) {
          const pendingStore = db.createObjectStore(PENDING_STORE, {
            keyPath: 'id',
            autoIncrement: true
          });
          pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async ensureDb() {
    await this.initPromise;
    if (!this.db) throw new Error('IndexedDB not available');
    return this.db;
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
      const { default: api } = await import('../services/api');

      for (const op of ops) {
        try {
          switch (op.method) {
            case 'POST':
              await api.post(op.url, op.data);
              break;
            case 'PUT':
              await api.put(op.url, op.data);
              break;
            case 'DELETE':
              await api.delete(op.url);
              break;
            default:
              console.warn('Unknown queued operation method:', op.method);
          }
          await this.dequeue(op.id);
        } catch (err) {
          console.error('Failed to sync operation:', op, err);
          // If server explicitly rejects (4xx), remove from queue to avoid infinite retry
          if (err.status >= 400 && err.status < 500) {
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
