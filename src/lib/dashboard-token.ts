/**
 * 🔑 대시보드 토큰 신선도 SSOT (2026-09-23 — 대표 신고 "승인 같은 게 왜 이리 느리지? 로딩이 길어").
 *
 * **실사고**: 어드민 대시보드를 하루 만에 다시 열면 콘솔에 401 이 일곱 개 뜨고 화면이 오래 돌았다.
 *   어드민 access 토큰 수명은 24시간인데, 사전 갱신 훅(`useTokenAutoRefresh`)은 **탭이 열려 있는 동안
 *   만료 5분 전**에만 돌고 *이미 만료된* 토큰은 일부러 건드리지 않았다("401 인터셉터에 맡김").
 *   그래서 재방문 첫 화면은 매번 [요청 7개 → 전부 401 → 갱신 1회 → 7개 재시도] 를 탔다 — 왕복이 두 배다.
 *   에러가 콘솔에만 남고 화면은 결국 떠서 **아무도 결함으로 신고하지 않는 종류**였다.
 *
 * ⇒ 고치는 자리는 훅이 아니라 **요청을 보내기 직전**이다. 훅은 마운트 *후* effect 라, React 가
 *   자식 effect 를 먼저 돌리는 이상 자식 쿼리가 언제나 먼저 나간다 — 훅만 고쳐서는 401 을 못 없앤다.
 *   `lib/api.ts` 의 요청 인터셉터(모든 요청이 지나는 단 하나의 길목)가 죽은 토큰을 먼저 갈아 끼운다.
 *
 * 이 파일은 그 판정을 **순수 함수**로만 들고 있다(저장소·네트워크 접근 0) — 훅과 인터셉터가 같은
 * 규칙을 쓰도록. 두 벌이면 한쪽만 고쳐져 "어디선 갱신되고 어디선 안 되는" 날이 온다.
 */

/** 단일 세션·리프레시 체계를 가진 대시보드 역할. 소비자(user) 세션은 쿠키라 해당 없음. */
export type DashboardRole = 'admin' | 'seller' | 'agency'

/** 훅이 쓰는 사전 갱신 창 — 만료 5분 전. (요청 직전 갱신은 아래 REQUEST_SKEW_MS 로 훨씬 좁다.) */
export const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000

/**
 * 요청 직전 갱신의 여유. **일부러 좁다(10초)** — 넉넉한 창은 훅이 이미 맡고 있고, 여기서까지 넓게
 * 잡으면 멀쩡한 토큰을 요청 때마다 갈아 끼워 refresh 호출이 늘어난다. 이 자리의 일은
 * "이미 죽었거나 지금 보내는 사이에 죽을 토큰"만 막는 것이다(시계 오차 + 왕복 시간).
 */
export const REQUEST_SKEW_MS = 10 * 1000

/** JWT payload 의 `exp`(초) → ms. 디코드 불가면 null(= 판단 불가, 건드리지 않는다). */
export function decodeJwtExpMs(token: string | null | undefined): number | null {
  if (!token) return null
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

/**
 * 저장된 access 토큰을 **쓰기 전에** 갈아야 하는가.
 *
 * ⚠️ `expMs === null`(디코드 불가 — 레거시/비-JWT 토큰) 이면 **false**. 모르는 토큰을 임의로
 *    갱신하려 들면 멀쩡한 세션을 건드린다. 판단 불가는 기존 401 흐름에 맡기는 게 맞다.
 */
export function needsPreemptiveRefresh(
  expMs: number | null,
  now: number,
  skewMs: number = REQUEST_SKEW_MS,
): boolean {
  if (expMs === null) return false
  return expMs - now <= skewMs
}

/** 역할별 refresh 엔드포인트. */
export function dashboardRefreshUrl(role: DashboardRole): string {
  return role === 'seller' ? '/api/seller/refresh'
    : role === 'agency' ? '/api/agency/refresh'
    : '/api/admin/refresh'
}

/** 역할별 localStorage 키. 둘이 어긋나면 갱신한 토큰을 아무도 안 읽는다. */
export function dashboardTokenKeys(role: DashboardRole): { token: string; refresh: string } {
  return { token: `${role}_token`, refresh: `${role}_refresh_token` }
}

/**
 * refresh 엔드포인트 자신인가 — 이 요청에는 사전 갱신을 걸지 않는다(자기 자신을 기다리는 모양이 된다).
 * 실제 갱신 호출은 raw axios 라 인터셉터를 안 타지만, 다른 코드가 `api` 로 부를 가능성까지 닫아 둔다.
 */
export function isDashboardRefreshUrl(url: string): boolean {
  return /^\/api\/(admin|seller|agency)\/refresh(\?|$)/.test(url)
}
