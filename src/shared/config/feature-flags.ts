/**
 * Feature Flags Configuration
 * 
 * Purpose: Toggle new features safely in production
 * Phase 2.3: Backend ID Token
 * 
 * Usage:
 *   import { featureFlags } from '@/shared/config/feature-flags';
 *   if (featureFlags.backendToken) {
 *     // Use backend token endpoint
 *   } else {
 *     // Use client-side Firebase token
 *   }
 * 
 * Benefits:
 *   - Gradual rollout (0% → 10% → 50% → 100%)
 *   - Instant rollback if issues occur
 *   - A/B testing capability
 *   - Zero code changes to toggle
 */

export interface FeatureFlags {
  /** 
   * Phase 2.3: Use backend /api/auth/id-token endpoint
   * 
   * Status: 🟡 Testing (0% traffic)
   * Risk: 35% → 0% with gradual rollout
   * 
   * Rollout plan:
   *   Week 1: 0% (localhost testing only)
   *   Week 2: 10% (early adopters)
   *   Week 3: 50% (half users)
   *   Week 4: 100% (full rollout)
   * 
   * Rollback: Set to false, redeploy (< 5 minutes)
   */
  backendToken: boolean;

  /**
   * Enable debug logs for authentication flow
   * 
   * Status: ✅ Active in development
   * 
   * When enabled:
   *   - Console logs for token operations
   *   - Network request/response details
   *   - State change tracking
   */
  authDebugLogs: boolean;

  /**
   * Enable retry on 401 errors
   * 
   * Status: 🟢 Active (with limits)
   * 
   * Limits:
   *   - Max 1 retry per request
   *   - 2-second delay between retries
   *   - Redirect to login after retry fails
   */
  authRetryOn401: boolean;
}

/**
 * Current Feature Flag Values
 * 
 * 🔧 Change these values to toggle features
 * 
 * Environment-based overrides:
 *   - Development: All flags enabled for testing
 *   - Production: Gradual rollout per flag
 */
export const featureFlags: FeatureFlags = {
  // Phase 2.3: Backend Token (0% rollout)
  backendToken: false, // Phase 2.3: Enable after backend token endpoint testing complete

  // Debug logs (development only)
  authDebugLogs: import.meta.env?.DEV === true,

  // Retry on 401 (always enabled with limits)
  authRetryOn401: true,
};

/**
 * Get feature flag value with optional user-based rollout
 * 
 * Example:
 *   const enabled = isFeatureEnabled('backendToken', userId);
 *   // Returns true for 10% of users when rolloutPercent = 10
 */
export function isFeatureEnabled(
  flagName: keyof FeatureFlags,
  userId?: number | string,
  rolloutPercent: number = 100
): boolean {
  // Clamp percent to valid range
  const pct = Math.max(0, Math.min(100, rolloutPercent));

  if (pct <= 0) return false;
  if (pct >= 100) return true;

  // User-based gradual rollout (deterministic)
  if (userId !== undefined) {
    // Hash userId to get consistent bucket (0-99)
    const hash = String(userId).split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
    const bucket = Math.abs(hash) % 100;

    // Enable for users in rollout percentage bucket
    return bucket < pct;
  }

  // Random rollout if no userId provided
  return Math.random() * 100 < pct;
}

/**
 * Feature Flag Status Dashboard
 * 
 * Prints current flag status to console (dev only)
 */
export function logFeatureFlagStatus(forceLog = false) {
  if (!forceLog && (!import.meta.env?.DEV || import.meta.env?.MODE === 'test')) return;

  console.group('🚩 Feature Flags Status');
  console.log('backendToken:', featureFlags.backendToken ? '🟢 Enabled' : '🔴 Disabled');
  console.log('authDebugLogs:', featureFlags.authDebugLogs ? '🟢 Enabled' : '🔴 Disabled');
  console.log('authRetryOn401:', featureFlags.authRetryOn401 ? '🟢 Enabled' : '🔴 Disabled');
  console.groupEnd();
}

// Log on module load (dev only, not in test)
if (import.meta.env?.DEV && import.meta.env?.MODE !== 'test') {
  logFeatureFlagStatus();
}
