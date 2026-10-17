/**
 * 📍 2026-10-17 대표 신고 — PC 홈의 목록 제목과 왼쪽 위치 칸이 **같은 곳을 다른 이름**으로 불렀다
 *   (제목 "동탄5동 근처 이용권" ↔ 칸 "내 주변", 제목 "이 지역 동네 딜" ↔ 칸 "부산 · 서면").
 *   이름은 이 함수 하나에서만 만든다 — 둘이 각자 조립하면 다시 갈린다(에러는 0).
 */
import { findRegionByKey } from '@/shared/constants/korea-regions'

export interface HomeRegionRef { regionKey?: string; districtKey?: string }

/** 위치 칸에 쓰는 이름. 현 위치 > 고른 지역 > 전국. */
export function homeLocationLabel(o: { located: boolean; dongLabel?: string | null; region: HomeRegionRef }): string {
  if (o.located) return o.dongLabel?.trim() || '내 주변'
  const r = o.region
  if (!r.regionKey) return '전국'
  const region = findRegionByKey(r.regionKey)
  if (!region) return '전국'
  if (r.districtKey) {
    const dg = region.districtGroups.find(g => g.key === r.districtKey)
    if (dg) return `${region.label} · ${dg.label.split('/')[0]}`
  }
  return region.label
}

/** 목록 제목. 위치 칸과 **같은 이름**을 그대로 쓴다. */
export function homeFeedTitle(o: { located: boolean; dongLabel?: string | null; region: HomeRegionRef }): string {
  const label = homeLocationLabel(o)
  return o.located ? `${label} 근처 이용권` : `${label} 이용권`
}
