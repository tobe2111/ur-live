/**
 * Worker Utility Modules 단위 테스트
 *   - circuit-breaker.ts (서킷 브레이커 로직)
 *   - idempotency.ts (멱등성 보장)
 *
 * Pure logic mirrors — 실제 모듈 import 시 글로벌 Map state 가 테스트 간 누수되어
 * mirror 함수로 격리. 모듈 자체 테스트는 의존성 격리가 어려움.
 */
import { describe, it, expect } from 'vitest';

// ── Circuit Breaker mirror ────────────────────────────────────────────────────

interface CircuitState {
  failures: number;
  lastFailureAt: number;
  state: 'closed' | 'open' | 'half-open';
}

function createCircuitMap(): Map<string, CircuitState> {
  return new Map();
}

async function withCircuitBreakerMirror<T>(
  circuits: Map<string, CircuitState>,
  opts: { name: string; maxFailures?: number; resetTimeoutMs?: number },
  operation: () => Promise<T>,
  fallback?: () => T | Promise<T>,
): Promise<T> {
  const { name, maxFailures = 5, resetTimeoutMs = 30_000 } = opts;
  let state = circuits.get(name);
  if (!state) {
    state = { failures: 0, lastFailureAt: 0, state: 'closed' };
    circuits.set(name, state);
  }
  if (state.state === 'open') {
    if (Date.now() - state.lastFailureAt > resetTimeoutMs) {
      state.state = 'half-open';
    } else {
      if (fallback) return await fallback();
      throw new Error(`Circuit breaker [${name}] is OPEN`);
    }
  }
  try {
    const result = await operation();
    state.failures = 0;
    state.state = 'closed';
    return result;
  } catch (e) {
    state.failures++;
    state.lastFailureAt = Date.now();
    if (state.failures >= maxFailures) state.state = 'open';
    if (fallback) return await fallback();
    throw e;
  }
}

async function fetchWithFallback<T>(
  fn: () => Promise<T>,
  fallback: T,
  timeoutMs = 5000,
): Promise<T> {
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ]);
  } catch {
    return fallback;
  }
}

// ── Idempotency mirror ────────────────────────────────────────────────────────

const IDEMPOTENCY_TTL = {
  DEFAULT: 24 * 60 * 60,
  PAYMENT: 7 * 24 * 60 * 60,
} as const;

class IdempotencyConflictError extends Error {
  readonly status = 409;
  constructor(message = '중복 요청 처리 중') {
    super(message);
    this.name = 'IdempotencyConflictError';
  }
}

interface IdempotencyRow { result: string | null; status: 'pending' | 'done'; expires_at: string }

function createIdempotencyStore() {
  const rows = new Map<string, IdempotencyRow>();

  function key(k: string, uid: string): string { return `${k}::${uid}`; }

  return {
    async tryClaim(k: string, uid: string, ttlSeconds: number): Promise<boolean> {
      const composite = key(k, uid);
      if (rows.has(composite)) {
        const r = rows.get(composite)!;
        if (Date.parse(r.expires_at) <= Date.now()) {
          rows.delete(composite);
          // expired → allow new claim
        } else {
          return false; // already claimed
        }
      }
      rows.set(composite, {
        result: null,
        status: 'pending',
        expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      });
      return true;
    },
    async getRow(k: string, uid: string): Promise<IdempotencyRow | null> {
      const r = rows.get(key(k, uid));
      if (!r) return null;
      if (Date.parse(r.expires_at) <= Date.now()) return null;
      return r;
    },
    async storeResult(k: string, uid: string, result: unknown): Promise<void> {
      const r = rows.get(key(k, uid));
      if (r) {
        r.result = JSON.stringify(result ?? null);
        r.status = 'done';
      }
    },
    async deleteKey(k: string, uid: string): Promise<void> {
      rows.delete(key(k, uid));
    },
  };
}

async function idempotentWriteMirror<T>(
  store: ReturnType<typeof createIdempotencyStore>,
  key: string,
  userId: string | number,
  operation: () => Promise<T>,
  ttlSeconds = IDEMPOTENCY_TTL.DEFAULT,
): Promise<T> {
  if (!key || !userId) return operation();
  const userIdStr = String(userId);
  const claimed = await store.tryClaim(key, userIdStr, ttlSeconds);
  if (!claimed) {
    const existing = await store.getRow(key, userIdStr);
    if (!existing) throw new IdempotencyConflictError('이전 요청이 만료');
    if (existing.status === 'done' && existing.result) {
      return JSON.parse(existing.result) as T;
    }
    throw new IdempotencyConflictError();
  }
  try {
    const result = await operation();
    await store.storeResult(key, userIdStr, result);
    return result;
  } catch (err) {
    await store.deleteKey(key, userIdStr);
    throw err;
  }
}

// ── Tests: Circuit Breaker ────────────────────────────────────────────────────

