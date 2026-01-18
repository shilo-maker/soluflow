// Offline Storage Utility using IndexedDB
// Provides persistent storage for songs and services when offline

const DB_NAME = 'SoluFlowOfflineDB';
const DB_VERSION = 1;
const SONGS_STORE = 'songs';
const SERVICES_STORE = 'services';

class OfflineStorage {
  constructor() {
    this.db = null;
    this.initPromise = this.init();
  }

  async init() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.warn('IndexedDB not supported');
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create songs store if it doesn't exist
        if (!db.objectStoreNames.contains(SONGS_STORE)) {
          const songsStore = db.createObjectStore(SONGS_STORE, { keyPath: 'id' });
          songsStore.createIndex('title', 'title', { unique: false });
          songsStore.createIndex('workspace_id', 'workspace_id', { unique: false });
          console.log('Songs object store created');
        }

        // Create services store if it doesn't exist
        if (!db.objectStoreNames.contains(SERVICES_STORE)) {
          const servicesStore = db.createObjectStore(SERVICES_STORE, { keyPath: 'id' });
          servicesStore.createIndex('code', 'code', { unique: false });
          servicesStore.createIndex('date', 'date', { unique: false });
          console.log('Services object store created');
        }
      };
    });
  }

  async ensureDb() {
    if (!this.db) {
      await this.initPromise;
    }
    return this.db;
  }

  // ==================== SONGS ====================

  async saveSong(song) {
    try {
      const db = await this.ensureDb();
      const transaction = db.transaction([SONGS_STORE], 'readwrite');
      const store = transaction.objectStore(SONGS_STORE);

      await new Promise((resolve, reject) => {
        const request = store.put(song);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      console.log('Song saved to offline storage:', song.id);
      return song;
    } catch (error) {
      console.error('Error saving song to offline storage:', error);
      throw error;
    }
  }

  async saveSongs(songs) {
    try {
      const db = await this.ensureDb();
      const transaction = db.transaction([SONGS_STORE], 'readwrite');
      const store = transaction.objectStore(SONGS_STORE);

      for (const song of songs) {
        store.put(song);
      }

      await new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });

      console.log(`${songs.length} songs saved to offline storage`);
      return songs;
    } catch (error) {
      console.error('Error saving songs to offline storage:', error);
      throw error;
    }
  }

  async getSong(id) {
    try {
      const db = await this.ensureDb();
      const transaction = db.transaction([SONGS_STORE], 'readonly');
      const store = transaction.objectStore(SONGS_STORE);

      return new Promise((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting song from offline storage:', error);
      throw error;
    }
  }

  async getAllSongs() {
    try {
      const db = await this.ensureDb();
      const transaction = db.transaction([SONGS_STORE], 'readonly');
      const store = transaction.objectStore(SONGS_STORE);

      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          console.log(`Retrieved ${request.result.length} songs from offline storage`);
          resolve(request.result);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting all songs from offline storage:', error);
      throw error;
    }
  }

  async deleteSong(id) {
    try {
      const db = await this.ensureDb();
      const transaction = db.transaction([SONGS_STORE], 'readwrite');
      const store = transaction.objectStore(SONGS_STORE);

      await new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      console.log('Song deleted from offline storage:', id);
    } catch (error) {
      console.error('Error deleting song from offline storage:', error);
      throw error;
    }
  }

  async clearSongs() {
    try {
      const db = await this.ensureDb();
      const transaction = db.transaction([SONGS_STORE], 'readwrite');
      const store = transaction.objectStore(SONGS_STORE);

      await new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      console.log('All songs cleared from offline storage');
    } catch (error) {
      console.error('Error clearing songs from offline storage:', error);
      throw error;
    }
  }

  // ==================== SERVICES ====================

  async saveService(service) {
    try {
      const db = await this.ensureDb();
      const transaction = db.transaction([SERVICES_STORE], 'readwrite');
      const store = transaction.objectStore(SERVICES_STORE);

      await new Promise((resolve, reject) => {
        const request = store.put(service);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      console.log('Service saved to offline storage:', service.id);
      return service;
    } catch (error) {
      console.error('Error saving service to offline storage:', error);
      throw error;
    }
  }

  async getService(id) {
    try {
      const db = await this.ensureDb();
      const transaction = db.transaction([SERVICES_STORE], 'readonly');
      const store = transaction.objectStore(SERVICES_STORE);

      return new Promise((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting service from offline storage:', error);
      throw error;
    }
  }

  async getAllServices() {
    try {
      const db = await this.ensureDb();
      const transaction = db.transaction([SERVICES_STORE], 'readonly');
      const store = transaction.objectStore(SERVICES_STORE);

      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          console.log(`Retrieved ${request.result.length} services from offline storage`);
          resolve(request.result);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting all services from offline storage:', error);
      throw error;
    }
  }

  async deleteService(id) {
    try {
      const db = await this.ensureDb();
      const transaction = db.transaction([SERVICES_STORE], 'readwrite');
      const store = transaction.objectStore(SERVICES_STORE);

      await new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      console.log('Service deleted from offline storage:', id);
    } catch (error) {
      console.error('Error deleting service from offline storage:', error);
      throw error;
    }
  }
}

// Export singleton instance
const offlineStorage = new OfflineStorage();
export default offlineStorage;
