/**
 * 📧 서버가 그리는 HTML 안의 이메일을 Cloudflare "Email Obfuscation" 에서 빼낸다 (2026-11-11 대표 *"이메일도 고쳐줘"*).
 *
 * 그 설정(존 설정 `email_obfuscation: on`)은 HTML 의 이메일을 `[email protected]` 로 바꾸고 풀이 스크립트
 * (`/cdn-cgi/scripts/…/email-decode.min.js`)를 붙이는데, **우리 CSP 가 그 스크립트를 막는다**(라이브 콘솔 실측).
 * 그래서 앱이 켜지기 전 화면 · JS 안 돌리는 크롤러에는 영영 `[email protected]` 로 남았다(`/faq`).
 * Cloudflare 가 공식으로 존중하는 `<!--email_off-->…<!--/email_off-->` 로 감싸면 그 구간은 건드리지 않는다.
 *
 * ⚠️ 설정 자체를 끄는 길도 있지만(대시보드) 세션은 Cloudflare 에 쓰지 않는다 — 코드로 그 자리만 뺀다.
 * ⚠️ CSP 에 Cloudflare 스크립트를 열어 주는 길은 택하지 않는다(보안 표면이 넓어진다).
 */
export const EMAIL_OFF_OPEN = '<!--email_off-->'
export const EMAIL_OFF_CLOSE = '<!--/email_off-->'

/** 이미 이스케이프된 HTML 조각을 받아, 이메일이 들어 있으면 가리기 제외 표시로 감싼다. */
export function emailOff(html: string): string {
  return html.includes('@') ? `${EMAIL_OFF_OPEN}${html}${EMAIL_OFF_CLOSE}` : html
}
