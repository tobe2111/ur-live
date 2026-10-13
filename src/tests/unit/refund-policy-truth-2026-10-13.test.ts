import { describe, it, expect } from 'vitest'
import { readCode, readRaw } from '../helpers/source-text'
import { DEFAULT_UNCLAIMED_POLICY } from '@/shared/pickup-refund'

/**
 * 💸 2026-10-13 — `/refund` 가 **우리 규칙**을 말하는지 지킨다 (결재 `2026-10-12-refund-policy-mismatch.md`).
 *
 * ## 무엇이 잘못돼 있었나 (실측)
 * `RefundPolicyPage.tsx` 의 `제22조 (환불)` 절이 **유어딜과 무관한 구독 서비스 약관**이었다 —
 * `가. 경기 결제 회원` · `결기간은 300일` · `[(전체금액) x 0.8 / 30] x 남은 일수` ·
 * `16일 이후 30일 이내 사용자는 환불이 불가능합니다`. 유어딜엔 300일 구독도 "경기 결제" 도 없다.
 *
 * 🔴 **그런데 같은 서비스의 구매 버튼은 다른 약속을 한다** — *"미사용 시 100% 자동환불"*.
 * 소비자용 문서 둘이 **서로 다른 환불 규칙**을 말하고 있었고, 분쟁이 나면 소비자가 유리한 쪽을
 * 인용한다. 그리고 그 페이지는 sitemap 이 제출하고 푸터가 링크한다 — **우리가 구속되는 약속**이다.
 *
 * ## 이 시험이 지키는 불변식
 * 페이지의 문구가 **코드가 실제로 하는 것**과 같은 말을 하는가. 세 축이다:
 *   ① 남의 약관이 되살아나지 않는다
 *   ② 전액 약속 ↔ 기본 정책값(100%) 이 어긋나지 않는다 — 값이 바뀌면 페이지를 다시 써야 한다
 *   ③ **꺼져 있는 기능을 약속하지 않는다**(장 단위 일부 환불 게이트는 기본 OFF)
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * - 라이브 `platform_settings` 의 실제 게이트 값(기본값만 본다 — 어드민이 켜면 페이지를 사람이 고쳐야 한다)
 * - 문구가 **법적으로** 충분한가(법무 검토는 코드 밖이다)
 * - 크롤러가 받는 본문(이 글은 20KB JSX 안에만 있어 `/refund` 크롤러 본문은 여전히 짧다 — 별건)
 */
const PAGE = 'src/pages/RefundPolicyPage.tsx'
const BAR = 'src/pages/group-buy/DealBottomBar.tsx'
const BOX = 'src/pages/group-buy/DealPurchaseBox.tsx'

describe('① 남의 서비스 약관이 되살아나지 않는다', () => {
  // 🩸 판정은 **주석을 뺀 실행되는 마크업**으로 한다 — 제거를 기록하는 주석이 같은 문구를
  //   인용하면 거짓 빨간불이 난다(이 레포가 robots·d1-migrate 에서 두 번 밟은 함정).
  it.each([
    ['조 번호', '제22조'],
    ['없는 회원 종류', '경기 결제'],
    ['없는 구독 기간', '300일'],
    ['없는 연간 구독', '연간 결제'],
    ['일할 계산 공식', '남은 일수'],
    ['환불 불가 기간', '16일 이후'],
  ])('%s(%s) 가 없다', (_label, bad) => {
    expect(readCode(PAGE), `/refund 가 남의 약관 문구를 다시 말한다: ${bad}`).not.toContain(bad)
  })
})

