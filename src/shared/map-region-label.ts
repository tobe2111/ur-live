/**
 * 📍 **지도 시트가 보고 있는 지역의 이름** — 줌에 맞는 행정 단위를 고르는 순수 규칙 (2026-09-09 대표 확정 "안 R1").
 *
 * ## 왜 생겼나
 * 시트 상단이 `이 지역 16곳 · 전체 338곳 📍내 위치 기준` 이라고 말했다. 대표:
 * *"지금은 내 위치 기준이라고 뜨는데 지역명이 나올 수 있나? 예를 들어서 동탄 6동 기준 이런 식으로?"*
 * ⇒ **"이 지역"이라는 대명사가 곧 지금 보는 화면**이므로, 글자를 덧붙이는 대신 그 대명사를 실제
 * 이름으로 바꾼다(시안 `docs/design/map-marker-declutter-2026-09.md` §지역명 R1).
 *
 * ## 🔴 이 파일이 존재하는 진짜 이유 = 줌
 * `Geocoder.coord2RegionCode` 는 **한 점**의 행정동만 준다. 화면에 화성시 전체가 보이는데
 * "동탄6동"이라고 쓰면 요약이 아니라 **거짓말**이다. 그래서 좌표만으로는 부족하고 **줌 레벨과 함께**
 * 판단해야 한다 — 그 판단이 여기 한 곳에 있다(화면이 저마다 규칙을 다시 짜면 반드시 갈린다).
 *
 * ## 레벨 → 행정 단위 (카카오 축척 기준)
 * 카카오 레벨의 축척 바는 대략 `6=500m · 7=1km · 8=2km · 9=4km` 이고, 폰 화면 폭은 축척 바의
 * 두세 배쯤을 담는다. 행정동 하나가 보통 1~3km 이므로:
 *
 * | 레벨 | 화면이 담는 것 | 표시 |
 * |---|---|---|
 * | ~6 | 동 하나 | `동탄6동` (행정동) |
 * | 7~8 | 여러 동 | `화성시` (시군구) |
 * | 9~10 | 시·군 여럿 | `경기` (시도) |
 * | 11~ | 전국 | (이름 없음 → 호출부가 "이 지역"으로) |
 *
 * ⚠️ 시안 표는 5~7 을 `화성시 동탄` 으로 적었는데 **그렇게 안 했다**: API 가 주지 않는 이름이라
 *   "동탄6동"에서 숫자를 떼어 만들어야 하는데, 그 처방은 `신사동 → 신사`(시가 아니라 동네 이름이
 *   통째로 잘림)처럼 **틀린 이름을 지어낸다**. 지어내느니 한 단계 위 실제 이름을 쓴다.
 */

export interface MapRegionParts {
  /** 시도 — `region_1depth_name` (예: 경기, 서울). */
  region1?: string | null
  /** 시군구 — `region_2depth_name` (예: 화성시, 강남구). */
  region2?: string | null
  /** 행정동/읍/면 — `region_3depth_name` (예: 동탄6동, 봉담읍). */
  region3?: string | null
}

/** 이 레벨을 넘으면 지역명을 안 쓴다(전국 뷰에서 한 점의 시도는 화면을 대표하지 못한다). */
export const MAP_REGION_MAX_LEVEL = 10

/**
 * 지금 줌에서 **정직하게** 쓸 수 있는 지역명. 없으면 `null`(호출부가 "이 지역"으로 폴백).
 *
 * 단계가 비어 있으면 **한 단계 위로 올라간다** — 바다·개발제한구역처럼 행정동이 안 잡히는 좌표가 있고,
 * 그때 빈 문자열을 그리면 시트가 `  16곳` 이 된다.
 */
export function mapRegionLabel(level: number, parts: MapRegionParts | null | undefined): string | null {
  if (!parts || !Number.isFinite(level)) return null
  if (level > MAP_REGION_MAX_LEVEL) return null
  const r1 = clean(parts.region1), r2 = clean(parts.region2), r3 = clean(parts.region3)
  if (level <= 6) return r3 || r2 || r1
  if (level <= 8) return r2 || r1
  return r1
}

function clean(v: string | null | undefined): string | null {
  const s = (v ?? '').trim()
  return s ? s : null
}

/**
 * 지오코딩을 다시 부를 만한 이동인가 — `idle` 은 손가락을 뗄 때마다 오므로 그대로 부르면 팬 한 번에
 * 수십 번 나간다. **줌 단계가 바뀌었거나** 중심이 화면 폭의 1/4 이상 움직였을 때만 다시 묻는다.
 *
 * ⚠️ 거리 임계를 고정 미터로 두면 안 된다 — 동네 줌에선 200m 가 화면 절반이고 시 단위 줌에선 1픽셀이다.
 */
export function shouldRefetchRegion(
  prev: { lat: number; lng: number; level: number } | null,
  next: { lat: number; lng: number; level: number },
  /** 뷰포트 위도 폭(도). bounds 에서 바로 나온다. */
  spanLat: number,
): boolean {
  if (!prev) return true
  if (regionDepth(prev.level) !== regionDepth(next.level)) return true
  const thr = Math.max(Math.abs(spanLat) * 0.25, 0.0005)
  return Math.abs(prev.lat - next.lat) > thr || Math.abs(prev.lng - next.lng) > thr
}

/** 위 표의 구간 번호. 같은 구간 안의 줌 변화는 같은 이름을 내므로 다시 물을 필요가 없다. */
export function regionDepth(level: number): 3 | 2 | 1 | 0 {
  if (level > MAP_REGION_MAX_LEVEL) return 0
  if (level <= 6) return 3
  if (level <= 8) return 2
  return 1
}
