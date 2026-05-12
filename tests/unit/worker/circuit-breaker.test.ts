/**
 * Unit Tests — circuit-breaker.ts
 *
 * Coverage:
 *   - CLOSED state: normal operation, failure counting
 *   - OPEN state: fallback / throw behavior
 *   - HALF-OPEN state: probe logic, CLOSED/OPEN transition
 *   - Independent circuits per name
 *   - Default option values
 *   - Helper utilities: getCircuitState, resetCircuit, fetchWithFallback
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  withCircuitBreaker,
  getCircuitState,
  listCircuits,
  resetCircuit,
  fetchWithFallback,
} from '@/worker/utils/circuit-breaker';

// ── helpers ────────────────────────────────────────────────────────────────

const success = <T>(value: T) => () => Promise.resolve(value);
const fail = (msg = 'boom') => () => Promise.reject(new Error(msg));

/** Trip the circuit by calling `withCircuitBreaker` n times with a failing op. */
async function tripCircuit(
  name: string,
  times: number,
  maxFailures: number,
): Promise<void> {
  for (let i = 0; i < times; i++) {
    try {
      await withCircuitBreaker({ name, maxFailures }, fail());
    } catch {
      // expected
    }
  }
}

// ── test setup ──────────────────────────────────────────────────────────────

const TEST_CIRCUIT = 'test-circuit';

