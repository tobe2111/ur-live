/**
 * 💰 교환권 소비자 마진 0% 가 실제로 0% 다 (2026-09-02 대표 "교환권도 제 가격으로 안 되어 있어").
 *
 * 라이브 실측: `kt_alpha_consumer_markup_pct=20`(8/26) → 교환권 2,260개가 액면가 ×1.19(최대 1.20). 어드민에서 0 을
 * 넣어도 세 곳의 `Number(v) || 20` 이 0 을 삼켜 20% 로 되돌아갔다 — 화면으로는 끌 수 없는 마진이었다.
 *
 * ## 이 테스트가 지키는 것
 *   1. SSOT 함수: '0' → 0 · 없음/빈값/문자 → 기본 20 · 클램프 0~100.
 *   2. 가져오기(catalog)·재계산(settings) 둘 다 그 함수를 쓰고, `|| 20` 형태가 남아 있지 않다.
 * ## 못 막는 것
 *   - 실제 설정값과 재계산 실행(어드민 조작) — 배포 후 `/api/products?deal_only=1` 의 price/original_price 비율로 판정.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { resolveKtConsumerMarkupPct, KT_CONSUMER_MARKUP_DEFAULT_PCT, resolveKtSellerMarkupPct, KT_SELLER_MARKUP_DEFAULT_PCT } from '../../features/admin/api/admin-kt-alpha/markup'

// 2026-09-14: 자체 주석 제거기를 쓰고 있었다 — 문자열·정규식 안의 `/*` 를 블록주석으로 읽어
// 소스를 통째로 삼키는 그 함정(`check-comment-stripper`)이라 SSOT 로 교체했다.
const code = (p: string) => stripComments(readFileSync(p, 'utf-8'))

describe('① 마진율 해석', () => {
  it("'0' 은 0 이다 (옛 `|| 20` 의 함정)", () => {
    expect(resolveKtConsumerMarkupPct('0')).toBe(0)
    expect(resolveKtConsumerMarkupPct(0)).toBe(0)
  })
  it('없음·빈값·문자는 기본값', () => {
    expect(resolveKtConsumerMarkupPct(undefined)).toBe(KT_CONSUMER_MARKUP_DEFAULT_PCT)
    expect(resolveKtConsumerMarkupPct(null)).toBe(KT_CONSUMER_MARKUP_DEFAULT_PCT)
    expect(resolveKtConsumerMarkupPct('')).toBe(KT_CONSUMER_MARKUP_DEFAULT_PCT)
    expect(resolveKtConsumerMarkupPct('abc')).toBe(KT_CONSUMER_MARKUP_DEFAULT_PCT)
  })
  it('0~100 으로 클램프', () => {
    expect(resolveKtConsumerMarkupPct('-5')).toBe(0)
    expect(resolveKtConsumerMarkupPct('250')).toBe(100)
    expect(resolveKtConsumerMarkupPct('12.5')).toBe(12.5)
  })
})

describe('② 가격을 만드는 두 자리가 SSOT 를 쓴다', () => {
  for (const f of ['src/features/admin/api/admin-kt-alpha/catalog.ts', 'src/features/admin/api/admin-kt-alpha/settings.ts']) {
    it(`${f.split('/').pop()}: resolveKtConsumerMarkupPct 사용 · \`|| 20\` 없음`, () => {
      const s = code(f)
      expect(s).toMatch(/const markupPct = resolveKtConsumerMarkupPct\(/)
      expect(s, '0 을 삼키는 옛 형태가 남아 있다').not.toMatch(/kt_alpha_consumer_markup_pct\) \|\| 20|settingsRow\?\.value\) \|\| 20/)
    })
  }
})

// 🧑‍💼 2026-09-14 — 셀러 축은 09-02 수리에서 빠져 있었다. 그때 라이브 값이 `5` 라
// 결과가 같았고, 그래서 **아무도 눈치채지 못했다**(이 결함의 성질이 그렇다).
describe('③ 셀러 축도 0 을 0 으로 읽는다', () => {
  it("'0' 은 0 · 없음/문자는 기본 5 · 클램프", () => {
    expect(resolveKtSellerMarkupPct('0')).toBe(0)
    expect(resolveKtSellerMarkupPct(0)).toBe(0)
    // 🩸 상수와 비교하면 안 된다 — 상수가 20 으로 바뀌어도 같이 따라가 늘 통과한다.
    //    (2026-09-14 주입이 실제로 이 헛돎을 잡았다.) 값을 못 박는다.
    expect(KT_SELLER_MARKUP_DEFAULT_PCT, '셀러 기본값은 5 — 소비자(20)와 다르다').toBe(5)
    expect(resolveKtSellerMarkupPct(undefined)).toBe(5)
    expect(resolveKtSellerMarkupPct('')).toBe(5)
    expect(resolveKtSellerMarkupPct('abc')).toBe(5)
    expect(resolveKtSellerMarkupPct('-3')).toBe(0)
    expect(resolveKtSellerMarkupPct('250')).toBe(100)
  })

  it('현재 라이브 값(5)에서는 옛 형태와 결과가 같다 — 달라지는 건 0 뿐', () => {
    expect(resolveKtSellerMarkupPct('5')).toBe(Number('5') || 5)
  })

  it('seller-settlements 두 자리가 SSOT 를 쓴다 · `|| 5` 없음', () => {
    const src = code('src/features/seller/api/seller-settlements.routes.ts')
    expect((src.match(/resolveKtSellerMarkupPct\(/g) ?? []).length).toBe(2)
    expect(src, '0 을 삼키는 옛 형태가 남아 있다').not.toMatch(/kt_alpha_markup_pct\) \|\| 5|settings\?\.value\) \|\| 5/)
  })
})
