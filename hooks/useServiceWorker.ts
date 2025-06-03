import { useState, useEffect, useCallback } from 'react';

interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isUpdateAvailable: boolean;
  isUpdating: boolean;
  registration: ServiceWorkerRegistration | null;
  updateServiceWorker: () => Promise<void>;
  skipWaiting: () => void;
  unregister: () => Promise<boolean>;
  clearCaches: () => Promise<void>;
}

export const useServiceWorker = (): ServiceWorkerState => {
  const [isSupported] = useState('serviceWorker' in navigator);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Register service worker
  const registerServiceWorker = useCallback(async () => {
    if (!isSupported) return;

    try {
      const reg = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/'
      });

      setRegistration(reg);
      setIsRegistered(true);

      console.log('Service Worker registered:', reg.scope);

      // Check for updates
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          console.log('New service worker found');
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('New service worker installed, update available');
              setIsUpdateAvailable(true);
            }
          });
        }
      });

      // Check if there's already an update waiting
      if (reg.waiting) {
        setIsUpdateAvailable(true);
      }

      return reg;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }, [isSupported]);

  // Update service worker
  const updateServiceWorker = useCallback(async () => {
    if (!registration) return;

    setIsUpdating(true);

    try {
      if (registration.waiting) {
        // Tell the waiting service worker to skip waiting
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else {
        // Check for updates
        await registration.update();
      }
    } catch (error) {
      console.error('Service Worker update failed:', error);
    } finally {
      setIsUpdating(false);
    }
  }, [registration]);

  // Skip waiting and activate new service worker
  const skipWaiting = useCallback(() => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [registration]);

  // Unregister service worker
  const unregister = useCallback(async (): Promise<boolean> => {
    if (!registration) return false;

    try {
      const result = await registration.unregister();
      if (result) {
        setIsRegistered(false);
        setRegistration(null);
        console.log('Service Worker unregistered');
      }
      return result;
    } catch (error) {
      console.error('Service Worker unregistration failed:', error);
      return false;
    }
  }, [registration]);

  // Clear all caches
  const clearCaches = useCallback(async () => {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('All caches cleared');
      
      // Notify service worker to clear its caches too
      if (registration?.active) {
        registration.active.postMessage({ type: 'CLEAR_CACHE' });
      }
    } catch (error) {
      console.error('Failed to clear caches:', error);
    }
  }, [registration]);

  // Handle service worker messages
  useEffect(() => {
    if (!isSupported) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'SW_UPDATE_READY') {
        setIsUpdateAvailable(true);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [isSupported]);

  // Handle controller change (when new SW takes control)
  useEffect(() => {
    if (!isSupported) return;

    const handleControllerChange = () => {
      console.log('Service Worker controller changed, reloading page');
      setIsUpdateAvailable(false);
      setIsUpdating(false);
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, [isSupported]);

  // Initial registration
  useEffect(() => {
    if (isSupported) {
      // Check if already registered
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg) {
          setRegistration(reg);
          setIsRegistered(true);
          
          // Check for waiting updates
          if (reg.waiting) {
            setIsUpdateAvailable(true);
          }
        } else {
          // Register new service worker
          registerServiceWorker();
        }
      });
    }
  }, [isSupported, registerServiceWorker]);

  // Listen for service worker updates
  useEffect(() => {
    if (!registration) return;

    const handleUpdateFound = () => {
      const newWorker = registration.installing;
      if (newWorker) {
        const handleStateChange = () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setIsUpdateAvailable(true);
          }
        };

        newWorker.addEventListener('statechange', handleStateChange);
        return () => newWorker.removeEventListener('statechange', handleStateChange);
      }
    };

    registration.addEventListener('updatefound', handleUpdateFound);

    return () => {
      registration.removeEventListener('updatefound', handleUpdateFound);
    };
  }, [registration]);

  return {
    isSupported,
    isRegistered,
    isUpdateAvailable,
    isUpdating,
    registration,
    updateServiceWorker,
    skipWaiting,
    unregister,
    clearCaches
  };
};

export default useServiceWorker;