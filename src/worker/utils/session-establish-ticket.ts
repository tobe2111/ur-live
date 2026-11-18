/**
 * 🛡️ 세션 확립 티켓 — 카카오·구글 로그인 콜백이 같은 한 벌을 쓴다 (2026-11-18 카카오 라우트에서 꺼냈다).
 *
 * 배경(2026-06-20 iOS 로그인): httpOnly `ur_session` 쿠키를 cross-site OAuth 콜백 302 에서 set 하면 iOS 에서
 *   영속되지 않는다. 그래서 콜백은 단명(120초)·서명·purpose-scoped 티켓만 fragment(`#st=`)로 넘기고, 착지 클라가
 *   same-origin `POST /api/auth/session/establish`(worker/routes/auth.routes.ts)로 교환해 first-party 200 에서
 *   쿠키를 받는다. 토큰을 localStorage 에 두지 않는다.
 */
import { sign as jwtSign } from 'hono/jwt'

export async function signEstablishTicket(
  secret: string,
  user: { id: number | string; name?: string; email?: string | null; profile_image?: string | null },
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return jwtSign({
    p: 'session_establish',
    uid: String(user.id),
    name: user.name || '',
    email: user.email || '',
    img: user.profile_image || '',
    iat: now,
    exp: now + 120,
  }, secret)
}
