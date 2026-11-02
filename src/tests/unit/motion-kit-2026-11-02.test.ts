/**
 * 🎬 작은 움직임 키트 (2026-11-02 대표 *"이전에 만든 모션그래픽 다 적용해줘"* + D 묶음 *"셋 다 넣기"*)
 *
 * 지키는 것:
 *   ① 움직임은 레이아웃을 건드리지 않는다(transform·opacity·stroke 만) · '동작 줄이기' 면 꺼진다.
 *   ② (유달이 몸짓은 2026-11-02 대표 *"유달이는 빼고"* 로 넣지 않는다 — 종전 둥실 그대로.)
 *   ③ 숫자 올라가기는 늦게 온 값에서 시작하고, 끝은 정확한 값이며, "아직 모름" 을 망가뜨리지 않는다.
 *   ④ 잠금 파일(BottomNav · GroupBuyFeedCard)의 로딩 계약은 그대로다 — 미리 받기 · 링크 기본 동작 폴백.
 *   ⑤ 사용 완료 도장은 **보는 중에 찍힐 때만** 쾅 — 열 때 이미 쓴 표는 조용하다.
 *
 * ⚠️ 못 보는 것: 움직임이 보기 좋은지 · 실제 폰에서 끊기는지 · 브라우저가 사진을 실제로 이어 그리는지
 *   (View Transitions 는 jsdom 에 없다) — 그건 배포 뒤 폰에서 본다(docs/locks/loading/2026-11-02-…).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderHook, act } from '@testing-library/react'
import { useCountUp } from '@/hooks/useCountUp'
import { canRunDealTransition } from '@/lib/deal-view-transition'
import { stripComments } from '../helpers/source-text'

const R = (p: string) => readFileSync(p, 'utf8')
const css = stripComments(R('src/index.css'))
const kit = css.slice(css.indexOf('.ur-burst {'), css.indexOf('::view-transition-old(root)'))

describe('① 움직임 키트 CSS', () => {
  it('키트 키프레임은 transform · opacity 만 움직인다', () => {
    const frames = [...kit.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\}\s*\}/g)]
    expect(frames.length).toBeGreaterThanOrEqual(7)
    for (const [, name, body] of frames) {
      const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1])
      for (const p of props) expect(['transform', 'opacity'], name).toContain(p)
    }
  })
  it('동작 줄이기면 키트 클래스와 화면 전환이 전부 꺼진다', () => {
    const reduce = css.slice(css.indexOf('::view-transition-old(root)'))
    const block = reduce.slice(reduce.indexOf('@media (prefers-reduced-motion: reduce)'))
    for (const c of ['ur-slam', 'ur-thud', 'ur-popin', 'ur-rise', 'ur-press', 'ur-ring', 'ur-burst i']) {
      expect(block.slice(0, 900)).toContain(c)
    }
    expect(block.slice(0, 900)).toMatch(/::view-transition-group\(\*\)[^{]*\{\s*animation:\s*none !important/)
  })
})

describe('③ 숫자 올라가기', () => {
  afterEach(() => { vi.useRealTimers() })
  it('값이 아직 없으면 그대로 돌려준다', () => {
    const { result } = renderHook(() => useCountUp(undefined as number | undefined))
    expect(result.current).toBeUndefined()
  })
  it('늦게 온 값에서 시작해 정확한 값으로 끝난다', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ v }) => useCountUp(v, { durationMs: 400 }), { initialProps: { v: undefined as number | undefined } })
    rerender({ v: 482000 })
    expect(result.current).toBe(0)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current).toBe(482000)
    rerender({ v: 500000 }) // 그 뒤 바뀐 값은 다시 올라가지 않고 바로
    expect(result.current).toBe(500000)
  })
})

describe('④ 잠금 파일 계약', () => {
  const card = R('src/pages/main-home/GroupBuyFeedCard.tsx')
  it('카드: 미리 받기 세 줄 불변 + 전환은 맡을 수 있을 때만', () => {
    expect(card).toContain('onMouseEnter={() => { prefetch(p.id); prefetchDetailChunk() }}')
    expect(card).toContain('onTouchStart={() => { prefetch(p.id); prefetchDetailChunk() }}')
    expect(card).toContain('onFocus={() => { prefetch(p.id); prefetchDetailChunk() }}')
    expect(card).toMatch(/if \(!canRunDealTransition\(e\)\) return\s*\n\s*e\.preventDefault\(\)/)
  })
  it('전환을 맡지 않는 클릭: 수정키 · 가운데 버튼 · 이미 막힌 클릭 · API 없음', () => {
    const base = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false }
    expect(canRunDealTransition({ ...base, metaKey: true })).toBe(false)
    expect(canRunDealTransition({ ...base, ctrlKey: true })).toBe(false)
    expect(canRunDealTransition({ ...base, button: 1 })).toBe(false)
    expect(canRunDealTransition({ ...base, defaultPrevented: true })).toBe(false)
    expect(canRunDealTransition(base)).toBe(false) // jsdom 엔 startViewTransition 이 없다 → 종전 링크 동작
  })
  it('상세 첫 사진만 이름을 받고, 기다림은 300ms 상한', () => {
    const gal = R('src/pages/group-buy/DetailGallery.tsx')
    expect(gal).toContain("data-vt-hero={i === 0 ? '' : undefined}")
    expect(gal).toContain('viewTransitionName: i === 0 ? DEAL_HERO_VT : undefined')
    expect(R('src/lib/deal-view-transition.ts')).toMatch(/const HERO_WAIT_MS = 300\b/)
  })
  it('하단 탭: 누름 반응은 클릭에서만, linkshop·prefetch 계약 불변', () => {
    const nav = R('src/components/main/BottomNav.tsx')
    expect(nav).toMatch(/onClick=\{\(\) => \{ setPress\(/)
    expect(nav).toContain('onPointerDown={warm}')
    expect(nav).toContain("cur.startsWith('/profile/') || cur.startsWith('/s/')")
  })
})

describe('⑤ 사용 완료 도장', () => {
  it('폴링이 used 로 바뀔 때만 justUsed 가 켜지고, 도장·카드가 그것에 묶인다', () => {
    const qr = R('src/pages/my-vouchers/QRModal.tsx')
    expect(qr).toMatch(/if \(newStatus === 'used'\) \{\s*\n\s*setJustUsed\(true\)/)
    expect(qr).toContain("${justUsed ? 'ur-slam' : ''}")
    expect(qr).toContain("${justUsed ? 'ur-thud' : ''}")
  })
})
