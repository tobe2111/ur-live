/**
 * 🧰 마이 안 판매 도구 넷 — 등록·환불·분석·출금 (2026-09-25, 설계 §19) → 출금은 2026-10-12 정산(읽기 전용)으로
 *   대표: *"등록, 환불, 분석, 출금도 마이에서 돼야해."*
 *
 * ## 🔴 이 파일이 막는 제일 큰 사고
 * `POST /api/seller/account/withdraw` 는 이름이 "withdraw" 지만 **셀러 탈퇴(계정 삭제)** 다.
 * 내가 설계 문서에 그걸 "출금" 이라고 적어 뒀었고(§19-0), 그 오기를 믿은 사람은 사장님의
 * [출금] 버튼에 탈퇴 API 를 배선한다. **에러도 안 난다** — 그 API 는 성공하고 가게가 사라진다.
 * ⇒ 출금 화면에 그 문자열이 못 들어오게 **이름으로** 막는다.
 *
 * ## 못 막는 것
 * - 서버 쪽 권한·정산 계산(그건 `seller-settlements` 와 머니 가드의 몫).
 * - 실제 브라우저에서 시트가 열리는지(jsdom 은 레이아웃이 없다).
 * - 사람이 *새* 파일에 같은 오배선을 하는 것 — 그때는 이 목록에 파일을 더해야 한다.
 */
import { describe, it, expect } from 'vitest'
import { readCode, stripComments } from '../helpers/source-text'

const SECTION = readCode('src/pages/user-profile/SellerSection.tsx')
// 💰 2026-10-12: 돈 시트가 `WithdrawSheet`(출금 신청) → `PayoutSheet`(주간 자동 정산, **읽기 전용**)로 바뀌었다.
//   출금 신청이 읽던 잔액(`seller_deal_balances`)은 한 번도 적립되지 않아 늘 0원이었고, 서버 문은 410 이다.
const PAYOUT = readCode('src/pages/user-profile/seller-section/PayoutSheet.tsx')
const BANK = readCode('src/pages/user-profile/seller-section/BankSheet.tsx')
// 🧹 2026-10-01 철거: `RefundSheet`·`AnalyticsSheet` 는 내려갔다 — 환불은 주문 대시보드 화면이,
//    분석은 `/seller/analytics` 가 맡는다(원본이고, 손수 시트는 그 **복제**였다).
//    아래에서 그 둘을 대상으로 하던 검사는 **대상만** 줄었고 판정은 그대로다. 사라진 판정 둘
//    (환불이 사유를 요구한다 · 분석이 서버 값만 그린다)은 복제가 아니라 **원본 화면의 성질**이라
//    그 화면들의 시험이 지킨다 — 복제가 없어졌으니 복제용 가드도 함께 내린다.
const SHEET = readCode('src/pages/user-profile/seller-section/Sheet.tsx')

