/**
 * 💳 결제수단 판정 SSOT + 명칭(교환권 ≠ 이용권) 고정 — 2026-08-03
 *
 * ## 무슨 일이 있었나
 *
 * 세션이 대표에게 **"이용권·교환권은 딜로만 살 수 있다"** 고 보고했다. **틀렸다.**
 * `getProductFlow` 는 카테고리가 아니라 `deal_only` / `group_buy_status` 로 가른다:
 *
 * ```
 * deal_only === 1               → voucher_deal     (딜)   ← 교환권(기프티콘·KT)
 * group_buy_status === 'active' → group_buy_toss   (카드) ← 이용권(식당·뷰티·숙박)·공구
 * 그 외                          → standard_checkout (카드)
 * ```
 *
 * 오판의 직접 원인은 소비자 화면의 **낡은 주석**이었다 — *"교환권(voucher 카테고리)은 딜 결제"*.
 * 명칭 SSOT 상 `meal_voucher` 는 **이용권**이고 카드로 판다(SSOT 주석의 예: 김밥천국 할인권 = 공구, Toss).
 * 그 한 줄 때문에 "카드로 살 수 있는 상품이 없다 → 새로 만들어야 한다"는 잘못된 절차까지 갈 뻔했다.
 *
 * ## 이 테스트가 막는 것
 *
 * ① 판정 함수가 카테고리로 되돌아가는 것 ② 소비자 표면이 SSOT 를 우회해 카테고리로 결제수단을
 * 정하는 것. ⚠️ **못 막는 것**: 서버가 실제로 어떤 결제를 태우는지(런타임) — 그건 실결제로만 안다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { getProductFlow } from '../../shared/product-flow'

const read = (p: string) => readFileSync(p, 'utf8')

describe('결제수단 판정 SSOT — 카테고리가 아니라 deal_only/group_buy_status', () => {
  it('교환권(deal_only=1)만 딜 결제다', () => {
    expect(getProductFlow({ deal_only: 1, category: 'meal_voucher' })).toBe('voucher_deal')
    expect(getProductFlow({ deal_only: 1, category: null })).toBe('voucher_deal')
  })

  it('🔴 이용권(meal_voucher 등)은 카드다 — 카테고리로 딜 판정하지 않는다', () => {
    // 김밥천국 할인권(id=25, meal_voucher, group_buy_status=active) 이 라이브의 실제 예다.
    expect(getProductFlow({ deal_only: 0, category: 'meal_voucher', group_buy_status: 'active' }))
      .toBe('group_buy_toss')
    for (const c of ['meal_voucher', 'beauty_voucher', 'stay_voucher', 'etc_voucher']) {
      expect(getProductFlow({ deal_only: 0, category: c, group_buy_status: 'active' }), `${c} 는 카드여야 한다`)
        .toBe('group_buy_toss')
    }
  })

  it('그 외는 일반 체크아웃(카드)', () => {
    expect(getProductFlow({ deal_only: 0, category: 'living', group_buy_status: null })).toBe('standard_checkout')
  })
})

describe('소비자 표면이 SSOT 를 우회하지 않는다', () => {
  const gbd = read('src/pages/GroupBuyDetailPage.tsx')

  it('공구/이용권 상세가 resolveProductFlow 로 흐름을 정한다', () => {
    // 이 호출이 카테고리 판정으로 바뀌면 이용권 전체가 카드 결제에서 빠진다.
    expect(gbd, 'SSOT 호출이 사라졌다 — 카테고리로 판정하면 이용권이 딜로 잘못 간다')
      .toContain('resolveProductFlow(detail)')
  })

  it('결제수단을 카테고리 술어로 고르지 않는다', () => {
    const exec = gbd
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n')
    // `payment_method: isVoucherCategory(...) ? 'deal' : 'toss'` 같은 형태
    expect(exec).not.toMatch(/payment_method\s*[:=][^\n]*isVoucherCategory/)
    // 흐름 상수 자체를 카테고리로 만들어내는 형태
    expect(exec).not.toMatch(/(flow|Flow)\s*=\s*isVoucherCategory/)
  })

  it('교환권을 카테고리로 정의하는 주석이 없다 (다음 세션을 오도한다)', () => {
    expect(gbd).not.toMatch(/교환권\s*[(（][^)）]*(카테고리|category)/)
  })
})
