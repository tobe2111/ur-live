import { hasAgencyLogin, AGENCY_TOKEN_KEY_MIRROR } from '@/lib/agency-presence'

function readAgencyTokenLite(): string {
  for (const get of [() => localStorage.getItem(AGENCY_TOKEN_KEY_MIRROR), () => sessionStorage.getItem(AGENCY_TOKEN_KEY_MIRROR)]) {
    try { const v = get(); if (v) return v } catch { /* 막힘 */ }
  }
  return ''
}
/**
 * 🏃 2026-11-04 대표 *"마이페이지도 리스터코퍼레이션 에이전시 명 그 부분이나 몇몇 부분만 유독 늦게 떠"* —
 *   에이전시 구역이 쓰는 조회를 **마이의 첫 렌더와 같은 순간에** 출발시킨다.
 *
 * 종전엔 줄을 서 있었다: 마이 그림 → 에이전시 화면 코드(lazy) 받기 → 그제야 `/me·/staff·/payouts` →
 *   매장 판 코드가 그려진 뒤에야 `/stores·/notifications`. 각 단계가 한 왕복씩 더해져 에이전시 구역만 늦게 떴다.
 * 여기서 미리 받아 둔 응답은 `agency-api.agencyRequest` 가 **같은 경로의 GET 을 처음 부를 때 한 번만** 꺼내 쓴다
 *   (같은 토큰 · 10초 이내). 그 뒤 호출은 종전대로 새로 받는다 — 화면 동작은 그대로이고 출발만 앞당긴다.
 * ⚠️ `lib/agency-presence` 가 아니라 **에이전시 화면 쪽**에 산다 — 거기 두면 모든 손님 화면의 공용 묶음(app-utils)에 실려
 *   유어샵 첫 화면 예산을 넘겼다(CI surface-budgets +1.6KB). 마이는 이 모듈을 동적으로 불러 출발시킨다.
 */
export const AGENCY_WARM_PATHS = ['/me', '/staff', '/payouts', '/stores', '/notifications?limit=30'] as const
type AgencyWarmResult = { status: number; body: string } | null
const agencyWarm = new Map<string, { token: string; at: number; p: Promise<AgencyWarmResult> }>()
const AGENCY_WARM_TTL_MS = 10_000

export function warmAgencyRequests(): void {
  if (typeof fetch === 'undefined' || !hasAgencyLogin()) return
  const token = readAgencyTokenLite()
  if (!token) return
  const now = Date.now()
  for (const path of AGENCY_WARM_PATHS) {
    const cur = agencyWarm.get(path)
    if (cur && cur.token === token && now - cur.at < AGENCY_WARM_TTL_MS) continue
    const p: Promise<AgencyWarmResult> = fetch(`/api/agency-console${path}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      credentials: 'omit',
    }).then(async (r) => ({ status: r.status, body: await r.text() })).catch(() => null)
    agencyWarm.set(path, { token, at: now, p })
  }
}

/** 미리 받아 둔 응답 — 같은 토큰 · 10초 이내일 때 한 번만 준다(두 번째부터는 null → 새로 받는다). */
export function takeAgencyWarm(path: string, token: string): Promise<AgencyWarmResult> | null {
  const w = agencyWarm.get(path)
  if (!w) return null
  agencyWarm.delete(path)
  if (w.token !== token || Date.now() - w.at > AGENCY_WARM_TTL_MS) return null
  return w.p
}
