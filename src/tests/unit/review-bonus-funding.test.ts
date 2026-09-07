/**
 * 🧾 후기 보너스 — 얼마를, 누가 부담하나 (2026-08-31 대표 "매장 사장님이 부담하게끔")
 *
 * ## 이 테스트가 지키는 것
 * 1. **매장이 아무것도 안 하면 오늘과 완전히 동일**해야 한다. 배포만으로 금액이 바뀌면 사고다.
 * 2. **게이트가 꺼져 있으면 항상 유어딜 부담**이어야 한다 — 매장이 모르는 사이에 청구되면 안 된다.
 * 3. 금액 읽는 곳이 **두 군데(제출·승인)** 인데 갈리면 "제출 때 본 금액과 받은 금액이 다르다"가 된다.
 *
 * ## 못 막는 것
 * 실제 정산 차감. 아직 붙지 않았다(머니 경로 — 게이트 flip 시 별도 세션에서).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolveReviewBonus } from '@/features/group-buy/api/review-bonus-funding'

/** platform_settings / seller_meta 만 흉내내는 최소 D1. */
function fakeDB(settings: Record<string, string>, meta: Record<number, Record<string, string>>) {
  return {
    prepare(sql: string) {
      const binds: unknown[] = []
      const api = {
        bind(...a: unknown[]) { binds.push(...a); return api },
        async first<T>() {
          if (sql.includes('platform_settings')) {
            const key = String(binds[0] ?? '')
            return (settings[key] != null ? { value: settings[key] } : null) as T | null
          }
          return null as T | null
        },
        async all<T>() {
          if (sql.includes('seller_meta')) {
            const rows = Object.entries(meta).flatMap(([sid, kv]) =>
              Object.entries(kv).map(([key, value]) => ({ seller_id: Number(sid), key, value })))
            return { results: rows as T[] }
          }
          return { results: [] as T[] }
        },
        async run() { return { meta: { changes: 1 } } },
      }
      return api
    },
    async batch() { return [] },
  } as unknown as Parameters<typeof resolveReviewBonus>[0]
}

const BASE = { kakao_review_bonus_amount: '1000' }

describe('후기 보너스 — 금액', () => {
  it('매장이 안 정했으면 플랫폼 기본값 (배포만으로 안 바뀐다)', async () => {
    const p = await resolveReviewBonus(fakeDB(BASE, {}), 14)
    expect(p.amount).toBe(1000)
    expect(p.storeSet).toBe(false)
  })

  it('매장이 정했으면 그 값', async () => {
    const p = await resolveReviewBonus(fakeDB(BASE, { 14: { review_bonus_amount: '3000' } }), 14)
    expect(p.amount).toBe(3000)
    expect(p.storeSet).toBe(true)
  })

  it('매장이 0 으로 두면 0 (안 주겠다는 선택도 존중)', async () => {
    const p = await resolveReviewBonus(fakeDB(BASE, { 14: { review_bonus_amount: '0' } }), 14)
    expect(p.amount).toBe(0)
  })

  it('매장이 없는 상품(데모 등)은 플랫폼 기본값·플랫폼 부담', async () => {
    const p = await resolveReviewBonus(fakeDB(BASE, {}), null)
    expect(p.amount).toBe(1000)
    expect(p.fundedBy).toBe('platform')
  })
})

describe('후기 보너스 — 누가 부담하나', () => {
  it('게이트가 꺼져 있으면 매장이 값을 정했어도 유어딜 부담', async () => {
    // 🔑 매장이 모르는 사이에 청구되면 안 된다. 게이트가 그 경계다.
    const p = await resolveReviewBonus(fakeDB(BASE, { 14: { review_bonus_amount: '3000' } }), 14)
    expect(p.fundedBy).toBe('platform')
  })

  it('게이트가 켜지고 매장이 정한 건만 매장 부담', async () => {
    const on = { ...BASE, review_bonus_owner_funded: 'true' }
    expect((await resolveReviewBonus(fakeDB(on, { 14: { review_bonus_amount: '3000' } }), 14)).fundedBy).toBe('owner')
    // 매장이 안 정한 건은 게이트가 켜져도 유어딜 부담 — 플랫폼이 정한 값이니까.
    expect((await resolveReviewBonus(fakeDB(on, {}), 14)).fundedBy).toBe('platform')
  })
})

describe('금액을 읽는 곳이 갈리지 않는다', () => {
  const routes = readFileSync(resolve(__dirname, '../../..', 'src/features/group-buy/api/review-bonus.routes.ts'), 'utf-8')

  it('제출·승인 두 곳 모두 SSOT 를 쓴다', () => {
    // 갈리면 "제출 때 본 금액과 받은 금액이 다르다"가 된다.
    expect(routes.match(/resolveReviewBonus\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  it('옛 직접 조회가 되살아나지 않는다', () => {
    expect(routes, 'platform_settings 를 직접 읽으면 매장 설정을 무시하게 된다')
      .not.toContain("key = 'kakao_review_bonus_amount'")
  })
})
