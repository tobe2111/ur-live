/**
 * 🔔 알림(`/notifications`) 서버 첫 화면 (2026-11-10 — 라이브 폰 첫 그림 1.7~2.3s · HTML 0.3~0.5s).
 *
 * 지키는 것:
 *   ① 서버 HTML = `shared/notifications-page.ts` 클래스·문구 + 공용 머리줄(`wide` — 오른쪽 칸 88px, 비어 있음) · 로더는 아래
 *   ② `NotificationsPage` 가 같은 상수를 쓴다(손으로 적은 클래스 0 · 제목/뒤로/모두 읽음은 상수 기본값)
 *   ③ **세션 쿠키가 있을 때만**: 워커 분기 `authed &&` · `firstScreenApplies(…, authed=true)` 만 참(폰·PC) · authed=false 면 거짓(로더-먼저는 그대로)
 *   ④ PC 면 [네비 높이 예약] + [430 액자] · 표면 `notifications` ↔ 생성기 ROOTS
 * ⚠️ 못 보는 것: 쿠키는 있는데 세션이 만료된 사람(앱이 로그인으로 보내며 머리줄이 한 번 보인다 — 종전 로더와 같은 길이).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { buildNotificationsFirstScreen } from '@/worker/utils/notifications-first-screen'
import { subPageHeadHtml } from '@/worker/utils/sub-page-head-html'
import { NOTIF_CLS, NOTIF_COPY, NOTIF_PULL_PATH } from '@/shared/notifications-page'
import { SUB_PAGE_HEAD } from '@/shared/sub-page-head'
import { PC_HOME_FS } from '@/shared/pc-home-first-screen'
import { GUEST_PC_FRAME } from '@/worker/utils/guest-first-screen'
import { firstScreenApplies, criticalSurfaceOf, criticalCssFor, cssFirstApplies } from '@/worker/utils/css-first-boot'
// @ts-expect-error — .mjs 생성기(타입 없음)
import { SURFACE_ROOTS } from '../../../scripts/generate-critical-css.mjs'

const PAGE = stripComments(readFileSync('src/pages/NotificationsPage.tsx', 'utf8'))
const LOADER = '<div style="min-height:100dvh">LOADER</div>'
const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
const PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const dom = (html: string) => { const d = document.createElement('div'); d.innerHTML = html; return d }
const html = buildNotificationsFirstScreen(LOADER)

describe('① 서버 HTML', () => {
  it.each(Object.entries(NOTIF_CLS).filter(([k]) => k !== 'markAll'))('클래스 %s', (_k, v) => { expect(html).toContain(v) })
  it('머리줄 wide(88px 칸 · 오른쪽 비움) · 제목 · 당김 화살표 path · 로더 아래 · 모두 읽음 버튼은 없다', () => {
    const root = dom(html).querySelector('#ur-first-screen > div')!
    expect(root.getAttribute('class')).toBe(NOTIF_CLS.root)
    const row = root.querySelector('header > div')!
    expect(row.getAttribute('class')).toBe(`${SUB_PAGE_HEAD.row} ${SUB_PAGE_HEAD.rowColsWide} ${SUB_PAGE_HEAD.rowTail}`)
    const right = row.children[2]
    expect(right.getAttribute('class')).toBe(`${SUB_PAGE_HEAD.right} ${SUB_PAGE_HEAD.rightWide}`); expect(right.innerHTML).toBe('')
    expect(root.querySelector('h1')!.textContent).toBe(NOTIF_COPY.title)
    expect(html).toContain(NOTIF_PULL_PATH); expect(html).not.toContain(NOTIF_COPY.markAllRead)
    expect(root.querySelector(`[class="${NOTIF_CLS.list}"]`)!.innerHTML).toBe('')
    expect(html).toContain('min-height:34dvh'); expect(html.indexOf('LOADER')).toBeGreaterThan(html.indexOf('</div>'))
    expect(subPageHeadHtml('x')).toContain(SUB_PAGE_HEAD.rowCols); expect(subPageHeadHtml('x', true)).toContain(SUB_PAGE_HEAD.rowColsWide)
  })
})

describe('② 화면이 같은 상수를 쓴다', () => {
  it('NotificationsPage', () => {
    for (const k of Object.keys(NOTIF_CLS) as Array<keyof typeof NOTIF_CLS>) {
      expect(PAGE, k).toContain(`NOTIF_CLS.${k}`)
      expect(PAGE, `손으로 적은 ${k}`).not.toContain(`"${NOTIF_CLS[k]}"`)
    }
    expect(PAGE).toContain("t('notifications.title', { defaultValue: NOTIF_COPY.title })")
    expect(PAGE).toContain("t('notifications.back', { defaultValue: NOTIF_COPY.back })")
    expect(PAGE).toContain("t('notifications.markAllRead', { defaultValue: NOTIF_COPY.markAllRead })")
    expect(PAGE).toContain('d={NOTIF_PULL_PATH}'); expect(PAGE).toContain('wideSides')
  })
})

describe('③ 세션 쿠키가 있을 때만', () => {
  it('워커 분기 authed && · UA 는 빌더 인자', () => {
    const w = readFileSync('src/worker/index.ts', 'utf8') // ⚠️ worker/index.ts 엔 stripComments 금지(source-text 머리말)
    expect(w).toContain("} else if (authed && url.pathname === '/notifications') { const notifFirst = buildNotificationsFirstScreen(urdealLoaderHtml, shouldRenderMobileFirstScreen(c.req.header('user-agent')))")
  })
  it('firstScreenApplies — authed 만 참(폰·PC) · 아니면 거짓, 로더-먼저는 둘 다', () => {
    for (const p of ['/notifications', '/notifications/']) {
      expect(firstScreenApplies(p, PHONE, true)).toBe(true); expect(firstScreenApplies(p, PC, true)).toBe(true)
      expect(firstScreenApplies(p, PHONE, false)).toBe(false); expect(firstScreenApplies(p, PC, false)).toBe(false)
      expect(cssFirstApplies(p, PHONE, false)).toBe(true)
    }
    expect(firstScreenApplies('/notifications/x', PHONE, true)).toBe(false)
    expect(criticalSurfaceOf('/notifications')).toBe('notifications'); expect(criticalCssFor('/notifications', 'FULL', 'HOME', { notifications: 'N' })).toBe('N')
    expect(SURFACE_ROOTS.notifications).toEqual(['src/worker/utils/notifications-first-screen.ts'])
  })
})

describe('④ PC', () => {
  it('네비 예약 + 액자 · 폰은 그대로', () => {
    const fs = dom(buildNotificationsFirstScreen(LOADER, false)).querySelector('#ur-first-screen')!
    expect(fs.children[0].getAttribute('class')).toBe(PC_HOME_FS.topnav)
    expect(fs.children[1].getAttribute('class')).toBe(GUEST_PC_FRAME.cls); expect(fs.children[1].getAttribute('style')).toBe(`--app-frame:${GUEST_PC_FRAME.width}`)
    expect(dom(html).querySelector('#ur-first-screen')!.children.length).toBe(1)
  })
})
