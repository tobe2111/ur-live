/**
 * 🚪 로그인 전 탭 셋(이용권 · 유어샵 · 마이) 서버 첫 화면 (2026-10-19 — 라이브 첫 그림 2.0~2.5초).
 *
 * 지키는 것:
 *   ① 서버 HTML 과 React 가 그리는 위쪽(제목 + 첫 카드)의 **요소 구조·클래스가 같다** — 진짜 페이지를 렌더해 대조한다
 *      (아이콘·마스코트는 서버가 같은 크기의 빈 칸만 그리므로 둘 다 ICON 으로 본다)
 *   ② 로그인 흔적이면 노드를 걷어낸다 — `RouteGuards.isUserLoggedIn` 과 **같은 두 키**
 *   ③ 워커는 세션 쿠키가 없고(폰·크롤러) 세 경로일 때만 그린다
 *
 * ⚠️ 못 보는 것: 실제 박스 위치(jsdom 엔 레이아웃이 없다 — 라이브 HTML 에 끼워 아이폰13 라이트·다크로 대조해 일치 확인).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

vi.mock('@/components/SEO', () => ({ default: () => null }))
vi.mock('@/components/mascot/Udal', () => ({ default: () => <span data-mock="udal" /> }))
vi.mock('@/pages/guest/usePopularPasses', () => ({ usePopularPasses: () => ({ data: [], isLoading: false }) }))
vi.mock('@/pages/guest/guest-login', () => ({ useGuestLoginPrepare: () => {}, startGuestKakaoLogin: () => {} }))

import GuestPassPage from '@/pages/guest/GuestPassPage'
import GuestUrShopPage from '@/pages/guest/GuestUrShopPage'
import GuestMyPage from '@/pages/guest/GuestMyPage'
import { buildGuestFirstScreen, guestTabOf, guestFirstScreenGuardScript, type GuestTab } from '@/worker/utils/guest-first-screen'

/** 요소 트리를 [태그.클래스] 줄로 — 아이콘(svg)·빈 칸(span.block.shrink-0)·마스코트는 ICON 하나로 본다. */
function shape(el: Element, out: string[] = [], depth = 0): string[] {
  const cls = (el.getAttribute('class') || '').trim()
  const isIcon = el.tagName.toLowerCase() === 'svg' || cls === 'block shrink-0' || el.getAttribute('data-mock') === 'udal'
  out.push(`${'  '.repeat(depth)}${isIcon ? 'ICON' : `${el.tagName.toLowerCase()}.${cls}`}`)
  if (!isIcon) for (const c of Array.from(el.children)) shape(c, out, depth + 1)
  return out
}

function serverTop(tab: GuestTab): Element {
  const d = document.createElement('div')
  d.innerHTML = buildGuestFirstScreen(tab, '<div>LOADER</div>', 'n')
  return d.querySelector('#ur-first-screen > div')!
}

const PAGES: Array<[GuestTab, () => JSX.Element]> = [['pass', GuestPassPage], ['shop', GuestUrShopPage], ['my', GuestMyPage]]

describe('① 서버 첫 화면 = React 위쪽 (구조·클래스·문구)', () => {
  beforeEach(() => { cleanup(); localStorage.clear() })
  it.each(PAGES)('%s', (tab, Page) => {
    const { container } = render(<MemoryRouter><Page /></MemoryRouter>)
    const reactRoot = container.firstElementChild!
    const server = serverTop(tab)
    expect(server.getAttribute('class')).toBe(reactRoot.getAttribute('class'))
    // 서버가 그리는 자식(제목 + 첫 블록)이 React 의 앞 자식들과 같다.
    const sKids = Array.from(server.children)
    const rKids = Array.from(reactRoot.children).slice(0, sKids.length)
    expect(sKids.length).toBeGreaterThanOrEqual(2)
    for (let i = 0; i < sKids.length; i++) {
      if (tab === 'shop' && i === 1) {
        // 유어샵은 문단 앞부분(제목·부제)만 그린다 — 그 두 줄이 React 와 같아야 한다.
        const s = Array.from(sKids[i].children).map((e) => shape(e).join('\n'))
        const r = Array.from(rKids[i].children).slice(0, s.length).map((e) => shape(e).join('\n'))
        expect(s).toEqual(r)
        expect(sKids[i].getAttribute('class')).toBe(rKids[i].getAttribute('class'))
        expect(sKids[i].textContent).toBe(Array.from(rKids[i].children).slice(0, 2).map((e) => e.textContent).join(''))
        continue
      }
      expect(shape(sKids[i])).toEqual(shape(rKids[i]))
      expect(sKids[i].textContent).toBe(rKids[i].textContent)
    }
  })
})

describe('② 로그인 흔적이면 걷어낸다', () => {
  it('RouteGuards.isUserLoggedIn 과 같은 두 키를 본다', () => {
    const guard = readFileSync('src/components/auth/RouteGuards.tsx', 'utf8')
    for (const k of ['user_id', 'session_login']) {
      expect(guard).toContain(`localStorage.getItem('${k}')`)
      expect(guestFirstScreenGuardScript('n')).toContain(`s.getItem('${k}')`)
    }
  })
  it('스크립트를 실제로 돌리면 로그인 흔적이 있을 때만 노드가 사라진다', () => {
    const run = () => { const m = guestFirstScreenGuardScript('n').match(/<script[^>]*>([\s\S]*)<\/script>/)![1]; new Function(m)() }
    for (const [key, gone] of [[null, false], ['user_id', true], ['session_login', true]] as const) {
      localStorage.clear(); if (key) localStorage.setItem(key, '1')
      document.body.innerHTML = '<div id="ur-first-screen"></div>'
      run()
      expect(!document.getElementById('ur-first-screen'), String(key)).toBe(gone)
    }
  })
  it('빌더 출력에 그 스크립트가 붙는다', () => {
    expect(buildGuestFirstScreen('pass', 'L', 'n')).toContain(guestFirstScreenGuardScript('n'))
  })
})

describe('③ 워커 배선', () => {
  const worker = stripComments(readFileSync('src/worker/index.ts', 'utf8'))
  it('세션 쿠키가 없고 세 경로이고 폰·크롤러일 때만 그린다', () => {
    expect(worker).toMatch(/\} else if \(!authed && guestTabOf\(url\.pathname\) && shouldRenderMobileFirstScreen\(c\.req\.header\('user-agent'\)\)\) \{ const guestFirst = buildGuestFirstScreen\(guestTabOf\(url\.pathname\)!, urdealLoaderHtml, nonce\)/)
  })
  it('경로 판정', () => {
    expect(guestTabOf('/my-vouchers')).toBe('pass')
    expect(guestTabOf('/u/me/')).toBe('shop')
    expect(guestTabOf('/user/profile')).toBe('my')
    for (const p of ['/u/jiwon1228', '/my-vouchers/1', '/user', '/']) expect(guestTabOf(p)).toBeNull()
  })
})
