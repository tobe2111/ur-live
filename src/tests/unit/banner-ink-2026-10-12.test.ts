import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { inkForLuminance, relativeLuminance } from '@/components/home/banner-ink'

/** 🖋️ 배너 글자색을 그림 밝기가 정한다 (2026-10-12 대표 — NOL 파스텔 배너 "이런색도 괜찮네"). */
const L = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return relativeLuminance((n >> 16) & 255, (n >> 8) & 255, n & 255)
}

describe('배너 글자색 자동 판정', () => {
  it('파스텔 바탕 → 짙은 글자', () => {
    for (const bg of ['#DCEAFD', '#CDEBEA', '#FFF4D6', '#FFFFFF']) expect(inkForLuminance(L(bg)), bg).toBe('dark')
  })
  it('짙은 바탕 → 흰 글자', () => {
    for (const bg of ['#1C5FD8', '#0E2466', '#1C69EF', '#000000']) expect(inkForLuminance(L(bg)), bg).toBe('light')
  })
  it('카드가 실제로 측정 결과를 쓴다 (onLoad 배선)', () => {
    const src = readFileSync('src/components/home/HomeBannerStrip.tsx', 'utf-8')
    expect(src).toMatch(/onLoad=\{\(e\) => \{ const L = measureTitleLuminance\(e\.currentTarget\); if \(L != null\) setInk\(inkForLuminance\(L\)\) \}\}/)
    expect(src).toMatch(/dark \? 'text-gray-900 dark:text-gray-900'/)
  })
})
