import React, { useState } from 'react';
import { RefreshCw, Clock, AlertCircle, Send, Trash2, X } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

interface OfflineQueueManagerProps {
  className?: string;
  isOpen: boolean;
  onClose: () => void;
}

const OfflineQueueManager: React.FC<OfflineQueueManagerProps> = ({
  className = '',
  isOpen,
  onClose
}) => {
  const { networkStatus, offlineQueue, isProcessingQueue } = useNetworkStatus();
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

  const handleRetryMessage = async (id: string) => {
    setRetryingIds(prev => new Set(prev).add(id));
    try {
      await offlineQueue.retry(id);
    } catch (error) {
      console.error('Failed to retry message:', error);
    } finally {
      setRetryingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleRetryAll = async () => {
    try {
      await offlineQueue.retryAll();
    } catch (error) {
      console.error('Failed to retry all messages:', error);
    }
  };

  const handleRemoveMessage = (id: string) => {
    offlineQueue.remove(id);
  };

  const handleClearQueue = () => {
    offlineQueue.clear();
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Clock size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Offline Queue
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {offlineQueue.messages.length} message{offlineQueue.messages.length === 1 ? '' : 's'} waiting to send
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {offlineQueue.messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Send size={24} className="text-gray-400" />
                </div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No queued messages
                </h4>
                <p className="text-gray-600 dark:text-gray-300">
                  Messages will appear here when sent offline
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Queue controls */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${networkStatus.isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {networkStatus.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleRetryAll}
                      disabled={!networkStatus.isOnline || isProcessingQueue}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                    >
                      {isProcessingQueue ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                      Retry All
                    </button>
                    <button
                      onClick={handleClearQueue}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              {/* Queue list */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-3">
                  {offlineQueue.messages.map((message) => (
                    <div
                      key={message.id}
                      className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              Message
                            </span>
                            {message.retries > 0 && (
                              <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs rounded-full">
                                <AlertCircle size={12} />
                                {message.retries} retries
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 mb-2">
                            {message.content}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                            <span>Queued {formatTimestamp(message.timestamp)}</span>
                            <span>ID: {message.conversationId.slice(-8)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRetryMessage(message.id)}
                            disabled={!networkStatus.isOnline || retryingIds.has(message.id)}
                            className="p-2 text-blue-600 hover:text-blue-700 disabled:text-gray-400 transition-colors"
                            title="Retry message"
                          >
                            {retryingIds.has(message.id) ? (
                              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <RefreshCw size={16} />
                            )}
                          </button>
                          <button
                            onClick={() => handleRemoveMessage(message.id)}
                            className="p-2 text-red-600 hover:text-red-700 transition-colors"
                            title="Remove message"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
            <span>
              Messages will be sent automatically when connection is restored
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfflineQueueManager;