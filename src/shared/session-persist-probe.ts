/**
 * 🔑 2026-10-10 — "302 가 심은 쿠키가 이 브라우저에 남았는가" 를 재는 표식 한 개.
 *
 * 왜 필요한가:
 *   카카오 콜백(`/auth/kakao/sync/callback`)은 **cross-site 302** 응답에 세션 쿠키를 심는다.
 *   크롬·안드로이드는 그 쿠키를 그대로 받지만 **iOS Safari/WebKit 은 유실**한다(2026-06-20 사고).
 *   그래서 콜백이 단명 티켓을 fragment(`#st=`)로 넘기고, 착지한 앱이 same-origin
 *   `POST /api/auth/session/establish` 로 세션을 **다시** 발급받는다 — iOS 를 살린 처방이다.
 *
 *   문제는 그 교환을 **첫 렌더 앞에서 기다린다**는 것이다(`main.tsx` bootApp). 쿠키가 이미
 *   들어온 브라우저에서는 순전히 낭비인데, 세션 쿠키는 `HttpOnly` 라 **앱이 그 사실을 볼 수 없다.**
 *
 *   ⇒ 세션 쿠키와 **같은 속성**(`Secure`·`SameSite=Lax`·`Path=/`)으로 `HttpOnly` 만 뺀 표식을
 *     같은 응답에 하나 더 심는다. 착지한 앱에 그 표식이 보이면 **같은 응답의 세션 쿠키도 남았다**는
 *     뜻이므로 기다리지 않고 바로 그린다. 안 보이면(iOS) 종전 경로 그대로 — 처방은 한 글자도 안 약해진다.
 *
 * 🔒 이 값은 **인증 신호가 아니다.** 내용은 고정 문자열 `1` 이고 서버는 이 쿠키를 **읽지 않는다**
 *    (권한 판정은 오직 `ur_session` JWT). 위조해도 얻는 것은 "렌더를 안 기다린다" 뿐이고, 세션이
 *    실제로 없으면 API 가 401 을 주고 앱은 비로그인으로 그려진다 — 오늘 establish 가 실패했을 때와 같다.
 *
 * ⏱️ 수명은 티켓과 같은 120초. 짧게 두는 이유: 이 표식을 읽는 순간은 **콜백 직후**(티켓이 있을 때)
 *    뿐이라 더 길 필요가 없고, 길면 "옛 로그인의 표식" 과 헷갈릴 여지만 생긴다.
 */

/** 쿠키 이름 — 서버가 심고 클라가 읽는 **유일한** 출처(두 벌이 갈리면 조용히 늘 느려진다). */
export const SESSION_PERSIST_PROBE = 'ur_sess_set'

/** 티켓(120초)과 같은 수명. */
export const SESSION_PERSIST_PROBE_MAX_AGE = 120

/**
 * 서버가 콜백 302 에 append 할 `Set-Cookie` 값.
 * ⚠️ `HttpOnly` 를 **일부러** 빼는 것이 이 표식의 존재 이유다(앱이 읽어야 한다).
 *    그 밖의 속성은 `createSessionCookie`(type='user')와 같아야 한다 — 하나가 남고 하나가
 *    사라지는 브라우저가 있으면 판정이 거짓이 되므로.
 */
export function sessionPersistProbeCookie(): string {
  return `${SESSION_PERSIST_PROBE}=1; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_PERSIST_PROBE_MAX_AGE}`
}

/** 읽은 뒤 지우는 값(표식을 남겨 둘 이유가 없다). */
export function clearSessionPersistProbe(): string {
  return `${SESSION_PERSIST_PROBE}=; Path=/; Max-Age=0`
}

/**
 * `document.cookie` 문자열에 표식이 있는가.
 * ⚠️ `includes('ur_sess_set')` 같은 부분일치를 쓰지 않는다 — 다른 쿠키 이름에 이 문자열이
 *    들어 있으면 거짓 양성이 되고, 그 결과는 **에러가 아니라 iOS 에서 렌더를 안 기다리는 것**이다.
 */
export function hasSessionPersistProbe(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) return false
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    if (part.slice(0, eq).trim() === SESSION_PERSIST_PROBE) return true
  }
  return false
}
