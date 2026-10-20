/**
 * 💳 **결제 콜백 주소 — 경로는 막고 쿼리는 남긴다** (2026-09-13)
 *
 * 대표 신고: *"토스페이먼츠 pg로 결제 중인데 안되고"* · 화면 `결제 정보: GB-3-1788967989484`.
 *
 * ## 무엇이 깨져 있었나
 * `TossWidgetPayPage` 가 결제 성공 주소를 `safeInternalPath()` 에 통과시켰는데 그 함수는
 * **쿼리를 통째로 지운다**(2026-05-01 카카오 returnUrl 의 `?error=` 누적 차단용 — *OAuth* 규칙).
 * 결제 콜백에서 쿼리는 장식이 아니라 **데이터**다: 토스는 `paymentKey·orderId·amount` 만 붙여
 * 돌려주므로 "어느 상품·몇 개·어느 주문" 은 우리가 실어 보낸 쿼리로만 돌아온다.
 *
 * 세 흐름이 **에러 없이** 깨져 있었다 — 그래서 아무도 신고하지 않았다(마지막 화면만 틀렸다).
 *
 * ## 이 시험이 지키는 두 축 — 하나라도 놓치면 의미가 없다
 * ① **쿼리가 살아남는가** (깨져 있던 것)
 * ② **오픈 리다이렉트가 여전히 막히는가** (고치다 무너뜨리면 훨씬 큰 사고)
 *
 * ⚠️ 못 막는 것: 토스가 실제로 그 주소로 돌려보내는지(외부 PG 동작 — staging 실결제 몫) ·
 *   `TossWidgetPayPage` 가 이 함수를 **부르는지**는 아래 배선 단언이 소스로만 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { safePaymentReturnPath, safeInternalPath } from '@/utils/safe-internal-path'
import { stripComments } from '../helpers/source-text'

describe('💳 결제 콜백 주소 — 쿼리는 데이터다', () => {
  it('🔴 대표가 겪은 그 입력 — 이용권 카드결제의 productId·qty 가 살아남는다', () => {
    const raw = '/group-buy/confirm-payment?productId=2306&qty=1'
    // 종전 함수는 지웠다(이게 결함이었다).
    expect(safeInternalPath(raw, '/')).toBe('/group-buy/confirm-payment')
    // 새 함수는 남긴다.
    const out = safePaymentReturnPath(raw, '/')
    expect(new URLSearchParams(out.split('?')[1]).get('productId')).toBe('2306')
    expect(new URLSearchParams(out.split('?')[1]).get('qty')).toBe('1')
  })

  it('숙소 예약의 order_id 도 살아남는다 — STAY-N 역산 폴백에 기대지 않는다', () => {
    const out = safePaymentReturnPath('/stays/checkout-return?order_id=123', '/')
    expect(new URLSearchParams(out.split('?')[1]).get('order_id')).toBe('123')
  })

  it('알림톡 충전의 charge·orderId 도 살아남는다', () => {
    const out = safePaymentReturnPath('/seller/alimtalk?charge=success&orderId=AT-9', '/')
    const q = new URLSearchParams(out.split('?')[1])
    expect(q.get('charge')).toBe('success')
    expect(q.get('orderId')).toBe('AT-9')
  })

  it('쿼리가 없으면 종전과 똑같다 — 딜 충전 경로는 byte-동일', () => {
    expect(safePaymentReturnPath('/points/charge/success', '/')).toBe('/points/charge/success')
    expect(safePaymentReturnPath('/points/charge/success', '/')).toBe(safeInternalPath('/points/charge/success', '/'))
  })

  it('추천 코드(ref)처럼 종전에 보존되던 것도 그대로 온다', () => {
    const out = safePaymentReturnPath('/group-buy/confirm-payment?productId=7&qty=2&ref=abc_1', '/')
    expect(new URLSearchParams(out.split('?')[1]).get('ref')).toBe('abc_1')
  })
})

describe('🔒 오픈 리다이렉트 방어 — 고치면서 무너뜨리지 않았는가', () => {
  // 경로 판정은 `isSafeInternalPath` 같은 함수를 그대로 쓴다. 쿼리를 살렸다고 뚫리면 안 된다.
  const attacks: Array<[string, string]> = [
    ['https://evil.com/x?a=1', '외부 절대 URL'],
    ['//evil.com/x?a=1', 'protocol-relative'],
    ['/\\evil.com?a=1', '역슬래시'],
    ['evil.com?a=1', '슬래시로 시작 안 함'],
    ['/login?next=/admin', '인증 경로(자기참조 루프)'],
    ['/auth/callback?code=1', '콜백 경로'],
    ['/oauth/x?a=1', 'OAuth 경로'],
    ['/ok\npath?a=1', '제어문자'],
  ]
  for (const [raw, why] of attacks) {
    it(`막힌다: ${why}`, () => {
      expect(safePaymentReturnPath(raw, '/fallback')).toBe('/fallback')
    })
  }

  /**
   * 🩸 첫 판은 `not.toContain('#')` + `toContain('productId=5')` 로 썼는데 **헛돌았다**(주입이 잡았다).
   *   조각을 안 떼면 `productId` 의 **값**이 `5#token=abc` 가 되고, 재인코딩이 그걸 `5%23token%3Dabc`
   *   로 바꾼다 — 리터럴 `#` 은 없고 문자열은 여전히 `productId=5` 로 시작한다. 둘 다 통과한다.
   *   ⇒ 모양이 아니라 **값**을 본다.
   */
  it('조각(#)은 버린다 — 서버 리다이렉트에서 살아남지 못하는 걸 남기면 "왔겠거니" 하는 코드를 부른다', () => {
    const out = safePaymentReturnPath('/group-buy/confirm-payment?productId=5#token=abc', '/')
    const q = new URLSearchParams(out.split('?')[1] ?? '')
    expect(q.get('productId')).toBe('5')        // 조각이 값에 섞이면 '5#token=abc' 가 된다
    expect(out).not.toContain('token')          // 조각 내용이 어떤 형태로도 안 실린다
  })

  it('쿼리는 재인코딩된다 — 이상한 바이트가 주소에 그대로 박히지 않는다', () => {
    const out = safePaymentReturnPath('/group-buy/confirm-payment?name=a b&productId=5', '/')
    expect(out).not.toMatch(/name=a b/)          // 날것의 공백 없음
    expect(new URLSearchParams(out.split('?')[1]).get('name')).toBe('a b')  // 값 자체는 보존
  })

  /**
   * 🩸 이 세 건도 주입이 잡아 준 자리다. 위 공격 목록은 전부 **경로**에 나쁜 문자가 있어
   *   `isSafeInternalPath` 가 어차피 잡는다 — 쪼개기 전 사전 차단을 통째로 지워도 초록이었다.
   *   사전 차단이 실제로 일하는 자리는 **쿼리 쪽**이다.
   */
  const queryAttacks: Array<[string, string]> = [
    ['/group-buy/confirm-payment?productId=5&x=a\\b', '쿼리의 역슬래시'],
    ['/group-buy/confirm-payment?productId=5&x=a\nb', '쿼리의 개행'],
    ['/group-buy/confirm-payment?productId=5&x=a\0b', '쿼리의 널 문자'],
  ]
  for (const [raw, why] of queryAttacks) {
    it(`막힌다: ${why} — 경로만 보면 통과해 버린다`, () => {
      expect(safePaymentReturnPath(raw, '/fallback')).toBe('/fallback')
    })
  }

  it('터무니없이 긴 주소는 폴백 — 길이 상한이 있다', () => {
    expect(safePaymentReturnPath('/x?a=' + 'z'.repeat(2000), '/fallback')).toBe('/fallback')
  })

  it('문자열이 아니거나 비면 폴백', () => {
    expect(safePaymentReturnPath(null, '/f')).toBe('/f')
    expect(safePaymentReturnPath('', '/f')).toBe('/f')
    expect(safePaymentReturnPath(undefined, '/f')).toBe('/f')
  })
})