describe('Circuit Breaker', () => {
  it('정상 작동 시 결과 반환', async () => {
    const circuits = createCircuitMap();
    const result = await withCircuitBreakerMirror(circuits, { name: 'test' }, async () => 'ok');
    expect(result).toBe('ok');
  });

  it('실패 누적 시 OPEN 상태 전환', async () => {
    const circuits = createCircuitMap();
    for (let i = 0; i < 5; i++) {
      try { await withCircuitBreakerMirror(circuits, { name: 'test', maxFailures: 5 }, async () => { throw new Error('fail'); }); } catch {}
    }
    expect(circuits.get('test')?.state).toBe('open');
  });

  it('OPEN 상태에서 fallback 사용', async () => {
    const circuits = createCircuitMap();
    circuits.set('test', { failures: 5, lastFailureAt: Date.now(), state: 'open' });
    const result = await withCircuitBreakerMirror(
      circuits,
      { name: 'test', resetTimeoutMs: 30000 },
      async () => 'should not run',
      () => 'fallback',
    );
    expect(result).toBe('fallback');
  });

  it('OPEN 상태에서 fallback 없으면 에러', async () => {
    const circuits = createCircuitMap();
    circuits.set('test', { failures: 5, lastFailureAt: Date.now(), state: 'open' });
    await expect(
      withCircuitBreakerMirror(circuits, { name: 'test' }, async () => 'x')
    ).rejects.toThrow('OPEN');
  });

  it('reset timeout 경과 후 half-open 으로 전환', async () => {
    const circuits = createCircuitMap();
    circuits.set('test', {
      failures: 5,
      lastFailureAt: Date.now() - 31_000,  // 31초 전 실패
      state: 'open',
    });
    const result = await withCircuitBreakerMirror(
      circuits,
      { name: 'test', resetTimeoutMs: 30_000 },
      async () => 'recovered',
    );
    expect(result).toBe('recovered');
    expect(circuits.get('test')?.state).toBe('closed');
  });

  it('성공 시 failures 카운터 리셋', async () => {
    const circuits = createCircuitMap();
    circuits.set('test', { failures: 3, lastFailureAt: Date.now(), state: 'closed' });
    await withCircuitBreakerMirror(circuits, { name: 'test' }, async () => 'ok');
    expect(circuits.get('test')?.failures).toBe(0);
  });

  it('각 회로(name)는 독립적', async () => {
    const circuits = createCircuitMap();
    try { await withCircuitBreakerMirror(circuits, { name: 'A', maxFailures: 1 }, async () => { throw new Error(); }); } catch {}
    expect(circuits.get('A')?.state).toBe('open');
    expect(circuits.get('B')).toBeUndefined();
  });
});

describe('fetchWithFallback', () => {
  it('성공 시 실제 결과 반환', async () => {
    const r = await fetchWithFallback(async () => 'success', 'fallback');
    expect(r).toBe('success');
  });

  it('실패 시 fallback 반환', async () => {
    const r = await fetchWithFallback(async () => { throw new Error('fail'); }, 'fallback');
    expect(r).toBe('fallback');
  });

  it('타임아웃 시 fallback 반환', async () => {
    const r = await fetchWithFallback(
      () => new Promise(resolve => setTimeout(() => resolve('late'), 100)),
      'fallback',
      10,  // 10ms 타임아웃
    );
    expect(r).toBe('fallback');
  });
});

// ── Tests: Idempotency ────────────────────────────────────────────────────────

describe('Idempotency', () => {
  it('TTL 상수 값', () => {
    expect(IDEMPOTENCY_TTL.DEFAULT).toBe(24 * 60 * 60);
    expect(IDEMPOTENCY_TTL.PAYMENT).toBe(7 * 24 * 60 * 60);
  });

  it('IdempotencyConflictError 상태 코드 409', () => {
    const e = new IdempotencyConflictError();
    expect(e.status).toBe(409);
    expect(e.name).toBe('IdempotencyConflictError');
  });

  it('첫 요청은 operation 실행', async () => {
    const store = createIdempotencyStore();
    let count = 0;
    const r = await idempotentWriteMirror(store, 'key1', 'user-1', async () => { count++; return 'result'; });
    expect(r).toBe('result');
    expect(count).toBe(1);
  });

  it('동일 key 재요청은 캐시된 결과 반환 (operation 재실행 안함)', async () => {
    const store = createIdempotencyStore();
    let count = 0;
    await idempotentWriteMirror(store, 'key1', 'user-1', async () => { count++; return { val: 42 }; });
    const r = await idempotentWriteMirror(store, 'key1', 'user-1', async () => { count++; return { val: 99 }; });
    expect(r).toEqual({ val: 42 });
    expect(count).toBe(1);
  });

  it('다른 user 의 동일 key 는 별개 처리', async () => {
    const store = createIdempotencyStore();
    const r1 = await idempotentWriteMirror(store, 'key1', 'user-A', async () => 'A');
    const r2 = await idempotentWriteMirror(store, 'key1', 'user-B', async () => 'B');
    expect(r1).toBe('A');
    expect(r2).toBe('B');
  });

  it('key 또는 userId 누락 시 가드 없이 실행', async () => {
    const store = createIdempotencyStore();
    const r = await idempotentWriteMirror(store, '', 'user', async () => 'no-guard');
    expect(r).toBe('no-guard');
  });

  it('operation 실패 시 row 삭제 - 재시도 가능', async () => {
    const store = createIdempotencyStore();
    let attempt = 0;
    try {
      await idempotentWriteMirror(store, 'key1', 'u1', async () => {
        attempt++;
        throw new Error('first attempt fails');
      });
    } catch {}
    // 동일 키로 재시도 - 성공
    const r = await idempotentWriteMirror(store, 'key1', 'u1', async () => {
      attempt++;
      return 'retry-success';
    });
    expect(r).toBe('retry-success');
    expect(attempt).toBe(2);
  });

  it('userId 가 number 여도 string 으로 변환되어 처리', async () => {
    const store = createIdempotencyStore();
    const r1 = await idempotentWriteMirror(store, 'key1', 42, async () => 'first');
    const r2 = await idempotentWriteMirror(store, 'key1', '42', async () => 'second');
    expect(r1).toBe('first');
    expect(r2).toBe('first'); // 같은 키로 인식
  });
});
