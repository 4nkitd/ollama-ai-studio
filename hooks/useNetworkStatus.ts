/// <reference lib="webworker" />
import { useState, useEffect, useCallback } from 'react';

interface QueuedMessage {
  id: string;
  conversationId: string;
  content: string;
  timestamp: Date;
  retries: number;
}

interface NetworkStatus {
  isOnline: boolean;
  isSlowConnection: boolean;
  connectionType: string;
  effectiveType: string;
}

interface OfflineQueue {
  messages: QueuedMessage[];
  add: (message: Omit<QueuedMessage, 'id' | 'retries'>) => void;
  remove: (id: string) => void;
  clear: () => void;
  retry: (id: string) => Promise<void>;
  retryAll: () => Promise<void>;
}

export const useNetworkStatus = () => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    isSlowConnection: false,
    connectionType: 'unknown',
    effectiveType: 'unknown'
  });

  const [offlineQueue, setOfflineQueue] = useState<QueuedMessage[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

  // Update network status
  const updateNetworkStatus = useCallback(() => {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    setNetworkStatus({
      isOnline: navigator.onLine,
      isSlowConnection: connection ? connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g' : false,
      connectionType: connection ? connection.type || 'unknown' : 'unknown',
      effectiveType: connection ? connection.effectiveType || 'unknown' : 'unknown'
    });
  }, []);

  // Load offline queue from localStorage
  const loadOfflineQueue = useCallback(() => {
    try {
      const saved = localStorage.getItem('offlineMessageQueue');
      if (saved) {
        const parsed = JSON.parse(saved);
        setOfflineQueue(parsed.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        })));
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
    }
  }, []);

  // Save offline queue to localStorage
  const saveOfflineQueue = useCallback((queue: QueuedMessage[]) => {
    try {
      localStorage.setItem('offlineMessageQueue', JSON.stringify(queue));
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }, []);

  // Add message to offline queue
  const addToQueue = useCallback((message: Omit<QueuedMessage, 'id' | 'retries'>) => {
    const queuedMessage: QueuedMessage = {
      ...message,
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      retries: 0
    };

    setOfflineQueue(prev => {
      const newQueue = [...prev, queuedMessage];
      saveOfflineQueue(newQueue);
      return newQueue;
    });

    // Register for background sync if available
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then(registration => {
        (registration as any).sync.register('chat-queue');
      });
    }

    return queuedMessage.id;
  }, [saveOfflineQueue]);

  // Remove message from offline queue
  const removeFromQueue = useCallback((id: string) => {
    setOfflineQueue(prev => {
      const newQueue = prev.filter(msg => msg.id !== id);
      saveOfflineQueue(newQueue);
      return newQueue;
    });
  }, [saveOfflineQueue]);

  // Clear offline queue
  const clearQueue = useCallback(() => {
    setOfflineQueue([]);
    localStorage.removeItem('offlineMessageQueue');
  }, []);

  // Retry specific message
  const retryMessage = useCallback(async (id: string): Promise<void> => {
    const message = offlineQueue.find(msg => msg.id === id);
    if (!message) return;

    try {
      // Attempt to send the message
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conversationId: message.conversationId,
          content: message.content,
          timestamp: message.timestamp
        })
      });

      if (response.ok) {
        removeFromQueue(id);
        // Trigger success callback or event
        window.dispatchEvent(new CustomEvent('messageRetrySuccess', { detail: message }));
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      // Update retry count
      setOfflineQueue(prev => {
        const newQueue = prev.map(msg => 
          msg.id === id ? { ...msg, retries: msg.retries + 1 } : msg
        );
        saveOfflineQueue(newQueue);
        return newQueue;
      });

      // Remove if too many retries
      const updatedMessage = offlineQueue.find(msg => msg.id === id);
      if (updatedMessage && updatedMessage.retries >= 3) {
        removeFromQueue(id);
        window.dispatchEvent(new CustomEvent('messageRetryFailed', { detail: updatedMessage }));
      }

      throw error;
    }
  }, [offlineQueue, removeFromQueue, saveOfflineQueue]);

  // Retry all queued messages
  const retryAllMessages = useCallback(async (): Promise<void> => {
    if (isProcessingQueue || !networkStatus.isOnline) return;

    setIsProcessingQueue(true);
    
    try {
      const promises = offlineQueue.map(message => retryMessage(message.id));
      await Promise.allSettled(promises);
    } finally {
      setIsProcessingQueue(false);
    }
  }, [isProcessingQueue, networkStatus.isOnline, offlineQueue, retryMessage]);

  // Auto-retry when coming back online
  useEffect(() => {
    if (networkStatus.isOnline && offlineQueue.length > 0 && !isProcessingQueue) {
      // Small delay to ensure connection is stable
      const timeout = setTimeout(() => {
        retryAllMessages();
      }, 2000);

      return () => clearTimeout(timeout);
    }
  }, [networkStatus.isOnline, offlineQueue.length, isProcessingQueue, retryAllMessages]);

  // Listen for network status changes
  useEffect(() => {
    const handleOnline = () => updateNetworkStatus();
    const handleOffline = () => updateNetworkStatus();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for connection changes
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection) {
      connection.addEventListener('change', updateNetworkStatus);
    }

    // Initial load
    updateNetworkStatus();
    loadOfflineQueue();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', updateNetworkStatus);
      }
    };
  }, [updateNetworkStatus, loadOfflineQueue]);

  // Listen for service worker messages
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'QUEUE_ITEM_SENT') {
          removeFromQueue(event.data.item.id);
        } else if (event.data.type === 'QUEUE_ITEM_FAILED') {
          // Handle permanent failure
          window.dispatchEvent(new CustomEvent('messageRetryFailed', { detail: event.data.item }));
        }
      };

      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
    }
  }, [removeFromQueue]);

  const queue: OfflineQueue = {
    messages: offlineQueue,
    add: addToQueue,
    remove: removeFromQueue,
    clear: clearQueue,
    retry: retryMessage,
    retryAll: retryAllMessages
  };

  return {
    networkStatus,
    offlineQueue: queue,
    isProcessingQueue
  };
};

export default useNetworkStatus;