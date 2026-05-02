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
  return s.thumbnail_url || s.image_url || (s.youtube_video_id ? `https://img.youtube.com/vi/${s.youtube_video_id}/hqdefault.jpg` : null)
}

export function disc(p: number, op?: number) {
  return op && op > p ? Math.round((1 - p / op) * 100) : 0
}

export function fmtEnd(deadline?: string) {
  if (!deadline) return ''
  const min = Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 60000))
  if (min < 60) return `${min}분 후 마감`
  if (min < 1440) return `${Math.floor(min / 60)}시간 ${min % 60}분 후 마감`
  return `${Math.floor(min / 1440)}일 후 마감`
}
