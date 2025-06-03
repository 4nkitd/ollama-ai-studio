import React from 'react';
import { Wifi, WifiOff, Loader2, AlertTriangle } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

interface NetworkStatusIndicatorProps {
  className?: string;
  showText?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  onClick?: () => void; // Added onClick prop
}

const NetworkStatusIndicator: React.FC<NetworkStatusIndicatorProps> = ({
  className = '',
  showText = true,
  position = 'top-right',
  onClick
}) => {
  const { networkStatus, offlineQueue, isProcessingQueue } = useNetworkStatus();
  const { isOnline, isSlowConnection, effectiveType } = networkStatus;
  const queueCount = offlineQueue.messages.length;

  const getPositionClasses = () => {
    const baseClasses = 'fixed z-50';
    switch (position) {
      case 'top-left':
        return `${baseClasses} top-4 left-4`;
      case 'top-right':
        return `${baseClasses} top-4 right-4`;
      case 'bottom-left':
        return `${baseClasses} bottom-4 left-4`;
      case 'bottom-right':
        return `${baseClasses} bottom-4 right-4`;
      default:
        return `${baseClasses} top-4 right-4`;
    }
  };

  const getStatusColor = () => {
    if (!isOnline) return 'text-red-500 bg-red-50 border-red-200';
    if (isSlowConnection) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (queueCount > 0) return 'text-blue-600 bg-blue-50 border-blue-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  const getIcon = () => {
    if (!isOnline) return <WifiOff size={16} />;
    if (isProcessingQueue) return <Loader2 size={16} className="animate-spin" />;
    if (isSlowConnection) return <AlertTriangle size={16} />;
    if (queueCount > 0) return <AlertTriangle size={16} />;
    return <Wifi size={16} />;
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (isProcessingQueue) return 'Syncing...';
    if (queueCount > 0) return `${queueCount} queued`;
    if (isSlowConnection) return `Slow (${effectiveType})`;
    return 'Online';
  };

  const getDescription = () => {
    if (!isOnline) return 'No internet connection. Messages will be queued.';
    if (isProcessingQueue) return 'Sending queued messages...';
    if (queueCount > 0) return `${queueCount} message${queueCount === 1 ? '' : 's'} waiting to send`;
    if (isSlowConnection) return 'Slow connection detected';
    return 'Connected and ready';
  };

  // Don't show indicator if online and no issues
  if (isOnline && !isSlowConnection && queueCount === 0 && !isProcessingQueue) {
    return null;
  }

  return (
    <div className={`${getPositionClasses()} ${className}`} onClick={onClick}>
      <div className={`
        flex items-center gap-2 px-3 py-2 rounded-lg border shadow-sm backdrop-blur-sm
        ${getStatusColor()}
        transition-all duration-300 ease-in-out
        ${showText ? 'min-w-max' : 'w-10 h-10 justify-center'}
      `}>
        {getIcon()}
        {showText && (
          <div className="flex flex-col">
            <span className="text-sm font-medium">{getStatusText()}</span>
            <span className="text-xs opacity-75">{getDescription()}</span>
          </div>
        )}
      </div>
      
      {queueCount > 0 && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
          {queueCount > 9 ? '9+' : queueCount}
        </div>
      )}
    </div>
  );
};

export default NetworkStatusIndicator;