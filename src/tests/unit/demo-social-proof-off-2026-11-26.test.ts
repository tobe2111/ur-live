/**
 * 🛑 데모 매장 리뷰·별점·"N명 구매" 중단 (2026-11-26 대표 "응 모두 하자" — 가상 손님 100명 패널에서
 *   "88명 구매라면서 저는 왜 못 사요?" 가 25명에게서 나왔다. 결제할 수 없는 매장에 사회적 증거를 붙이지 않는다.)
 *   ① 스위치가 켜져 있다 ② 시드·재생성·매장 교체 시드가 모두 아무것도 안 만든다 ③ 매시간 숨김이 돈다
 *   ④ 범용 시드가 데모 전 종류(demo-%)를 뺀다 ⑤ 숨김은 지우지 않는다(되돌릴 수 있게)
 * ⚠️ 못 막는 것: 판매자 없는 플랫폼 상품(교환권 등)의 자동 리뷰 — 대표 판단 대기(결재 2026-11-26-platform-auto-reviews).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DEMO_SOCIAL_PROOF_OFF, seedDemoReviews, seedMissingDemoReviews, refreshDemoReviews } from '@/worker/utils/demo-review-generator'

const ROOT = resolve(__dirname, '../../..')
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf-8')
const noDB = { DB: { prepare: () => { throw new Error('DB 를 건드리면 안 된다') } } } as never

describe('데모 사회적 증거 중단', () => {
  it('① 스위치가 켜져 있다', () => { expect(DEMO_SOCIAL_PROOF_OFF).toBe(true) })
  it('② 시드·재생성은 DB 를 건드리지 않고 0 을 돌려준다', async () => {
    expect(await seedDemoReviews(noDB, { id: 1, name: 'x', category: 'meal_voucher', storeName: 'y', price: 1000 })).toBe(0)
    expect(await seedMissingDemoReviews(noDB)).toEqual({ seeded: 0 })
    expect(await refreshDemoReviews(noDB)).toEqual({ refreshed: 0, reviews: 0, remaining: 0 })
  })
  it('③ 매시간 리뷰 cron 이 숨김을 먼저 돌린다', () => {
    const src = read('src/worker/cron/auto-seed-reviews.ts')
    expect(src.indexOf('hideDemoSocialProof(env)')).toBeGreaterThan(-1)
    expect(src.indexOf('hideDemoSocialProof(env)')).toBeLessThan(src.indexOf('refreshDemoReviews('))
  })
  it('④ 범용 시드는 데모 전 종류를 뺀다', () => {
    expect(read('src/worker/utils/auto-seed-fake-reviews.ts')).toMatch(/p\.slug NOT LIKE 'demo-%'/)
  })
  it('⑤ 숨김은 지우지 않는다 — is_visible=0 과 숫자 0 만', () => {
    const src = read('src/worker/utils/demo-review-generator.ts')
    const body = src.slice(src.indexOf('export async function hideDemoSocialProof'), src.indexOf('export function composeDemoReview'))
    expect(body).toMatch(/SET is_visible = 0/)
    expect(body).toMatch(/review_count = 0, avg_rating = 0, sold_count = 0/)
    expect(body).not.toMatch(/DELETE/)
  })
})
