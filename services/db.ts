import { ExploredItem } from '../types';

const DB_NAME = 'CuriousExplorerDB';
const DB_VERSION = 2; // Bumped version for new schema (ItemImages)
const STORE_NAME = 'explorations';

export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      // If store exists (from v1), delete it to avoid schema conflict, or just let it recreate
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
  });
};

export const saveExploration = async (item: ExploredItem): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(item); // put updates if exists, adds if not

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error("Failed to save to IndexedDB", error);
    // Don't crash the app if saving fails
  }
};

export const bulkSaveExplorations = async (items: ExploredItem[]): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      items.forEach(item => {
        store.put(item);
      });

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
    });
  } catch (error) {
    console.error("Failed to bulk save to IndexedDB", error);
    throw error;
  }
};

export const deleteExploration = async (id: string): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error("Failed to delete from IndexedDB", error);
    throw error;
  }
};

export const getAllExplorations = async (): Promise<ExploredItem[]> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
          const results = request.result as ExploredItem[];
          // Sort by timestamp desc
          results.sort((a, b) => b.timestamp - a.timestamp);
          resolve(results);
      };
    });
  } catch (error) {
    console.error("Failed to load from IndexedDB", error);
    return [];
  }
};