describe('🔌 배선 — 결제 화면이 실제로 새 함수를 쓰는가', () => {
  const src = stripComments(readFileSync('src/pages/TossWidgetPayPage.tsx', 'utf8'))

  it('successUrl·failUrl 둘 다 safePaymentReturnPath 를 통과한다', () => {
    expect(src).toMatch(/const successUrl = `\$\{window\.location\.origin\}\$\{safePaymentReturnPath\(successUrlRaw, '\/'\)\}`/)
    expect(src).toMatch(/const failUrl = `\$\{window\.location\.origin\}\$\{safePaymentReturnPath\(failUrlRaw, '\/'\)\}`/)
  })

  it('🔴 옛 함수로 되돌아가지 않는다 — 되돌아가면 쿼리가 다시 사라진다', () => {
    expect(src).not.toMatch(/safeInternalPath\(\s*(successUrlRaw|failUrlRaw)/)
  })

  it('⚠️ 잠긴 계약은 그대로다 — 이 커밋이 만진 건 경로 검증 한 곳뿐', () => {
    // 결제 호출·위젯 마운트·금액 설정은 손대지 않았다(잠금표가 byte-불변을 요구한다).
    expect(src).toMatch(/requestPayment/)
    expect(src).toMatch(/widgets\(\{ customerKey/)
    expect(src).toMatch(/setAmount\(\{ currency: 'KRW', value: Math\.round\(amount\) \}\)/)
    expect(src).toMatch(/id="toss-widget-pay-method"/)
    expect(src).toMatch(/id="toss-widget-pay-agreement"/)
  })
})
