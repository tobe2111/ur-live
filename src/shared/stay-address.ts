/**
 * 📍 숙소 주소 한 줄 — SSOT (2026-09-14 대표 신고 "고칠 것 다 고쳐줘")
 *
 * ## 무엇을 고치는가
 * 상세 화면이 `region_sido + region_sigungu + address` 를 **이어 붙여** 찍고 있었다.
 * 대표 스크린샷의 그 줄이다:
 *
 *     경북 경주시 · 경북 경주시 손곡3길 37-14      ← 같은 말을 두 번
 *
 * ## 왜 "주소 항목만" 쓰는가 (라이브 50건 전수 실측, 2026-09-14)
 *
 * | | 건수 |
 * |---|---|
 * | 주소가 자체 지역을 갖고 있다 | **50 / 50** |
 * | 그중 시·군·구가 그대로 겹친다(= 화면에 두 번) | 38 |
 * | **지역 항목과 주소가 서로 다르다** | **12 (24%)** |
 * | 지역이 없는 맨 주소 | **0** |
 *
 * 🔴 24% 는 단순 중복이 아니라 **틀린 주소**다. 예: `region=강원 속초시` 인데
 * `address=강원특별자치도 양양군 강현면 동해대로 3275`. 이어 붙이면 화면에
 * "강원 속초시 강원특별자치도 양양군 …" 이 찍힌다 — 속초에 있지도 않은 숙소다.
 *
 * ⇒ **주소 항목이 이긴다.** 그게 매장이 실제로 입력한 위치이고, 50/50 이 지역을 이미 담고 있어
 * 버려지는 정보가 없다. 지역 항목(`region_*`)은 **검색·필터용**으로 그대로 둔다 —
 * 지우지 말 것(`/stays/search` 의 지역 필터가 그 값을 쓴다).
 *
 * ⚠️ 이 함수를 우회해 다시 이어 붙이지 말 것. 가드: `stay-address.test.ts`.
 */

import { parseRegionFromAddress } from './constants/region-slugs'

/** 화면에 찍을 주소 한 줄. 주소가 있으면 그것만, 없을 때만 지역으로 대체한다. */
export function stayAddressLine(
  sido?: string | null,
  sigungu?: string | null,
  address?: string | null,
): string {
  const a = (address || '').trim()
  if (a) return a
  return [sido, sigungu].map((s) => (s || '').trim()).filter(Boolean).join(' ')
}

/**
 * 목록 카드처럼 **짧게** 쓰는 자리용 — 시·군·구까지만.
 * 주소가 있으면 그 앞 두 토막을 쓴다(주소가 진실이므로 지역 항목보다 우선).
 * 예: `강원특별자치도 양양군 강현면 동해대로 3275` → `강원특별자치도 양양군`
 */
export function stayRegionLabel(
  sido?: string | null,
  sigungu?: string | null,
  address?: string | null,
): string {
  const a = (address || '').trim()
  if (a) {
    const parts = a.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return `${parts[0]} ${parts[1]}`
    if (parts.length === 1) return parts[0]
  }
  return [sido, sigungu].map((s) => (s || '').trim()).filter(Boolean).join(' ')
}

/**
 * 제목·검색 설명에 쓰는 **짧은 정규화 지역**(`강원 양양군`) — SSOT (2026-10-18).
 *
 * `stayRegionLabel` 은 주소 원문을 자르므로 `강원특별자치도 양양군` 처럼 길고 `/region/강원`
 * 슬러그와 표기가 다르다. 그래서 2026-10-14 에 제목·설명은 **지역 항목(컬럼)** 을 먼저 쓰기로
 * 했는데, 위 머리말 표의 **12건(24%)은 컬럼이 틀려** 있다 — 라이브 `/stays/2887` 의 검색 제목이
 * `(강원 속초시)` 인데 주소는 양양군이고, 2719 는 도부터 다르다(`강원 춘천시` ↔ `경기 가평군`).
 * 화면 주소 줄은 이미 주소가 이기는데(2026-09-14) 제목·설명만 틀린 지역을 말하고 있었다.
 *
 * ⇒ 주소를 `/region` 과 **같은 파서**(`parseRegionFromAddress` — 시/도를 짧은 표기로 정규화)로
 *   읽어 시·군·구까지 나오면 그것을 쓴다. 주소와 컬럼이 일치하는 37건은 결과가 **같은 문자열**이고
 *   (짧은 표기끼리 비교), 틀린 12건만 바로잡힌다. 주소가 시·군·구를 못 주면 종전대로 컬럼.
 */
export function stayRegionShort(
  sido?: string | null,
  sigungu?: string | null,
  address?: string | null,
): string {
  const parsed = parseRegionFromAddress(address)
  if (parsed?.sigungu) return `${parsed.sido} ${parsed.sigungu}`
  const cols = [sido, sigungu].map((s) => (s || '').trim()).filter(Boolean).join(' ')
  return cols || stayRegionLabel(null, null, address)
}
