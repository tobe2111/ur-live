/**
 * 🎟️ 2026-11-04 [UNLOCK_LOADING] 대표 *"잠금파일도 모두 허가해줄게"* — 내 이용권 탭이 공용 봉투 app-components(109KB)를
 *   받고 9KB 만 쓰던 것: 지갑 부품 다섯을 catch-all **앞에서** app-wallet 으로 보낸다(870 → 741KB).
 * ⚠️ 못 보는 것: 실제 청크 배치(CI surface-budgets 가 빌드 산출물로 본다). 여기서는 규칙의 존재와 **순서**(catch-all 앞)만.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('지갑 부품은 지갑 봉투로', () => {
  const v = readFileSync('vite.config.ts', 'utf8')
  const rule = v.indexOf("(AddToHomeHint|voucher\\/(ScannableQr|VoucherRedeemModal|RedeemReviewCard))")
  const catchAll = v.indexOf("if (id.includes('/src/components/')) return 'app-components'")
  it('규칙이 있고 catch-all 보다 먼저 온다(먼저 맞는 규칙이 이긴다)', () => {
    expect(rule).toBeGreaterThan(0)
    expect(catchAll).toBeGreaterThan(rule)
    expect(v.slice(rule, rule + 300)).toContain("return 'app-wallet'")
  })
  it('지갑 페이지는 여전히 QR 창을 정적으로 쓴다(누르는 순간 받게 하면 더 느리다)', () => {
    expect(readFileSync('src/pages/MyVouchersPage.tsx', 'utf8')).toMatch(/^import QRModal from '\.\/my-vouchers\/QRModal'/m)
  })
})
