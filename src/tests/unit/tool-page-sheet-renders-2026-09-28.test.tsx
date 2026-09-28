/**
 * 🪟 2026-09-28 — **`ToolPageSheet` 는 한 번도 동작한 적이 없다.** 그 사실을 여기 박는다.
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
 * ## 🔴 고치는 사람에게 — 이 시험은 **뒤집으라고** 있다
 * 아래는 *깨진 현재*를 고정한다. 중첩 라우터를 걷어내면 이 시험이 **빨간불**이 된다.
 * 그때 지우지 말고 **뒤집어라**:
 * ```ts
 * render(<MemoryRouter><ToolPageSheet path="/seller/tier" … /></MemoryRouter>)
 * expect(screen.queryByText('문제가 발생했습니다')).toBeNull()
 * ```
 * 고칠 때 고려할 길(전부 장단이 있다 — 결재 `2026-09-28-my-stage2-sheet-teardown.md`):
 *  ① `<Routes location={…}>` 로 중첩 라우터 없이 — 안쪽 `navigate()` 가 바깥을 움직이는 문제가 남는다
 *  ② 시트를 **별도 React 루트**로 띄운다 — 컨텍스트(QueryClient·테마)를 다시 얹어야 한다
 *  ③ 손으로 적은 지도로 되돌아간다 — 2026-09-26 에 버린 길이다(파라미터 화면을 못 연다)
 *
 * ⚠️ **이 시험이 못 하는 것**: jsdom 에는 레이아웃이 없다. "폰에서 보기 좋은가" 는 못 잰다
 *   (그건 `node scripts/visual-preview.mjs --route=/user/profile --auth=user --stores=1 --click=…`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
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

describe('ToolPageSheet — 중첩 라우터 (알려진 결함)', () => {
  it('🔴 지금은 중첩 라우터 invariant 로 터진다 — 고치면 이 시험이 빨간불이 된다', () => {
    expect(() => mount('/seller/tier')).toThrow(/<Router> inside another <Router>/)
  })

  it('🔴 특정 화면 탓이 아니다 — 어느 주소로 열어도 같다', () => {
    for (const p of ['/seller/stores', '/seller/business-info', '/seller/orders']) {
      expect(() => mount(p), p).toThrow(/<Router> inside another <Router>/)
    }
  })

  it('🔴 이 시험이 헛돌지 않는다 — 중첩 라우터가 실제로 소스에 있다', async () => {
    const { readCode } = await import('../helpers/source-text')
    const src = readCode('src/pages/user-profile/seller-section/ToolPageSheet.tsx')
    expect(src).toContain('<MemoryRouter')
    expect(readCode('src/App.tsx')).toContain('BrowserRouter')
  })
})
