/**
 * 🍪 쿠키 한 줄 읽기 — `api.ts` 와 `csrf-token.ts` 가 **같은 구현**을 쓴다.
 *
 * 2026-10-06 에 CSRF 단일비행을 `csrf-token.ts` 로 떼면서 생겼다. 그냥 두면
 * `api ↔ csrf-token` **순환 import** 가 되고(지금은 둘 다 요청 시점에만 부르므로 안전하지만
 * 누가 모듈 평가 시점에 부르는 순간 조용히 깨진다), 각자 구현하면 두 벌이 갈린다.
 */
export function readCookie(name: string): string {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&') + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}