describe('② 전액 약속이 코드의 기본 정책과 같은 말을 한다', () => {
  it('페이지가 "결제 금액 전액" 자동 환불을 말한다', () => {
    const c = readCode(PAGE)
    expect(c).toContain('결제 금액 전액')
    expect(c, '자동 환불이라는 말이 사라졌다').toMatch(/자동으로 환불/)
    expect(c, '신청이 필요 없다는 말이 사라졌다').toMatch(/따로 신청하지 않아도/)
  })

  it('미수령 기본 정책이 100% 다 — 바뀌면 이 페이지를 다시 써야 한다', () => {
    // 🔑 페이지가 "전액" 이라고 쓸 수 있는 **근거**가 이 기본값이다. 어드민이 비율을 내리려면
    //   게이트를 켜야 하고(기본 OFF), 그때는 이 문장이 거짓이 되므로 사람이 고쳐야 한다.
    expect(DEFAULT_UNCLAIMED_POLICY.enabled, '미수령 차감 게이트의 기본값이 바뀌었다').toBe(false)
    expect(DEFAULT_UNCLAIMED_POLICY.coldPct).toBe(100)
    expect(DEFAULT_UNCLAIMED_POLICY.roomPct).toBe(100)
  })

  it('구매 버튼과 환불 페이지가 같은 약속을 한다', () => {
    // 두 화면이 갈리면 분쟁에서 소비자가 유리한 쪽을 인용한다 — 그게 이 결재의 출발점이었다.
    for (const f of [BAR, BOX]) {
      expect(readCode(f), `${f} 의 100% 자동환불 약속이 사라졌다`).toMatch(/미사용 시 100% 자동환불/)
    }
    expect(readCode(PAGE), '페이지가 전액 환불을 말하지 않는다').toContain('전액')
  })
})

describe('③ 꺼져 있는 기능을 약속하지 않는다', () => {
  it('장 단위 일부 환불을 안내하지 않는다 — 게이트가 기본 OFF 다', () => {
    const c = readCode(PAGE)
    for (const bad of ['장 단위', '일부 환불', '부분 환불']) {
      expect(c, `꺼져 있는 기능을 약속한다: ${bad}`).not.toContain(bad)
    }
    // 그 게이트가 아직 기본 OFF 라는 사실 자체를 함께 고정한다(ON 이 되면 이 단언이 빨간불 →
    // 페이지를 고치러 오게 된다).
    expect(readCode('src/worker/utils/voucher-partial-refund.ts'))
      .toMatch(/voucher_partial_refund_enabled/)
    expect(readRaw('src/features/admin/api/admin-system-monitoring.routes.ts'))
      .toMatch(/voucher_partial_refund_enabled'[\s\S]{0,200}default_value: 'false'/)
  })
})

describe('④ 딜 환급 안내가 코드의 규칙과 같다', () => {
  it('세 가지를 그대로 말한다 — 충전 한도 · 무상 딜 제외 · 원천징수 없음', () => {
    const c = readCode(PAGE)
    expect(c, '환급 한도(충전한 만큼)가 빠졌다').toMatch(/충전하신 금액/)
    expect(c, '무상 딜 제외가 빠졌다').toMatch(/리워드로 받은 딜은 환급 대상이 아닙니다/)
    expect(c, '원천징수 없음이 빠졌다').toMatch(/원천징수를 하지 않습니다/)
  })

  it('그 세 규칙의 코드 근거가 살아 있다', () => {
    const c = readCode('src/worker/utils/deal-refund.ts')
    expect(c, '유상 잔액 기준이 사라졌다').toContain('PAID_BALANCE_SQL')
    expect(c, '환급 신청 문이 사라졌다').toContain('DEAL_REFUND_OPEN')
    // 환급은 소득이 아니라 돌려주는 돈이다 — 원천징수 코드가 섞이면 약관 제12조와 어긋난다.
    expect(c, '환급 경로에 원천징수가 섞였다').not.toMatch(/withholdAndLog|0\.088|0\.033/)
  })
})

describe('⑤ 배송 안내가 이용권과 섞이지 않는다', () => {
  it('배송 교환·반품 절의 제목이 범위를 밝힌다', () => {
    // 종전 제목 `교환 및 반품 안내` 는 전체를 가리켜, 이용권을 산 사람이 택배 반품 절차(왕복
    // 배송비 6,000원)를 자기 것으로 읽었다 — `/faq` 가 같은 이유로 고쳐진 적이 있다(2026-10-12).
    expect(readCode(PAGE)).toContain('배송 상품 교환 및 반품')
  })
})
