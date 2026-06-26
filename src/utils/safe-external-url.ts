/**
 * 🛡️ 2026-06-26 [보안] 외부 URL href 가드.
 *
 * 어드민 승인 화면 등에서 사용자(제조사/판매사)-제출 URL(사업자등록증 이미지 등)을
 * `<a href>` 로 렌더할 때, `javascript:`/`data:` scheme 면 클릭 시 admin 세션에서 스크립트가
 * 실행되는 stored-XSS 가 된다. React 는 href 의 javascript: 를 막지 않는다.
 *
 * 서버 쓰기 검증(supplier-auth/wholesale routes)이 1차 방어이고, 이 함수는 이미 저장된
 * 레거시 값에 대한 방어선이다. http(s) 절대 URL 또는 same-origin 상대경로(/api/media/...)만
 * 통과시키고 그 외(javascript:, data:, vbscript:, 빈값)는 undefined 를 반환 → 링크 비활성.
 */
export function safeHttpHref(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined
  const s = url.trim()
  if (!s) return undefined
  // 업로드 same-origin 상대경로 허용 (단, protocol-relative `//` 와 백슬래시는 차단)
  if (/^\/(?!\/)/.test(s) && !s.includes('\\')) return s
  if (/^https?:\/\//i.test(s)) return s
  return undefined
}
