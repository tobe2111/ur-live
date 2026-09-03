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
import { resolveKtConsumerMarkupPct, KT_CONSUMER_MARKUP_DEFAULT_PCT } from '../../features/admin/api/admin-kt-alpha/markup'

const code = (p: string) =>
  readFileSync(p, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')

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
