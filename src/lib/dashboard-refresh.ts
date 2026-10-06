/**
 * 🔑 대시보드 토큰 **갱신 실행부** 하나 (2026-09-23 — 대표 "승인 같은 게 왜 이리 느리지? 로딩이 길어").
 *
 * 판정(언제 갈아야 하나)은 `dashboard-token.ts`(순수 함수), 실행(실제로 갈아 끼우기)은 여기.
 * 나눠 둔 이유는 판정만 쓰는 쪽(테스트·훅의 재스케줄 게이트)이 네트워크·localStorage 를 안 끌고 오게.
 *
 * **왜 한 곳이어야 하나 — inflight 락 때문이다.** refresh 토큰은 회전(rotation)한다: 같은 순간에
 * 갱신이 둘 나가면 **첫 번째만 성공하고 두 번째는 stale refresh 토큰으로 401** → 강제 로그아웃이다.
 * 종전엔 갱신 경로가 둘이었다 — `lib/api.ts` 의 401 인터셉터(락 있음)와 `useTokenAutoRefresh` 의
 * 생 `axios.post`(락 **없음**). 마운트 순간 둘이 겹칠 수 있었고, 2026-09-23 에 요청 인터셉터에도
 * 사전 갱신을 넣으면서 겹칠 확률이 더 올라갔다. ⇒ 세 경로가 **같은 락**을 쓴다.
 */
import axios from 'axios'
import {
  type DashboardRole, REQUEST_SKEW_MS,
  decodeJwtExpMs, needsPreemptiveRefresh, dashboardRefreshUrl, dashboardTokenKeys,
} from './dashboard-token'

export type RefreshResult = { accessToken: string; refreshToken?: string } | null

const _inflightRefresh: Record<string, Promise<RefreshResult> | undefined> = {}

/**
 * refresh 엔드포인트 1회 호출. 같은 역할로 동시에 부르면 **같은 Promise 를 공유**한다.
 * ⚠️ 생 `axios` 를 쓴다(`api` 인스턴스 아님) — 인터셉터를 다시 타면 자기 자신을 기다린다.
 */
export async function refreshDashboardToken(
  refreshUrl: string,
  refreshToken: string,
  cacheKey: DashboardRole,
): Promise<RefreshResult> {
  if (_inflightRefresh[cacheKey]) return _inflightRefresh[cacheKey]!
  const p = (async () => {
    try {
      const res = await axios.post(refreshUrl, { refreshToken })
      if (res.data?.success) {
        return {
          accessToken: res.data.data.accessToken as string,
          refreshToken: res.data.data.refreshToken as string | undefined,
        }
      }
      return null
    } catch {
      return null
    } finally {
      // 다음 사이클이 새 갱신을 시도할 수 있도록 즉시 해제
      delete _inflightRefresh[cacheKey]
    }
  })()
  _inflightRefresh[cacheKey] = p
  return p
}

/**
 * 저장된 access 토큰이 곧(또는 이미) 죽었으면 갈아 끼우고, 쓸 토큰을 돌려준다.
 *
 * 🔒 안전 규칙:
 *   - 갱신 **실패는 삼킨다** — 저장된 토큰을 그대로 돌려주고 기존 401 흐름(강제 로그아웃 포함)에 맡긴다.
 *     여기서 로그아웃을 흉내 내면 401 응답 인터셉터의 탭 경합 가드(2026-07-04)를 우회하게 된다.
 *   - 디코드 불가 토큰은 건드리지 않는다(`needsPreemptiveRefresh` 가 false) — 모르는 세션을 깨지 않는다.
 *
 * @param skewMs 얼마나 미리 갈 것인가. 요청 직전은 기본값(10초, 좁게), 훅의 예약 갱신은 5분.
 */
export async function ensureFreshDashboardToken(
  role: DashboardRole,
  skewMs: number = REQUEST_SKEW_MS,
): Promise<string | null> {
  const keys = dashboardTokenKeys(role)
  let token: string | null = null
  let refreshToken: string | null = null
  try {
    token = localStorage.getItem(keys.token)
    refreshToken = localStorage.getItem(keys.refresh)
  } catch { return null }            // storage 접근 불가 — 토큰 없음과 같게 취급
  if (!token || !refreshToken) return token
  if (!needsPreemptiveRefresh(decodeJwtExpMs(token), Date.now(), skewMs)) return token
  const refreshed = await refreshDashboardToken(dashboardRefreshUrl(role), refreshToken, role)
  if (!refreshed) return token       // 실패 → 기존 401 흐름
  try {
    localStorage.setItem(keys.token, refreshed.accessToken)
    if (refreshed.refreshToken) localStorage.setItem(keys.refresh, refreshed.refreshToken)
  } catch { /* storage 쓰기 불가 — 이번 요청만 새 토큰으로 */ }
  return refreshed.accessToken
}
