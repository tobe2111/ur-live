/**
 * Auth API Client with Infinite Loop Prevention
 * 
 * Purpose: Safe API calls with automatic retry and 401 handling
 * Phase 2.3: Backend ID Token integration
 * 
 * Key Safety Features:
 *   1. Max 1 retry per request (prevents infinite loops)
 *   2. Exponential backoff (2s delay between retries)
 *   3. Redirect to login only once (no retry storms)
 *   4. Request tracking (detect duplicate requests)
 *   5. Timeout protection (abort after 10s)
 */

import { featureFlags } from '@/shared/config/feature-flags';

/**
 * Request tracker to prevent duplicate requests
 * Key: `${method}:${url}`, Value: timestamp
 */
const requestTracker = new Map<string, number>();

/**
 * Retry tracker to prevent infinite retries
 * Key: `${method}:${url}`, Value: retry count
 */
const retryTracker = new Map<string, number>();

/**
 * Cleanup old entries from trackers (called periodically)
 */
function cleanupTrackers() {
  const now = Date.now();
  const EXPIRE_MS = 60 * 1000; // 1 minute

  for (const [key, timestamp] of requestTracker.entries()) {
    if (now - timestamp > EXPIRE_MS) {
      requestTracker.delete(key);
      retryTracker.delete(key);
    }
  }
}

// Cleanup every minute
setInterval(cleanupTrackers, 60 * 1000);

/**
 * Get ID Token from backend (Phase 2.3)
 * 
 * Flow:
 *   1. Check Feature Flag (backendToken)
 *   2. If enabled: POST /api/auth/id-token with uid
 *   3. If disabled: Use client-side Firebase token
 * 
 * Benefits:
 *   - Centralized token management
 *   - Better security (server-side only)
 *   - Easier monitoring
 * 
 * Safety:
 *   - Max 1 retry on failure
 *   - Returns null on error (no throws)
 *   - Logs errors for debugging
 */
