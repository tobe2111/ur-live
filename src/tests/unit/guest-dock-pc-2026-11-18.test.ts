/**
 * 🖥️ 2026-11-18 — 로그아웃 화면 재검토에서 찾은 두 결함의 가드.
 *
 * ① 로그인 전 세 탭(이용권 `/my-vouchers` · 유어샵 `/u/me` · 마이 `/user/profile`)의 카카오 버튼(`GUEST_CLS.dock`)에
 *    `app-frame-bar` 가 붙어 있었다. 세 탭은 PC 에서 `pc-fullbleed` 이고, index.css 의
 *    `body.pc-fullbleed .app-frame-bar { display:none }` 은 *하단 탭*을 PC 에서 숨기려는 규칙이라 로그인 버튼까지 같이 숨었다.
 *    실측(1440px): 세 화면 모두 버튼 display none — "로그인 후 보여요" 만 있고 누를 곳이 없었다.
 * ② `/about` 모바일 고정 CTA 가 첫 화면부터 떠서 히어로의 같은 버튼과 두 개로 보였고, '매장 입점 안내' 버튼을 덮었다.
 *
 * 못 막는 것: 실제 렌더 결과(좌표·겹침)는 본다고 보장하지 않는다 — 배포 뒤 1440px·390px 로 다시 찍어 볼 것.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { GUEST_CLS } from '@/shared/guest-page'
import { isFullBleedPcPath } from '@/shared/pc-fullbleed'

describe('로그인 전 탭의 카카오 버튼은 PC 에서도 보인다', () => {
  it('세 탭이 pc-fullbleed 인 한 dock 에 app-frame-bar 를 붙이지 않는다', () => {
    const fullbleed = ['/my-vouchers', '/user/profile', '/u/me'].filter((p) => isFullBleedPcPath(p))
    expect(fullbleed.length, '세 탭 중 하나라도 PC 풀폭이면 규칙이 적용된다').toBeGreaterThan(0)
    expect(GUEST_CLS.dock.split(/\s+/), 'app-frame-bar 는 PC 풀폭에서 display:none 된다').not.toContain('app-frame-bar')
  })
  it('PC 에선 하단 탭이 없으니 화면 맨 아래에 붙고 본문 열과 같은 폭이다', () => {
    const cls = GUEST_CLS.dock.split(/\s+/)
    expect(cls).toContain('lg:bottom-0')
    expect(cls).toContain('lg:max-w-[720px]')
    expect(GUEST_CLS.root.split(/\s+/)).toContain('lg:max-w-[720px]')
  })
  it('index.css 가 아직 pc-fullbleed 에서 app-frame-bar 를 숨긴다(이 가드의 전제)', () => {
    const css = readFileSync('src/index.css', 'utf-8')
    expect(css).toMatch(/body\.pc-fullbleed \.app-frame-bar \{ display: none !important; \}/)
  })
})

describe('/about 모바일 고정 CTA 는 히어로 버튼이 보이는 동안 숨는다', () => {
  const s = readFileSync('src/pages/AboutServicePage.tsx', 'utf-8')
  it('히어로 버튼 줄을 관찰하고, 보이는 동안 고정 바를 내린다', () => {
    expect(s).toContain('ref={heroCtaRef}')
    expect(s).toMatch(/style=\{heroCtaVisible \? \{ transform: 'translateY\(100%\)'/)
  })
})
