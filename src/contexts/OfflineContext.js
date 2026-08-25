import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

const OfflineContext = createContext(null);

// IndexedDB wrapper for offline storage
const DB_NAME = 'pav-manager-offline';
const DB_VERSION = 1;

const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create stores for each data type
      const stores = ['techniciens', 'salles', 'creneaux', 'materiel', 'devis', 'formations', 'reservations', 'enums', 'dashboard', 'organigramme'];
      
      stores.forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      });
      
      // Store for pending operations when offline
      if (!db.objectStoreNames.contains('pendingOperations')) {
        db.createObjectStore('pendingOperations', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
};

const getFromStore = async (storeName) => {
  try {
    const db = await openDB();
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('IndexedDB get error:', error);
    return [];
  }
};

const saveToStore = async (storeName, data) => {
  try {
    const db = await openDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    
    // Clear existing data
    store.clear();
    
    // Add new data
    if (Array.isArray(data)) {
      data.forEach(item => {
        store.add({ ...item, id: item.id || storeName });
      });
    } else {
      store.add({ ...data, id: storeName });
    }
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('IndexedDB save error:', error);
  }
};

const addPendingOperation = async (operation) => {
  try {
    const db = await openDB();
    const transaction = db.transaction('pendingOperations', 'readwrite');
    const store = transaction.objectStore('pendingOperations');
    
    store.add({
      ...operation,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to save pending operation:', error);
  }
};

const getPendingOperations = async () => {
  return getFromStore('pendingOperations');
};

const clearPendingOperations = async () => {
  try {
    const db = await openDB();
    const transaction = db.transaction('pendingOperations', 'readwrite');
    const store = transaction.objectStore('pendingOperations');
    store.clear();
  } catch (error) {
    console.error('Failed to clear pending operations:', error);
  }
};

export const OfflineProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(0);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Connexion rétablie', {
        description: 'Synchronisation des données en cours...'
      });
      syncPendingOperations();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Mode hors-ligne', {
        description: 'Les modifications seront synchronisées à la reconnexion'
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check pending operations on mount
    checkPendingOperations();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const checkPendingOperations = async () => {
    const operations = await getPendingOperations();
    setPendingSync(operations.length);
  };

  const syncPendingOperations = async () => {
    if (!navigator.onLine) return;

    const operations = await getPendingOperations();
    if (operations.length === 0) return;

    let syncedCount = 0;
    
    for (const op of operations) {
      try {
        const response = await fetch(op.url, {
          method: op.method,
          headers: op.headers,
          body: op.body
        });
        
        if (response.ok) {
          syncedCount++;
        }
      } catch (error) {
        console.error('Sync failed for operation:', op);
      }
    }

    if (syncedCount > 0) {
      await clearPendingOperations();
      setPendingSync(0);
      toast.success(`${syncedCount} opération(s) synchronisée(s)`);
    }
  };

  const cacheData = useCallback(async (key, data) => {
    await saveToStore(key, data);
  }, []);

  const getCachedData = useCallback(async (key) => {
    return getFromStore(key);
  }, []);

  const queueOperation = useCallback(async (operation) => {
    await addPendingOperation(operation);
    setPendingSync(prev => prev + 1);
  }, []);

  return (
    <OfflineContext.Provider value={{
      isOnline,
      pendingSync,
      cacheData,
      getCachedData,
      queueOperation,
      syncPendingOperations
    }}>
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within OfflineProvider');
  }
  return context;
};
