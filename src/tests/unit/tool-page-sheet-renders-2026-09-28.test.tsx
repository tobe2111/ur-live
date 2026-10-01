/**
 * 🪟 2026-09-28 — **`ToolPageSheet` 가 실제로 렌더되는가.** (같은 날 수리됨 — 경위는 아래)
 *
 * ## 무엇이 깨졌나
 * ```
 * Error: You cannot render a <Router> inside another <Router>.
 *        You should never have more than one in your app.
 * ```
 * 앱은 `BrowserRouter` 로 감싸여 있는데(`App.tsx`) `ToolPageSheet` 가 그 **안에**
 * `MemoryRouter` 를 또 넣는다. react-router v6 은 중첩 라우터를 금지한다 — 열자마자 throw 다.
 * ⇒ 마이 `전체 도구` 에서 시트로 열리도록 돼 있던 화면이 **전부** 에러 화면이다.
 *
 * ## 왜 여태 아무도 몰랐나 (이 파일이 존재하는 진짜 이유)
 * 이 경로를 지키던 시험은 전부 **텍스트 가드**였다 — "배선이 있는가" 만 보고
 * **렌더되는가는 안 봤다**. 그래서 *"66/68 라우트가 시트에서 열린다"* 가 초록인 채로 남았다.
 * 브라우저에서도 안 보였다: 프로덕션 빌드는 `drop_console: true`(vite.config)라 콘솔이 통째로
 * 지워지고, react-router 도 프로덕션에선 invariant 메시지를 지운다 — 화면엔 `Error` 만 남는다.
 * **jsdom 은 개발 빌드라 메시지가 살아 있다.** 그게 이 시험이 진단까지 해낸 이유다.
 *
 * ## ✅ 어떻게 고쳤나
 * `ToolPageSheet` 의 `RouterReset` 이 `LocationContext`·`RouteContext` 를 끊어 안쪽 라우터를
 * **그 서브트리의 최상위**로 만든다. 다른 길을 안 고른 이유는 그 컴포넌트 주석에 있다
 * (요약: `<Routes location=…>` 은 안쪽 `navigate()` 가 **바깥을 움직여** 마이가 통째로 떠난다 —
 * 2026-09-26 이 `MemoryRouter` 를 고른 이유가 바로 그 문제다).
 *
 * 🔴 **이 시험이 진짜 지키는 것**: react-router 버전을 올리면 `UNSAFE_*` 컨텍스트 모양이 바뀔 수 있다.
 * 그때 여기서 빨간불이 난다 — 그게 이 파일이 존재하는 이유다.
 *
 * ⚠️ **이 시험이 못 하는 것**: jsdom 에는 레이아웃이 없다. "폰에서 보기 좋은가" 는 못 잰다
 *   (그건 `node scripts/visual-preview.mjs --route=/user/profile --auth=user --stores=1 --click=…`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ToolPageSheet from '@/pages/user-profile/seller-section/ToolPageSheet'

beforeEach(() => {
  try {
    localStorage.setItem('seller_token', 'preview')
    localStorage.setItem('seller_id', '1')
  } catch { /* private mode */ }
  // react-dom 이 터진 트리를 콘솔로 크게 찍는다 — 이 시험에선 기대된 동작이라 소음만 줄인다.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

/** 실제 호출부(`SellerSection`)와 같은 모양 — 바깥 라우터 안에서 시트를 연다. */
const mount = (path: string) =>
  render(
    <MemoryRouter>
      <ToolPageSheet path={path} title="테스트" onClose={() => {}} onLeave={() => {}} />
    </MemoryRouter>,
  )

describe('ToolPageSheet — 터지지 않는가', () => {
  it('🔴 바깥 라우터 안에서 열어도 안 터진다 (중첩 라우터 invariant)', () => {
    expect(() => mount('/seller/tier')).not.toThrow()
  })

  it('🔴 에러 화면으로 떨어지지도 않는다', () => {
    mount('/seller/tier')
    expect(screen.queryByText('문제가 발생했습니다')).toBeNull()
  })

  it('🔴 특정 화면 탓이 아니다 — 여러 주소에서 같다', () => {
    for (const p of ['/seller/stores', '/seller/business-info', '/seller/orders']) {
      const { unmount } = mount(p)
      expect(screen.queryByText('문제가 발생했습니다'), p).toBeNull()
      unmount()
    }
  })

  /**
   * 🧹 **2026-10-01 철거의 안전망** — 손수 시트 일곱을 지우면서 그 일들이 **이 시트로** 넘어왔다.
   *   그래서 그 다섯 주소가 여기서 실제로 마운트되는지가 철거의 전제다. 소스 검사로는 못 본다
   *   (2026-09-28 에 이 파일이 생긴 이유가 정확히 그것 — 텍스트 가드는 "배선이 있는가" 만 봤고
   *   그 시트는 **한 번도 동작한 적이 없었다**).
   */
  it('🧹 철거로 이 시트가 맡게 된 다섯 화면이 실제로 마운트된다', () => {
    for (const p of ['/seller/group-buy', '/seller/analytics', '/seller/store',
      '/seller/influencer-deals', '/seller/alimtalk']) {
      const { unmount } = mount(p)
      expect(screen.queryByText('문제가 발생했습니다'), `${p} 가 에러 화면이다 — 철거의 도착지가 깨졌다`).toBeNull()
      expect(screen.getByText('테스트'), `${p}: 시트 껍데기가 안 그려졌다`).toBeTruthy()
      unmount()
    }
  })

  it('🔴 이 시험이 헛돌지 않는다 — 시트 껍데기가 실제로 그려졌다', () => {
    mount('/seller/tier')
    expect(screen.getByText('테스트')).toBeTruthy()   // 시트 머리(title)
  })

  it('🔴 줄을 끊는 장치가 실제로 배선돼 있다 (지우면 종전처럼 터진다)', async () => {
    const { readCode } = await import('../helpers/source-text')
    const src = readCode('src/pages/user-profile/seller-section/ToolPageSheet.tsx')
    expect(src).toContain('UNSAFE_LocationContext.Provider')
    expect(src).toContain('UNSAFE_RouteContext.Provider')
    expect(src).toContain('<RouterReset>')
  })
})
