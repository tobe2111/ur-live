/**
 * 🧭 2026-06-22: 큐레이터 링크샵 페이지 데이터 모듈 캐시 (CuratorPage.tsx 에서 추출).
 *   추출 이유: picker(/u/me/add) 등 다른 작은 청크가 무거운 CuratorPage 청크를 끌어오지 않고
 *   캐시 무효화(invalidateCurator)만 가볍게 import 할 수 있도록.
 *
 *   동작은 기존과 동일: 60s TTL 메모리 캐시 + in-flight 공유(중복요청 0) + 하단바 워밍.
 */

import { curatorApi, type CuratorPageResponse } from '@/features/curator/api/curator-api'

export const CURATOR_CACHE_TTL = 60_000
const _curatorCache = new Map<string, { data: CuratorPageResponse; at: number }>()
const _curatorInflight = new Map<string, Promise<CuratorPageResponse | null>>()

export function getCuratorCache(handle: string): CuratorPageResponse | null {
  const hit = _curatorCache.get(handle)
  return hit ? hit.data : null
}

export function fetchCuratorPage(handle: string): Promise<CuratorPageResponse | null> {
  const inflight = _curatorInflight.get(handle)
  if (inflight) return inflight
  const p = curatorApi.getPage(handle)
    .then((res) => {
      if (res?.success) { _curatorCache.set(handle, { data: res, at: Date.now() }); return res }
      return res ?? null
    })
    .catch(() => null)
    .finally(() => { _curatorInflight.delete(handle) })
  _curatorInflight.set(handle, p)
  return p
}

/** 하단바 pointerdown 워밍 — 누르는 순간 데이터 선요청 (신선하면 no-op). */
export function warmCurator(handle: string): void {
  if (!handle || handle === 'me') return
  const hit = _curatorCache.get(handle)
  if (hit && Date.now() - hit.at < CURATOR_CACHE_TTL) return
  void fetchCuratorPage(handle)
}

// 🏁 2026-06-22 (대표 — picker 에서 담은 게 즉시 반영): 핀 추가/삭제 후 모듈 캐시 무효화 →
//   링크샵 재진입 시 stale(옛 핀) flash 없이 fresh 페인트. handle 미지정 시 전체 클리어
//   (picker 는 오너 본인 데이터만 바꾸므로 전체 클리어해도 무해 — 다음 진입에서 서버 fresh).
export function invalidateCurator(handle?: string): void {
  if (handle) _curatorCache.delete(handle)
  else _curatorCache.clear()
}
