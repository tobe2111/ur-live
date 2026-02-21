import { useEffect, useState } from 'react';

/**
 * Version Checker Hook
 * Detects new version deployments and prompts user to refresh
 * Prevents infinite login loops caused by cached old code
 */
export function useVersionCheck() {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const STORAGE_KEY = 'app_version';
  const CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes

  const checkVersion = async () => {
    try {
      // Fetch version with cache-busting
      const response = await fetch(`/version.json?t=${Date.now()}`);
      const data = await response.json();
      const newVersion = data.version;

      // Get stored version
      const currentVersion = localStorage.getItem(STORAGE_KEY);

      console.log('[VersionCheck] Current:', currentVersion, 'New:', newVersion);

      if (currentVersion && currentVersion !== newVersion) {
        console.warn('[VersionCheck] ⚠️ New version detected! Update required.');
        setNeedsUpdate(true);
      } else if (!currentVersion) {
        // First visit - store version
        localStorage.setItem(STORAGE_KEY, newVersion);
        console.log('[VersionCheck] ✅ Version stored:', newVersion);
      }
    } catch (error) {
      console.error('[VersionCheck] Failed to check version:', error);
    }
  };

  const forceUpdate = () => {
    console.log('[VersionCheck] 🔄 Force updating...');
    // Clear all caches
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    // Update version and reload
    fetch(`/version.json?t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        localStorage.setItem(STORAGE_KEY, data.version);
        window.location.reload();
      });
  };

  useEffect(() => {
    // Initial check
    checkVersion();

    // Periodic checks
    const interval = setInterval(checkVersion, CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  return { needsUpdate, forceUpdate };
}
