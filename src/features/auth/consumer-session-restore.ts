/**
 * 🩹 2026-11-03 대표 신고 *"로그인을 했는데도 왜 이렇게 뜨지?"* (PC 계정 메뉴가 손님용 — 카카오 로그인 상태).
 *   실측: 그날 13:00 KST 카카오 로그인 성공(desktop_chrome establish_ok) · 헤더 찜 배지는 1(= 서버는 소비자로 인증) —
 *   그런데 헤더의 소비자 판정(`hasConsumerSession`)이 보는 localStorage `user_id`/`session_login` 이 비어 있었다.
 *   즉 **서버 세션(ur_session)은 살아 있는데 브라우저 표시만 손님**이다. 무엇이 그 두 키를 지웠는지는 아직 못 좁혔다
 *   (역할 토큰은 남아 있었다). 그래서 원인과 무관하게 **되살린다**: 탭당 한 번 서버에 묻고, 살아 있으면 두 키를 다시 쓴다.
 *   📦 위치가 `features/auth` 인 이유: `src/lib`·`src/utils` 는 vite 가 전부 app-utils(모든 첫 화면)에 묶어 동적 import 로도 안 갈라진다(빌드 실측).
 *   부르는 쪽(`auth-callback-bootstrap`)이 "소비자 흔적 없음 + 역할 토큰 있음" 일 때만 이 파일을 동적으로 부른다 — 익명 방문엔 요청 0.
 */
import { CONSUMER_SESSION_RESTORED_EVENT } from '@/lib/consumer-session-event'

type RestoreHealth = { data?: { session?: boolean; user?: { userId?: string; name?: string; email?: string; type?: string } | null } }

export async function restoreConsumerSession(): Promise<void> {
  try {
    if (localStorage.getItem('user_id') || localStorage.getItem('session_login')) return
    if (sessionStorage.getItem('ur_consumer_restore_tried')) return
    sessionStorage.setItem('ur_consumer_restore_tried', '1')
    const r = await fetch('/api/auth/session/health', { credentials: 'include' })
    if (!r.ok) return
    const body = (await r.json()) as RestoreHealth
    const u = body?.data?.session ? body.data.user : null
    if (!u?.userId || (u.type && u.type !== 'user')) return
    if (localStorage.getItem('user_id') || localStorage.getItem('session_login')) return // 그 사이 로그인 흐름이 썼다
    localStorage.setItem('user_id', String(u.userId))
    localStorage.setItem('session_login', 'true')
    if (u.name && !localStorage.getItem('user_name')) localStorage.setItem('user_name', u.name)
    if (u.email && !localStorage.getItem('user_email')) localStorage.setItem('user_email', u.email)
    window.dispatchEvent(new Event(CONSUMER_SESSION_RESTORED_EVENT))
  } catch { /* 네트워크·저장소 — 다음 탭에서 다시 */ }
}
