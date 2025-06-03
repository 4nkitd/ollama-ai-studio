import React from 'react';
import { Download, X, RefreshCw } from 'lucide-react';
// import { useServiceWorker } from '../hooks/useServiceWorker'; // No longer used directly

interface UpdateNotificationProps {
  className?: string;
  position?: 'top' | 'bottom';
  // Props passed from App.tsx
  isUpdateAvailable: boolean;
  isUpdating: boolean; // Added isUpdating
  updateServiceWorker: () => Promise<void>;
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({
  className = '',
  position = 'bottom',
  // Destructure props passed from App.tsx
  isUpdateAvailable,
  isUpdating,
  updateServiceWorker
}) => {
  // const { isUpdateAvailable, isUpdating, updateServiceWorker } = useServiceWorker(); // Removed internal hook call

  const handleUpdate = () => {
    updateServiceWorker();
  };

  const handleDismiss = () => {
    // For now, just hide by not rendering
    // Could add local state to manage dismissal
  };

  if (!isUpdateAvailable) {
    return null;
  }

  const positionClasses = position === 'top' 
    ? 'top-4 left-1/2 transform -translate-x-1/2' 
    : 'bottom-4 left-1/2 transform -translate-x-1/2';

  return (
    <div className={`fixed ${positionClasses} z-50 ${className}`}>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 max-w-sm w-full mx-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg flex-shrink-0">
            <Download size={20} className="text-blue-600 dark:text-blue-400" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 dark:text-white mb-1">
              Update Available
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              A new version of the app is ready. Update now for the latest features and improvements.
            </p>
            
            <div className="flex gap-2">
              <button
                onClick={handleUpdate}
                disabled={isUpdating}
                className={`
                  flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 
                  disabled:bg-blue-400 text-white rounded-lg transition-colors duration-200
                  ${isUpdating ? 'cursor-not-allowed' : ''}
                `}
              >
                {isUpdating ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    Update Now
                  </>
                )}
              </button>
              
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition-colors duration-200"
              >
                Later
              </button>
            </div>
          </div>
          
          <button
            onClick={handleDismiss}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200 flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateNotification;