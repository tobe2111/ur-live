/**
 * 📍 2026-10-13 (대표 — 위치를 정하면 홈 맨 위가 그 지역에서 가까운 이용권, 시안 확정 "1,2 섞어서").
 *
 * 홈이 가진 두 위치 입력을 섹션 요청 하나로 접는다:
 *   ① 내 위치(GPS, `userLoc`) — 그 좌표, 라벨은 동 이름, 카드에 km
 *   ② 지역만 고름(`regionKey`) — 시/도 중심, 라벨은 시/도 이름, 카드엔 km 없음(내 위치가 아니므로)
 * 둘 다 없으면 위치 없음 — 종전과 같은 요청(`/api/sections`)이다.
 *
 * 쿠키(`ur_loc`)도 여기서 쓴다 — 워커가 다음 하드로드에서 **같은 격자**로 섹션 시드를 받아 오게.
 * 그래야 첫 화면이 전국 인기로 그려졌다가 동네 것으로 바뀌는 일이 없다.
 * 🔒 격자(0.02°≈2km)로 반올림한 값만 쿠키에 싣는다 — 정밀 좌표를 매 요청 서버에 보내지 않는다.
 */
import { findRegionByKey, regionCentroid } from '@/shared/constants/korea-regions'
import { NEAR_COOKIE, NEAR_LABEL_COOKIE, nearCookieValue, nearKeyOf, type NearPoint } from '@/shared/home-near'

export interface HomeNear {
  /** 격자 키 `37.20,127.08` — 요청 쿼리·쿼리키·시드 판정에 쓴다. 없으면 ''. */
  key: string
  /** 소제목 라벨("동탄5동"·"부산"). 모르면 ''(→ "내 주변"). */
  label: string
  /** 카드에 km 를 그릴 기준점. 지역만 골랐으면 null(시/도 중심과의 거리는 의미가 없다). */
  kmFrom: NearPoint | null
}

export function resolveHomeNear(input: {
  userLoc: NearPoint | null | undefined
  dongLabel?: string | null
  regionKey?: string | null
}): HomeNear {
  if (input.userLoc) {
    const key = nearKeyOf(input.userLoc)
    if (key) return { key, label: input.dongLabel || '', kmFrom: input.userLoc }
  }
  const c = regionCentroid(input.regionKey)
  if (c) return { key: nearKeyOf(c), label: findRegionByKey(input.regionKey)?.label || '', kmFrom: null }
  return { key: '', label: '', kmFrom: null }
}

/** 쿠키를 맞춘다(30일). 위치가 없으면 지운다 — 남겨 두면 다음 방문이 엉뚱한 동네로 시작한다. */
export function syncNearCookie(key: string, label = ''): void {
  try {
    if (typeof document === 'undefined') return
    const tail = (v: string, on: boolean) => `${v}; path=/; max-age=${on ? 2592000 : 0}; samesite=lax; secure`
    document.cookie = `${NEAR_COOKIE}=${tail(key ? nearCookieValue(key) : '', !!key)}`
    // 라벨은 워커가 그리는 첫 화면의 소제목용("동탄5동에서 가까운 순") — 위치가 없으면 같이 지운다.
    document.cookie = `${NEAR_LABEL_COOKIE}=${tail(key && label ? encodeURIComponent(label) : '', !!(key && label))}`
  } catch { /* 쿠키 차단 — 시드만 못 맞출 뿐 화면은 정상 */ }
}