describe('🔴 출금 ≠ 탈퇴 (§19-0)', () => {
  it('정산 화면은 읽기만 한다 — 탈퇴는 물론 어떤 쓰기도 부르지 않는다', () => {
    const code = stripComments(PAYOUT)
    expect(code, 'account/withdraw 는 계정 삭제다 — 사장님이 돈을 보려다 가게를 잃는다')
      .not.toContain('account/withdraw')
    // 2026-10-12: 셀러 돈은 매주 자동으로 나간다 — 이 화면에서 돈을 움직이는 요청이 생기면
    //   주간 정산과 **두 번째 출구**가 된다(같은 돈이 두 길로 나갈 수 있다).
    expect(code, '정산 시트에 쓰기 요청이 생겼다').not.toMatch(/api\.(post|put|patch|delete)\(/)
    expect(code, '닫은 문(deal-withdraw)을 다시 부른다').not.toContain('deal-withdraw')
  })

  it('숫자의 출처는 주간 자동 정산(payouts) 하나다', () => {
    const code = stripComments(PAYOUT)
    expect(code).toContain("api.get('/api/seller/payouts')")
    expect(code, '한 번도 적립되지 않는 잔액을 다시 읽는다 — 늘 0원이 뜬다').not.toContain('/api/seller/deal-balance')
  })

  it('마이 판매 화면 어디에도 탈퇴 엔드포인트가 없다', () => {
    for (const [name, code] of [['section', SECTION], ['payout', PAYOUT], ['bank', BANK]] as const) {
      expect(stripComments(code), `${name}`).not.toContain('account/withdraw')
    }
  })

  it('계좌는 좌석 인증된 서버 응답으로만 판정한다 (localStorage 금지)', () => {
    const code = stripComments(PAYOUT)
    expect(code).toContain("api.get('/api/seller/profile')")
    // 🔴 localStorage 는 **좌석을 안 따라간다** — 가게를 옮긴 뒤엔 직전 가게 계좌 여부를 말한다.
    for (const key of ['seller_bank_name', 'seller_account_number', 'seller_account_holder']) {
      expect(code, `${key} 를 읽으면 좌석이 바뀐 뒤 남의 가게 계좌 상태를 보여 준다`).not.toContain(key)
    }
  })

  it('조회 실패를 0원으로 위장하지 않는다', () => {
    const code = stripComments(PAYOUT)
    expect(code, '실패하면 "불러오지 못했어요" 가 떠야 한다 — 0원은 거짓말이다').toContain('정산 정보를 불러오지 못했어요')
    expect(code).toMatch(/if \(!p\.data\?\.success\) \{ setFailed\(true\)/)
  })
})

/**
 * 🧹 **2026-10-01 철거 — 여기 있던 두 묶음(환불 · 분석)을 내렸다. 무엇을 확인하고 내렸는지 남긴다.**
 *
 * 그 검사들의 대상은 **복제**였다(`RefundSheet`·`AnalyticsSheet` = 대시보드 화면의 폰용 사본).
 * 복제를 지우면 복제용 가드도 내려간다 — 다만 *"원본에도 그 성질이 있나"* 를 먼저 확인했다:
 *
 * | 지키던 것 | 원본(`/seller/orders`·`/seller/analytics`) | 판정 |
 * |---|---|---|
 * | 환불을 상태 변경으로 하지 않는다 | `api.post('/api/seller/orders/{n}/refund')` | ✅ 같다 |
 * | 한 번의 탭으로 환불되지 않는다 | `confirmDialog({ danger: true, '되돌릴 수 없습니다' })` | ✅ 같다 |
 * | **환불 사유를 적는다** | 본문이 `{}` — 사유 칸이 없다 | 🔴 **손수 시트가 더 나았다** |
 * | 분석이 서버 값만 그린다 | 그 화면이 원본이다(사본이 복제했던 것) | ✅ 같다 |
 *
 * 🔴 **그래서 철거로 잃은 것이 하나 있다 — 환불 사유.** 되돌릴 수 없는 일에 이유를 남기는 것은
 *   원본에 **넣어야 할 것**이고, 환불은 등급 C 라 대표 판단 자리다(결재문 §철거로 잃은 것).
 */

describe('등록 — 폼을 복제하지 않는다', () => {
  /**
   * 🔁 2026-09-26 **전제가 뒤집혔다.** 원래 이 시험은 *"마이는 전체화면 폼으로 보내기만 한다"* 였다.
   * 대표 *"이용권 등록, 숙소까지 해줘"* 로 등록도 마이 안에서 끝나게 됐다 — 다만 **지키려던 것은
   * 그대로다**: 폼을 복제하지 않는다. 방법이 "내보낸다" 에서 "같은 페이지를 시트로 연다" 로 바뀐 것뿐.
   * ⇒ 판정을 **목적지**가 아니라 **복제 금지**에 다시 건다(세부는 `seller-register-stays-in-my`).
   */
  it('마이 어디에도 등록 폼 부품을 직접 들이지 않는다', () => {
    for (const [name, code] of [['section', SECTION]] as const) {
      expect(stripComments(code), `${name}: 등록 폼 부품을 여기서 import 하면 두 벌이 갈린다`)
        .not.toMatch(/seller-meal-voucher\//)
    }
  })
})

describe('시트는 좌석이 맞을 때만 열리고, 같은 셸을 쓴다', () => {
  it('도구를 열기 전에 좌석을 맞춘다', () => {
    const code = stripComments(SECTION)
    // 🔁 2026-10-01 철거: 좌석 맞추기가 `ensureSeat` 한 벌로 합쳐졌다(`openTool`·`openPage` 공용).
    //   불변식은 그대로 — **좌석을 맞추고, 못 잡으면 열지 않는다.**
    const at = code.indexOf('async function openTool')
    expect(at, 'openTool 이 없다 — 앵커가 낡았다').toBeGreaterThan(0)
    expect(code.slice(at, at + 200), 'openTool 이 좌석을 안 거친다')
      .toMatch(/if \(!\(await ensureSeat\(\)\)\) return/)
    const sat = code.indexOf('async function ensureSeat()')
    expect(sat, 'ensureSeat 가 없다 — 좌석 규칙이 흩어졌다').toBeGreaterThan(0)
    const fn = code.slice(sat, sat + 500)
    expect(fn).toContain('currentSeatId() === store.seller_id')
    expect(fn).toContain('switchSeat(')
    expect(fn, '좌석을 못 잡았는데 열면 남의 가게 데이터를 그린다').toMatch(/if \(!ok\).*return false/s)
  })

  it('남은 시트가 좌석을 스스로도 확인한다', () => {
    for (const [name, code] of [['payout', PAYOUT]] as const) {
      expect(stripComments(code), `${name}`).toContain('currentSeatId() !== sellerId')
    }
  })

  it('쓰기 시트는 보내기 직전 assertSeat 을 지난다', () => {
    // 💰 2026-10-12: 남은 쓰기 시트는 계좌(`BankSheet`) — 정산 시트는 읽기 전용이 됐다.
    for (const [name, code] of [['bank', BANK]] as const) {
      expect(stripComments(code), `${name}`).toContain('assertSeat(sellerId)')
    }
  })

  it('시트 셸이 하나다 — 높이·z-index·스크롤 규약이 갈리지 않게', () => {
    for (const [name, code] of [['payout', PAYOUT], ['bank', BANK]] as const) {
      expect(stripComments(code), `${name} 가 자체 오버레이를 그리면 셸이 두 벌이 된다`).toContain("from './Sheet'")
      expect(stripComments(code), `${name}`).not.toContain('fixed inset-0')
    }
    const shell = stripComments(SHEET)
    expect(shell).toContain('Z.SHEET_BACKDROP')
    expect(shell).toContain('flex-1 min-h-0 overflow-y-auto')
  })
})
