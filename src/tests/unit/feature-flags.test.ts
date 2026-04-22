/**
 * Feature Flags 단위 테스트
 *
 * Kill switch 시스템이 KV 미설정 상태에서도 D1 폴백으로 작동하는지 검증.
 * 1인 운영자가 긴급 상황 때 이 기능 의존 → 반드시 동작 보장 필요.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getFeatureFlags,
  setFeatureFlag,
  setAllFeatureFlags,
  EMERGENCY_MODE_FLAGS,
  NORMAL_MODE_FLAGS,
} from '../../../src/worker/utils/feature-flags';

// 인메모리 D1 스텁 — CF Workers 실제 D1 API 유사
function createMockD1() {
  const tables: Record<string, Array<Record<string, unknown>>> = {};

  const run = (name: string, args: unknown[]) => {
    if (name === 'CREATE') {
      tables['feature_flags_kv'] = tables['feature_flags_kv'] || [];
      return { success: true };
    }
    if (name === 'INSERT_UPSERT') {
      const [value] = args;
      const table = tables['feature_flags_kv'];
      const existing = table.find((r) => r.key === 'feature_flags');
      if (existing) existing.value = value;
      else table.push({ key: 'feature_flags', value });
      return { success: true };
    }
    return { success: true };
  };

  return {
    prepare: (sql: string) => {
      let boundArgs: unknown[] = [];
      const stmt = {
        bind: (...args: unknown[]) => {
          boundArgs = args;
          return stmt;
        },
        run: async () => {
          if (/^CREATE TABLE/.test(sql.trim())) return run('CREATE', []);
          if (/^INSERT INTO feature_flags_kv/.test(sql.trim())) return run('INSERT_UPSERT', boundArgs);
          return { success: true };
        },
        first: async () => {
          if (/SELECT value FROM feature_flags_kv/.test(sql)) {
            const table = tables['feature_flags_kv'] || [];
            return table.find((r) => r.key === 'feature_flags') ?? null;
          }
          return null;
        },
        all: async () => ({ results: [] }),
      };
      return stmt;
    },
    // test helper
    _dump: () => tables,
  } as unknown as D1Database;
}

// 모듈 내부 cache 는 테스트 격리를 위해 매번 리셋
async function freshModule() {
  // Vite 의 static analysis 회피를 위해 dynamic URL 구성
  const url = '../../../src/worker/utils/feature-flags?t=' + Date.now();
  return (await import(/* @vite-ignore */ url)) as typeof import('../../../src/worker/utils/feature-flags');
}

describe('Feature Flags — Kill Switch Infrastructure', () => {
  beforeEach(() => {
    // Reset module cache
  });

  it('KV/DB 둘 다 없을 때 DEFAULT_FLAGS 반환', async () => {
    const flags = await getFeatureFlags(undefined, undefined);
    expect(flags.enable_reviews).toBe(true);
    expect(flags.enable_chat).toBe(true);
  });

  it('DB 폴백: D1 에 저장 후 조회 가능', async () => {
    const DB = createMockD1();
    await setAllFeatureFlags(EMERGENCY_MODE_FLAGS, undefined, DB);

    // cache 리셋 위해 새 모듈 로드
    const mod = await freshModule();
    const flags = await mod.getFeatureFlags(undefined, DB);
    expect(flags.enable_reviews).toBe(false);
    expect(flags.enable_chat).toBe(false);
    expect(flags.enable_shorts_feed).toBe(true); // emergency 에도 유지
  });

  it('Emergency → Normal 토글 가능', async () => {
    const DB = createMockD1();

    await setAllFeatureFlags(EMERGENCY_MODE_FLAGS, undefined, DB);
    let mod = await freshModule();
    let flags = await mod.getFeatureFlags(undefined, DB);
    expect(flags.enable_reviews).toBe(false);

    await setAllFeatureFlags(NORMAL_MODE_FLAGS, undefined, DB);
    mod = await freshModule();
    flags = await mod.getFeatureFlags(undefined, DB);
    expect(flags.enable_reviews).toBe(true);
  });

  it('단일 플래그 토글', async () => {
    const DB = createMockD1();
    await setFeatureFlag('enable_chat', false, undefined, DB);

    const mod = await freshModule();
    const flags = await mod.getFeatureFlags(undefined, DB);
    expect(flags.enable_chat).toBe(false);
    expect(flags.enable_reviews).toBe(true); // 다른 플래그는 영향 없음
  });

  it('EMERGENCY_MODE_FLAGS 는 critical 기능 보존', () => {
    // checkout, payment, login 같은 critical 은 플래그 자체가 없어야 함
    const keys = Object.keys(EMERGENCY_MODE_FLAGS);
    expect(keys).not.toContain('enable_checkout');
    expect(keys).not.toContain('enable_payment');
    expect(keys).not.toContain('enable_login');
  });
});
