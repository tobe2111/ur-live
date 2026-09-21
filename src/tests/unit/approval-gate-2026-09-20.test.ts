/**
 * 🥕 **승인 대기 병목 — 준비는 지금, 노출·정산은 승인 뒤** (2026-09-20 대표 *"2번은 더 이상적인 방법이 있어?"*)
 *
 * 두 판정이 서로 **다른 집합**인 것이 이 변경의 전부다:
 *   - 좌석(`isSeatableStoreStatus`)   — 대기·반려도 앉는다. 정지만 아니다.
 *   - 정산(`isPayoutEligibleSellerStatus`) — 승인된 매장만. 돈은 사람이 등록증을 본 뒤에만 나간다.
 * 좌석을 열어 놓고 정산 게이트를 빼면 09-16 사기 방어(등록증 + 어드민 승인)가 통째로 우회된다 —
 * 그래서 이 파일은 둘을 **함께** 잰다. 주입 매니페스트가 한쪽만 빠지는 경우를 빨간불로 만든다.
 *
 * 이 테스트가 못 보는 것: 실제 cron 이 D1 에서 skip 하는지(라이브 판정은 STAGING P15) · 배너 렌더.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { stripComments } from '../helpers/source-text'
import {
  isSeatableStoreStatus,
  isPayoutEligibleSellerStatus,
  SEATABLE_STORE_STATUSES,
  PAYOUT_ELIGIBLE_SELLER_STATUSES,
} from '@/shared/seller-status'

const read = (p: string) => stripComments(readFileSync(p, 'utf8'))
const OPS = read('src/features/seller/api/seller-operators.routes.ts')
const STORES = read('src/features/seller/api/seller-stores.routes.ts')
const STEP = read('src/pages/seller-meal-voucher/StoreStep.tsx')
const PAYOUT = read('src/worker/cron/payouts-generate.ts')
const SWITCHER = read('src/components/seller/StoreSwitcher.tsx')
const ADMIN = read('src/features/admin/api/admin-sellers.routes.ts')
const CODES = read('src/features/group-buy/api/marketing/collab-codes.ts')
const AUTH = read('src/worker/middleware/auth.ts')

describe('① 판정 SSOT — 좌석과 정산은 다른 집합이다', () => {
  it('좌석: 대기·반려·승인·활성은 앉고, 정지·미지·null 은 못 앉는다', () => {
    for (const s of ['pending', 'rejected', 'approved', 'active']) expect(isSeatableStoreStatus(s), s).toBe(true)
    for (const s of ['suspended', 'deleted', '', null, undefined, 42]) expect(isSeatableStoreStatus(s), String(s)).toBe(false)
  })
  it('정산: 승인·활성만. 대기·반려는 좌석은 있어도 돈은 없다', () => {
    for (const s of ['approved', 'active']) expect(isPayoutEligibleSellerStatus(s), s).toBe(true)
    for (const s of ['pending', 'rejected', 'suspended', null, undefined]) expect(isPayoutEligibleSellerStatus(s), String(s)).toBe(false)
  })
  it('정산 집합은 좌석 집합의 진부분집합 — 앉지도 못하는데 돈을 받는 상태는 없다', () => {
    for (const s of PAYOUT_ELIGIBLE_SELLER_STATUSES) expect((SEATABLE_STORE_STATUSES as readonly string[]).includes(s)).toBe(true)
    expect(SEATABLE_STORE_STATUSES.length).toBeGreaterThan(PAYOUT_ELIGIBLE_SELLER_STATUSES.length)
  })
})

describe('② 좌석 — 세 곳(토큰·가산·화면)이 같은 함수를 쓴다', () => {
  it('좌석 토큰이 SSOT 로 판정하고, 옛 active|approved 직접 비교가 없다', () => {
    const at = OPS.indexOf("app.post('/stores/:sellerId/token'")
    const body = OPS.slice(at, OPS.indexOf('app.', at + 10))
    expect(body).toMatch(/if \(!isSeatableStoreStatus\(seller\.status\)\)/)
    expect(body).not.toMatch(/status !== 'active' && [^\n]*status !== 'approved'/)
  })
  it('앉을 수 있는 매장 수·요약 API 도 같은 판정', () => {
    expect(STORES).toMatch(/mine\.filter\(x => isSeatableStoreStatus\(x\.status\)\)/)
    expect(OPS).toMatch(/\.filter\(s => isSeatableStoreStatus\(s\.status\)\)/)
  })
  it('이용권 등록의 매장 선택 화면도 같은 판정 + 심사 중 배지', () => {
    expect(STEP).toMatch(/const seatable = \(s: OperableStore\) => isSeatableStoreStatus\(s\.status\)/)
    expect(STEP).toContain("s.status === 'pending'")
  })
  it('매장 스위처가 대기·반려를 배지로 말한다 (앉을 수 있으니 상태가 보여야 한다)', () => {
    expect(SWITCHER).toContain("s.status === 'pending'")
    expect(SWITCHER).toContain("s.status === 'rejected'")
  })
})

describe('③ 정산 게이트 — 좌석 개방의 짝', () => {
  it('payouts-generate 가 셀러 status 를 읽고, 계좌를 쓰기 전에 SSOT 로 skip 한다', () => {
    const at = PAYOUT.indexOf("payeeType === 'store_owner' || payeeType === 'seller'")
    expect(at).toBeGreaterThan(0)
    const body = PAYOUT.slice(at, at + 900)
    expect(body).toMatch(/SELECT bank_account, business_name, status FROM sellers/)
    const gate = body.indexOf('isPayoutEligibleSellerStatus(row?.status)')
    const use = body.indexOf('accountNumber = row?.bank_account')
    expect(gate).toBeGreaterThan(0)
    expect(use).toBeGreaterThan(gate)
    expect(body.slice(gate, gate + 160)).toMatch(/continue/)
  })
})

describe('④ 운영자 통보 · 발급자 기록', () => {
  it('어드민 승인이 위임 운영자(중개사)에게도 알린다 — 승계 전 매장은 linked_user_id 가 비어 종전 알림이 아무에게도 안 갔다', () => {
    const at = ADMIN.indexOf("adminSellersRoutes.patch('/sellers/:id/approve'")
    const body = ADMIN.slice(at, at + 4000)
    expect(body).toMatch(/notifyStoreOperatorsApproved\(DB, sellerId, linkedUserId, isReactivation\)/)
    const MOD = read('src/features/admin/api/admin-sellers/notify-store-operators.ts')
    expect(MOD).toMatch(/SELECT user_id, role FROM seller_operators WHERE seller_id = \? AND revoked_at IS NULL/)
    expect(MOD).toContain("'store_approved'")
    expect(MOD).toMatch(/const owner = o\.role === 'owner'/) // 승계 사장님에게 "위임받은" 이라 하지 않는다 (E5 실측)
  })
  it('협업 코드의 발급자는 좌석의 셀러 id 가 아니라 행위자 유저 id', () => {
    expect(CODES).toMatch(/createdBy: await resolveIssuerUserId\(c, sellerId\)/)
    expect(CODES).toMatch(/if \(u\.operator_user_id\) return u\.operator_user_id/)
    expect(AUTH).toMatch(/operator_user_id\?: number/)
    expect(AUTH).toMatch(/operator_user_id: Number\(jwtPayload\.operator_user_id\)/)
  })
})
