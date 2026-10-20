/**
 * Feature Flags Configuration
 * 
 * Purpose: Enable/disable features for gradual rollout and safe rollback
 * 
 * Usage:
 *   import { featureFlags } from '@/config/feature-flags';
 *   if (featureFlags.backendToken) { ... }
 */

export interface FeatureFlags {
  // Phase 2.3: Backend ID Token endpoint
  backendToken: boolean;
  
  // Phase 2.4: Unified Auth Store (future)
  unifiedAuth: boolean;
  
  // Phase 2.5: Drizzle ORM (future)
  drizzleORM: boolean;
  
  // Other flags
  enableAnalytics: boolean;
  enablePushNotifications: boolean;
  enableChatModeration: boolean;
}

/**
 * Default feature flags
 * 
 * IMPORTANT: Keep conservative defaults (false) for new features
 * Enable gradually via environment variables
 */
const defaultFlags: FeatureFlags = {
  backendToken: false,        // Phase 2.3 - Start disabled
  unifiedAuth: false,          // Phase 2.4 - Future
  drizzleORM: false,           // Phase 2.5 - Future
  enableAnalytics: true,
  enablePushNotifications: true,
  enableChatModeration: true,
};

/**
 * Load feature flags from environment
 * 
 * Environment variables:
 *   VITE_FEATURE_BACKEND_TOKEN=true
 *   VITE_FEATURE_UNIFIED_AUTH=true
 *   VITE_FEATURE_DRIZZLE_ORM=true
 */
function loadFeatureFlagsFromEnv(): Partial<FeatureFlags> {
  if (typeof import.meta === 'undefined' || !import.meta.env) {
    return {};
  }

  return {
    backendToken: import.meta.env.VITE_FEATURE_BACKEND_TOKEN === 'true',
    unifiedAuth: import.meta.env.VITE_FEATURE_UNIFIED_AUTH === 'true',
    drizzleORM: import.meta.env.VITE_FEATURE_DRIZZLE_ORM === 'true',
  };
}

/**
 * Load feature flags from localStorage (for local override)
 * 
 * Usage in DevTools Console:
 *   localStorage.setItem('feature_flags', JSON.stringify({ backendToken: true }))
 */
function loadFeatureFlagsFromStorage(): Partial<FeatureFlags> {
  try {
    const stored = localStorage.getItem('feature_flags');
    if (stored) {
      return JSON.parse(stored) as Partial<FeatureFlags>;
    }
  } catch (err) {
    console.warn('[FeatureFlags] Failed to load from localStorage:', err);
  }
  return {};
}

/**
 * Merge feature flags from multiple sources
 * Priority: localStorage > env > defaults
 */
export const featureFlags: FeatureFlags = {
  ...defaultFlags,
  ...loadFeatureFlagsFromEnv(),
  ...loadFeatureFlagsFromStorage(),
};

/**
 * Update feature flag at runtime (for testing)
 * 
 * Usage:
 *   updateFeatureFlag('backendToken', true);
 */
export function updateFeatureFlag<K extends keyof FeatureFlags>(
  flag: K,
  value: FeatureFlags[K]
): void {
  featureFlags[flag] = value;
  
  // Persist to localStorage
  try {
    const stored = loadFeatureFlagsFromStorage();
    const updated = { ...stored, [flag]: value };
    localStorage.setItem('feature_flags', JSON.stringify(updated));
  } catch (err) {
    console.warn('[FeatureFlags] Failed to save to localStorage:', err);
  }
}

/**
 * Reset all feature flags to defaults
 */
export function resetFeatureFlags(): void {
  Object.assign(featureFlags, defaultFlags);
  localStorage.removeItem('feature_flags');
}

/**
 * Log current feature flags (for debugging)
 */
export function logFeatureFlags(): void {
  console.table(featureFlags);
}

// Export for DevTools access
if (typeof window !== 'undefined') {
  (window as any).__featureFlags = {
    current: featureFlags,
    update: updateFeatureFlag,
    reset: resetFeatureFlags,
    log: logFeatureFlags,
  };

  if (import.meta.env.DEV) {
    console.log('[FeatureFlags] Available in DevTools as window.__featureFlags');
  }
}
