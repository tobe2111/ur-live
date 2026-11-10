/**
 * 🚪 로그인 전 탭 셋(이용권 · 유어샵 · 마이) 서버 첫 화면 (2026-10-19 — 라이브 첫 그림 2.0~2.5초).
 *
 * 지키는 것:
 *   ① 서버 HTML 과 React 가 그리는 위쪽(제목 + 머리)과 **아래 고정 카카오 버튼**(2026-11-03)의 요소 구조·클래스가
 *      같다 — 진짜 페이지를 렌더해 대조한다
 *      (아이콘은 서버가 같은 크기의 빈 칸만 그리므로 ICON 으로 본다 · 마스코트는 2026-11-09 부터 서버도 그린다 — ①-3)
 *   ② 로그인 흔적이면 노드를 걷어낸다 — `RouteGuards.isUserLoggedIn` 과 **같은 두 키**
 *   ③ 워커는 세션 쿠키가 없고(폰·크롤러) 세 경로일 때만 그린다
 *
 * ⚠️ 못 보는 것: 실제 박스 위치(jsdom 엔 레이아웃이 없다 — 라이브 HTML 에 끼워 아이폰13 라이트·다크로 대조해 일치 확인).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync, existsSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

vi.mock('@/components/SEO', () => ({ default: () => null }))
vi.mock('@/components/mascot/Udal', () => ({ default: () => <span data-mock="udal" /> }))
vi.mock('@/pages/guest/usePopularPasses', () => ({ usePopularPasses: () => ({ data: [], isLoading: false }) }))
vi.mock('@/pages/guest/guest-login', () => ({ useGuestLoginPrepare: () => {}, startGuestKakaoLogin: () => {} }))

import GuestPassPage from '@/pages/guest/GuestPassPage'
import GuestUrShopPage from '@/pages/guest/GuestUrShopPage'
import GuestMyPage from '@/pages/guest/GuestMyPage'
import { buildGuestFirstScreen, guestTabOf, guestFirstScreenGuardScript, GUEST_PC_FRAME, type GuestTab } from '@/worker/utils/guest-first-screen'
import { PC_HOME_FS } from '@/shared/pc-home-first-screen'
import { GUEST_COPY, GUEST_EXAMPLE_IMG, GUEST_CLS } from '@/shared/guest-page'
import { UDAL_HELLO_SRC } from '@/shared/mascot-art'
import GuestExampleRows from '@/pages/guest/GuestExampleRows'

/** 요소 트리를 [태그.클래스] 줄로 — 아이콘(svg)·빈 칸(span.block.shrink-0)·마스코트는 ICON 하나로 본다. */
function shape(el: Element, out: string[] = [], depth = 0): string[] {
  const cls = (el.getAttribute('class') || '').trim()
  const isIcon = el.tagName.toLowerCase() === 'svg' || cls === 'block shrink-0' || el.getAttribute('data-mock') === 'udal' || el.hasAttribute('data-udal')
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
    // 서버가 그리는 자식 = 제목 + 머리(앞) + 고정 버튼(맨 끝). React 의 앞 자식들 + 마지막 자식과 같다.
    const sAll = Array.from(server.children)
    const rAll = Array.from(reactRoot.children)
    expect(sAll.length).toBeGreaterThanOrEqual(3)
    expect(sAll[sAll.length - 1].hasAttribute('data-guest-dock'), '서버가 고정 버튼을 안 그린다').toBe(true)
    expect(rAll[rAll.length - 1].hasAttribute('data-guest-dock'), '고정 버튼이 페이지 맨 끝이 아니다').toBe(true)
    expect(shape(sAll[sAll.length - 1])).toEqual(shape(rAll[rAll.length - 1]))
    expect(sAll[sAll.length - 1].textContent).toBe(rAll[rAll.length - 1].textContent)
    const sKids = sAll.slice(0, -1)
    const rKids = rAll.slice(0, sKids.length)
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

describe('①-2 예시 지갑 사진·시계는 한 벌 (2026-11-04 — 옛 QR 티켓 대체)', () => {
  beforeEach(() => cleanup())
  it('서버와 앱이 같은 사진 주소·같은 시계 path 를 그린다(모양만 보는 ① 이 못 보는 자리)', () => {
    const { container } = render(<MemoryRouter><GuestPassPage /></MemoryRouter>)
    const srvTop = serverTop('pass')
    const imgs = (root: { querySelectorAll: (s: string) => ArrayLike<Element> }) => Array.from(root.querySelectorAll('[data-guest="pass"] img')).map((e) => e.getAttribute('src'))
    const app = imgs(container)
    expect(app.length).toBe(2)
    expect(app.every((s) => !!s && s.startsWith('/assets/guest/'))).toBe(true)
    expect(imgs(srvTop)).toEqual(app)
    const clock = (root: { querySelectorAll: (s: string) => ArrayLike<Element> }) => Array.from(root.querySelectorAll('[data-guest="pass"] svg[viewBox="0 0 24 24"] path')).map((e) => e.getAttribute('d'))
    expect(clock(container).length).toBe(2)
    expect(clock(srvTop)).toEqual(clock(container))
  })
  it('예시 사진 파일이 실제로 있다(정적 주소가 404 면 회색 칸)', () => {
    for (const w of GUEST_COPY.pass.wallet) expect(existsSync('public' + w.img), w.img).toBe(true)
  })
})

describe('①-3 마이 유달이는 서버가 같은 공개 주소로 그린다 (2026-11-09 — 빈 칸이던 때 그림 2.3초)', () => {
  beforeEach(() => cleanup())
  it('서버 첫 화면의 마스코트 <img> 가 Udal(hello) 과 같은 주소·eager 이고 파일이 실재한다', () => {
    const img = serverTop('my').querySelector('[data-guest="my"] img[data-udal="hello"]')!
    expect(img, '서버가 유달이를 안 그린다(빈 칸이면 앱 코드가 올 때까지 그림이 없다)').toBeTruthy()
    expect(img.getAttribute('src')).toBe(UDAL_HELLO_SRC)
    expect(UDAL_HELLO_SRC.startsWith('/assets/mascot/'), '번들 자산이면 서버가 주소를 모른다').toBe(true)
    expect(existsSync('public' + UDAL_HELLO_SRC)).toBe(true)
    expect(img.getAttribute('loading')).toBe('eager')
    expect(img.getAttribute('width')).toBe('56')
  })
  it('Udal 부품의 hello 도 같은 공개 주소를 쓴다 — 두 벌이 아니다', () => {
    const udal = stripComments(readFileSync('src/components/mascot/Udal.tsx', 'utf8'))
    expect(udal).toMatch(/hello:\s*\{\s*src:\s*UDAL_HELLO_SRC\b/)
    expect(udal).not.toMatch(/udal-pose-stand/)
  })
  it('GuestMyPage 는 첫 화면 자리라 priority(eager) 로 그린다 — 서버 <img> 와 loading 이 같아야 마운트 때 다시 안 받는다', () => {
    expect(stripComments(readFileSync('src/pages/guest/GuestMyPage.tsx', 'utf8'))).toMatch(/<Udal mood="hello"[^>]*\bpriority\b/)
  })
  it('예시 줄 사진도 공개 주소(지갑 두 장과 같은 파일) — 같은 그림을 번들 주소로 한 번 더 받지 않는다', () => {
    const { container } = render(<MemoryRouter><GuestExampleRows /></MemoryRouter>)
    const srcs = Array.from(container.querySelectorAll('img')).map((e) => e.getAttribute('src'))
    expect(srcs.length).toBe(3)
    expect(srcs.every((s) => !!s && s.startsWith('/assets/guest/'))).toBe(true)
    expect(srcs.slice(0, 2)).toEqual(GUEST_COPY.pass.wallet.map((w) => w.img))
    for (const s of Object.values(GUEST_EXAMPLE_IMG)) expect(existsSync('public' + s), s).toBe(true)
    expect(existsSync('src/assets/guest'), '번들 사본이 남아 있다').toBe(false)
  })
})

describe('①-4 PC 는 네비 높이 예약 + 430 액자 (2026-11-09 대표 승인 — PC 첫 화면)', () => {
  it('pass·my: [네비 예약] + [액자(mobile-app-container app-framed · --app-frame:430px)] ⊃ 본문 · 로그인: 액자만(상단 네비 없음) · 폰: 종전 byte-동일', () => {
    const layout = stripComments(readFileSync('src/components/MobileAppLayout.tsx', 'utf8'))
    expect(layout).toContain("const frameWidth = '430px'")
    expect(layout).toContain("className={`mobile-app-container ${framed ? 'app-framed' :")
    for (const tab of ['pass', 'my'] as const) {
      const d = document.createElement('div'); d.innerHTML = buildGuestFirstScreen(tab, '<div>LOADER</div>', 'n', false)
      const root = d.querySelector('#ur-first-screen')!
      expect(root.children.length).toBe(2)
      expect(root.children[0].getAttribute('class')).toBe(PC_HOME_FS.topnav)
      const frame = root.children[1]
      expect(frame.getAttribute('class')).toBe(GUEST_PC_FRAME.cls)
      expect(frame.getAttribute('style')).toBe(`--app-frame:${GUEST_PC_FRAME.width}`)
      expect(frame.firstElementChild!.getAttribute('class')).toBe(GUEST_CLS.root)
    }
    const l = document.createElement('div'); l.innerHTML = buildGuestFirstScreen('login', '<div>LOADER</div>', 'n', false)
    const lroot = l.querySelector('#ur-first-screen')!
    expect(lroot.children.length).toBe(1)
    expect(lroot.firstElementChild!.getAttribute('class')).toBe(GUEST_PC_FRAME.cls)
    expect(buildGuestFirstScreen('my', '<div>LOADER</div>', 'n')).toBe(buildGuestFirstScreen('my', '<div>LOADER</div>', 'n', true))
    expect(buildGuestFirstScreen('my', '<div>LOADER</div>', 'n')).not.toContain('app-framed')
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
  it('세션 쿠키가 없고 네 경로일 때 그린다 — UA 는 조건이 아니라 빌더 인자(PC 면 네비 예약 + 430 액자, 2026-11-09)', () => {
    expect(worker).toMatch(/\} else if \(!authed && guestTabOf\(url\.pathname\)\) \{ const guestFirst = buildGuestFirstScreen\(guestTabOf\(url\.pathname\)!, urdealLoaderHtml, nonce, shouldRenderMobileFirstScreen\(c\.req\.header\('user-agent'\)\)\)/)
  })
  it('경로 판정', () => {
    expect(guestTabOf('/my-vouchers')).toBe('pass')
    expect(guestTabOf('/u/me/')).toBe('shop')
    expect(guestTabOf('/user/profile')).toBe('my')
    for (const p of ['/u/jiwon1228', '/my-vouchers/1', '/user', '/']) expect(guestTabOf(p)).toBeNull()
  })
})
