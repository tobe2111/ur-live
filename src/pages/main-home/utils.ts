/**
 * 🛡️ 2026-05-02: TD-018 분할 — MainHomePage 공유 유틸 (좌표→지역, 썸네일, 할인율, 마감 시간).
 */
import { REGION_COORDS } from './constants'
import type { LiveStream } from './types'

export function detectRegionFromCoords(lat: number, lng: number): string | null {
  let closest: { name: string; dist: number } | null = null
  for (const r of REGION_COORDS) {
    const dLat = lat - r.lat
    const dLng = lng - r.lng
    const dist = dLat * dLat + dLng * dLng // squared distance 로 충분 (정렬용)
    if (!closest || dist < closest.dist) closest = { name: r.name, dist }
  }
  // 0.5도 이내 (대략 55km) 만 유효
  if (closest && closest.dist < 0.25) return closest.name
  return null
}

export function getThumb(s: LiveStream) {
  // 🛡️ 2026-05-11: custom_thumbnail_url (셀러 업로드, 영구) → thumbnail_url (방송용) → image_url → YouTube hqdefault (404 가능, 마지막 fallback)
  const custom = (s as { custom_thumbnail_url?: string }).custom_thumbnail_url
  return custom || s.thumbnail_url || s.image_url || (s.youtube_video_id ? `https://img.youtube.com/vi/${s.youtube_video_id}/hqdefault.jpg` : null)
}

export function disc(p: number, op?: number) {
  return op && op > p ? Math.round((1 - p / op) * 100) : 0
}

// 🪦 2026-09-07: `fmtEnd(deadline)`(`N분 후 마감`) 제거 — 참조 0. 마감 개념이 없어져 되살릴 자리도 없다.
