/**
 * 🎬 이용권 결제 완료 — 티켓 발급 움직임 (2026-11-02 대표 확정, 모션 시안 1번 수정판)
 *
 * 지키는 것:
 *   ① 움직임은 transform·opacity·clip-path 만 — 레이아웃 속성을 움직이면 읽던 줄이 밀린다.
 *   ② '동작 줄이기' 면 전부 끈다.
 *   ③ 1.5초 안에 끝나고, 화면을 누르면 즉시 끝난다(매장 앞 손님을 기다리게 하지 않는다).
 *   ④ 끝나거나 건너뛰면 금액은 언제나 실제 결제액이다(움직임이 금액을 틀리게 남기면 안 된다).
 *
 * ⚠️ 못 보는 것: 움직임이 *보기 좋은지* · 실제 폰에서 끊기는지 — 그건 그려서/라이브에서 본다.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderHook, act } from '@testing-library/react'
import { useTicketMotion } from '@/pages/group-buy/PaymentCompleteTicket'
import { stripComments } from '../helpers/source-text'

const css = readFileSync('src/pages/group-buy/payment-complete-motion.css', 'utf8')
const tsx = readFileSync('src/pages/group-buy/PaymentCompleteTicket.tsx', 'utf8')
const cssCode = stripComments(css)

describe('① 레이아웃을 움직이지 않는다', () => {
  it('키프레임 안 속성은 opacity · transform · clip-path 뿐', () => {
    const frames = [...cssCode.matchAll(/@keyframes[^{]+\{([\s\S]*?)\}\s*\}/g)].map((m) => m[1])
    expect(frames.length).toBeGreaterThanOrEqual(5)
    for (const body of frames) {
      const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1])
      for (const p of props) expect(['opacity', 'transform', 'clip-path']).toContain(p)
    }
  })
  it('움직임은 .ur-pc-play 아래에서만 걸린다(클래스 없으면 완성 화면)', () => {
    const rules = [...cssCode.matchAll(/([^{}]+)\{[^{}]*animation:/g)].map((m) => m[1].trim())
    expect(rules.length).toBeGreaterThan(5)
    for (const sel of rules) expect(sel).toMatch(/\.ur-pc-play\b/)
  })
})

describe('② 동작 줄이기', () => {
  it('reduce 면 animation: none', () => {
    expect(cssCode).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none !important/)
  })
})

describe('③ 화면 배선', () => {
  it('컴포넌트가 CSS 를 import 하고 재생 중에만 클래스를 붙이며, 누르면 건너뛴다', () => {
    expect(tsx).toMatch(/import '\.\/payment-complete-motion\.css'/)
    expect(tsx).toMatch(/motion\.playing \? 'ur-pc-play' : ''/)
    expect(tsx).toMatch(/onPointerDown=\{motion\.playing \? motion\.skip : undefined\}/)
    expect(tsx).toMatch(/formatNumber\(motion\.shownAmount\)/)
  })
})

describe('④ 금액은 끝에 언제나 실제 값', () => {
  afterEach(() => { vi.useRealTimers() })
  it('1.5초 뒤 재생이 끝나고 금액은 결제액', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useTicketMotion(39000))
    expect(result.current.playing).toBe(true)
    act(() => { vi.advanceTimersByTime(1600) })
    expect(result.current.playing).toBe(false)
    expect(result.current.shownAmount).toBe(39000)
  })
  it('건너뛰면 즉시 결제액', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useTicketMotion(7500))
    expect(result.current.shownAmount).toBe(0)
    act(() => { result.current.skip() })
    expect(result.current.playing).toBe(false)
    expect(result.current.shownAmount).toBe(7500)
  })
  it('동작 줄이기면 처음부터 결제액', () => {
    const orig = window.matchMedia
    window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as unknown as typeof window.matchMedia
    try {
      const { result } = renderHook(() => useTicketMotion(12000))
      expect(result.current.playing).toBe(false)
      expect(result.current.shownAmount).toBe(12000)
    } finally { window.matchMedia = orig }
  })
})
