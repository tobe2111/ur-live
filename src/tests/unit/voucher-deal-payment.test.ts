/**
 * 💰 이용권 딜 결제 게이트 (2026-08-31 대표 방향).
 *
 * 🔑 이 변경의 핵심은 **기능 추가가 아니라 문 닫기**다.
 *   `group-buy.routes` join 의 상품 조회가 `voucher 카테고리 OR deal_only=1` 을 함께 매칭해서,
 *   서버는 원래부터 이용권에도 `payment_method:'deal'` 을 받고 있었다. 화면이 안 내놨을 뿐
 *   직접 POST 하면 통했다. 게이트가 기본 OFF 라 이 PR 은 그 문을 닫는다.
 *
 * 🔴 왜 기본 OFF 여야 하는가: 딜 보너스 20% 가 살아 있는 채로 열면 이용권 마진(5~10%)보다
 *   보너스가 커서 **팔릴수록 유어딜이 건당 8~14원 적자**다. 교환권은 소비자 마크업 20% 가
 *   보너스를 상쇄해 괜찮았고, 이용권엔 그 상쇄가 없다.
 *
 * ⚠️ 못 막는 것: 실제 D1 실행·정산 결과는 안 본다(소스 불변식만). 활성 전 staging 실결제 필요.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { VOUCHER_DEAL_PAYMENT_ENABLED } from '@/shared/feature-flags'
import { getProductFlow } from '@/shared/product-flow'

// ⚠️ 2026-08-31: 게이트 판정은 파일크기 래칫 때문에 라우트 → `gb-purchase-guards.ts` 로 **이동**했다.
//   이 경로를 안 따라가면 테스트가 낡은 지도가 되어, 코드 없는 파일을 검사하며 초록을 낸다.
const GUARD = 'src/features/group-buy/api/gb-purchase-guards.ts'
const ROUTE = 'src/features/group-buy/api/group-buy.routes.ts'
const PAGE = 'src/pages/GroupBuyDetailPage.tsx'
/** 주석 제거 — 주석에만 남은 이름을 배선으로 오독하지 않는다(2026-08-01 교훈). */
const codeOnly = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('R1 — 기본 OFF (배포만으로 열리지 않는다)', () => {
  it('클라 플래그가 false', () => expect(VOUCHER_DEAL_PAYMENT_ENABLED).toBe(false))
  it('서버는 설정이 정확히 `true` 일 때만 통과시킨다', () => {
    const code = codeOnly(readFileSync(GUARD, 'utf8'))
    expect(code).toContain("key = 'voucher_deal_payment_enabled'")
    // `=== 'true'` 로만 허용 — truthy 검사(`!!gate?.value`)면 'false' 문자열도 통과한다.
    expect(code).toMatch(/gate\?\.value === 'true'/)
  })
  it('라우트가 그 판정을 실제로 호출한다', () => {
    expect(codeOnly(readFileSync(ROUTE, 'utf8'))).toContain('isVoucherDealPaymentAllowed(')
  })
})

describe('R2 — 게이트가 교환권을 막지 않는다 (기존 딜 결제 보존)', () => {
  it('교환권은 설정을 보기 전에 통과한다 (조기 반환)', () => {
    const code = codeOnly(readFileSync(GUARD, 'utf8'))
    const early = code.indexOf('product.deal_only === 1) return true')
    const gate = code.indexOf("key = 'voucher_deal_payment_enabled'")
    expect(early).toBeGreaterThan(0)
    expect(gate).toBeGreaterThan(early) // 설정 조회는 그 뒤에만
  })
  it('교환권은 여전히 voucher_deal 로 분류된다', () => {
    expect(getProductFlow({ deal_only: 1, category: 'etc_voucher' })).toBe('voucher_deal')
  })
  it('이용권의 기본 분류는 그대로 카드다', () => {
    expect(getProductFlow({ category: 'meal_voucher', group_buy_status: 'active' })).toBe('group_buy_toss')
  })
})

describe('R3 — 화면: 딜은 선택지일 뿐 기본이 아니다', () => {
  const code = readFileSync(PAGE, 'utf8')
  it('handleJoin 의 딜 결제는 기본값 false', () => {
    expect(code).toContain('async function handleJoin(payWithDeal = false)')
  })
  it('CTA 가 이벤트를 인자로 흘리지 않는다', () => {
    // ⚠️ `onClick={handleJoin}` 이면 MouseEvent 가 payWithDeal 로 들어가 **truthy** 가 되고,
    //   모든 이용권 구매가 딜 경로로 간다. (타입체커가 실제로 이걸 잡았다.)
    expect(code).not.toMatch(/onClick=\{handleJoin\}/)
    expect(code).not.toMatch(/onBuy=\{handleJoin\}/)
    expect(code).toContain('() => handleJoin()')
  })
  it('딜 버튼은 플래그 + 로그인 + 잔액 충분일 때만', () => {
    const block = code.slice(code.indexOf('const canPayWithDeal'))
    const decl = block.slice(0, block.indexOf('\n\n'))
    expect(decl).toContain('VOUCHER_DEAL_PAYMENT_ENABLED')
    expect(decl).toContain('isLoggedIn')
    expect(decl).toContain('dealBalance >= total')
  })
  it('서버 거절 코드를 안내로 처리한다', () => {
    expect(code).toContain('DEAL_PAYMENT_NOT_ALLOWED')
  })
})