export async function getIdTokenFromBackend(
  uid: string,
  forceRefresh: boolean = false
): Promise<string | null> {
  if (!featureFlags.backendToken) {
    if (featureFlags.authDebugLogs) {
      console.log('[AuthAPI] Backend token disabled, using client-side Firebase');
    }
    return null; // Fall back to client-side Firebase
  }

  const requestKey = `POST:/api/auth/id-token:${uid}`;
  const now = Date.now();

  // Check if same request is already in flight
  const lastRequest = requestTracker.get(requestKey);
  if (lastRequest && now - lastRequest < 5000) {
    console.warn('[AuthAPI] Duplicate request detected, skipping:', requestKey);
    return null;
  }

  // Check retry count
  const retryCount = retryTracker.get(requestKey) || 0;
  if (retryCount >= 1) {
    console.error('[AuthAPI] Max retries exceeded for:', requestKey);
    retryTracker.delete(requestKey);
    return null;
  }

  try {
    requestTracker.set(requestKey, now);

    if (featureFlags.authDebugLogs) {
      console.log('[AuthAPI] Requesting token from backend for uid:', uid);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch('/api/auth/id-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uid, forceRefresh }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('[AuthAPI] Backend token request failed:', response.status);
      
      // Increment retry count
      retryTracker.set(requestKey, retryCount + 1);

      // On 401/404, don't retry - likely invalid user
      if (response.status === 401 || response.status === 404) {
        return null;
      }

      // On 500, could retry once after delay
      if (response.status >= 500 && retryCount === 0) {
        console.log('[AuthAPI] Server error, will retry once after 2s');
        await new Promise(resolve => setTimeout(resolve, 2000));
        return getIdTokenFromBackend(uid, forceRefresh); // Recursive retry (max 1)
      }

      return null;
    }

    const data = await response.json();
    
    if (!data.success || !data.data?.token) {
      console.error('[AuthAPI] Invalid response from backend:', data);
      return null;
    }

    if (featureFlags.authDebugLogs) {
      console.log('[AuthAPI] ✅ Token received from backend:', data.data.token.substring(0, 20) + '...');
      console.log('[AuthAPI] Token expires at:', new Date(data.data.expiresAt).toISOString());
    }

    // Clear retry count on success
    retryTracker.delete(requestKey);

    return data.data.token;

  } catch (err) {
    console.error('[AuthAPI] Error getting token from backend:', err);
    
    // Increment retry count
    retryTracker.set(requestKey, retryCount + 1);
    
    return null;
  } finally {
    // Remove from in-flight tracker after 5s
    setTimeout(() => {
      requestTracker.delete(requestKey);
    }, 5000);
  }
}

/**
 * Make authenticated API request with automatic token handling
 * 
 * Features:
 *   - Automatic Authorization header
 *   - Token refresh on 401
 *   - Max 1 retry (prevents infinite loops)
 *   - Redirect to login if retry fails
 * 
 * Usage:
 *   const data = await authFetch('/api/cart', { method: 'GET' });
 * 
 * Safety:
 *   - One-time retry only
 *   - One-time login redirect
 *   - Request deduplication
 */
export async function authFetch<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const requestKey = `${options.method || 'GET'}:${url}`;

  // Get token from store
  const { useAuthStore } = await import('@/client/stores/auth.store');
  const token = useAuthStore.getState().accessToken;

  if (!token) {
    console.error('[AuthAPI] No access token available');
    throw new Error('NOT_AUTHENTICATED');
  }

  // Check retry count
  const retryCount = retryTracker.get(requestKey) || 0;
  if (retryCount >= 1) {
    console.error('[AuthAPI] Max retries exceeded for:', requestKey);
    retryTracker.delete(requestKey);
    throw new Error('MAX_RETRIES_EXCEEDED');
  }

  try {
    if (featureFlags.authDebugLogs) {
      console.log('[AuthAPI] Request:', requestKey, 'with token:', token.substring(0, 20) + '...');
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.status === 401 && featureFlags.authRetryOn401 && retryCount === 0) {
      console.warn('[AuthAPI] 401 Unauthorized, attempting token refresh...');

      // Increment retry count
      retryTracker.set(requestKey, retryCount + 1);

      // Try to refresh token
      const { useAuthKR } = await import('@/shared/stores/useAuthKR');
      const newToken = await useAuthKR.getState().getIdToken(true); // Force refresh

      if (newToken) {
        console.log('[AuthAPI] Token refreshed, retrying request...');
        useAuthStore.getState().setAuth(
          useAuthStore.getState().user!,
          newToken,
          ''
        );

        // Wait 2s before retry
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Retry once (recursive call, but retry count prevents infinite loop)
        return authFetch<T>(url, options);
      } else {
        console.error('[AuthAPI] Token refresh failed, redirecting to login...');
        
        // Clear retry tracker
        retryTracker.delete(requestKey);

        // Redirect to login (one-time only)
        if (!sessionStorage.getItem('auth_redirect_attempted')) {
          sessionStorage.setItem('auth_redirect_attempted', 'true');
          window.location.href = '/login';
        }

        throw new Error('AUTHENTICATION_FAILED');
      }
    }

    // Clear retry count on success
    retryTracker.delete(requestKey);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();

  } catch (err) {
    console.error('[AuthAPI] Request failed:', requestKey, err);
    throw err;
  }
}

/**
 * Reset auth state and redirect to login
 * 
 * Safety: Only redirects once per session
 */
export function redirectToLogin() {
  if (sessionStorage.getItem('auth_redirect_attempted')) {
    console.warn('[AuthAPI] Login redirect already attempted this session');
    return;
  }

  console.log('[AuthAPI] Redirecting to login...');
  sessionStorage.setItem('auth_redirect_attempted', 'true');
  
  // Clear auth state
  localStorage.removeItem('auth-kr-storage');
  localStorage.removeItem('auth-world-storage');
  localStorage.removeItem('firebase_token_cache');
  
  // Redirect
  window.location.href = '/login';
}

/**
 * Clear redirect flag (call after successful login)
 */
export function clearRedirectFlag() {
  sessionStorage.removeItem('auth_redirect_attempted');
}
