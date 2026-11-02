/**
 * 🫥 2026-11-02 대표 *"처음에 우리 유어딜 서비스 들어갈 때는 로딩 페이지 안보이게 해줘. 최대한 로딩 페이지 안보이게."*
 *   → 선택 *"아예 안 보이게"*. 실측(폰): 세부 화면(지도·생활·유어쇼츠·숙소·검색·이용권 상세) 0.2~0.6초 · PC: 거의 전 화면.
 *
 * 전체 화면 로더는 **배경만** 남기고 유달이·로고·진행 바를 숨긴다(visibility:hidden — 자리·위상·연속성 장치는 그대로).
 * 지키는 것: ① 워커 정적 로더가 숨겨져 있다 ② React 전체 화면 로더도 숨긴다(둘이 갈리면 교체 순간 유달이가 튄다)
 *   ③ 서버 첫 화면 아래의 인라인 로더도 숨긴다 ④ **숨기면 안 되는 셋은 그대로** — 문구 있는 로더("결제 승인 중")·
 *   대시보드(forceLight)·섹션 인라인 로더 ⑤ 화면읽기용 "로딩 중" 은 남는다.
 * ⚠️ 못 보는 것: 실제 화면에서 빈 바탕이 얼마나 오래 보이는지(느린 회선) — 라이브에서 잰다.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import BrandLoader from '@/components/brand/BrandLoader'

// 로더 뿌리의 **직계 자식**(그림·로고·바·문구) 중 화면읽기 문구를 뺀 것 — visibility 는 자손에게 물려진다.
const vis = (c: HTMLElement) => [...(c.firstElementChild as HTMLElement).children]
  .filter((e) => !e.classList.contains('sr-only')).map((e) => (e.getAttribute('class') || '').includes('invisible'))

describe('첫 진입 로딩 화면 — 아예 안 보이게', () => {
  it('① 워커 정적 로더 바깥 상자가 visibility:hidden', () => {
    const src = readFileSync('src/worker/index.ts', 'utf8')
    const at = src.indexOf('const urdealLoaderHtml =')
    expect(at).toBeGreaterThan(0)
    expect(src.slice(at, at + 400)).toMatch(/justify-content:center;gap:20px;visibility:hidden">/)
  })
  it('② 전체 화면 로더 — 그림·로고·바 전부 숨김, 배경 막·화면읽기 문구는 남음', () => {
    const { container } = render(<BrandLoader fullScreen />)
    const v = vis(container)
    expect(v.length).toBeGreaterThanOrEqual(3)
    expect(v.every(Boolean)).toBe(true)
    const root = container.firstElementChild as HTMLElement
    expect(root.className).toMatch(/fixed inset-0/)
    expect(root.className).not.toMatch(/invisible/)
    expect(container.querySelector('.sr-only')?.className).not.toMatch(/invisible/)
  })
  it('③ quiet(서버 첫 화면 아래 인라인)도 숨김', () => {
    expect(vis(render(<BrandLoader quiet />).container).every(Boolean)).toBe(true)
    expect(readFileSync('src/components/brand/BrandLoader.tsx', 'utf8')).toMatch(/<BrandLoader quiet \/>/)
  })
  it('④ 숨기면 안 되는 셋은 그대로 보인다', () => {
    expect(vis(render(<BrandLoader fullScreen label="결제 승인 중" />).container).some(Boolean)).toBe(false)
    expect(vis(render(<BrandLoader fullScreen forceLight />).container).some(Boolean)).toBe(false)
    expect(vis(render(<BrandLoader />).container).some(Boolean)).toBe(false)
  })
})
