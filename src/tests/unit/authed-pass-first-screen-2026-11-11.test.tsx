/**
 * 🎟️ 로그인한 사람의 내 이용권(`/my-vouchers`) 서버 첫 화면 — 제목 줄 + 로더 (2026-11-11).
 *   실사용 표본(RUM)이 실제로 있는 화면인데 로그인 상태면 서버가 아무것도 안 그렸다(로더 약 2초).
 *
 * 지키는 것:
 *   ① 서버 HTML = 제목 줄(`AUTHED_PASS_CLS`) + 로더 아래 · 뿌리는 높이를 안 잡는다
 *   ② 그 클래스·문구가 `MyVouchersPage`(잠금 파일 — 손대지 않는다)·`WalletPageWrapper`·번역 파일의 글자열과 같다
 *   ③ 세션 쿠키가 있을 때만 · 폰만: 워커 분기 · `firstScreenApplies` · 게스트(쿠키 없음)는 종전 그대로
 *   ④ 쿠키는 있는데 기기가 로그아웃 상태면 스크립트가 제목을 걷어낸다(게스트 스크립트의 반대 방향)
 * ⚠️ 못 보는 것: 실제 속도(세션이 필요해 이 환경에서 못 잰다 — RUM) · 한국어가 아닌 사용자의 제목.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildAuthedPassFirstScreen, authedFirstScreenGuardScript, guestFirstScreenGuardScript } from '@/worker/utils/guest-first-screen'
import { AUTHED_PASS_CLS, AUTHED_PASS_TITLE } from '@/shared/guest-page'
import { firstScreenApplies, criticalSurfaceOf } from '@/worker/utils/css-first-boot'

const LOADER = '<div style="min-height:100dvh">LOADER</div>'
const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
const PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const read = (f: string) => readFileSync(f, 'utf8')
const html = buildAuthedPassFirstScreen(LOADER, 'n1')

describe('① 서버 HTML', () => {
  it('제목 줄 + 로더 아래 · 뿌리는 높이를 안 잡는다', () => {
    const d = document.createElement('div'); d.innerHTML = html
    const root = d.querySelector('#ur-first-screen > div')!
    expect(root.getAttribute('class')).toBe(AUTHED_PASS_CLS.root); expect(AUTHED_PASS_CLS.root).not.toContain('min-h')
    expect(root.firstElementChild!.getAttribute('class')).toBe(AUTHED_PASS_CLS.titleRow)
    const h1 = root.querySelector('h1')!
    expect(h1.getAttribute('class')).toBe(AUTHED_PASS_CLS.title); expect(h1.textContent).toBe(AUTHED_PASS_TITLE)
    expect(html).toContain('min-height:34dvh'); expect(html.indexOf('LOADER')).toBeGreaterThan(html.indexOf('</h1>'))
  })
})

describe('② 화면의 글자열과 같다(잠금 파일은 손대지 않는다)', () => {
  it('MyVouchersPage 제목 줄 · WalletPageWrapper 뿌리 · 번역 파일', () => {
    const page = read('src/pages/MyVouchersPage.tsx')
    expect(page).toContain(`<div className="${AUTHED_PASS_CLS.titleRow}">`)
    expect(page).toContain(`<h1 className="${AUTHED_PASS_CLS.title}">{t('voucher.myVouchers')}</h1>`)
    expect(page).toContain("const theme = 'light' as const")
    expect(read('src/components/wallet/WalletAtoms.tsx')).toContain('<div className={`' + AUTHED_PASS_CLS.root + ' ${className}`}')
    expect(JSON.parse(read('public/locales/ko/translation.json')).voucher.myVouchers).toBe(AUTHED_PASS_TITLE)
  })
})

describe('③ 세션 쿠키가 있을 때만 · 폰만', () => {
  it('워커 분기 — 게스트 분기 앞 · 게스트 분기는 그대로', () => {
    const w = read('src/worker/index.ts') // raw — worker/index.ts 엔 주석 제거기를 쓰지 않는다
    expect(w).toContain("} else if (authed && guestTabOf(url.pathname) === 'pass' && shouldRenderMobileFirstScreen(c.req.header('user-agent'))) { const passFirst = buildAuthedPassFirstScreen(urdealLoaderHtml, nonce);")
    expect(w).toContain("} else if (!authed && guestTabOf(url.pathname)) { const guestFirst = buildGuestFirstScreen(")
  })
  it('firstScreenApplies', () => {
    for (const p of ['/my-vouchers', '/my-vouchers/']) {
      expect(firstScreenApplies(p, PHONE, true)).toBe(true); expect(firstScreenApplies(p, PC, true)).toBe(false)
      expect(firstScreenApplies(p, PHONE, false)).toBe(true) // 게스트는 종전 그대로(게스트 탭 첫 화면)
    }
    expect(firstScreenApplies('/user/profile', PHONE, true)).toBe(false); expect(firstScreenApplies('/u/me', PHONE, true)).toBe(false)
    expect(criticalSurfaceOf('/my-vouchers')).toBe('guest')
  })
})

describe('④ 기기가 로그아웃 상태면 걷어낸다', () => {
  it('게스트 스크립트의 반대 조건 · nonce', () => {
    const s = authedFirstScreenGuardScript('n1')
    expect(html).toContain(s); expect(s).toContain('nonce="n1"')
    expect(s).toContain("if(!(s.getItem('user_id')||s.getItem('session_login')))")
    expect(guestFirstScreenGuardScript('n1')).toContain("if(s.getItem('user_id')||s.getItem('session_login'))")
  })
  it('실제로 돈다 — 로그아웃이면 지우고 로그인이면 남긴다', () => {
    const js = authedFirstScreenGuardScript('n').replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')
    const run = (loggedIn: boolean) => { localStorage.clear(); if (loggedIn) localStorage.setItem('user_id', '3'); document.body.innerHTML = '<div id="ur-first-screen"></div>'; new Function(js)(); return !!document.getElementById('ur-first-screen') }
    expect(run(false)).toBe(false); expect(run(true)).toBe(true)
  })
})
