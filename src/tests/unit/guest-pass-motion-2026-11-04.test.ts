/**
 * 🎬 로그아웃 이용권 탭 모션(2026-11-04 대표 *"로그아웃 상태에서의 이용권 페이지도 모션그래픽들을 넣어줄래?"*).
 *
 * 지키는 것:
 *  (2026-11-04 같은 날 개정 — 대표 *"이용권 티켓 이제 저렇게 안생겼잖아"*: 옛 QR 띠 티켓 → 지금 지갑 줄 모양 예시 두 장.
 *   그래서 QR 스캔 줄·띠 빛은 없어지고 '줄 차례 착지 · [사용] 물결' 이 됐다.)
 *  ① 모션 CSS 를 실제로 꽂고, 그 표식(`ur-gp-*`)이 앱·서버 첫 화면이 **같이 쓰는** 클래스 SSOT 에 있다
 *     (한쪽에만 있으면 서버가 그린 티켓은 영영 안 움직이거나, 앱이 그릴 때 모양이 갈린다).
 *  ② 서버가 이미 그린 위쪽(티켓·1·2·3)의 움직임은 **보이지 않게 시작하지 않는다** — opacity 0 에서 띄우면
 *     첫 화면에 보이던 티켓이 한 번 꺼졌다 켜진다(깜빡임).
 *  ③ 숨겨서 시작하는 것은 앱만 그리는 아래(예시·보러 가기)뿐이고, 화면에 들어와야 켜진다(`ur-gp-on`).
 *  ④ 동작 줄이기(prefers-reduced-motion)에서는 전부 멈추고 숨긴 것도 보인다.
 *
 * ⚠️ 못 보는 것: 움직임이 보기 좋은지(그려서 볼 것) · 실제 브라우저에서 IntersectionObserver 가 켜지는지.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { GUEST_CLS } from '@/shared/guest-page'

const page = readFileSync('src/pages/guest/GuestPassPage.tsx', 'utf8')
const css = (page.match(/injectMotionCss\('ur-m-guestpass', `([^`]*)`\)/) || [])[1] || ''
const kf = (name: string) => (css.match(new RegExp(`@keyframes ${name} \\{(.*?\\})\\s*\\}`)) || [])[1] || ''

describe('로그아웃 이용권 탭 모션', () => {
  it('① 모션 CSS 를 꽂고, 표식은 앱·서버가 같이 쓰는 클래스에 있다', () => {
    expect(css.length).toBeGreaterThan(500)
    expect(GUEST_CLS.walletRow).toContain('ur-gp-wrow')
    expect(GUEST_CLS.walletUse).toContain('ur-gp-use')
    expect(GUEST_CLS.stepNum).toContain('ur-gp-num')
    for (const k of ['.ur-gp-wrow {', '.ur-gp-use {', '.ur-gp-num {']) expect(css).toContain(k)
  })

  it('② 서버가 그린 위쪽 움직임은 opacity 0 에서 시작하지 않는다', () => {
    for (const name of ['ur-gp-land', 'ur-gp-numon', 'ur-gp-press', 'ur-gp-ring', 'ur-gp-kb']) {
      const body = kf(name)
      expect(body, name).not.toBe('')
      expect(body, name).not.toMatch(/opacity/)
    }
  })

  it('③ 숨겨서 시작하는 것은 아래 예시뿐이고, 화면에 들어오면 켜진다', () => {
    const hidden = css.match(/[^}]*\{ opacity: 0; \}/g) || []
    for (const h of hidden) expect(h, h).toMatch(/ur-gp-shelf/)
    expect(css).toMatch(/\.ur-gp-shelf\.ur-gp-on \.ur-gs-rows > \* \{ animation/)
    // 관찰기 콜백(화면에 들어올 때)과 관찰기 없는 경우 둘 다 켠다 — 콜백 쪽이 빠지면 예시가 영영 투명하다
    expect(page).toMatch(/isIntersecting\)\) \{ el\.classList\.add\('ur-gp-on'\)/)
    expect(page).toMatch(/IntersectionObserver === 'undefined'\) \{ el\.classList\.add\('ur-gp-on'\)/)
    expect(page).toMatch(/ref=\{shelfRef\} className="[^"]*ur-gp-shelf/)
    expect(page).toContain('<GuestExampleRows motion />')
  })

  it('④ 동작 줄이기에서는 멈추고, 숨긴 것도 보인다', () => {
    const rm = (css.match(/@media \(prefers-reduced-motion: reduce\)\{(.*)\}$/) || [])[1] || ''
    expect(rm).toMatch(/animation:none!important/)
    expect(rm).toMatch(/\.ur-gp-wrow,\[data-guest="pass"\] \.ur-gp-wrow img,\[data-guest="pass"\] \.ur-gp-use,/)
    expect(rm).toMatch(/\.ur-gp-use::after,\[data-guest="pass"\] ol::after\{display:none\}/)
    expect(rm).toMatch(/\.ur-gp-shelf \.ur-gs-rows > \*,\.ur-gp-shelf \.ur-gp-browse\{opacity:1\}/)
  })

  it('⑤ "제대로" — 사용 시연(눌림 + QR 떠오름) · 1·2·3 막대 · 헤드라인 형광펜이 있다(2026-11-04 대표 *"모션그래픽 제대로 넣어줘"*)', () => {
    expect(css).toMatch(/\.ur-gp-wrow:first-child \.ur-gp-use \{[^}]*animation: ur-gp-press [^}]*ur-gp-ring/)
    expect(css).toMatch(/\.ur-gp-wrow:first-child \.ur-gp-use::after \{[^}]*data:image\/svg\+xml[^}]*animation: ur-gp-qrpop/)
    expect(css).toMatch(/\[data-guest="pass"\] ol::after \{[^}]*animation: ur-gp-bar/)
    expect(page).toMatch(/useGuestMotion\(rootRef\)/)
    expect(page).toMatch(/<MarkedLine line=\{t\('guest\.pass\.headline2'/)
  })
})
