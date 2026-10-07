import { describe, it, expect } from 'vitest'
import { sign } from 'hono/jwt'
import { resolveApprovedSeller, SELLER_PENDING_APPROVAL } from '@/worker/utils/seller-approval-gate'
import { readCode } from '../helpers/source-text'

const SECRET = 'test-secret-for-seat-gate'

/** 진짜 좌석 토큰을 만든다 — `getSellerIdFromToken` 의 `type:'seller'` 검증까지 실제로 탄다. */
const seatToken = (sellerId: number) =>
  sign({ sub: String(sellerId), seller_id: sellerId, type: 'seller' }, SECRET, 'HS256')

/** `sellers` 한 행만 돌려주는 최소 D1. (`node:sqlite` 는 client 환경에서 못 쓴다 — 첫 판이 거기서 죽었다.) */
function fakeDB(row: { id: number; status: string | null; is_active: number | null } | null) {
  return {
    prepare: () => ({ bind: () => ({ first: async () => row }) }),
  } as unknown as D1Database
}

describe('좌석 판정 — 401 과 403 을 가른다 (2026-10-07)', () => {
  it('⓪ 측정기 자기검사 — 진짜 토큰이 실제로 파싱된다', async () => {
    // 토큰이 안 먹으면 아래 ②③ 가 전부 `no_token` 으로 통과해 **아무것도 안 지킨다**.
    const r = await resolveApprovedSeller(fakeDB({ id: 26, status: 'approved', is_active: 1 }),
      `Bearer ${await seatToken(26)}`, SECRET)
    expect(r.ok).toBe(true)
    expect(r.ok === true && r.sellerId).toBe(26)
  })

  it('① 토큰이 없으면 no_token — 이때만 진짜 401 이다', async () => {
    const r = await resolveApprovedSeller(fakeDB(null), undefined, SECRET)
    expect(r.ok === false && r.reason).toBe('no_token')
  })

  it('②-1 승인 대기 매장은 not_approved — 대표가 밟은 바로 그 경우', async () => {
    const r = await resolveApprovedSeller(fakeDB({ id: 26, status: 'pending', is_active: 1 }),
      `Bearer ${await seatToken(26)}`, SECRET)
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.reason).toBe('not_approved')   // ← 종전엔 전부 null → 401 이었다
    expect(r.ok === false && r.reason === 'not_approved' && r.status).toBe('pending')
  })

  it('②-2 반려·비활성도 not_approved (401 아님)', async () => {
    for (const row of [
      { id: 26, status: 'rejected', is_active: 1 },
      { id: 26, status: 'approved', is_active: 0 },
    ]) {
      const r = await resolveApprovedSeller(fakeDB(row), `Bearer ${await seatToken(26)}`, SECRET)
      expect(r.ok === false && r.reason).toBe('not_approved')
    }
  })

  it('②-3 매장 행이 없으면 no_seller — 그건 401 이 맞다', async () => {
    const r = await resolveApprovedSeller(fakeDB(null), `Bearer ${await seatToken(26)}`, SECRET)
    expect(r.ok === false && r.reason).toBe('no_seller')
  })

  it('③ 승인 집합은 seller-status SSOT 에서 온다 — 문자열을 다시 적지 않는다', () => {
    const code = readCode('src/worker/utils/seller-approval-gate.ts')
    expect(code).toContain('isPayoutEligibleSellerStatus')
    // 🔴 여기에 'approved'/'active' 를 손으로 적으면 09-20 당근 모델과 갈린다.
    expect(code).not.toMatch(/'approved'\s*,\s*'active'/)
  })

  it('④ 승인 대기 본문은 "로그인" 이라고 말하지 않는다 (거짓말 금지)', () => {
    expect(SELLER_PENDING_APPROVAL.code).toBe('SELLER_PENDING_APPROVAL')
    expect(SELLER_PENDING_APPROVAL.success).toBe(false)
    expect(SELLER_PENDING_APPROVAL.error).toContain('승인')
    expect(SELLER_PENDING_APPROVAL.error).not.toContain('로그인')
  })

  it('⑤ 주문 라우트가 사유별로 다른 코드를 준다 (401 / 403)', () => {
    const code = readCode('src/features/seller/api/seller-orders.routes.ts')
    // 종전의 뭉개는 판정이 되살아나면 안 된다.
    expect(code).not.toContain('async function getActiveSellerId')
    expect(code).toContain("gate.reason === 'not_approved'")
    expect(code).toMatch(/SELLER_PENDING_APPROVAL[\s\S]{0,80}403/)
    // 두 호출부 모두 게이트를 거친다.
    expect([...code.matchAll(/denySellerGate\(c, gate\)/g)]).toHaveLength(2)
  })

  it('⑥ 401 인터셉터는 그 역할의 화면 안에서만 이동한다 (사고의 핵심)', () => {
    const code = readCode('src/lib/api.ts')
    expect(code).toContain('onRoleSurface')
    // 하드 이동이 가드 **밖**에 있으면 소비자 화면에서 또 튕긴다.
    const at = code.indexOf('onRoleSurface = p === surface')
    expect(at).toBeGreaterThan(0)
    const after = code.slice(at)
    const jump = after.indexOf('window.location.href = `${loginUrl}')
    const guard = after.indexOf('if (onRoleSurface) {')
    expect(guard).toBeGreaterThan(0)
    expect(jump).toBeGreaterThan(guard)   // 이동은 가드 안쪽
  })

  it('⑦ 마이는 승인 대기를 "못 불러왔다" 와 다른 문장으로 말한다', () => {
    const hook = readCode('src/pages/user-profile/seller-section/useSellerWork.ts')
    // 🩸 첫 판은 `toContain('pendingApproval')` 였는데, **일하는 줄을 지워도** 상태 선언과
    //   반환에 그 이름이 남아 통과했다(주입 러너가 잡았다 — 오늘 이 클래스 넷째).
    //   ⇒ 이름이 아니라 **배선**을 앵커한다: 403 을 보고 실제로 켜는 줄.
    expect(hook).toContain('SELLER_PENDING_APPROVAL')
    expect(hook).toMatch(/isPending\(oRes\)[\s\S]{0,60}setPendingApproval\(true\)/)
    // 그리고 그 경우를 **실패로 세지 않는다**(둘 다 켜면 화면이 두 문장을 다 그린다).
    expect(hook).toMatch(/setPendingApproval\(true\)[\s\S]{0,40}setFailed\(false\)/)
    const ui = readCode('src/pages/user-profile/SellerSection.tsx')
    expect(ui).toContain('work.pendingApproval')
    expect(ui).toMatch(/승인 대기/)
  })
})
