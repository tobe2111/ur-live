import { describe, it, expect } from 'vitest'
import { runAutobidShadowAll } from '@/features/marketing/api/autobid'
import type { Env } from '@/worker/types/env'

/**
 * 🆕 2026-07-01 유어애즈 자동입찰 섀도우 — 킬스위치 게이트 잠금.
 *   불변식: ① ADS_AUTOBID_SHADOW_ENABLED !== 'true' → no-op ② 실제 엔진 ON 이면 섀도우 skip(중복 방지).
 *   (섀도우 자체는 dryRun 이라 updateKeywordBid PUT 0 — runAutobidForSeller dryRun 경로는 기존 테스트가 잠금.)
 */
const envOf = (flags: Record<string, string>): Env => {
  // 게이트에 막히면 DB 접근 자체가 없어야 함 — 접근 시 throw 하는 트랩 DB.
  const trapDB = new Proxy({}, { get() { throw new Error('DB touched — 게이트 실패') } })
  return { DB: trapDB, ...flags } as unknown as Env
}

describe('runAutobidShadowAll 게이트', () => {
  it('섀도우 플래그 OFF(기본) → no-op (DB 미접근)', async () => {
    expect(await runAutobidShadowAll(envOf({}))).toEqual({ sellers: 0, planned: 0 })
  })
  it('섀도우 ON + 실제 엔진 ON → 중복이라 skip (DB 미접근)', async () => {
    expect(await runAutobidShadowAll(envOf({ ADS_AUTOBID_SHADOW_ENABLED: 'true', ADS_AUTOBID_ENABLED: 'true' }))).toEqual({ sellers: 0, planned: 0 })
  })
})
