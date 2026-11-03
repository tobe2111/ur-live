/**
 * 🩹 2026-11-03 대표 신고 *"로그인을 했는데도 왜 이렇게 뜨지?"* — 카카오 로그인(서버 세션 살아 있음)인데 PC 계정 메뉴가 손님용.
 * 헤더는 localStorage `user_id`/`session_login` 만 보는데 그 둘이 비어 있었다(역할 토큰은 남아 있었다).
 * 부팅 때 그 모양이면 서버에 한 번 묻고 되살린다.
 * ⚠️ 못 보는 것: 무엇이 두 키를 지웠는지(원인). 이 시험은 *되살리는 길*만 고정한다.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processAuthCallbackParams, consumerRestoreGate } from '@/utils/auth-callback-bootstrap'
import { CONSUMER_SESSION_RESTORED_EVENT } from '@/lib/consumer-session-event'
import { readFileSync } from 'node:fs'

const flush = () => new Promise((r) => setTimeout(r, 20)) // 동적 import + fetch 두 박자
const health = (session: boolean) => vi.fn(async () => new Response(JSON.stringify({ success: true, data: { session, user: session ? { userId: '3', name: '정지원', email: 'a@b.c', type: 'user' } : null } }), { status: 200 }))

// 부팅 함수는 창당 한 번만 돈다(멱등 깃발) — 시험마다 깃발을 내려야 각 경우를 진짜로 밟는다.
const reset = () => { delete (window as unknown as Record<string, unknown>).__urAuthCallbackProcessed }
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); reset(); window.history.replaceState({}, '', '/') })

describe('소비자 표시 되살리기', () => {
  it('역할 토큰만 있고 서버 세션이 살아 있으면 user_id·session_login 을 다시 쓰고 알린다', async () => {
    localStorage.setItem('agency_token', 'x')
    const f = health(true); vi.stubGlobal('fetch', f)
    const seen = vi.fn(); window.addEventListener(CONSUMER_SESSION_RESTORED_EVENT, seen)
    processAuthCallbackParams(); await flush(); await flush()
    expect(f).toHaveBeenCalledWith('/api/auth/session/health', expect.objectContaining({ credentials: 'include' }))
    expect(localStorage.getItem('user_id')).toBe('3')
    expect(localStorage.getItem('session_login')).toBe('true')
    expect(seen).toHaveBeenCalledTimes(1)
  })
  it('서버 세션이 없으면 아무것도 안 쓴다', async () => {
    localStorage.setItem('seller_token', 'x')
    const f = health(false); vi.stubGlobal('fetch', f)
    processAuthCallbackParams(); await flush(); await flush()
    expect(f).toHaveBeenCalledTimes(1) // 물어는 봤다(헛돌지 않음)
    expect(localStorage.getItem('user_id')).toBeNull()
  })
  it('익명 방문(역할 토큰 없음)엔 요청 0', async () => {
    const f = health(true); vi.stubGlobal('fetch', f)
    processAuthCallbackParams(); await flush()
    expect(f).not.toHaveBeenCalled()
  })
  it('대시보드(어드민·셀러·에이전시)에선 묻지 않는다 — 판정 함수', () => {
    // 이 시험 환경은 history 가 고정이라 경로를 바꿀 수 없다 → 판정을 순수 함수로 뽑아 직접 잰다.
    const store = (o: Record<string, string>) => ({ getItem: (k: string) => o[k] ?? null })
    expect(consumerRestoreGate('/', store({ admin_token: 'x' }))).toBe(true)
    for (const p of ['/admin', '/admin/orders', '/seller/home', '/agency']) expect(consumerRestoreGate(p, store({ admin_token: 'x' }))).toBe(false)
    expect(consumerRestoreGate('/administrator', store({ admin_token: 'x' }))).toBe(true) // 접두어만 같은 경로는 대시보드 아님
    expect(consumerRestoreGate('/', store({ admin_token: 'x', user_id: '3' }))).toBe(false)
    expect(consumerRestoreGate('/', store({}))).toBe(false)
  })
  it('탭당 한 번만 묻는다', async () => {
    localStorage.setItem('agency_token', 'x')
    const f = health(false); vi.stubGlobal('fetch', f)
    processAuthCallbackParams(); await flush(); reset(); processAuthCallbackParams(); await flush()
    expect(f).toHaveBeenCalledTimes(1)
  })
  it('헤더가 그 이벤트에 다시 그린다', () => {
    const nav = readFileSync('src/components/main/DesktopTopNav.tsx', 'utf8')
    expect(nav).toContain('window.addEventListener(CONSUMER_SESSION_RESTORED_EVENT, on)')
  })
})
