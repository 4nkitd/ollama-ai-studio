import React, { useState } from 'react';
import { Download, X, Smartphone, Monitor, Info } from 'lucide-react';
// import { usePWAInstall } from '../hooks/usePWAInstall'; // No longer used directly

interface PWAInstallPromptProps {
  className?: string;
  variant?: 'banner' | 'modal' | 'button';
  showIcon?: boolean;
  autoShow?: boolean; // Retained as App.tsx might implicitly use its default
  // Props passed from App.tsx
  canInstall: boolean;
  isIOS: boolean;
  showInstallPrompt: () => Promise<boolean>;
  dismissPrompt: () => void;
  installationStatus: 'idle' | 'prompted' | 'installing' | 'installed' | 'dismissed';
  isStandalone: boolean;
}

const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({
  className = '',
  variant = 'banner',
  showIcon = true,
  autoShow = true,
  // Destructure props passed from App.tsx
  canInstall,
  isIOS,
  showInstallPrompt,
  dismissPrompt,
  installationStatus,
  isStandalone,
}) => {
  // const { // Removed internal hook call, props are passed directly
  //   canInstall,
  //   isIOS,
  //   showInstallPrompt,
  //   dismissPrompt,
  //   installationStatus,
  //   isStandalone
  // } = usePWAInstall();

  const [isVisible, setIsVisible] = useState(autoShow);
  const [showInstructions, setShowInstructions] = useState(false);

  const handleInstall = async () => {
    if (isIOS) {
      setShowInstructions(true);
      return;
    }

    const success = await showInstallPrompt();
    if (success) {
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    dismissPrompt();
    setIsVisible(false);
  };

  // Don't show if already installed or not installable
  if (!canInstall || !isVisible || isStandalone) {
    return null;
  }

  if (variant === 'button') {
    return (
      <button
        onClick={handleInstall}
        className={`
          flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 
          text-white rounded-lg transition-colors duration-200 
          ${className}
        `}
      >
        {showIcon && <Download size={16} />}
        Install App
      </button>
    );
  }

  if (variant === 'modal' && showInstructions) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Install Ollama AI Studio
            </h3>
            <button
              onClick={() => {
                setShowInstructions(false);
                handleDismiss();
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={20} />
            </button>
          </div>

          {isIOS ? (
            <div className="space-y-4">
              <p className="text-gray-600 dark:text-gray-300">
                To install this app on your iPhone or iPad:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <li>Tap the Share button in Safari</li>
                <li>Scroll down and tap "Add to Home Screen"</li>
                <li>Tap "Add" in the top-right corner</li>
              </ol>
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Info size={16} className="text-blue-600 dark:text-blue-400" />
                <span className="text-sm text-blue-800 dark:text-blue-300">
                  The app will appear on your home screen
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-600 dark:text-gray-300">
                Install the app for a better experience:
              </p>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <li>• Faster loading</li>
                <li>• Offline support</li>
                <li>• Native app experience</li>
                <li>• Push notifications</li>
              </ul>
              <button
                onClick={handleInstall}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
              >
                <Download size={16} />
                Install Now
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Banner variant
  return (
    <div className={`
      flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 
      dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 
      dark:border-blue-700 rounded-lg shadow-sm ${className}
    `}>
      <div className="flex items-center gap-3">
        {showIcon && (
          <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-lg">
            {isIOS ? <Smartphone size={20} className="text-blue-600 dark:text-blue-400" /> : 
                     <Monitor size={20} className="text-blue-600 dark:text-blue-400" />}
          </div>
        )}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white">
            Install Ollama AI Studio
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {isIOS ? 
              'Add to your home screen for quick access' : 
              'Get the full app experience with offline support'
            }
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleInstall}
          disabled={installationStatus === 'installing'}
          className={`
            flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 
            disabled:bg-blue-400 text-white rounded-lg transition-colors duration-200
            ${installationStatus === 'installing' ? 'cursor-not-allowed' : ''}
          `}
        >
          {installationStatus === 'installing' ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Installing...
            </>
          ) : (
            <>
              <Download size={16} />
              {isIOS ? 'Instructions' : 'Install'}
            </>
          )}
        </button>
        
        <button
          onClick={handleDismiss}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
        >
          <X size={16} />
        </button>
      </div>

      {showInstructions && (
        <PWAInstallPrompt
          variant="modal"
          className="fixed inset-0"
          autoShow={true}
        />
      )}
    </div>
  );
};

export default PWAInstallPrompt;