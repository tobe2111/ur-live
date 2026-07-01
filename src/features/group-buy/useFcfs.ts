/**
 * 🎯 2026-07-01 (대표 — 동네딜 추첨 응모 노출): 공용 추첨(fcfs) 훅.
 *
 *   목적: 백엔드(`fcfs.routes.ts`, 2026-06-20)만 있고 소비자 화면(홈 피드/리스트)엔 안 붙어 있던
 *         "추첨 N/M명" 배지 + 응모를 홈·리스트에 일관되게 연결. 결제 없음(응모형)이라 이행/환불 사고 0.
 *
 *   설계:
 *     - `/api/fcfs/active`(공개) 1회 fetch → Map<productId, FcfsInfo>. 모듈 캐시(60s) 공유 →
 *       홈+리스트가 같은 세션에서 중복 호출 0(in-flight 공유). 비로그인도 배지 노출(공개 엔드포인트).
 *     - applyFcfs: `/api/fcfs/:id/apply`(로그인 필요) — 낙관적 +1, 401 이면 로그인 안내 toast.
 */
import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

export interface FcfsInfo {
  spots: number
  appliedDisplay: number
  deadline?: string | null
}

const TTL = 60_000
let _cache: { map: Map<number, FcfsInfo>; at: number } | null = null
let _inflight: Promise<Map<number, FcfsInfo>> | null = null

function fetchActive(): Promise<Map<number, FcfsInfo>> {
  if (_inflight) return _inflight
  _inflight = api
    .get('/api/fcfs/active')
    .then((r) => {
      const m = new Map<number, FcfsInfo>()
      const data = Array.isArray(r.data?.data) ? r.data.data : []
      for (const p of data as Array<{ id: number; fcfs?: { enabled?: boolean; spots?: number; appliedDisplay?: number; deadline?: string | null } }>) {
        if (p?.fcfs?.enabled) {
          m.set(p.id, { spots: p.fcfs.spots || 0, appliedDisplay: p.fcfs.appliedDisplay || 0, deadline: p.fcfs.deadline ?? null })
        }
      }
      _cache = { map: m, at: Date.now() }
      return m
    })
    .catch(() => new Map<number, FcfsInfo>())
    .finally(() => { _inflight = null })
  return _inflight
}

/**
 * 활성 추첨 상품 Map + 응모 함수. 홈 피드/리스트 카드에 배지 노출용.
 * 캐시가 신선하면 즉시(0ms) 반환, 아니면 백그라운드 fetch 후 갱신(스켈레톤 없음).
 */
export function useFcfsMap(): { fcfsMap: Map<number, FcfsInfo>; applyFcfs: (id: number) => void } {
  const [fcfsMap, setFcfsMap] = useState<Map<number, FcfsInfo>>(() => _cache?.map || new Map())

  useEffect(() => {
    if (_cache && Date.now() - _cache.at < TTL) { setFcfsMap(_cache.map); return }
    let alive = true
    void fetchActive().then((m) => { if (alive) setFcfsMap(m) })
    return () => { alive = false }
  }, [])

  const applyFcfs = useCallback((id: number) => {
    api
      .post(`/api/fcfs/${id}/apply`)
      .then((res) => {
        const already = !!res.data?.data?.already
        toast.success(already ? '이미 응모했어요' : '🎉 응모 완료! 추첨 결과는 알림으로 안내드려요')
        // 낙관적 표시 갱신(신규 응모만 +1). 서버가 appliedDisplay 를 주면 그 값 우선.
        setFcfsMap((prev) => {
          const info = prev.get(id)
          if (!info) return prev
          const disp = typeof res.data?.data?.appliedDisplay === 'number'
            ? res.data.data.appliedDisplay
            : info.appliedDisplay + (already ? 0 : 1)
          const next = new Map(prev)
          next.set(id, { ...info, appliedDisplay: disp })
          return next
        })
      })
      .catch((e) => {
        if (e?.response?.status === 401) toast.error('응모하려면 로그인이 필요해요')
        else toast.error(e?.response?.data?.error || '응모 처리 중 오류가 발생했어요')
      })
  }, [])

  return { fcfsMap, applyFcfs }
}
