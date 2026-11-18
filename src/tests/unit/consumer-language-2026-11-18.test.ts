/**
 * 🧪 2026-11-18 소비자 화면 언어 = 폰 언어(한국어 → ko · 그 밖 → en). 대표 *"외국인한테만"*.
 * ⚠️ 못 보는 것: 영어 화면의 실제 모양(서버 첫 화면은 한국어로 그려지고 앱이 영어로 바꾼다 — 외국인에게만 생기는 한 번의 바뀜).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { consumerLanguageFor } from '@/shared/consumer-language'

describe('소비자 화면 언어', () => {
  it('한국어 폰은 ko', () => {
    for (const l of [['ko'], ['ko-KR'], ['KO-kr', 'en-US']]) expect(consumerLanguageFor(l)).toBe('ko')
  })
  it('그 밖은 en(일본어·중국어 폰도 아직 영어)', () => {
    for (const l of [['en-US'], ['ja-JP'], ['zh-CN', 'ko-KR'], ['fr']]) expect(consumerLanguageFor(l)).toBe('en')
  })
  it('모르면 ko', () => {
    for (const l of [[], null, undefined, [''], [null]]) expect(consumerLanguageFor(l as never)).toBe('ko')
  })
  it('저장된 선택은 여전히 무시한다(전환 UI 가 닫혀 있어 갇힘 방지)', () => {
    const i = readFileSync('src/i18n.ts', 'utf8')
    const idx = i.indexOf('if (CONSUMER_LANGUAGE_SWITCH_HIDDEN) return consumerLanguageFor(')
    expect(idx).toBeGreaterThan(0)
    expect(idx).toBeLessThan(i.indexOf("getItem('i18nextLng')"))
  })
})
