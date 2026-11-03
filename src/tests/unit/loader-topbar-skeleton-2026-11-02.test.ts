/**
 * ⏳ 로딩 화면 = 위쪽 얇은 막대 + 화면 모양 미리 보여 주기 (2026-11-02 대표 확정)
 *   대표: *"유달이 뜨는게 별로인 것 같아 로딩 중에. 그래서 A처럼 위쪽 얇은 막대를 넣으면서 화면 모양 미리 보여주기로"*.
 *
 * 지키는 것: 로더가 네 곳(워커 정적 · 앱 BrandLoader · index.html · 카카오 오버레이)에서 **같은 글자**다 —
 *   하나라도 갈리면 교체 순간 화면이 튄다(대표가 2026-07-01 에 금지한 "로딩 화면 2~3개").
 * ⚠️ 못 보는 것: 실제 화면에서 막대가 '빨라 보이는지' — 그건 폰에서 눈으로 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { brandLoaderMarkup, loaderPhaseVars, LOADER_TOP_S, LOADER_SHINE_S } from '@/shared/brand-loader-markup'

const R = (f: string) => readFileSync(f, 'utf8')

describe('⏳ 로딩 화면 한 벌', () => {
  it('index.html 의 첫 로더가 SSOT 문자열과 글자까지 같다', () => {
    expect(R('index.html')).toContain(brandLoaderMarkup(4, true))
  })
  it('워커 정적 로더 · 앱 로더 · 카카오 오버레이가 같은 함수를 부른다', () => {
    expect(R('src/worker/index.ts')).toContain(`const urdealLoaderHtml = '<div style="min-height:100dvh">' + brandLoaderMarkup(4, true) + '</div>';`)
    expect(R('src/components/brand/BrandLoader.tsx')).toContain('dangerouslySetInnerHTML={{ __html: brandLoaderMarkup(4, shy) }}')
    expect(R('src/utils/kakao-login-overlay.ts')).toContain('o.innerHTML = brandLoaderMarkup(0)')
  })
  it('막대는 되풀이하지 않고 한 번 차오른다 · 빛만 되풀이', () => {
    const m = brandLoaderMarkup(4)
    expect(m).toContain(`animation:ur-ldr-top ${LOADER_TOP_S}s cubic-bezier(.08,.8,.2,1) forwards`)
    expect(m).toContain(`animation:ur-ldr-shine ${LOADER_SHINE_S}s ease-in-out infinite`)
    expect(m).not.toMatch(/ur-ldr-top[^;]*infinite/)
  })
  it('그림·손으로 박은 색이 없다(다크는 토큰이 바꾼다) · 동작 줄이기 대응', () => {
    const m = brandLoaderMarkup(4)
    expect(m).not.toMatch(/<img|#[0-9A-Fa-f]{3,8}\b/)
    expect(m).toContain('var(--brand)')
    expect(m).toContain('var(--rule)')
    expect(m).toContain('@media (prefers-reduced-motion: reduce)')
  })
  it('rows 0 이면 막대만(카카오 로그인 — 다음 화면이 남의 화면)', () => {
    expect(brandLoaderMarkup(0)).not.toContain('class="ur-ldr ur-ldr-sk"')
    expect(brandLoaderMarkup(4).match(/class="ur-ldr-row"/g)?.length).toBe(4)
  })
  it('위상 — 첫 페인트 이후 흐른 시간만큼 음수 delay, 막대는 끝을 넘기지 않는다', () => {
    expect(loaderPhaseVars(0.5)).toEqual({ '--ur-ldr-top-d': '-0.500s', '--ur-ldr-shine-d': '-0.500s', '--ur-ldr-in-d': '0.000s' })
    expect(loaderPhaseVars(99)['--ur-ldr-top-d']).toBe(`-${LOADER_TOP_S.toFixed(3)}s`)
    expect(loaderPhaseVars(-3)['--ur-ldr-top-d']).toBe('-0.000s')
  })
})
