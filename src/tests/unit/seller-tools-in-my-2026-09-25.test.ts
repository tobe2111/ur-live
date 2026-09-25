/**
 * 🧰 마이 안 판매 도구 넷 — 등록·환불·분석·출금 (2026-09-25, 설계 §19)
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
const WITHDRAW = readCode('src/pages/user-profile/seller-section/WithdrawSheet.tsx')
const REFUND = readCode('src/pages/user-profile/seller-section/RefundSheet.tsx')
const ANALYTICS = readCode('src/pages/user-profile/seller-section/AnalyticsSheet.tsx')
const SHEET = readCode('src/pages/user-profile/seller-section/Sheet.tsx')

describe('🔴 출금 ≠ 탈퇴 (§19-0)', () => {
  it('출금 화면이 탈퇴 엔드포인트를 부르지 않는다', () => {
    const code = stripComments(WITHDRAW)
    expect(code, 'account/withdraw 는 계정 삭제다 — 사장님이 돈을 받으려다 가게를 잃는다')
      .not.toContain('account/withdraw')
    expect(code).toContain("api.post('/api/seller/deal-withdraw'")
  })

  it('마이 판매 화면 어디에도 탈퇴 엔드포인트가 없다', () => {
    for (const [name, code] of [['section', SECTION], ['refund', REFUND], ['analytics', ANALYTICS]] as const) {
      expect(stripComments(code), `${name}`).not.toContain('account/withdraw')
    }
  })

  it('최소 금액은 서버와 맞춘 하나의 값이다', () => {
    const code = stripComments(WITHDRAW)
    expect(code).toContain('export const MIN_WITHDRAW = 10_000')
    // 화면이 서버보다 느슨하면 사장님이 400 을 받고 이유를 모른다.
    expect(code).toMatch(/parsed >= MIN_WITHDRAW/)
  })

  // 🩸 이 시험은 2026-09-25 에 한 번 뒤집혔다. 처음엔 *"계좌 세 필드를 아예 안 보낸다"* 로 썼는데,
  //   실측해 보니 `settlements` 행은 **요청 본문 값 그대로** 저장되고 어드민 지급 센터는 그 행만
  //   읽는다(`sellers` 폴백 없음) — 안 보내면 **송금할 계좌가 없는 지급 행**이 조용히 생긴다.
  //   ⇒ 지켜야 할 것은 "안 보낸다" 가 아니라 **"화면이 지어내지 않는다"** 였다.
  it('입금 계좌는 서버에서 받아 그대로 돌려보낸다 (localStorage 금지)', () => {
    const code = stripComments(WITHDRAW)
    // ① 출처가 좌석 인증된 서버 응답이다.
    expect(code, '계좌를 어디서도 안 받아오면 보낼 값이 없다').toContain("api.get('/api/seller/profile')")
    // ② 그 값을 그대로 싣는다 — 이게 빠지면 어드민이 송금할 계좌가 없는 행이 생긴다.
    for (const field of ['bank_name', 'account_number', 'account_holder']) {
      expect(code, `${field} 가 본문에서 빠지면 지급 행이 비어서 저장된다`)
        .toMatch(new RegExp(`${field}:\\s*payout\\.`))
    }
    // ③ 🔴 localStorage 는 **좌석을 안 따라간다** — 가게를 옮긴 뒤 출금하면 직전 가게 계좌로 간다.
    //    (셀러 대시보드의 DealBalanceCard 가 실제로 그렇게 읽고 있다. 여기로 옮겨오면 안 된다.)
    for (const key of ['seller_bank_name', 'seller_account_number', 'seller_account_holder']) {
      expect(code, `${key} 를 읽으면 좌석이 바뀐 뒤 남의 계좌로 송금 행이 생긴다`).not.toContain(key)
    }
    // ④ 계좌를 못 받았으면 **보내지 않는다**. 송금 못 하는 행을 만드는 게 아무것도 안 하는 것보다 나쁘다.
    expect(code).toMatch(/canSend\s*=[^\n]*payout !== null/)
  })

  it('계좌 번호를 화면에 통째로 찍지 않는다', () => {
    const code = stripComments(WITHDRAW)
    expect(code).toContain('maskAccount(payout.account_number)')
    // 뒤 4자리만 남는다 — 확인에는 충분하고 화면 캡처로 전부 새지 않는다.
    expect(code).toMatch(/digits\.slice\(-4\)/)
  })

  it('서버의 412 넷이 각각 사람 말로 번역된다', () => {
    const code = stripComments(WITHDRAW)
    // 🩸 주입 검증이 잡은 것: 코드 이름만 찾으면 **참조 한 곳만 남아도 통과**한다
    //   (맵 항목을 지워도 `BLOCKED.BUSINESS_REGISTRATION_REQUIRED` 가 남는다).
    //   지키려는 건 "그 코드에 **안내 문장이 붙어 있는가**" 이므로 쌍으로 앵커한다.
    for (const c of ['BUSINESS_REGISTRATION_REQUIRED', 'PIN_REQUIRED', 'ACCOUNT_REVERIFICATION_REQUIRED']) {
      expect(code, `${c} 가 "출금 실패" 로 뭉뚱그려지면 사장님은 할 일을 모른다`)
        .toMatch(new RegExp(`${c}:\\s*'[^']{10,}'`))
    }
    expect(code, '서버가 준 code 로 안내를 고르지 않으면 번역표가 죽은 코드가 된다').toMatch(/BLOCKED\[res\.code\]/)
  })
})

describe('환불 — 화면이 돈을 옮기지 않는다', () => {
  it('환불은 환불 경로로만 한다 (상태 변경 취소 금지)', () => {
    const code = stripComments(REFUND)
    expect(code).toMatch(/api\.post\(`\/api\/seller\/orders\/\$\{encodeURIComponent\(picked\.orderNumber\)\}\/refund`/)
    expect(code, "status='CANCELLED' 는 돈을 안 돌려주고 취소 알림만 보낸다(서버도 REFUND_REQUIRED 로 막는다)")
      .not.toContain("'CANCELLED'")
  })

  it('한 번의 탭으로 환불되지 않는다 — 고르고, 사유를 적고, 확인한다', () => {
    const code = stripComments(REFUND)
    expect(code).toMatch(/if \(picked\)/)
    expect(code).toContain('setPicked(o)')
    expect(code).toContain('되돌릴 수 없습니다')
  })

  it('결제가 캡처된 주문만 후보다', () => {
    const code = stripComments(REFUND)
    expect(code).toMatch(/REFUNDABLE = new Set\(\['PAID', 'DONE', 'PREPARING', 'SHIPPING', 'DELIVERED'\]\)/)
  })
})

describe('분석 — 서버가 준 값만 그린다', () => {
  it('매출은 `/dashboard/stats` 의 daily_revenue 하나에서 온다', () => {
    const code = stripComments(ANALYTICS)
    expect(code).toContain("api.get('/api/seller/dashboard/stats')")
    expect(code).toContain('daily_revenue')
    expect(code, '주문 목록으로 매출을 다시 계산하면 대시보드와 숫자가 갈린다')
      .not.toContain('/api/seller/orders')
  })

  it('표가 아니라 요약이다 — 폰에서 읽히는 기간만 그린다', () => {
    const code = stripComments(ANALYTICS)
    expect(code).toMatch(/length: 14/)
    expect(code).not.toContain('<table')
  })
})

describe('등록 — 폼을 복제하지 않는다', () => {
  it('마이는 기존 전체화면 폼으로 보내기만 한다', () => {
    const code = stripComments(SECTION)
    expect(code).toContain("enterSeat('/seller/meal-voucher/new')")
    expect(code, '등록 폼 부품을 여기서 import 하면 두 벌이 갈린다')
      .not.toMatch(/seller-meal-voucher\//)
  })
})

describe('시트는 좌석이 맞을 때만 열리고, 같은 셸을 쓴다', () => {
  it('도구를 열기 전에 좌석을 맞춘다', () => {
    const code = stripComments(SECTION)
    const at = code.indexOf('async function openTool')
    expect(at, 'openTool 이 없다 — 앵커가 낡았다').toBeGreaterThan(0)
    const fn = code.slice(at, at + 500)
    expect(fn).toContain('currentSeatId() !== store.seller_id')
    expect(fn).toContain('switchSeat(')
    expect(fn, '좌석을 못 잡았는데 열면 남의 가게 데이터를 그린다').toMatch(/if \(!ok\).*return/s)
  })

  it('세 시트가 좌석을 스스로도 확인한다', () => {
    for (const [name, code] of [['refund', REFUND], ['analytics', ANALYTICS], ['withdraw', WITHDRAW]] as const) {
      expect(stripComments(code), `${name}`).toContain('currentSeatId() !== sellerId')
    }
  })

  it('쓰기 시트는 보내기 직전 assertSeat 을 지난다', () => {
    for (const [name, code] of [['refund', REFUND], ['withdraw', WITHDRAW]] as const) {
      expect(stripComments(code), `${name}`).toContain('assertSeat(sellerId)')
    }
  })

  it('시트 셸이 하나다 — 높이·z-index·스크롤 규약이 갈리지 않게', () => {
    for (const [name, code] of [['refund', REFUND], ['analytics', ANALYTICS], ['withdraw', WITHDRAW]] as const) {
      expect(stripComments(code), `${name} 가 자체 오버레이를 그리면 셸이 두 벌이 된다`).toContain("from './Sheet'")
      expect(stripComments(code), `${name}`).not.toContain('fixed inset-0')
    }
    const shell = stripComments(SHEET)
    expect(shell).toContain('Z.SHEET_BACKDROP')
    expect(shell).toContain('flex-1 min-h-0 overflow-y-auto')
  })
})
