/**
 * 🎁 교환권 마진 0% 가 실제로 0% 로 동작하는가 (2026-08-31 대표 지시 "원가로 되돌려줘").
 *
 * 이 테스트가 막는 사고: `Number(x) || 20` 처럼 **0 을 falsy 로 삼키는** 기본값 처리.
 *   어드민이 마진을 0 으로 저장해도 재계산이 20% 로 가격을 되돌려, 에러 없이
 *   "슬라이더를 0으로 내렸는데 가격이 그대로"로만 보이던 조용한 실패였다.
 *
 * ⚠️ 이 테스트가 **못 막는 것**: 실제 UPDATE 문이 이 값을 쓰는지(D1 실행 경로)는 안 본다.
 *   그건 R3/R4 의 소스 스캔으로 근사한다 — 호출부가 헬퍼를 쓰는지만 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  resolveConsumerMarkupPct,
  resolveSellerMarkupPct,
  consumerPriceMultiplier,
  KT_CONSUMER_MARKUP_DEFAULT_PCT,
  KT_SELLER_MARKUP_DEFAULT_PCT,
} from '@/shared/kt-alpha-markup'

describe('R1 — 0 은 유효한 마진이다 (기본값으로 튕기지 않는다)', () => {
  it("문자열 '0' → 0", () => expect(resolveConsumerMarkupPct('0')).toBe(0))
  it('숫자 0 → 0', () => expect(resolveConsumerMarkupPct(0)).toBe(0))
  it("'0.0' → 0", () => expect(resolveConsumerMarkupPct('0.0')).toBe(0))
  it('셀러 축도 동일', () => expect(resolveSellerMarkupPct('0')).toBe(0))
  it('0% 배수는 1.0 — 판매가 = 원가', () => expect(consumerPriceMultiplier(0)).toBe(1))
})

describe('R2 — 미설정·오염만 기본값으로 (과거 동작 보존)', () => {
  it('undefined → 20', () => expect(resolveConsumerMarkupPct(undefined)).toBe(KT_CONSUMER_MARKUP_DEFAULT_PCT))
  it('null → 20', () => expect(resolveConsumerMarkupPct(null)).toBe(20))
  it("'' → 20", () => expect(resolveConsumerMarkupPct('')).toBe(20))
  it("'abc' → 20", () => expect(resolveConsumerMarkupPct('abc')).toBe(20))
  it("'20' → 20 (현행값 불변)", () => expect(resolveConsumerMarkupPct('20')).toBe(20))
  it('셀러 축 기본값은 5 (소비자 축과 다른 설정)', () => {
    expect(resolveSellerMarkupPct(undefined)).toBe(KT_SELLER_MARKUP_DEFAULT_PCT)
    expect(KT_SELLER_MARKUP_DEFAULT_PCT).not.toBe(KT_CONSUMER_MARKUP_DEFAULT_PCT)
  })
  it('범위 밖은 clamp', () => {
    expect(resolveConsumerMarkupPct('-5')).toBe(0)
    expect(resolveConsumerMarkupPct('999')).toBe(100)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// R3/R4 — 호출부가 헬퍼를 쓰는지. 헬퍼만 고치고 호출부에 `|| 20` 이 남아 있으면
//   단위 테스트는 전부 초록인데 라이브는 그대로다(이 레포가 반복해 당한 "헛도는 가드").
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ 셀러 축(`seller-settlements.routes.ts`)은 **의도적으로 빠져 있다.** 같은 `Number(x) || 5`
//   결함이 있지만 그 파일이 파일크기 래칫 baseline 에 걸려 임포트 한 줄도 못 늘린다(CI 가 막았다).
//   현재 저장값이 5 라 라이브 영향 0. 분리 후 배선하면서 이 목록에 넣을 것.
const SITES = [
  ['src/features/admin/api/admin-kt-alpha/settings.ts', 'resolveConsumerMarkupPct'],
  ['src/features/admin/api/admin-kt-alpha/catalog.ts', 'resolveConsumerMarkupPct'],
] as const

/** 주석을 지운다 — 주석에만 남은 이름을 배선으로 오독하지 않기 위해(2026-08-01 교훈). */
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('R3 — 마진을 읽는 곳은 전부 SSOT 헬퍼를 통한다', () => {
  for (const [file, fn] of SITES) {
    it(`${file} 가 ${fn} 을 호출한다`, () => {
      const code = codeOnly(readFileSync(file, 'utf8'))
      expect(code).toContain(`${fn}(`)
    })
  }
})

describe('R4 — 0 을 삼키는 패턴이 되살아나지 않는다', () => {
  for (const [file] of SITES) {
    it(`${file} 에 markup 관련 \`|| 숫자\` 폴백이 없다`, () => {
      const code = codeOnly(readFileSync(file, 'utf8'))
      // `Number(...markup...) || 20` / `Number(x) || 5` 류. 같은 줄에 markup 이 있거나
      // 변수명이 markupPct 인 대입만 본다(무관한 `|| 0` 오탐 방지).
      const bad = code
        .split('\n')
        .filter((l) => /markup/i.test(l) && /\|\|\s*\d/.test(l))
      expect(bad).toEqual([])
    })
  }
})
