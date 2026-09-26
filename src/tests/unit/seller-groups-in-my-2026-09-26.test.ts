/**
 * 🧰 마이 안 판매 = 묶음 다섯 (2026-09-26, 설계 §21)
 *   대표: *"일단 마이에서 대부분 끝내야 해"*
 *
 * 여기 고정하는 것들은 **전부 에러 없이 회귀한다**:
 *   - 좌석 가드가 빠져도 화면은 멀쩡히 그려진다 — 남의 가게 주문이 뜰 뿐이다.
 *   - 상태 전이를 여기서 다시 구현해도 동작한다 — 규칙이 두 벌이 될 뿐이다.
 *   - 가게 시트가 계좌 필드를 같이 보내도 저장은 된다 — 사장님이 상호를 고치려다 PIN 을 요구받을 뿐이다.
 *   - 가격 확인 단계가 사라져도 저장은 된다 — 한 손 실수가 손님이 보는 값을 바꿀 뿐이다.
 * ⇒ 그래서 주입 러너(`scripts/mutations/seller-groups-in-my.mjs`)가 매번 깨뜨려 본다.
 *
 * ## 이 시험이 **못** 막는 것
 *   - 실제 렌더·레이아웃(jsdom 은 높이가 없다) — 시트가 폰에서 잘리는지는 브라우저가 판정한다.
 *   - 서버가 정말 그 필드를 받는지 — 라이브 계약은 staging 이 판정한다.
 */
import { describe, it, expect } from 'vitest'
import { readCode, stripComments } from '../helpers/source-text'

const SECTION = readCode('src/pages/user-profile/SellerSection.tsx')
const ORDERS = readCode('src/pages/user-profile/seller-section/OrdersSheet.tsx')
const VOUCHERS = readCode('src/pages/user-profile/seller-section/VoucherSheet.tsx')
const VEDIT = readCode('src/pages/user-profile/seller-section/VoucherEditSheet.tsx')
const STORE = readCode('src/pages/user-profile/seller-section/StoreSheet.tsx')

/** 읽어 온 소스가 실제로 내용이 있는가 — 경로가 낡아 빈 문자열이면 아래 `not.toMatch` 가 전부 헛돈다. */
describe('0. 검사 대상이 실재한다 (0건이면 통과가 아니라 고장)', () => {
  it('네 시트 소스가 모두 충분한 길이로 읽힌다', () => {
    for (const [name, code] of [['orders', ORDERS], ['vouchers', VOUCHERS], ['voucherEdit', VEDIT], ['store', STORE]] as const) {
      expect(code.length, `${name}: 소스를 못 읽었다 — 파일이 옮겨졌다면 앵커부터 고칠 것`).toBeGreaterThan(1500)
    }
  })
})

