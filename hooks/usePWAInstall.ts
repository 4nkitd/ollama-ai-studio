import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAInstallState {
  isInstallable: boolean;
  isInstalled: boolean;
  isStandalone: boolean;
  canInstall: boolean;
  isIOS: boolean;
  showInstallPrompt: () => Promise<boolean>;
  dismissPrompt: () => void;
  installationStatus: 'idle' | 'prompted' | 'installing' | 'installed' | 'dismissed';
}

export const usePWAInstall = (): PWAInstallState => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [installationStatus, setInstallationStatus] = useState<PWAInstallState['installationStatus']>('idle');

  // Detect if app is running in standalone mode
  const isStandalone = () => {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://')
    );
  };

  // Detect iOS
  const isIOS = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  };

  // Check if app is already installed
  const isInstalled = () => {
    return isStandalone() || localStorage.getItem('pwa-installed') === 'true';
  };

  // Show install prompt
  const showInstallPrompt = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      // For iOS, we can't programmatically show install prompt
      if (isIOS()) {
        setInstallationStatus('prompted');
        return false;
      }
      return false;
    }

    setInstallationStatus('prompted');

    try {
      // Show the install prompt
      await deferredPrompt.prompt();
      
      // Wait for the user to respond to the prompt
      const choiceResult = await deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        setInstallationStatus('installing');
        localStorage.setItem('pwa-installed', 'true');
        
        // Clear the deferredPrompt so it can only be used once
        setDeferredPrompt(null);
        setIsInstallable(false);
        
        // Set installed after a delay to allow for installation
        setTimeout(() => {
          setInstallationStatus('installed');
        }, 2000);
        
        return true;
      } else {
        setInstallationStatus('dismissed');
        return false;
      }
    } catch (error) {
      console.error('Error showing install prompt:', error);
      setInstallationStatus('idle');
      return false;
    }
  }, [deferredPrompt]);

  // Dismiss prompt
  const dismissPrompt = useCallback(() => {
    setInstallationStatus('dismissed');
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  }, []);

  // Check if install prompt was recently dismissed
  const wasRecentlyDismissed = useCallback(() => {
    const dismissedTime = localStorage.getItem('pwa-install-dismissed');
    if (!dismissedTime) return false;
    
    const dismissedDate = new Date(parseInt(dismissedTime));
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    return dismissedDate > oneDayAgo;
  }, []);

  useEffect(() => {
    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      console.log('PWA install prompt available');
      
      const beforeInstallPromptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(beforeInstallPromptEvent);
      
      // Only show as installable if not recently dismissed
      if (!wasRecentlyDismissed() && !isInstalled()) {
        setIsInstallable(true);
      }
    };

    // Listen for app installation
    const handleAppInstalled = () => {
      console.log('PWA was installed');
      setInstallationStatus('installed');
      setIsInstallable(false);
      setDeferredPrompt(null);
      localStorage.setItem('pwa-installed', 'true');
    };

    // Listen for display mode changes
    const handleDisplayModeChange = () => {
      if (isStandalone()) {
        setInstallationStatus('installed');
        localStorage.setItem('pwa-installed', 'true');
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    
    // Listen for display mode changes
    if (window.matchMedia) {
      const displayModeQuery = window.matchMedia('(display-mode: standalone)');
      displayModeQuery.addEventListener('change', handleDisplayModeChange);
      
      // Cleanup for display mode listener
      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
        displayModeQuery.removeEventListener('change', handleDisplayModeChange);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [wasRecentlyDismissed]);

  // Initialize installation status based on current state
  useEffect(() => {
    if (isInstalled()) {
      setInstallationStatus('installed');
    } else if (wasRecentlyDismissed()) {
      setInstallationStatus('dismissed');
    }
  }, [wasRecentlyDismissed]);

  const canInstall = isInstallable && installationStatus !== 'dismissed' && !isInstalled();

  return {
    isInstallable,
    isInstalled: isInstalled(),
    isStandalone: isStandalone(),
    canInstall,
    isIOS: isIOS(),
    showInstallPrompt,
    dismissPrompt,
    installationStatus
  };
};

export default usePWAInstall;