/**
 * 🧾 철거로 잃은 둘을 **원본 화면에** 복원 (2026-10-06)
 *
 * 대표 2026-10-06 "모두 다 해줘" — 결재 `2026-09-28-my-stage2-sheet-teardown.md` §잃은 것의 1·2.
 * 손수 시트가 원본보다 **나았던** 자리다. 결재문이 명시한다: *"1·2 는 원본에 **넣어야 할 것**이고 …
 * **사본을 되살리는 것이 아니다**"* ⇒ 시트를 복구하지 않았다는 것도 함께 고정한다.
 *
 * | 무엇 | 손수 시트(철거됨) | 원본(전) | 이 PR |
 * |---|---|---|---|
 * | 환불 **사유** | 고르고 → 사유 → 확인 | 확인 창만, **칸 없음** | `promptDialog` 로 받아 `reason` 으로 보낸다 |
 * | 이용권 **가격 확인** | 바뀌면 한 번 더 묻는다 | 그 단계 없음 | 바뀔 때만 `confirmDialog` |
 *
 * 🔒 **둘 다 서버 무접촉이다** — 환불은 `seller-orders.routes.ts` 가 **이미** `reason` 을 읽어
 *   200자로 자르고, 가격은 보낼 값이 그대로다. 금액 계산·환불 경로(`refundOrderFully`)는 불변.
 *
 * ⚠️ **이 시험이 못 보는 것**: 창이 실제로 뜨는지·사유가 서버 기록에 남는지는 문자열로 알 수 없다.
 *   그건 staging 실결제(S-RR1)가 판정한다. 여기서는 **배선과 계약**만 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const code = (p: string) => stripComments(readFileSync(p, 'utf8'))

const ORDERS = 'src/pages/SellerOrdersPage.tsx'
const EDIT = 'src/pages/SellerProductEditPage.tsx'
const ROUTE = 'src/features/seller/api/seller-orders.routes.ts'
// 🔀 2026-10-06 재조준: 두 화면이 600줄 래칫에 닿아 **계약을 모듈로 추출**했다(지키려던 것은 그대로).
const PROMPT = 'src/pages/seller-orders/refund-prompt.ts'
const PRICE = 'src/pages/seller-product-edit/confirm-price-change.ts'

describe('① 환불 사유 — 원본이 사유를 받아 보낸다', () => {
  it('promptDialog 로 받는다 (confirmDialog 만으로는 칸이 없다)', () => {
    const s = code(PROMPT)
    expect(s, '사유 입력이 사라졌다 — 되돌릴 수 없는 일에 이유가 안 남는다').toContain('promptDialog(')
    expect(s, 'prompt 모드가 아니면 입력 칸이 안 뜬다').toMatch(/promptDialog\(\{[\s\S]*?prompt:\s*\{/)
    expect(code(ORDERS), '화면이 그 모듈을 안 쓰면 칸이 안 뜬다').toContain('askRefundReason(t)')
  })

  it('취소(null)면 환불을 **보내지 않는다**', () => {
    const s = code(ORDERS)
    expect(s, 'null 분기가 없으면 창을 닫아도 환불이 나간다').toContain("if (reason === null) return")
  })

  it('받은 사유를 그 요청 본문에 실어 보낸다 — 빈 칸이면 기본값', () => {
    const s = code(ORDERS)
    expect(s, '빈 본문({})으로 돌아갔다 — 사유가 서버에 도달하지 않는다')
      .toMatch(/\/refund`,\s*\{\s*reason:\s*reason\.trim\(\)\s*\|\|\s*REFUND_REASON_FALLBACK/)
    expect(s, '빈 본문 호출이 남아 있다').not.toMatch(/\/refund`,\s*\{\s*\}\s*\)/)
  })

  it('🔒 서버는 무접촉 — 이미 reason 을 읽어 200자로 자른다', () => {
    const s = code(ROUTE)
    expect(s, '서버가 reason 을 안 읽으면 클라가 보내도 버려진다').toMatch(/body\.reason/)
    expect(s, '길이 상한이 사라졌다').toMatch(/\.slice\(0,\s*200\)/)
  })
})

describe('② 이용권 가격 확인 — 바뀔 때만 한 번 더 묻는다', () => {
  it('저장 전에 가격 변화를 보고 확인을 받는다', () => {
    const s = code(PRICE)
    expect(s, '가격 확인 단계가 사라졌다').toContain('confirmDialog(')
    expect(s, '전/후 가격을 보여 주지 않으면 무엇이 바뀌는지 모른다')
      .toMatch(/formatWon\(basePrice\)[\s\S]{0,40}formatWon\(nextPrice\)/)
  })

  it('안 바뀌면 묻지 않는다 — 조건이 `===` 로 조기 통과한다', () => {
    const s = code(PRICE)
    expect(s, '무조건 묻는다면 저장마다 창이 떠서 사람이 눌러 넘긴다(경고가 죽는다)')
      .toMatch(/nextPrice === basePrice\) return true/)
  })

  it('거절하면 저장을 **보내지 않는다**', () => {
    const s = code(EDIT)
    expect(s, '확인 결과를 안 보면 물어 보고도 저장된다')
      .toMatch(/if \(!\(await confirmPriceChange\(t, product\?\.price, formData\.price\)\)\) return/)
  })

  it('🔒 금액을 계산하지 않는다 — 보낼 값은 그대로다', () => {
    const s = code(EDIT)
    expect(s, '확인 단계가 payload 의 price 를 다시 쓰면 화면이 금액을 지어내는 자리가 된다')
      .toMatch(/price:\s*Number\(formData\.price\)/)
  })
})

describe('🔴 사본을 되살리지 않았다 — 결재문이 명시한 조건', () => {
  it('철거된 손수 시트 파일이 돌아오지 않았다', () => {
    for (const f of ['RefundSheet', 'VoucherEditSheet']) {
      expect(existsSync(`src/pages/user-profile/seller-section/${f}.tsx`),
        `${f} 가 되살아났다 — 결재는 "원본에 넣는다"였다(같은 일에 화면이 둘이 되면 한쪽만 고쳐진다)`)
        .toBe(false)
    }
  })
})
