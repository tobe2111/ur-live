/**
 * 🔑 **QR 로 들어온 사장님에게 로그인을 권한다** (2026-10-07) + 🎟️ **인증 화면 다섯 상황** (2026-10-08 시안 확정)
 *
 * 대표(10-07): *"QR 인증을 사장님이 할 때 로그인이 안되어있으면 일반 카메라로 QR 인증 시 카카오 로그인을
 * 먼저 요청하는게 맞지 않을까?"* → 대표(10-08): *"시안대로 해줘"* (`docs/design/voucher-verify-redesign.md`).
 *
 * ## 지키는 것
 * - **벽이 아니라 권유다**: 이 화면은 손님도 연다(자기 QR 을 자기 폰으로 찍으면 같은 주소). 로그인 벽 금지.
 * - 복귀 주소를 싣는다 · 이미 로그인한 사람은 '내 가게' 로(→ `/login` 은 아무 일도 안 일어난다).
 * - 🩸 **처리 성공 = 완료 화면**: 종전엔 성공해도 상태를 'used' 로 바꿔 곧장 "이미 사용된 바우처" 가 떴다.
 * - 🩸 **다른 매장 사장님에게 처리 버튼을 안 보인다**: 서버 `can_redeem` 으로 가른다. 그 판정은 실제
 *   처리(use-by-seller)와 **같은 미들웨어**(`scanOrSellerAuth`)를 써야 한다 — 둘이 갈리면 화면이 거짓말을 한다.
 * - 🔒 `can_redeem` 은 표시용이다. 실제 처리의 소유권 검사(403)는 그대로 남아 있어야 한다.
 *
 * ## ❌ 이 시험이 못 보는 것
 * 로그인 후 실제로 이 화면으로 돌아오는지 · 렌더된 모양(시안과 같은지는 그려서 봐야 한다) ·
 * `scanOrSellerAuth` 를 핸들러에서 호출했을 때 Hono 가 실제로 user 를 채우는지(배포 후 판정).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { pickVerifyView } from '@/pages/VoucherVerifyPage'

const SRC = readCode('src/pages/VoucherVerifyPage.tsx')
const PUB = readCode('src/features/group-buy/api/group-buy-public.routes.ts')
const USE = readCode('src/features/group-buy/api/group-buy-voucher.routes.ts')

const unused = { code: 'UR-AAAA-BBBB', status: 'unused' }

describe('인증 화면 — 어떤 상황을 보여 줄지 (pickVerifyView)', () => {
  it('① 우리 매장 사장님(can_redeem) → 사용 처리', () => {
    expect(pickVerifyView({ ...unused, can_redeem: true }, { done: false, isSeller: true })).toBe('redeem')
  })
  it('② 처리 직후 → 완료 화면 (이미 사용된 이용권 화면이 아니다)', () => {
    expect(pickVerifyView({ ...unused, status: 'used', can_redeem: true }, { done: true, isSeller: true })).toBe('done')
  })
  it('③ 이미 쓴/만료/환불 → 닫힘', () => {
    for (const status of ['used', 'expired', 'refunded']) {
      expect(pickVerifyView({ ...unused, status }, { done: false, isSeller: false })).toBe('closed')
    }
  })
  it('④ 좌석 없음 → 매장 확인코드', () => {
    expect(pickVerifyView({ ...unused }, { done: false, isSeller: false })).toBe('pin')
  })
  it('⑤ 다른 매장 사장님 → 처리 버튼 없음', () => {
    expect(pickVerifyView({ ...unused, can_redeem: false }, { done: false, isSeller: true })).toBe('other-store')
  })
  it('조회 전 → 코드 입력', () => {
    expect(pickVerifyView(null, { done: false, isSeller: false })).toBe('lookup')
  })
})

describe('화면 배선', () => {
  it('처리 성공이 완료 상태로 간다 (상태를 used 로 덮지 않는다)', () => {
    expect(SRC).toMatch(/if \(res\.data\.success\) finish\(\)/)
    expect(SRC).not.toMatch(/status: 'used' \}/)
  })
  it('🔒 벽이 아니다 — 손님 확인코드 경로가 남고 조기 리다이렉트가 없다', () => {
    expect(SRC).toMatch(/redeemWithStoreCode/)
    expect(SRC).toMatch(/\/api\/vouchers\/\$\{voucher\.code\}\/use`/)
    expect(SRC).not.toMatch(/navigate\(loginPathFromHere/)
    expect(SRC).not.toMatch(/<Navigate/)
  })
  it('복귀 주소를 싣고, 이미 로그인한 사람은 /login 으로 보내지 않는다', () => {
    expect(SRC).toMatch(/const loggedIn = !!getUserIdSync\(\)/)
    expect(SRC).toMatch(/to=\{loggedIn \? '\/user\/profile' : loginPathFromHere\(\)\}/)
    expect(SRC).not.toMatch(/to="\/login"/)
  })
  it('사용 처리 버튼은 redeem 상황에서만 use-by-seller 를 부른다', () => {
    expect(SRC).toMatch(/\/use-by-seller`/)
    expect(SRC).toMatch(/\{view === 'redeem' && \(/)
  })
  it('조회 때 좌석 토큰을 실어 보낸다 (안 실으면 can_redeem 이 늘 false)', () => {
    expect(SRC).toMatch(/\/api\/vouchers\/verify\/\$\{parsedCode\}`, isSeller/)
  })
  it('이모지·옛 용어 0 — 바우처/교환권/PIN 문구가 화면에 없다', () => {
    expect(SRC).not.toMatch(/[\u{1F300}-\u{1FAFF}✅]/u)
    expect(SRC).not.toMatch(/defaultValue: '[^']*(바우처|교환권|PIN)/)
  })
})

describe('서버 — can_redeem 은 실제 처리와 같은 판정이다', () => {
  it('verify 응답에 can_redeem 이 있고 scanOrSellerAuth 로 판정한다', () => {
    const i = PUB.indexOf("router.get('/verify/:code'")
    expect(i).toBeGreaterThan(0)
    const body = PUB.slice(i, i + 3000)
    expect(body).toMatch(/can_redeem: canRedeem/)
    expect(body).toMatch(/await scanOrSellerAuth\(\)\(/)
    expect(body).toMatch(/Number\(voucher\.product_seller_id\) === Number\(u\.id\)/)
  })
  it('🔒 실제 처리의 소유권 검사(403)는 그대로다', () => {
    expect(USE).toMatch(/Number\(voucher\.seller_id\) !== Number\(user\.id\)/)
  })
  it('use-by-seller 성공 문구에 이모지가 없다', () => {
    expect(USE).not.toMatch(/✅ 메뉴 제공/)
  })
})