describe('1. 🧾 주문 묶음 — 마이 안에서 지난 주문까지', () => {
  it('🪑 좌석이 안 맞으면 **부르지 않는다**', () => {
    // 부르면 조용히 남의 가게 주문을 그린다(에러가 안 난다 — 이 레포가 반복해 당한 클래스).
    expect(stripComments(ORDERS)).toMatch(/if \(currentSeatId\(\) !== sellerId\)/)
  })

  it('상태 전이를 여기서 다시 구현하지 않는다 — `work.confirmOrder` 를 쓴다', () => {
    const code = stripComments(ORDERS)
    expect(code, '주문 시트가 직접 쓰기를 하면 전이 규칙이 두 벌이 된다').not.toMatch(/api\.(put|patch|post|delete)\(/)
    expect(code).toContain('work.confirmOrder(')
  })

  it('전부 한 번에 받지 않는다 — offset 으로 이어 받는다', () => {
    const code = stripComments(ORDERS)
    expect(code).toMatch(/offset=\$\{offset\}/)
    expect(code, '더 보기가 없으면 옛 주문에 닿을 수 없다').toContain('더 보기')
  })

  it('환불을 여기서 실행하지 않는다 — 사유를 적어야 하고 되돌릴 수 없다', () => {
    // 🩸 처음엔 `/refund|환불/i` 로 썼는데 상태 라벨 `REFUNDED: '환불'` 에 걸렸다(표시 문자열이다).
    //   판정은 **엔드포인트**로 한다 — 위 '쓰기 없음' 단언과 짝이다.
    expect(stripComments(ORDERS), '환불은 전용 시트가 맡는다').not.toMatch(/['"`][^'"`]*\/refund/)
  })

  /**
   * 🩸 2026-09-26 — **내가 만든 결함을 잡아 둔다.** 낱개 `ToolRow` 목록을 묶음으로 바꾸며 '환불' 줄을
   * 지웠는데, 새 자리를 안 만들어서 `RefundSheet` 가 **어디서도 열리지 않게** 됐다. tsc 도 테스트도
   * 통과했다(분기는 남아 있고 아무도 그 상태를 세팅하지 않을 뿐이다) — 전형적인 "조용한 부재".
   */
  it('🔴 환불에 닿을 길이 있다 — 주문에서 열고, 닫으면 주문으로 돌아온다', () => {
    expect(stripComments(ORDERS), '주문 시트에 문이 없으면 환불 시트는 도달 불가다').toMatch(/onClick=\{onRefund\}/)
    const code = stripComments(SECTION)
    expect(code, '주문 시트의 문이 환불로 배선되지 않았다').toContain("onRefund={() => setTool('refund')}")
    const at = code.indexOf("tool === 'refund'")
    expect(at, '환불 분기가 없다').toBeGreaterThan(0)
    expect(code.slice(at, at + 300), '닫으면 주문 목록으로 돌아와야 한다 — 어디서 왔는지 잊지 않게')
      .toContain("onClose={() => setTool('orders')}")
  })
})

describe('2. 🎟️ 이용권 묶음 — 목록·중지/재개·고치기', () => {
  it('목록을 다시 부르지 않는다 — 마이 카드와 같은 `work` 를 쓴다', () => {
    const code = stripComments(VOUCHERS)
    expect(code, '또 부르면 같은 화면에 두 개의 진실이 생긴다').not.toMatch(/api\./)
    // 🩸 `work.products` 로 앵커했다가 빨간불 — 이 파일은 구조분해로 받는다. 앵커는 **출처**에 건다.
    expect(code, '목록의 출처가 work 가 아니면 카드와 갈린다').toMatch(/\}\s*=\s*work\b/)
    expect(code).toContain('products.filter')
    expect(code).toMatch(/toggleProduct\(p\)/)
  })

  it('등록은 시트 안에서 만들지 않는다 — 전체화면으로 나간다', () => {
    const code = stripComments(VOUCHERS)
    expect(code, '같은 폼이 두 벌이 되면 반드시 한쪽만 고쳐진다').toContain('onRegister')
    expect(code).not.toMatch(/meal-voucher\/new/)
  })

  it('좌석에 막 앉은 순간의 빈 목록을 "없음" 으로 단정하지 않는다', () => {
    // `openTool` 이 좌석을 발급한 직후에는 목록이 아직 안 왔다 — 그때 "없어요" 를 그리면 거짓말이다.
    expect(stripComments(VOUCHERS)).toMatch(/products\.length === 0 && work\.loading/)
    expect(stripComments(VOUCHERS), '실패를 0개로 그리면 안 된다').toContain('work.failed')
  })

  it('이름과 스위치가 **자리를 나눈다** — 끄려다 편집이 열리면 안 된다', () => {
    const code = stripComments(VOUCHERS)
    expect(code).toMatch(/onClick=\{\(\) => setEditing\(p\)\}/)
    expect(code).toMatch(/role="switch"/)
  })
})

describe('3. 🎟️ 이용권 고치기 — 손님이 보는 값이다', () => {
  it('🔴 가격이 바뀌면 한 번 더 묻는다', () => {
    const code = stripComments(VEDIT)
    expect(code, '한 손으로 쓰는 물건이라 실수도 한 손으로 난다').toMatch(/if \(priceChanged && !confirming\) \{ setConfirming\(true\); return \}/)
  })

  it('가격을 **안 바꿨으면** 확인 단계가 없다 — 매번 물으면 확인이 무의미해진다', () => {
    const code = stripComments(VEDIT)
    expect(code).toMatch(/const priceChanged = priceOk && nextPrice !== basePrice/)
    // 되돌리면 확인 단계도 취소된다 — 안 그러면 '확인' 이 옛 금액을 저장한다.
    expect(code).toMatch(/if \(!priceChanged\) setConfirming\(false\)/)
  })

  it('🪑 보내기 직전에 좌석을 다시 확인한다 (§15-3 규칙 ②)', () => {
    expect(stripComments(VEDIT)).toContain('assertSeat(sellerId)')
  })

  it('사진·옵션은 보내지 않는다 — 그건 전체화면 폼의 일이다', () => {
    const code = stripComments(VEDIT)
    for (const f of ['images', 'detail_images', 'image_url']) {
      expect(code, `${f} 를 여기서 보내면 전체화면 폼과 두 벌이 된다`).not.toMatch(new RegExp(`body\\.${f}|${f}:`))
    }
  })
})

describe('4. 🏪 가게 묶음 — 계좌는 여기 없다', () => {
  /**
   * 🔴 서버는 계좌 필드가 **섞이기만 해도** PIN(412)과 소유자(403) 게이트를 켠다
   * (`seller-profile.routes` 의 `bankChanged`). 상호를 고치려던 사람이 PIN 을 요구받게 된다.
   */
  it('계좌 필드를 보내지 않는다', () => {
    const code = stripComments(STORE)
    const at = code.indexOf("api.put('/api/seller/profile'")
    expect(at, '저장 호출을 못 찾았다 — 앵커가 낡았다').toBeGreaterThan(0)
    const call = code.slice(at, at + 400)
    for (const f of ['bank_name', 'bank_account', 'account_holder']) {
      expect(call, `${f} 를 보내면 서버가 PIN·소유자 게이트를 켠다`).not.toContain(f)
    }
  })

  it('손님에게 보이는 넷만 보낸다', () => {
    const code = stripComments(STORE)
    const at = code.indexOf("api.put('/api/seller/profile'")
    const call = code.slice(at, at + 400)
    for (const f of ['business_name', 'phone', 'address', 'description']) {
      expect(call).toContain(f)
    }
  })

  it('🪑 좌석 가드 + 보내기 직전 확인', () => {
    const code = stripComments(STORE)
    expect(code).toMatch(/if \(currentSeatId\(\) !== sellerId\)/)
    expect(code).toContain('assertSeat(sellerId)')
  })

  it('승인 상태는 마이 카드와 **같은 문장**을 쓴다', () => {
    // 두 곳이 다르게 설명하면 더 헷갈린다 — 문장은 `STATUS_NOTE` 한 곳에서만 나온다.
    expect(stripComments(STORE), '시트가 자기 문장을 지어내면 두 벌이 된다').not.toMatch(/승인 대기 중이에요|서류가 반려됐어요/)
    expect(stripComments(STORE)).toContain('statusNote')
    expect(stripComments(SECTION)).toContain('statusNote={note}')
  })
})

describe('5. 🧰 배선 — 낱개 목록이 아니라 묶음이다', () => {
  it('다섯 묶음이 모두 카드에 있다', () => {
    const code = stripComments(SECTION)
    for (const t of ['orders', 'vouchers', 'withdraw', 'analytics', 'store']) {
      expect(code, `${t} 묶음 줄이 없다 — 그 화면에 닿을 길이 사라진다`).toContain(`openTool('${t}')`)
    }
  })

  it('다섯 묶음이 모두 시트로 열린다 (줄만 있고 시트가 없으면 아무 일도 안 난다)', () => {
    const code = stripComments(SECTION)
    for (const [t, tag] of [['orders', '<OrdersSheet'], ['vouchers', '<VoucherSheet'], ['store', '<StoreSheet'], ['analytics', '<AnalyticsSheet'], ['withdraw', '<WithdrawSheet']] as const) {
      const at = code.indexOf(`tool === '${t}'`)
      expect(at, `${t} 분기가 없다`).toBeGreaterThan(0)
      expect(code.slice(at, at + 200), `${t} 가 ${tag} 를 안 연다`).toContain(tag)
    }
  })

  it('판매 중 목록이 두 곳에 있지 않다 — `SellingList` 는 지웠다', () => {
    // 같은 목록이 카드와 묶음 두 곳에 있으면 한쪽만 새로고침되는 날이 온다.
    expect(stripComments(SECTION)).not.toContain('<SellingList')
  })

  it('할 일(확인 대기)은 카드에 남는다 — 가장 잦은 행동을 한 탭 더 깊게 두지 않는다', () => {
    expect(stripComments(SECTION)).toContain('<PendingOrders')
  })

  it('네 시트 모두 공용 셸(`Sheet`)을 쓴다 — 뒤로가기·z-index·스크롤 규약이 갈리지 않게', () => {
    for (const [name, code] of [['orders', ORDERS], ['vouchers', VOUCHERS], ['voucherEdit', VEDIT], ['store', STORE]] as const) {
      expect(stripComments(code), `${name}: 자기 마크업을 쓰면 하단 네비 뒤로 숨거나 폰에서 잘린다`).toMatch(/from '\.\/Sheet'/)
    }
  })
})
