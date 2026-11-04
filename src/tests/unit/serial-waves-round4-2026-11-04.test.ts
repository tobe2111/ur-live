/**
 * ⚡ 2026-11-04 대표 *"또 더 최적화해 대기업급으로 해야해"* — 첫 진입 화면의 DB 차례 묻기 4차.
 *   한국 손님은 홍콩·도쿄·LA 데이터센터에서 미국 동부 DB 로 묻는다(왕복 ≈0.2초) → 차례로 묻는 횟수가 곧 체감.
 *   ① 내 이용권(GET /vouchers/my): 이용권 · 교환권(KT) · 선물 상태를 한 물결에 [UNLOCK_LOADING] 대표 *"허가 — 고쳐줘"*
 *   ② 사장님 주문 목록: 개수를 목록과 같은 물결에 · 부가정보 4단 → 2물결
 *   ③ 에이전시 /me: 가드가 같은 JOIN 으로 이미 읽은 값을 쓴다(같은 두 표 재조회 제거)
 * ⚠️ 못 보는 것: 실제 왕복 시간(어드민 vitals `D1` 표본 · 라이브 Server-Timing 으로 판정).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { applyGiftState } from '@/worker/utils/voucher-gift'
import { stripComments } from '../helpers/source-text'

const code = (f: string) => stripComments(readFileSync(f, 'utf8'))

describe('① 내 이용권 — 세 조회 한 물결', () => {
  const s = code('src/features/group-buy/api/group-buy-public.routes.ts')
  const my = s.slice(s.indexOf("router.get('/my'"), s.indexOf("router.get('/my'") + 9000)
  it('선물 조회는 목록보다 먼저 출발하고, 셋을 Promise.all 로 기다린다', () => {
    expect(my).toContain('const giftP = loadGiftState(DB, uidBinds)')
    expect(my).toContain('const [{ results }, ktAlphaItems, giftState] = await Promise.all([vouchersP, ktP, giftP])')
    expect(my).toContain('applyGiftState(merged, giftState)')
    expect(my, '선물 상태를 목록 뒤에 다시 묻지 않는다').not.toContain('withGiftState(')
  })
  it('applyGiftState — 선물 중 표시 · 보낸 기록 · 상태 없으면 원래 목록', () => {
    const items = [{ id: 1, source: 'internal', status: 'unused' }, { id: 'kt-1', source: 'kt_alpha', status: 'unused' }]
    expect(applyGiftState(items, null)).toBe(items)
    const out = applyGiftState(items, { pendingIds: new Set([1]), history: [{ id: 'gift-9', status: 'gifted' }] })
    expect(out[0]).toMatchObject({ id: 1, gift_pending: true })
    expect(out[1]).not.toHaveProperty('gift_pending')
    expect(out[2]).toMatchObject({ id: 'gift-9' })
  })
})

describe('② 사장님 주문 목록', () => {
  it('개수는 목록과 같은 물결 · 부가정보는 2물결', () => {
    const r = code('src/features/seller/api/seller-orders.routes.ts')
    expect(r).toContain('const [, countResult] = await Promise.all([enrichSellerOrderRows(db, orderRows), countP]);')
    const e = code('src/worker/utils/order-list-enrich.ts')
    expect(e).toContain('const vouchersP = attachVouchers(DB, orderRows, oIds)')
    expect(e).toContain('await Promise.all([vouchersP, kindP, pickupP])')
  })
})

describe('③ 에이전시 /me', () => {
  it('가드가 표시용 칸을 같은 질의로 싣고, /me 는 그것을 쓴다', () => {
    const g = code('src/features/agency-console/api/agency-session.ts')
    expect(g).toMatch(/s\.name, a\.name AS agency_name, a\.kind, a\.business_number/)
    expect(g).toContain('profile: { name: row.name ?? null, agencyName: row.agency_name, kind: row.kind, businessNumber: row.business_number ?? null }')
    const me = code('src/features/agency-console/api/agency-auth.routes.ts')
    expect(me).toMatch(/const row = me\.profile\s*\?/)
  })
})
