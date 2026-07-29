/**
 * ⚡ 서비스몰 로딩 가속 (2026-07-27 대표 "서비스몰이 조금 늦게 떠").
 *   원인: ① 콜드 ur-ads 워커(저트래픽 — isolate 콜드 + 첫 요청 DDL/시드 검사) ② 탭 클릭 후에야 fetch 시작.
 *   수리: ① 대시보드 진입 시 선워밍(in-flight 공유 — 탭 열 때 이어받아 중복 왕복 0)
 *        ② sessionStorage 캐시 즉시 페인트(stale-while-revalidate — 뜨자마자 카드 표시 후 신선분 교체).
 */
import api from '@/lib/api'

const CACHE_KEY = 'ads_services_cache_v1'
const CACHE_TTL_MS = 30 * 60 * 1000 // 30분 — 상품 목록은 저변동(어드민 수정 시 신선분이 곧 교체)

const authHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('ads_token') : null
  return t ? { Authorization: `Bearer ${t}` } : undefined
}

export interface WarmedServices { services: unknown[]; at: number }

let inflight: Promise<unknown[] | null> | null = null

/** 즉시 페인트용 캐시 읽기 — TTL 내 캐시 없으면 null. */
export function readServicesCache(): unknown[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const j = JSON.parse(raw) as WarmedServices
    if (!Array.isArray(j.services) || Date.now() - (j.at || 0) > CACHE_TTL_MS) return null
    return j.services
  } catch { return null }
}

/** 서비스 목록 워밍 — 대시보드 진입 시 fire-and-forget, 패널은 같은 in-flight 를 이어받음. */
export function warmServices(): Promise<unknown[] | null> {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const r = await api.get('/api/ads/services', { headers: authHeader() })
      if (r.data?.success && Array.isArray(r.data.services)) {
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ services: r.data.services, at: Date.now() })) } catch { /* quota — 무해 */ }
        return r.data.services as unknown[]
      }
      return null
    } catch { return null } finally {
      // 완료 후 in-flight 해제 — 다음 호출은 새 요청(패널 리프레시가 항상 신선분을 받도록)
      setTimeout(() => { inflight = null }, 0)
    }
  })()
  return inflight
}
