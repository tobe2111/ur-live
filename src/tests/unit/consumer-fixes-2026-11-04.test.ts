/**
 * 📏 2026-11-04 대표 신고 셋 — 화면 고정.
 *  ① 생활 견적(/life) 양쪽 40px: 평면 판의 안쪽 px-5 가 바깥 px-5 와 겹쳤다 → 안쪽 가로 여백 0.
 *  ② 내 이용권 지도: 이용권이 한 장이면 80% 폭이 왼쪽에 붙었다 → 한 장이면 꽉(양옆 같은 여백).
 *  ③ 내 이용권 '쓸 수 있는 이용권 합계' 판 — 대표 *"없애줘"*.
 * ⚠️ 못 보는 것: 실제 렌더 폭(그려서 볼 것).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const read = (p: string) => stripComments(readFileSync(p, 'utf8'))

describe('2026-11-04 손님 화면 셋', () => {
  it('① 생활 견적 판·머리에 안쪽 가로 여백이 없다', () => {
    expect(read('src/pages/life/LifePage.tsx')).toContain("const CARD = 'rounded-2xl py-5'")
    expect(read('src/pages/life/LifeHero.tsx')).toContain('data-testid="life-hero" className="pt-1 pb-2"')
  })
  it('② 지도 카드: 한 장이면 꽉', () => {
    expect(read('src/pages/MyVouchersPage.tsx')).toContain("${mapCarousel.length === 1 ? 'w-full' : 'w-[80%] max-w-[300px]'}")
  })
  it('③ 합계 판이 없다', () => {
    expect(read('src/pages/MyVouchersPage.tsx')).not.toMatch(/WalletSummaryCard|walletTotalTitle/)
    expect(existsSync('src/pages/my-vouchers/WalletSummaryCard.tsx')).toBe(false)
  })
})
