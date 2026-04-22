/**
 * Core Business Logic Unit Tests - Auth API Utils
 * 
 * Phase: Unit Testing (High Priority)
 * Purpose: Test infinite loop prevention, token management, and API request handling
 * 
 * Coverage:
 *   - getIdTokenFromBackend: Backend token fetching with retry logic
 *   - authFetch: Authenticated API requests with 401 handling
 *   - Request deduplication
 *   - Max retry limits
 *   - One-time redirect
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock feature flags
vi.mock('@/shared/config/feature-flags', () => ({
  featureFlags: {
    backendToken: true,
    authDebugLogs: false,
    authRetryOn401: true,
  },
  isFeatureEnabled: vi.fn(() => true),
}));

// Mock auth store
const mockAuthStore = {
  getState: vi.fn(() => ({
    accessToken: 'mock-access-token-12345',
    user: { id: 1, email: 'test@example.com', name: 'Test User', role: 'user' },
    setAuth: vi.fn(),
  })),
};

vi.mock('@/client/stores/auth.store', () => ({
  useAuthStore: mockAuthStore,
}));

// Mock useAuthKR
const mockAuthKR = {
  getState: vi.fn(() => ({
    getIdToken: vi.fn(async () => 'refreshed-token-67890'),
  })),
};

vi.mock('@/shared/stores/useAuthKR', () => ({
  useAuthKR: mockAuthKR,
}));

describe('Auth API Utils - Infinite Loop Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules(); // fresh module state (clears retryTracker, requestTracker)
    vi.useFakeTimers();

    // Clear session storage
    sessionStorage.clear();

    // Reset fetch mock
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getIdTokenFromBackend', () => {
    it('should successfully fetch token from backend', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            token: 'backend-token-abc123',
            expiresAt: Date.now() + 3300000, // 55 minutes
          },
        }),
      };

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      // Dynamically import to use mocked modules
      const { getIdTokenFromBackend } = await import('@/shared/utils/auth-api');
      
      const token = await getIdTokenFromBackend('kakao_1234567890', false);

      expect(token).toBe('backend-token-abc123');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/id-token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: 'kakao_1234567890', forceRefresh: false }),
        })
      );
    });

    it('should prevent duplicate requests within 5 seconds', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: true,
          data: { token: 'token-1', expiresAt: Date.now() + 3300000 },
        }),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const { getIdTokenFromBackend } = await import('@/shared/utils/auth-api');

      // First request
      const token1 = await getIdTokenFromBackend('uid-123', false);
      expect(token1).toBe('token-1');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second request within 5 seconds (should be blocked)
      const token2 = await getIdTokenFromBackend('uid-123', false);
      expect(token2).toBeNull(); // Blocked
      expect(global.fetch).toHaveBeenCalledTimes(1); // No new fetch
    });

    it('should enforce max 1 retry on server error', async () => {
      // First call: 500 error
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      // Retry call: 500 error again
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { getIdTokenFromBackend } = await import('@/shared/utils/auth-api');

      // Advance past the 2s retry delay + 5s cleanup timers
      const tokenPromise = getIdTokenFromBackend('uid-456', false);
      await vi.advanceTimersByTimeAsync(7500);
      const token = await tokenPromise;

      expect(token).toBeNull();
      // Should be called twice: initial + 1 retry
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 401/404 errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const { getIdTokenFromBackend } = await import('@/shared/utils/auth-api');

      const token = await getIdTokenFromBackend('uid-789', false);

      expect(token).toBeNull();
      expect(global.fetch).toHaveBeenCalledTimes(1); // No retry
    });

    it('should timeout after 10 seconds', async () => {
      // Mock a slow response that respects AbortSignal
      (global.fetch as any).mockImplementation((_url: string, options?: RequestInit) =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve({
            ok: true,
            json: async () => ({ success: true, data: { token: 'slow-token' } }),
          }), 15000); // 15 seconds
          options?.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('The user aborted a request.', 'AbortError'));
          });
        })
      );

      const { getIdTokenFromBackend } = await import('@/shared/utils/auth-api');

      const tokenPromise = getIdTokenFromBackend('uid-slow', false);

      // Advance timers to trigger the 10s abort timeout, then flush microtasks
      await vi.advanceTimersByTimeAsync(10001);

      const token = await tokenPromise;

      // Should abort and return null
      expect(token).toBeNull();
    });
  });

  describe('authFetch', () => {
    it('should make authenticated request with token', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ items: ['item1', 'item2'], total: 2 }),
      };

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      const { authFetch } = await import('@/shared/utils/auth-api');

      const data = await authFetch('/api/cart');

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/cart',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-access-token-12345',
          }),
        })
      );

      expect(data).toEqual({ items: ['item1', 'item2'], total: 2 });
    });

    it('should retry once on 401 with token refresh', async () => {
      // First call: 401 error
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      // Retry call: Success
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const { authFetch } = await import('@/shared/utils/auth-api');

      // Advance past the 2s retry delay + 5s cleanup timers
      const dataPromise = authFetch('/api/cart');
      await vi.advanceTimersByTimeAsync(7500);
      const data = await dataPromise;

      expect(global.fetch).toHaveBeenCalledTimes(2);
      // getIdToken is called inside authFetch during 401 retry
      expect(mockAuthKR.getState).toHaveBeenCalled();
      expect(data).toEqual({ success: true });
    });

    it('should enforce max 1 retry limit', async () => {
      // Both calls: 401 error
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
      });

      const { authFetch } = await import('@/shared/utils/auth-api');

      // pre-attach .catch() to avoid unhandled-rejection while timers advance
      const settled = authFetch('/api/orders').then(
        (v) => ({ ok: true as const, v }),
        (err: Error) => ({ ok: false as const, err })
      );
      await vi.advanceTimersByTimeAsync(7500);
      const result = await settled;
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.err.message).toBe('MAX_RETRIES_EXCEEDED');
      }

      // Should be called twice: initial + 1 retry
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should redirect to login only once per session', async () => {
      // Mock 401 error and failed token refresh
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
      });

      mockAuthKR.getState = vi.fn(() => ({
        getIdToken: vi.fn(async () => null), // Refresh fails
      }));

      const { authFetch, redirectToLogin } = await import('@/shared/utils/auth-api');

      // Mock window.location
      delete (window as any).location;
      (window as any).location = { href: '' };

      try {
        await authFetch('/api/profile');
      } catch (err) {
        // Expected error
      }

      // Check redirect flag
      expect(sessionStorage.getItem('auth_redirect_attempted')).toBe('true');

      // Try redirecting again (should be blocked)
      redirectToLogin();

      // Should still be set (no duplicate redirect)
      expect(sessionStorage.getItem('auth_redirect_attempted')).toBe('true');
    });

    it('should throw error when no access token', async () => {
      mockAuthStore.getState = vi.fn(() => ({
        accessToken: null, // No token
        user: null,
      }));

      const { authFetch } = await import('@/shared/utils/auth-api');

      await expect(authFetch('/api/cart')).rejects.toThrow('NOT_AUTHENTICATED');

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup and Memory Management', () => {
    it('should cleanup old tracker entries after 1 minute', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ success: true, data: { token: 'token-cleanup' } }),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const { getIdTokenFromBackend } = await import('@/shared/utils/auth-api');

      // Make first request
      await getIdTokenFromBackend('uid-cleanup', false);

      // Advance time by 61 seconds
      vi.advanceTimersByTime(61000);

      // Make second request (should not be blocked because cleanup happened)
      await getIdTokenFromBackend('uid-cleanup', false);

      // Should be called twice (no duplicate block)
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle network errors gracefully', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const { getIdTokenFromBackend } = await import('@/shared/utils/auth-api');

      const token = await getIdTokenFromBackend('uid-network-error', false);

      expect(token).toBeNull();
    });

    it('should handle malformed JSON response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      const { authFetch } = await import('@/shared/utils/auth-api');

      await expect(authFetch('/api/invalid')).rejects.toThrow();
    });

    it('should clear redirect flag on clearRedirectFlag', async () => {
      sessionStorage.setItem('auth_redirect_attempted', 'true');

      const { clearRedirectFlag } = await import('@/shared/utils/auth-api');

      clearRedirectFlag();

      expect(sessionStorage.getItem('auth_redirect_attempted')).toBeNull();
    });
  });
});

describe('Integration: Full Auth Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules(); // fresh module state (clears retryTracker, requestTracker)
    sessionStorage.clear();
    global.fetch = vi.fn();
    // Restore mocks that may have been mutated by previous tests
    mockAuthStore.getState = vi.fn(() => ({
      accessToken: 'mock-access-token-12345',
      user: { id: 1, email: 'test@example.com', name: 'Test User', role: 'user' },
      setAuth: vi.fn(),
    }));
    mockAuthKR.getState = vi.fn(() => ({
      getIdToken: vi.fn(async () => 'refreshed-token-67890'),
    }));
  });

  it('should handle complete login → API call → 401 → refresh → retry flow', async () => {
    // Step 1: Backend token fetch (login)
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { token: 'initial-token', expiresAt: Date.now() + 3300000 },
      }),
    });

    const { getIdTokenFromBackend } = await import('@/shared/utils/auth-api');
    const token = await getIdTokenFromBackend('user-integration', false);
    expect(token).toBe('initial-token');

    // Step 2: API call with token
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ cart: { items: [] } }),
    });

    const { authFetch } = await import('@/shared/utils/auth-api');
    const cartData = await authFetch('/api/cart');
    expect(cartData).toEqual({ cart: { items: [] } });

    // Step 3: 401 error → token refresh
    (global.fetch as any).mockResolvedValueOnce({ ok: false, status: 401 });

    // Step 4: Retry with refreshed token
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ orders: [] }),
    });

    const ordersData = await authFetch('/api/orders');
    expect(ordersData).toEqual({ orders: [] });

    // Verify token refresh path was taken (getState called during 401 retry)
    expect(mockAuthKR.getState).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(4); // id-token + cart + orders(401) + orders(retry)
  });
});
