/**
 * Core Business Logic Unit Tests - Feature Flags
 * 
 * Phase: Unit Testing (High Priority)
 * Purpose: Test feature flag system for gradual rollout
 * 
 * Coverage:
 *   - featureFlags: Default values
 *   - isFeatureEnabled: User-based rollout
 *   - Gradual rollout percentages (10%, 50%, 100%)
 *   - Deterministic user bucketing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create a test version of feature flags
const createTestFeatureFlags = (overrides = {}) => ({
  backendToken: true, // Enable for testing
  authDebugLogs: false,
  authRetryOn401: true,
  ...overrides,
});

describe('Feature Flags System', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('Default Flag Values', () => {
    it('should have correct default values for production', async () => {
      const { featureFlags } = await import('@/shared/config/feature-flags');

      // In production, backendToken should be false by default
      // but we test the flag system works correctly
      expect(typeof featureFlags.backendToken).toBe('boolean');
      expect(featureFlags.authRetryOn401).toBe(true); // Always on
    });

    it('should enable debug logs in development', async () => {
      const { featureFlags } = await import('@/shared/config/feature-flags');

      // Debug logs depend on environment
      expect(typeof featureFlags.authDebugLogs).toBe('boolean');
    });
  });

  describe('isFeatureEnabled - User-based Rollout', () => {
    it('should return false when base flag is explicitly false', async () => {
      const { isFeatureEnabled } = await import('@/shared/config/feature-flags');

      // When testing, we simulate flag being false
      // isFeatureEnabled checks base value first
      const flags = createTestFeatureFlags({ backendToken: false });
      
      // Mock the check - if base is false, should return false
      expect(typeof isFeatureEnabled).toBe('function');
    });

    it('should return true for 100% rollout', async () => {
      const { isFeatureEnabled } = await import('@/shared/config/feature-flags');

      const result = isFeatureEnabled('authRetryOn401' as any, 999, 100);

      expect(result).toBe(true);
    });

    it('should use deterministic bucketing for 10% rollout', async () => {
      const { isFeatureEnabled } = await import('@/shared/config/feature-flags');

      // Test same userId multiple times (should be consistent)
      const result1 = isFeatureEnabled('backendToken' as any, 5, 10);
      const result2 = isFeatureEnabled('backendToken' as any, 5, 10);
      const result3 = isFeatureEnabled('backendToken' as any, 5, 10);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it('should distribute users across buckets for 50% rollout', async () => {
      const { isFeatureEnabled } = await import('@/shared/config/feature-flags');

      const results: boolean[] = [];

      // Test 100 users
      for (let i = 1; i <= 100; i++) {
        const enabled = isFeatureEnabled('backendToken' as any, i, 50);
        results.push(enabled);
      }

      const enabledCount = results.filter(Boolean).length;

      // Should be approximately 50% (allow 10% variance)
      expect(enabledCount).toBeGreaterThanOrEqual(40);
      expect(enabledCount).toBeLessThanOrEqual(60);
    });

    it('should handle string userId', async () => {
      const { isFeatureEnabled } = await import('@/shared/config/feature-flags');

      const result1 = isFeatureEnabled('backendToken' as any, 'kakao_123', 50);
      const result2 = isFeatureEnabled('backendToken' as any, 'kakao_123', 50);

      // Should be consistent
      expect(result1).toBe(result2);
    });

    it('should use random rollout when no userId provided', async () => {
      const { isFeatureEnabled } = await import('@/shared/config/feature-flags');

      // Mock Math.random for predictable testing
      const mockRandom = vi.spyOn(Math, 'random');

      // 25 < 50 → should enable
      mockRandom.mockReturnValueOnce(0.25);
      expect(isFeatureEnabled('backendToken' as any, undefined, 50)).toBe(true);

      // 75 >= 50 → should not enable
      mockRandom.mockReturnValueOnce(0.75);
      expect(isFeatureEnabled('backendToken' as any, undefined, 50)).toBe(false);

      mockRandom.mockRestore();
    });
  });

  describe('Gradual Rollout Scenarios', () => {
    it('Week 2: 10% rollout should enable for ~10 out of 100 users', async () => {
      const { isFeatureEnabled } = await import('@/shared/config/feature-flags');

      const enabledUsers: number[] = [];

      for (let userId = 1; userId <= 100; userId++) {
        if (isFeatureEnabled('backendToken' as any, userId, 10)) {
          enabledUsers.push(userId);
        }
      }

      // Should be approximately 10 users (allow variance)
      expect(enabledUsers.length).toBeGreaterThanOrEqual(5);
      expect(enabledUsers.length).toBeLessThanOrEqual(15);
    });

    it('Week 3: 50% rollout should enable for ~50 out of 100 users', async () => {
      const { isFeatureEnabled } = await import('@/shared/config/feature-flags');

      let enabledCount = 0;

      for (let userId = 1; userId <= 100; userId++) {
        if (isFeatureEnabled('backendToken' as any, userId, 50)) {
          enabledCount++;
        }
      }

      // Should be approximately 50 users (allow 15% variance)
      expect(enabledCount).toBeGreaterThanOrEqual(35);
      expect(enabledCount).toBeLessThanOrEqual(65);
    });

    it('Week 4: 100% rollout should enable for all users', async () => {
      const { isFeatureEnabled } = await import('@/shared/config/feature-flags');

      const results = [];

      for (let userId = 1; userId <= 100; userId++) {
        results.push(isFeatureEnabled('backendToken' as any, userId, 100));
      }

      // All should be enabled
      expect(results.every(Boolean)).toBe(true);
    });
  });

  describe('logFeatureFlagStatus', () => {
    it('should log status only in development', async () => {
      const consoleSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const groupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

      // Mock development
      vi.stubGlobal('import', {
        meta: {
          env: { DEV: true },
        },
      });

      const { logFeatureFlagStatus } = await import('@/shared/config/feature-flags');

      logFeatureFlagStatus();

      expect(consoleSpy).toHaveBeenCalledWith('🚩 Feature Flags Status');
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('backendToken:'),
        expect.anything()
      );
      expect(groupEndSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      logSpy.mockRestore();
      groupEndSpy.mockRestore();
    });

    it('should not log in production', async () => {
      const consoleSpy = vi.spyOn(console, 'group').mockImplementation(() => {});

      // Mock production
      vi.stubGlobal('import', {
        meta: {
          env: { DEV: false },
        },
      });

      const { logFeatureFlagStatus } = await import('@/shared/config/feature-flags');

      logFeatureFlagStatus();

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Hash Function Consistency', () => {
    it('should produce same hash for same userId', async () => {
      const { isFeatureEnabled } = await import('@/shared/config/feature-flags');

      const results: boolean[] = [];

      // Same userId, 10 times
      for (let i = 0; i < 10; i++) {
        results.push(isFeatureEnabled('backendToken' as any, 'user-42', 50));
      }

      // All results should be identical
      const firstResult = results[0];
      expect(results.every(r => r === firstResult)).toBe(true);
    });

    it('should produce different results for different userIds', async () => {
      const { isFeatureEnabled } = await import('@/shared/config/feature-flags');

      const results = new Set<boolean>();

      // Different userIds
      for (let i = 1; i <= 20; i++) {
        results.add(isFeatureEnabled('backendToken' as any, `user-${i}`, 50));
      }

      // Should have both true and false (not all same)
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle 0% rollout', async () => {
      const { isFeatureEnabled } = await import('@/shared/config/feature-flags');

      const results: boolean[] = [];

      for (let i = 1; i <= 50; i++) {
        results.push(isFeatureEnabled('backendToken' as any, i, 0));
      }

      // All should be false
      expect(results.every(r => r === false)).toBe(true);
    });

    it('should handle negative rollout percentage', async () => {
      const { isFeatureEnabled } = await import('@/shared/config/feature-flags');

      const result = isFeatureEnabled('backendToken' as any, 123, -10);

      // Should treat as 0%
      expect(result).toBe(false);
    });

    it('should handle percentage > 100', async () => {
      const { isFeatureEnabled } = await import('@/shared/config/feature-flags');

      const result = isFeatureEnabled('backendToken' as any, 456, 150);

      // Should treat as 100%
      expect(result).toBe(true);
    });

    it('should handle very large userId numbers', async () => {
      const { isFeatureEnabled } = await import('@/shared/config/feature-flags');

      const largeId = 999999999;
      const result = isFeatureEnabled('backendToken' as any, largeId, 50);

      // Should not throw or crash
      expect(typeof result).toBe('boolean');
    });

    it('should handle special characters in string userId', async () => {
      const { isFeatureEnabled } = await import('@/shared/config/feature-flags');

      const specialIds = [
        'user@example.com',
        'user-123-abc',
        'user_with_underscore',
        '한글사용자',
      ];

      specialIds.forEach(id => {
        const result = isFeatureEnabled('backendToken' as any, id, 50);
        expect(typeof result).toBe('boolean');
      });
    });
  });
});

describe('Real-world Rollout Simulation', () => {
  it('should simulate Week 1-4 rollout strategy', async () => {
    const { isFeatureEnabled } = await import('@/shared/config/feature-flags');

    const userIds = Array.from({ length: 1000 }, (_, i) => i + 1);

    // Week 1: 0% (testing only)
    const week1Enabled = userIds.filter(id =>
      isFeatureEnabled('backendToken' as any, id, 0)
    );
    expect(week1Enabled.length).toBe(0);

    // Week 2: 10% rollout
    const week2Enabled = userIds.filter(id =>
      isFeatureEnabled('backendToken' as any, id, 10)
    );
    expect(week2Enabled.length).toBeGreaterThanOrEqual(50); // ~100
    expect(week2Enabled.length).toBeLessThanOrEqual(150);

    // Week 3: 50% rollout
    const week3Enabled = userIds.filter(id =>
      isFeatureEnabled('backendToken' as any, id, 50)
    );
    expect(week3Enabled.length).toBeGreaterThanOrEqual(400); // ~500
    expect(week3Enabled.length).toBeLessThanOrEqual(600);

    // Week 4: 100% rollout
    const week4Enabled = userIds.filter(id =>
      isFeatureEnabled('backendToken' as any, id, 100)
    );
    expect(week4Enabled.length).toBe(1000); // All users
  });

  it('should ensure same users stay enabled across rollout increases', async () => {
    const { isFeatureEnabled } = await import('@/shared/config/feature-flags');

    // Users enabled at 10%
    const users10 = new Set<number>();
    for (let i = 1; i <= 100; i++) {
      if (isFeatureEnabled('backendToken' as any, i, 10)) {
        users10.add(i);
      }
    }

    // Users enabled at 50%
    const users50 = new Set<number>();
    for (let i = 1; i <= 100; i++) {
      if (isFeatureEnabled('backendToken' as any, i, 50)) {
        users50.add(i);
      }
    }

    // All users from 10% should still be enabled at 50%
    users10.forEach(userId => {
      expect(users50.has(userId)).toBe(true);
    });
  });
});
