/**
 * 🖼️ 2026-11-09 대표 승인(상세 잠금 *"허가 — 진행"*) — 상세 맨 위 큰 사진이 다 뜬 뒤에 아래쪽(지도·리뷰·다녀온 사람들·같은 가게 목록)을 받는다.
 * 실측: 카드 탭 뒤 큰 사진과 같은 순간 아래쪽 15건이 출발해 회선을 나눴다(사진 완료 1.33s).
 * ⚠️ 못 보는 것: 실제 몇 초 줄었는지(배포 뒤 라이브).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { render, act } from '@testing-library/react'
import { beginHero, markHeroSettled, isHeroSettled, HERO_SETTLE_MAX_MS } from '@/lib/hero-settled'
import DeferUntilVisible from '@/pages/group-buy/DeferUntilVisible'

const read = (p: string) => fs.readFileSync(path.join(__dirname, '../../..', p), 'utf8')

afterEach(() => { markHeroSettled(); vi.useRealTimers() })

describe('hero-settled', () => {
  it('갤러리가 없으면 처음부터 풀려 있다(종전과 같다)', () => {
    expect(isHeroSettled()).toBe(true)
  })
  it('대기 → 사진 도착에 풀린다', () => {
    beginHero(); expect(isHeroSettled()).toBe(false)
    markHeroSettled(); expect(isHeroSettled()).toBe(true)
  })
  it('사진이 끝내 안 와도 최대 시간 뒤엔 풀린다', () => {
    vi.useFakeTimers()
    beginHero(); expect(isHeroSettled()).toBe(false)
    vi.advanceTimersByTime(HERO_SETTLE_MAX_MS)
    expect(isHeroSettled()).toBe(true)
  })
})

describe('DeferUntilVisible — 보이는 것 + 큰 사진', () => {
  it('사진을 기다리는 동안엔 자식을 안 그리고, 오면 그린다', () => {
    const IO = vi.fn(function (this: unknown, cb: (e: Array<{ isIntersecting: boolean }>) => void) {
      Object.assign(this as object, { observe: () => cb([{ isIntersecting: true }]), disconnect: () => {} })
    })
    vi.stubGlobal('IntersectionObserver', IO as never)
    beginHero()
    const { queryByText } = render(<DeferUntilVisible minHeight={50}><p>아래쪽</p></DeferUntilVisible>)
    expect(queryByText('아래쪽')).toBeNull()
    act(() => { markHeroSettled() })
    expect(queryByText('아래쪽')).not.toBeNull()
    vi.unstubAllGlobals()
  })
})

describe('배선', () => {
  it('갤러리: 커밋 직후 대기 시작(useLayoutEffect) · 첫 사진 load/error 에 풀기 · 떠날 때 풀기', () => {
    const g = read('src/pages/group-buy/DetailGallery.tsx')
    expect(g).toMatch(/useLayoutEffect\(\(\) => \{\s*\n\s*if \(!firstImg\) return\s*\n\s*beginHero\(\)/)
    expect(g).toContain('onLoad={i > 0 ? (blurUp ? sharpen : undefined) : markHeroSettled')
    expect(g).toContain('if (i === 0) markHeroSettled()')
    expect(g).toContain('return () => markHeroSettled()')
  })
  it('상세: 같은 가게 목록도 사진 뒤', () => {
    expect(read('src/pages/GroupBuyDetailPage.tsx')).toContain('if (!sid || !otherDealsInView || !heroSettled) return')
  })
})