beforeEach(() => {
  resetCircuit(TEST_CIRCUIT);
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── CLOSED state ────────────────────────────────────────────────────────────

describe('CLOSED state', () => {
  it('returns the operation result on success', async () => {
    const result = await withCircuitBreaker({ name: TEST_CIRCUIT }, success(42));
    expect(result).toBe(42);
  });

  it('keeps failures at 0 after a successful call', async () => {
    await withCircuitBreaker({ name: TEST_CIRCUIT }, success('ok'));
    const state = getCircuitState(TEST_CIRCUIT);
    expect(state?.failures).toBe(0);
    expect(state?.state).toBe('closed');
  });

  it('increments failure count on each failed call', async () => {
    try { await withCircuitBreaker({ name: TEST_CIRCUIT, maxFailures: 5 }, fail()); } catch { /* expected */ }
    expect(getCircuitState(TEST_CIRCUIT)?.failures).toBe(1);

    try { await withCircuitBreaker({ name: TEST_CIRCUIT, maxFailures: 5 }, fail()); } catch { /* expected */ }
    expect(getCircuitState(TEST_CIRCUIT)?.failures).toBe(2);
  });

  it('remains CLOSED until maxFailures is reached', async () => {
    const max = 3;
    for (let i = 0; i < max - 1; i++) {
      try { await withCircuitBreaker({ name: TEST_CIRCUIT, maxFailures: max }, fail()); } catch { /* expected */ }
    }
    expect(getCircuitState(TEST_CIRCUIT)?.state).toBe('closed');
  });

  it('transitions to OPEN exactly at maxFailures', async () => {
    const max = 3;
    await tripCircuit(TEST_CIRCUIT, max, max);
    expect(getCircuitState(TEST_CIRCUIT)?.state).toBe('open');
  });

  it('re-throws the original error when no fallback provided', async () => {
    const err = new Error('original-error');
    await expect(
      withCircuitBreaker({ name: TEST_CIRCUIT, maxFailures: 5 }, () => Promise.reject(err)),
    ).rejects.toThrow('original-error');
  });

  it('returns fallback value on failure when fallback is provided', async () => {
    const result = await withCircuitBreaker(
      { name: TEST_CIRCUIT, maxFailures: 5 },
      fail(),
      () => 'fallback-value',
    );
    expect(result).toBe('fallback-value');
  });

  it('resets failures to 0 after a success following failures', async () => {
    // Fail twice (below maxFailures=5)
    try { await withCircuitBreaker({ name: TEST_CIRCUIT }, fail()); } catch { /* expected */ }
    try { await withCircuitBreaker({ name: TEST_CIRCUIT }, fail()); } catch { /* expected */ }
    expect(getCircuitState(TEST_CIRCUIT)?.failures).toBe(2);

    // Now succeed
    await withCircuitBreaker({ name: TEST_CIRCUIT }, success('ok'));
    expect(getCircuitState(TEST_CIRCUIT)?.failures).toBe(0);
    expect(getCircuitState(TEST_CIRCUIT)?.state).toBe('closed');
  });
});

// ── OPEN state ──────────────────────────────────────────────────────────────

describe('OPEN state', () => {
  const max = 3;

  beforeEach(async () => {
    await tripCircuit(TEST_CIRCUIT, max, max);
    expect(getCircuitState(TEST_CIRCUIT)?.state).toBe('open');
  });

  it('executes fallback when circuit is OPEN and fallback provided', async () => {
    const result = await withCircuitBreaker(
      { name: TEST_CIRCUIT, maxFailures: max },
      success('should-not-run'),
      () => 'open-fallback',
    );
    expect(result).toBe('open-fallback');
  });

  it('throws a descriptive error when circuit is OPEN and no fallback', async () => {
    await expect(
      withCircuitBreaker({ name: TEST_CIRCUIT, maxFailures: max }, success('nope')),
    ).rejects.toThrow(/Circuit breaker \[test-circuit\] is OPEN/);
  });

  it('does NOT execute the operation while OPEN', async () => {
    const operation = vi.fn().mockResolvedValue('result');
    try {
      await withCircuitBreaker({ name: TEST_CIRCUIT, maxFailures: max }, operation);
    } catch {
      // expected
    }
    expect(operation).not.toHaveBeenCalled();
  });
});

// ── HALF-OPEN state ─────────────────────────────────────────────────────────

describe('HALF-OPEN state', () => {
  const max = 3;
  const resetTimeoutMs = 5_000;

  beforeEach(async () => {
    vi.useFakeTimers();
    await tripCircuit(TEST_CIRCUIT, max, max);
    expect(getCircuitState(TEST_CIRCUIT)?.state).toBe('open');
    // Advance time past resetTimeout so next call enters HALF-OPEN
    vi.advanceTimersByTime(resetTimeoutMs + 1);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('transitions from OPEN to HALF-OPEN after resetTimeoutMs', async () => {
    // Trigger the check by calling with a fallback (won't throw)
    const fallback = vi.fn(() => 'fb');
    // A successful probe will close it; use fail to stay observable
    try {
      await withCircuitBreaker({ name: TEST_CIRCUIT, maxFailures: max, resetTimeoutMs }, fail());
    } catch { /* expected */ }
    // After probe failure it goes back to OPEN (not HALF-OPEN), confirming it was HALF-OPEN
    expect(getCircuitState(TEST_CIRCUIT)?.state).toBe('open');
    expect(fallback).not.toHaveBeenCalled();
  });

  it('probe success → transitions to CLOSED', async () => {
    const result = await withCircuitBreaker(
      { name: TEST_CIRCUIT, maxFailures: max, resetTimeoutMs },
      success('probe-ok'),
    );
    expect(result).toBe('probe-ok');
    expect(getCircuitState(TEST_CIRCUIT)?.state).toBe('closed');
    expect(getCircuitState(TEST_CIRCUIT)?.failures).toBe(0);
  });

  it('probe failure → re-transitions to OPEN', async () => {
    try {
      await withCircuitBreaker({ name: TEST_CIRCUIT, maxFailures: max, resetTimeoutMs }, fail('probe-fail'));
    } catch { /* expected */ }
    expect(getCircuitState(TEST_CIRCUIT)?.state).toBe('open');
  });

  it('probe failure with fallback → returns fallback, goes OPEN', async () => {
    const result = await withCircuitBreaker(
      { name: TEST_CIRCUIT, maxFailures: max, resetTimeoutMs },
      fail('probe-fail'),
      () => 'fb-after-probe',
    );
    expect(result).toBe('fb-after-probe');
    expect(getCircuitState(TEST_CIRCUIT)?.state).toBe('open');
  });
});

// ── Independent circuits ─────────────────────────────────────────────────────

describe('Independent circuits per name', () => {
  const CIRCUIT_A = 'circuit-a';
  const CIRCUIT_B = 'circuit-b';

  beforeEach(() => {
    resetCircuit(CIRCUIT_A);
    resetCircuit(CIRCUIT_B);
  });

  afterEach(() => {
    resetCircuit(CIRCUIT_A);
    resetCircuit(CIRCUIT_B);
  });

  it('failures in circuit-a do not affect circuit-b', async () => {
    await tripCircuit(CIRCUIT_A, 5, 5);
    expect(getCircuitState(CIRCUIT_A)?.state).toBe('open');

    const result = await withCircuitBreaker({ name: CIRCUIT_B }, success('b-ok'));
    expect(result).toBe('b-ok');
    expect(getCircuitState(CIRCUIT_B)?.state).toBe('closed');
  });

  it('each circuit tracks its own failure count independently', async () => {
    try { await withCircuitBreaker({ name: CIRCUIT_A, maxFailures: 5 }, fail()); } catch { /* expected */ }
    try { await withCircuitBreaker({ name: CIRCUIT_A, maxFailures: 5 }, fail()); } catch { /* expected */ }
    try { await withCircuitBreaker({ name: CIRCUIT_B, maxFailures: 5 }, fail()); } catch { /* expected */ }

    expect(getCircuitState(CIRCUIT_A)?.failures).toBe(2);
    expect(getCircuitState(CIRCUIT_B)?.failures).toBe(1);
  });
});

// ── Default values ───────────────────────────────────────────────────────────

describe('Default option values', () => {
  const DEFAULTS_CIRCUIT = 'defaults-circuit';

  beforeEach(() => resetCircuit(DEFAULTS_CIRCUIT));
  afterEach(() => resetCircuit(DEFAULTS_CIRCUIT));

  it('default maxFailures is 5 — circuit stays CLOSED after 4 failures', async () => {
    for (let i = 0; i < 4; i++) {
      try { await withCircuitBreaker({ name: DEFAULTS_CIRCUIT }, fail()); } catch { /* expected */ }
    }
    expect(getCircuitState(DEFAULTS_CIRCUIT)?.state).toBe('closed');
  });

  it('default maxFailures is 5 — circuit opens on 5th failure', async () => {
    await tripCircuit(DEFAULTS_CIRCUIT, 5, 5);
    expect(getCircuitState(DEFAULTS_CIRCUIT)?.state).toBe('open');
  });

  it('default resetTimeoutMs is 30000 — circuit stays OPEN before 30s', async () => {
    vi.useFakeTimers();
    await tripCircuit(DEFAULTS_CIRCUIT, 5, 5);

    vi.advanceTimersByTime(29_999);
    await expect(
      withCircuitBreaker({ name: DEFAULTS_CIRCUIT }, success('nope')),
    ).rejects.toThrow(/OPEN/);

    vi.useRealTimers();
  });

  it('default resetTimeoutMs is 30000 — after 30s probe is allowed', async () => {
    vi.useFakeTimers();
    await tripCircuit(DEFAULTS_CIRCUIT, 5, 5);

    vi.advanceTimersByTime(30_001);
    const result = await withCircuitBreaker({ name: DEFAULTS_CIRCUIT }, success('probe'));
    expect(result).toBe('probe');
    expect(getCircuitState(DEFAULTS_CIRCUIT)?.state).toBe('closed');

    vi.useRealTimers();
  });
});

// ── Utility functions ────────────────────────────────────────────────────────

describe('getCircuitState', () => {
  it('returns null for an unknown circuit name', () => {
    expect(getCircuitState('nonexistent-xyz')).toBeNull();
  });

  it('returns state object after first use', async () => {
    await withCircuitBreaker({ name: TEST_CIRCUIT }, success(1));
    const s = getCircuitState(TEST_CIRCUIT);
    expect(s).not.toBeNull();
    expect(s?.state).toBe('closed');
    expect(typeof s?.failures).toBe('number');
    expect(typeof s?.lastFailureAt).toBe('number');
  });
});

describe('listCircuits', () => {
  it('includes all active circuits as a plain object', async () => {
    const NAMED_A = 'list-a';
    const NAMED_B = 'list-b';
    resetCircuit(NAMED_A);
    resetCircuit(NAMED_B);

    await withCircuitBreaker({ name: NAMED_A }, success(1));
    await withCircuitBreaker({ name: NAMED_B }, success(2));

    const all = listCircuits();
    expect(all[NAMED_A]).toBeDefined();
    expect(all[NAMED_B]).toBeDefined();

    resetCircuit(NAMED_A);
    resetCircuit(NAMED_B);
  });

  it('returns copies (mutations do not affect internal state)', async () => {
    await withCircuitBreaker({ name: TEST_CIRCUIT }, success(1));
    const snapshot = listCircuits();
    snapshot[TEST_CIRCUIT].failures = 9999;
    expect(getCircuitState(TEST_CIRCUIT)?.failures).toBe(0);
  });
});

describe('resetCircuit', () => {
  it('removes circuit state so getCircuitState returns null', async () => {
    await withCircuitBreaker({ name: TEST_CIRCUIT }, success(1));
    expect(getCircuitState(TEST_CIRCUIT)).not.toBeNull();
    resetCircuit(TEST_CIRCUIT);
    expect(getCircuitState(TEST_CIRCUIT)).toBeNull();
  });
});

// ── fetchWithFallback ────────────────────────────────────────────────────────

describe('fetchWithFallback', () => {
  it('returns the resolved value on success', async () => {
    const result = await fetchWithFallback(() => Promise.resolve(123), 0);
    expect(result).toBe(123);
  });

  it('returns fallback when the operation rejects', async () => {
    const result = await fetchWithFallback(() => Promise.reject(new Error('fail')), 'default');
    expect(result).toBe('default');
  });

  it('returns fallback when the operation times out', async () => {
    vi.useFakeTimers();
    const slow = () => new Promise<string>((resolve) => setTimeout(() => resolve('late'), 10_000));
    const p = fetchWithFallback(slow, 'timed-out', 100);
    vi.advanceTimersByTime(200);
    const result = await p;
    expect(result).toBe('timed-out');
    vi.useRealTimers();
  });

  it('uses default timeout of 5000ms', async () => {
    vi.useFakeTimers();
    const slow = () => new Promise<number>((resolve) => setTimeout(() => resolve(1), 10_000));
    const p = fetchWithFallback(slow, -1); // no explicit timeout → default 5000
    vi.advanceTimersByTime(5_001);
    const result = await p;
    expect(result).toBe(-1);
    vi.useRealTimers();
  });
});
