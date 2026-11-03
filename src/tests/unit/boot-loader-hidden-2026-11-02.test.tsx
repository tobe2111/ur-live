/**
 * 🫥 2026-11-02 첫 진입 로딩 화면 — 처음엔 대표 *"아예 안 보이게"*(#2122 · visibility:hidden),
 *   같은 날 대표가 *"위쪽 얇은 막대 + 화면 모양 미리 보여주기"* 를 골라 두 결정이 갈렸고, 대표가 **"섞기"** 로 정했다:
 *   **0.5초(`LOADER_REVEAL_S`) 안에 뜨면 아무것도 안 보이고, 늦을 때만 막대 + 화면 모양이 스르르 나타난다.**
 *
 * 지키는 것: ① 워커 정적 로더 · index.html 사본이 shy ② React 전체 화면 로더도 shy(둘이 갈리면 교체 순간 튄다)
 *   ③ 서버 첫 화면 아래 인라인(quiet)도 shy ④ **바로 보여야 하는 셋은 shy 가 아니다** — 문구 있는 로더("결제 승인 중")·
 *   대시보드(forceLight)·섹션 인라인 ⑤ 화면읽기용 "로딩 중" 은 늘 있다 ⑥ 앱 로더는 서버 로더의 남은 숨김 시간만 기다린다.
 * ⚠️ 못 보는 것: 느린 회선에서 0.5초 뒤 나타나는 모습 — 그려서 본다(`node scripts/probe-loading.mjs`).
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import BrandLoader from '@/components/brand/BrandLoader'
import { brandLoaderMarkup, loaderPhaseVars, LOADER_REVEAL_S } from '@/shared/brand-loader-markup'

const shy = (c: HTMLElement) => !!c.querySelector('.ur-ldr-shy')

describe('첫 진입 로딩 화면 — 빠르면 안 보이고, 늦으면 나타난다', () => {
  it('① 워커 정적 로더 · index.html 이 shy', () => {
    expect(readFileSync('src/worker/index.ts', 'utf8')).toContain("brandLoaderMarkup(4, true) + '</div>';")
    expect(readFileSync('index.html', 'utf8')).toContain(brandLoaderMarkup(4, true))
  })
  it('② shy 는 처음 0.5초 투명하고 그 뒤 나타난다(동작 줄이기에서도 나타난다)', () => {
    const m = brandLoaderMarkup(4, true)
    expect(LOADER_REVEAL_S).toBe(0.5)
    expect(m).toContain(`.ur-ldr-shy{opacity:0;animation:ur-ldr-in .2s ease-out forwards;animation-delay:var(--ur-ldr-in-d,${LOADER_REVEAL_S}s)}`)
    expect(m).toContain('@keyframes ur-ldr-in{to{opacity:1}}')
    expect(m).toMatch(/prefers-reduced-motion[^}]*\}[^@]*\.ur-ldr-shy\{animation-duration:\.01s\}/)
    expect(brandLoaderMarkup(4)).not.toContain('<div class="ur-ldr-shy">')
  })
  it('③ React 전체 화면 · quiet 로더가 shy, 배경 막·화면읽기 문구는 남음', () => {
    const { container } = render(<BrandLoader fullScreen />)
    expect(shy(container)).toBe(true)
    expect((container.firstElementChild as HTMLElement).className).toMatch(/fixed inset-0/)
    expect(container.querySelector('.sr-only')).not.toBeNull()
    expect(shy(render(<BrandLoader quiet />).container)).toBe(true)
    expect(readFileSync('src/components/brand/BrandLoader.tsx', 'utf8')).toMatch(/<BrandLoader quiet \/>/)
  })
  it('④ 바로 보여야 하는 셋은 shy 가 아니다', () => {
    expect(shy(render(<BrandLoader fullScreen label="결제 승인 중" />).container)).toBe(false)
    expect(shy(render(<BrandLoader fullScreen forceLight />).container)).toBe(false)
    expect(shy(render(<BrandLoader />).container)).toBe(false)
  })
  it('⑤ 앱 로더는 남은 숨김 시간만 기다린다(서버가 이미 보였으면 바로)', () => {
    expect(loaderPhaseVars(0.2)['--ur-ldr-in-d']).toBe('0.300s')
    expect(loaderPhaseVars(2)['--ur-ldr-in-d']).toBe('-1.500s')
  })
})
