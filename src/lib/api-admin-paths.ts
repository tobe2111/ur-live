/**
 * 🛡️ 2026-11-25 어드민만 쓰는데 `/api/admin*` · `/api/<기능>/admin` 패턴 밖에 있는 경로.
 *
 * 요청 인터셉터(`api.ts`)는 주소 모양으로 어느 토큰을 붙일지 정한다. 아래 주소들은 공개 목록(`/api/sections` · `/api/debug`)에
 * 가리거나 어느 패턴에도 안 걸려 **토큰 없이** 나갔고, 서버는 어드민 쿠키를 `/api/admin/*` 안에서만 받는다(라이브 실측).
 * 그래서 홈 섹션 관리 · KV 모니터링 · 맛집 수요 세 화면이 "불러오지 못했습니다"(401)였다.
 * 홈 섹션은 읽기(`/admin`)와 모든 쓰기가 어드민 전용이다 — 공개인 것은 목록 GET 뿐이다.
 *
 * 순수 모듈로 둔 이유: 시험이 `api.ts`(axios · 인터셉터)를 통째로 들이지 않고 이 판정만 잰다.
 * 가드: `src/tests/unit/admin-screens-auth-2026-11-25.test.ts` — 어드민 화면이 부르는 주소를 전수로 훑는다.
 */
export function isAdminOnlyOutsidePatterns(url: string, method: string): boolean {
  if (url.startsWith('/api/debug/') || url.startsWith('/api/restaurant-suggestions/stats')) return true
  if (url.startsWith('/api/sections')) return /^\/api\/sections\/admin(\/|\?|$)/.test(url) || method.toUpperCase() !== 'GET'
  return false
}
