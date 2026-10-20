import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
// 🩸 2026-08-27: 각자 쓰던 codeOnly 가 **라인 주석 속 `/*`** 에 걸려 파일 절반을 삼켰다
//   (실측 4곳). 공용 스캐너로 통일 — 자세한 경위는 `helpers/source-text.ts`.
import { stripComments as codeOnly } from '../helpers/source-text'

/**
 * 💸 2026-08-27 — **표시되는 수수료 = 실제로 청구되는 수수료.**
 *
 * ## 무슨 일이 있었나
 * 매장이 등록에서 **직접(10%)** 을 고르면 이용권 등록 화면의 "판매 1건당 실수령" 카드가
 * **10% 를 빼고** 보여 줬다. 실제 결제 분배는 `getSellerCommissionRate`(채널 무시 · 기본 5%)를
 * 쓰므로 **5% 만 떼였다.** 매장 입장에선 더 받는 쪽이라 신고가 안 들어왔고 — 그래서 아무도 몰랐다.
 *
 * 두 파일이 각각 *"loadFeeRates SSOT 라 표시·정산이 갈릴 수 없다"* 고 **주석으로 단언**하고 있었다.
 * 같은 값을 읽는 건 맞지만 **그 값이 정산에 안 쓰였다.** 주석이 가드 역할을 못 한 전형이라 테스트로 옮긴다.
 *
 * ## 이 가드가 지키는 것
 *   ① 표시 엔드포인트가 **결제가 쓰는 함수**(`getSellerCommissionRate`)를 거친다
 *   ② 화면이 채널로 **다시 계산하지 않는다** — 서버가 준 값만 쓴다
 *   ③ 채널 요율 게이트 상태를 응답에 실어, 꺼져 있음을 숨기지 않는다
 *
 * ## 못 막는 것
 *   - 게이트를 켰을 때 원장·분배가 실제로 10% 를 떼는지(머니 경로 — staging 실결제로만 확인).
 *   - 다른 상품 종류(쇼핑·숙박)의 수수료 경로.
 */
const SSOT = 'src/worker/utils/effective-platform-fee.ts'
const ROUTE = 'src/features/seller/api/seller-stores.routes.ts'
const CARD = 'src/pages/seller-meal-voucher/NetProceedsCard.tsx'
const read = (f: string) => readFileSync(f, 'utf-8')

describe('① 표시가 결제와 같은 경로를 읽는다', () => {
  it('SSOT 가 결제 함수를 **실제로 호출**한다', () => {
    // 🩸 첫 판이 헛돌았다: `toContain('getSellerCommissionRate')` 는 **import 줄과 주석**에도
    //   걸려, 호출을 `Promise.resolve(NaN)` 으로 바꿔도 초록이 떴다(주입 검증에서 잡음).
    //   ⇒ import·주석을 걷어내고 **호출 형태**(`(DB, sellerId)`)로 앵커한다.
    const body = codeOnly(read(SSOT)).replace(/^import .*$/gm, '')
    expect(body, '결제가 쓰는 함수를 안 부르면 표시가 다시 갈린다')
      .toMatch(/getSellerCommissionRate\(\s*DB\s*,\s*sellerId\s*\)/)
  })
  it('fee-context 라우트가 SSOT 를 거친다', () => {
    const r = read(ROUTE)
    expect(r).toContain('getEffectivePlatformFee(')
    // 🩸 예전엔 loadFeeRates 로 채널 요율을 그대로 표시했다 — 그게 갈림의 원인이었다.
    const handler = r.slice(r.indexOf("fee-context"), r.indexOf("fee-context") + 1800)
    expect(codeOnly(handler), 'loadFeeRates 로 표시값을 다시 만들면 결제와 갈린다')
      .not.toContain('loadFeeRates(')
  })
})

describe('② 화면이 채널로 다시 계산하지 않는다', () => {
  const card = codeOnly(read(CARD))
  it('서버가 준 platform_fee_pct 로만 계산한다', () => {
    expect(card).toContain('fee.platform_fee_pct')
  })
  it('채널로 요율을 분기해 계산하지 않는다', () => {
    // `fee.channel` 을 **라벨**로 쓰는 건 괜찮다. 금액 계산에 쓰면 안 된다.
    const calc = card.slice(card.indexOf('const platformCut'), card.indexOf('const net'))
    expect(calc, '화면이 채널로 요율을 정하면 서버를 우회해 다시 갈린다')
      .not.toContain('channel')
  })
})

describe('③ 게이트 상태를 숨기지 않는다', () => {
  it('응답에 channel_rates_active 를 싣는다', () => {
    expect(read(ROUTE)).toContain('channel_rates_active')
  })
  it('SSOT 가 게이트를 실제로 읽는다', () => {
    expect(read(SSOT)).toContain("fee_channel_rates_enabled")
  })
  it('게이트가 꺼져 있으면 채널값을 청구율로 쓰지 않는다', () => {
    const s = read(SSOT)
    // active 일 때만 channelPct 를 쓰는 삼항이어야 한다.
    expect(s).toMatch(/const chargedPct = active\s*\n?\s*\?\s*channelPct/)
  })
})

describe('④ 어드민 정책 대시보드가 "설계값 ≠ 청구액"을 밝힌다', () => {
  // 🩸 처음엔 이걸 표에 **행으로** 넣었다가 유령 키 가드(policy-dashboard-sync)에 걸렸다 — 맞는 지적이다.
  //   policy.ts 에 없는 상수를 표에 적으면 그 표가 거짓말을 하게 된다. 그래서 행이 아니라 섹션 note 로 옮겼고,
  //   note 는 **렌더 배선이 빠지면 조용히 사라지므로**(이 레포가 반복해 만난 클래스) 배선까지 함께 고정한다.
  const ROWS = 'src/pages/admin-policy/policy-rows.ts'
  const PAGE = 'src/pages/AdminPolicyDashboardPage.tsx'

  it('커미션 섹션에 채널 요율 미적용 경고가 있다', () => {
    const src = readFileSync(ROWS, 'utf-8')
    const sec = src.slice(src.indexOf("source: 'COMMISSION_DEFAULTS'"), src.indexOf("source: 'HOSTING_DEFAULTS'"))
    expect(sec, '경고가 없으면 대표가 10% 를 오늘의 청구액으로 읽는다').toContain('fee_channel_rates_enabled')
    expect(sec).toMatch(/note:/)
  })
  it('페이지가 note 를 실제로 렌더한다 (배선 누락 = 조용한 부재)', () => {
    const page = codeOnly(readFileSync(PAGE, 'utf-8'))
    expect(page, 'PolicyTable 에 note 를 안 넘기면 경고가 화면에 안 뜬다').toContain('note={sec.note}')
    expect(page, 'PolicyTable 이 note 를 안 그리면 넘겨도 소용없다').toMatch(/\{note && \(/)
  })
})
