/**
 * Auth Token API Client
 * 
 * Purpose: Client-side helper for backend ID token endpoint
 * Feature: Phase 2.3 - Backend ID Token (with Feature Flag)
 */

import { featureFlags } from '@/config/feature-flags';
import { useAuthKR } from '@/shared/stores/useAuthKR';
import type { ApiResponse } from '@/shared/types/common';

interface TokenResponse {
  token: string;
  expiresAt: number;
  user: {
    id: number;
    email: string;
    name: string | null;
    userType: string;
  };
}

interface TokenInfoResponse {
  valid: boolean;
  userId: number;
  email: string;
  name: string | null;
  userType: string;
  expiresIn: number;
  expiresAt: number;
}

/**
 * Get ID Token - Smart routing based on feature flag
 * 
 * If featureFlags.backendToken = true:
 *   → Use backend endpoint /api/auth/id-token
 * 
 * If featureFlags.backendToken = false (default):
 *   → Use client-side Firebase getIdToken() (existing behavior)
 * 
 * This allows gradual rollout and easy rollback
 */
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  try {
    // Feature Flag: Use backend token endpoint?
    if (featureFlags.backendToken) {
      return await getTokenFromBackend(forceRefresh);
    }

    // Default: Use client-side Firebase token (Phase 2.2 implementation)
    return await useAuthKR.getState().getIdToken(forceRefresh);

  } catch (err) {
    console.error('[AuthToken] Error getting ID token:', err);
    return null;
  }
}

/**
 * Get token from backend endpoint
 * 
 * POST /api/auth/id-token
 * Body: { uid: "kakao_...", forceRefresh: false }
 */
async function getTokenFromBackend(forceRefresh = false): Promise<string | null> {
  try {
    const { user } = useAuthKR.getState();
    
    if (!user) {
      if (import.meta.env.DEV) console.warn('[AuthToken] No user logged in');
      return null;
    }

    const uid = user.uid;

    // Make API call to backend
    const response = await fetch('/api/auth/id-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uid, forceRefresh }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[AuthToken] Backend token request failed:', errorData);
      
      // Fallback to client-side token on error
      if (import.meta.env.DEV) console.warn('[AuthToken] Falling back to client-side token');
      return await useAuthKR.getState().getIdToken(forceRefresh);
    }

    const data: ApiResponse<TokenResponse> = await response.json();

    if (!data.success || !data.data) {
      console.error('[AuthToken] Backend returned error:', data.error);
      // Fallback
      return await useAuthKR.getState().getIdToken(forceRefresh);
    }

    // Update cache with backend token
    const { setTokenCache } = useAuthKR.getState();
    setTokenCache({
      token: data.data.token,
      expiresAt: data.data.expiresAt,
    });

    return data.data.token;

  } catch (err) {
    console.error('[AuthToken] Backend token request failed:', err);
    // Fallback to client-side
    return await useAuthKR.getState().getIdToken(forceRefresh);
  }
}

/**
 * Get token information (for debugging)
 * 
 * GET /api/auth/token-info
 * Headers: Authorization: Bearer <token>
 */
export async function getTokenInfo(token: string): Promise<TokenInfoResponse | null> {
  try {
    const response = await fetch('/api/auth/token-info', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data: ApiResponse<TokenInfoResponse> = await response.json();
    
    if (!data.success || !data.data) {
      return null;
    }

    return data.data;

  } catch (err) {
    console.error('[AuthToken] Failed to get token info:', err);
    return null;
  }
}

/**
 * DevTools helper: Test backend token endpoint
 * 
 * Usage in Console:
 *   window.__testBackendToken()
 */
if (typeof window !== 'undefined') {
  (window as any).__testBackendToken = async () => {
    const { user } = useAuthKR.getState();
    if (!user) {
      console.error('No user logged in');
      return;
    }

    // Test with feature flag enabled
    const originalFlag = featureFlags.backendToken;
    featureFlags.backendToken = true;

    const token = await getIdToken(true);

    if (token) {
      const info = await getTokenInfo(token);
      if (info) {
        // DevTools test completed successfully
      }
    } else {
      console.error('Failed to get backend token');
    }

    // Restore original flag
    featureFlags.backendToken = originalFlag;
  };
}
