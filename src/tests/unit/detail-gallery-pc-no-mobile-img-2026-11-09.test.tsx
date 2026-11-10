/**
 * 🖥️ 상세 갤러리 — PC 에선 폰 슬라이드 블록을 **렌더하지 않는다** (2026-11-09).
 *
 * 라이브 실측(1440px, `/pass/2919`): 1280 폭 큰 사진(367KB) 뒤에 **960 폭 폰 히어로**가 또 내려왔다 — `lg:hidden` 은 숨기기만 하고
 * 안의 `<img>` 는 받아진다. PC 상세마다 수백 KB 낭비. 지키는 것:
 *   ① `isDesktop` 이면 폰 블록(`relative lg:hidden`)·폰 썸네일 줄이 DOM 에 없다 → `<img>` 요청 0
 *   ② 폰(`isDesktop=false`)이면 종전 그대로(폰 슬라이드 + 썸네일 줄) — 서버 첫 화면과의 대조 시험들이 그대로 지킨다
 * ⚠️ 못 보는 것: 실제 네트워크 요청(배포 뒤 PC `lcpel.cjs` 에서 width=960 요청이 사라지는지).
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { readCode } from '../helpers/source-text'

let desktop = false
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => desktop }))
import DetailGallery from '@/pages/group-buy/DetailGallery'

const IMGS = ['https://media.ur-team.com/a.jpg', 'https://media.ur-team.com/b.jpg', 'https://media.ur-team.com/c.jpg', 'https://media.ur-team.com/d.jpg']

describe('🖥️ PC 에선 폰 슬라이드를 렌더하지 않는다', () => {
  it('① isDesktop → 폰 블록·폰 썸네일 줄 없음 · <img> 0 · PC 블록은 있다', () => {
    desktop = true
    const { container } = render(<DetailGallery images={IMGS} alt="가게" />)
    expect(container.querySelector('.relative.lg\\:hidden')).toBeNull()
    expect(container.querySelector('.lg\\:hidden')).toBeNull()
    expect(container.querySelectorAll('img:not([aria-hidden="true"])').length).toBe(0)
    expect(container.querySelector('.hidden.lg\\:block')).toBeTruthy()
  })
  it('② 폰 → 종전 그대로(슬라이드 <img> + 썸네일 줄)', () => {
    desktop = false
    const { container } = render(<DetailGallery images={IMGS} alt="가게" />)
    expect(container.querySelector('.relative.lg\\:hidden')).toBeTruthy()
    expect(container.querySelectorAll('.relative.lg\\:hidden img').length).toBeGreaterThan(0)
    expect(container.querySelector('.lg\\:hidden.grid')).toBeTruthy()
  })
  it('소스: 두 폰 블록이 !isDesktop 으로 묶여 있다', () => {
    const s = readCode('src/pages/group-buy/DetailGallery.tsx')
    expect(s).toMatch(/\{!isDesktop && \(\s*<div className=\{`relative lg:hidden overflow-hidden`\}>/)
    expect(s).toContain('{!isDesktop && showMobileThumbs(images.length) && (')
  })
})
