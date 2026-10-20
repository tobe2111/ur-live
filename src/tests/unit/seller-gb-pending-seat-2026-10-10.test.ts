/**
 * 🪑 승인 대기 매장이 셀러 홈에서 로그아웃되던 것 (2026-10-10 전수조사)
 *
 * `/seller` 첫 화면의 '운영자 문의' 칸이 `GET /api/seller/gb/support-contact` 를 부르는데, 그 경로가
 * 승인 전 매장에 **401** 을 줬다. 셀러 화면의 401 인터셉터는 그걸 "세션 만료" 로 읽어 좌석 토큰을
 * 지우고 셀러 로그인으로 보낸다. 2026-10-07 `/seller/orders` 와 같은 클래스(`seller-approval-gate.ts`).
 *
 * 이 시험은 **함수를 실제로 돌려** 판정한다(문자열이 아니라 동작):
 *  - 토큰 없음/깨짐/행 없음 → 401 (진짜 인증 실패)
 *  - 승인 매장 → 통과
 *  - 대기 매장 → 403 SELLER_PENDING_APPROVAL (몰·공구 설정) / 통과 (문의처 — allowUnapproved)
 *  - 정지 매장 → allowUnapproved 여도 403
 *
 * ⚠️ 못 보는 것: 클라 인터셉터가 403 을 정말 무시하는지(그건 `api.ts` 의 몫 — 403 은 로그아웃 분기에 없다).
 */
import { describe, it, expect } from 'vitest'
import { sign } from 'hono/jwt'
import { gbSeat } from '@/features/seller/api/seller-gb.routes'

const SECRET = 'test-secret'
function fakeDB(row: { status: string; approved: number } | null) {
  return {
    prepare: () => ({ bind: () => ({ first: async () => row }) }),
  } as unknown as D1Database
}
async function bearer(sellerId: number) {
  return `Bearer ${await sign({ seller_id: sellerId, exp: Math.floor(Date.now() / 1000) + 60 }, SECRET, 'HS256')}`
}

describe('gbSeat — 401 은 "누구인지 모르겠다" 일 때만', () => {
  it('토큰 없음 → 401', async () => {
    const r = await gbSeat(fakeDB({ status: 'approved', approved: 1 }), undefined, SECRET)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(401)
  })
  it('깨진 토큰 → 401', async () => {
    const r = await gbSeat(fakeDB({ status: 'approved', approved: 1 }), 'Bearer nope', SECRET)
    if (!r.ok) expect(r.status).toBe(401)
    else throw new Error('통과하면 안 된다')
  })
  it('행 없음 → 401', async () => {
    const r = await gbSeat(fakeDB(null), await bearer(9), SECRET)
    if (!r.ok) expect(r.status).toBe(401)
    else throw new Error('통과하면 안 된다')
  })
  it('승인 매장 → 통과', async () => {
    const r = await gbSeat(fakeDB({ status: 'approved', approved: 1 }), await bearer(9), SECRET)
    expect(r).toEqual({ ok: true, sellerId: 9 })
  })
  it('대기 매장 → 403 SELLER_PENDING_APPROVAL (401 이면 클라가 로그아웃시킨다)', async () => {
    const r = await gbSeat(fakeDB({ status: 'pending', approved: 0 }), await bearer(9), SECRET)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.status).toBe(403)
      expect(r.body.code).toBe('SELLER_PENDING_APPROVAL')
    }
  })
  it('대기 매장 + allowUnapproved(문의처) → 통과', async () => {
    const r = await gbSeat(fakeDB({ status: 'pending', approved: 0 }), await bearer(9), SECRET, { allowUnapproved: true })
    expect(r).toEqual({ ok: true, sellerId: 9 })
  })
  it('정지 매장은 allowUnapproved 여도 막힌다', async () => {
    const r = await gbSeat(fakeDB({ status: 'suspended', approved: 0 }), await bearer(9), SECRET, { allowUnapproved: true })
    expect(r.ok).toBe(false)
  })
})
