/**
 * 🤝 제휴사 입점 위젯 — "매장 등록하고 돌아오기" 기억 (2026-10-31 대표 *"제휴사들이 자신들의 사이트에서 유어딜 서비스를 파는"*)
 *
 * 제휴사 사이트의 [유어딜 입점 신청] → `/store/partner/:agencyId` 에 들어온 사장님이 아직 매장이 없으면
 * 매장 등록(`/store/new`)을 거쳐야 한다. 그 사이에 어느 제휴사에서 왔는지 잃으면 요청이 안 간다(에러 0 —
 * 사장님은 그냥 마이로 떨어진다). 그래서 들어온 순간 적어 두고, 매장 등록이 끝나면 그 화면으로 되돌린다.
 *
 * 7일만 기억한다 — 오래전 본 위젯 때문에 엉뚱한 매장 등록이 제휴사 화면으로 튀지 않게.
 */
const KEY = 'ur_partner_store_return'
const TTL_MS = 7 * 24 * 60 * 60 * 1000

export function rememberPartner(agencyId: number, now = Date.now()): void {
  if (!Number.isInteger(agencyId) || agencyId <= 0) return
  try { localStorage.setItem(KEY, JSON.stringify({ id: agencyId, at: now })) } catch { /* 저장 막힘 — 돌아오기만 못 한다 */ }
}

/** 매장 등록 직후 갈 곳. 기억이 없거나 지났으면 null. 꺼내면서 지운다(한 번만 돌아간다). */
export function takePartnerReturn(now = Date.now()): string | null {
  try {
    const raw = localStorage.getItem(KEY)
    localStorage.removeItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { id?: unknown; at?: unknown }
    const id = Number(v.id); const at = Number(v.at)
    if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(at) || now - at > TTL_MS || now < at) return null
    return `/store/partner/${id}`
  } catch {
    return null
  }
}

export function forgetPartner(): void {
  try { localStorage.removeItem(KEY) } catch { /* noop */ }
}
