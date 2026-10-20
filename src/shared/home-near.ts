/**
 * 📍 2026-10-13 (대표 — *"메인에서 위치를 설정하면 맨 위에 … 그 지역에 맞는 이용권이 가장 맨 위에 나와야하지 않을까?
 *   … 어드민에서 직접 설정을 하지 않는 한, 그 지역에 가장 가까운 이용권들을 보여줘"* → 시안 확정 "1,2 섞어서").
 *
 * 홈 편성 섹션(`/api/sections`)이 위치를 받는 **단일 창구**. 세 곳이 같은 값을 써야 한다:
 *   ① 화면(`HomeSections`) — 요청 쿼리 `?near=`
 *   ② 워커 SSR 보조 슬롯 — 쿠키 `ur_loc` 를 읽어 같은 쿼리로 시드를 받는다
 *   ③ 서버(`section-rules`) — 그 좌표로 거리순 정렬
 * 셋이 다른 반올림을 쓰면 시드가 화면 요청과 어긋나 **첫 화면이 버려지고 다시 받는다**(에러 0).
 *
 * ## 왜 0.02° 로 반올림하나
 * 피드(`/api/group-buy/products?near=`)의 서버 캐시키가 이미 0.02°(≈2km) 격자다. 같은 격자를 쓰면
 * 엣지 캐시가 위치 하나당 수천 개로 쪼개지지 않고, 쿠키에 정밀 좌표가 실리지도 않는다.
 *
 * ## 두 입력 (시안 ①·② — 대표 "1,2 섞어서")
 *   - 내 위치(GPS): 그 좌표 · 카드에 km
 *   - 지역만 고름: 그 지역 중심(`REGION_CENTROIDS`) · 카드엔 주소만
 */

/** 서버 캐시키·쿠키·요청이 공유하는 격자(도). 피드 near 캐시키와 같다. */
export const NEAR_GRID_DEG = 0.02

/** 이 반경 안에서는 실매장을 먼저, 밖에서는 순수 거리순(=반경을 넓혀 채운다). */
export const NEAR_RADIUS_KM = 10

/** 위치를 실어 보내는 쿠키. 값은 `37.20_127.08` (쉼표는 쿠키 값에 쓸 수 없다). */
export const NEAR_COOKIE = 'ur_loc'

/**
 * 위치 라벨("동탄5동"·"부산") 쿠키 — 워커가 그리는 첫 화면의 소제목용. 서버는 동 이름을 모른다.
 * 없으면 "내 주변". 값은 화면에 그대로 찍히므로 받는 쪽이 길이를 자르고 HTML 탈출한다.
 */
export const NEAR_LABEL_COOKIE = 'ur_loc_n'
const NEAR_LABEL_MAX = 20

export interface NearPoint { lat: number; lng: number }

const snap = (v: number) => (Math.round(v / NEAR_GRID_DEG) * NEAR_GRID_DEG).toFixed(2)

/** 좌표 → 격자 키 `37.20,127.08`. 유효하지 않으면 ''. */
export function nearKeyOf(p: NearPoint | null | undefined): string {
  if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return ''
  if (p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180) return ''
  return `${snap(p.lat)},${snap(p.lng)}`
}

/**
 * 키(쉼표 또는 밑줄 구분) → 격자에 맞춘 좌표. 범위 밖·숫자 아님은 null.
 * 서버는 받은 값을 **다시 격자에 맞춘다** — 클라가 정밀 좌표를 보내도 캐시가 쪼개지지 않게.
 */
export function parseNearKey(raw: string | null | undefined): NearPoint | null {
  if (!raw) return null
  const parts = String(raw).trim().split(/[,_]/)
  if (parts.length !== 2) return null
  const lat = Number(parts[0]), lng = Number(parts[1])
  const key = nearKeyOf({ lat, lng })
  if (!key) return null
  const [a, b] = key.split(',')
  return { lat: Number(a), lng: Number(b) }
}

/** 쿠키 값(밑줄 구분)으로. */
export const nearCookieValue = (key: string) => key.replace(',', '_')

/**
 * 위치 쿠키를 쓴다(30일) — 화면 쪽 **유일한** 쓰기 창구. 위치가 없으면 지운다.
 * 라벨(`ur_loc_n`)은 워커가 그리는 첫 화면 소제목용. `label` 이 `null` 이면 **라벨은 건드리지 않는다**
 * (지도처럼 동네 이름을 모르는 곳이 좌표만 갱신할 때 — 같은 격자면 기존 라벨이 맞고, 다른 격자면 지운다).
 */
export function writeNearCookie(key: string, label: string | null = ''): void {
  try {
    if (typeof document === 'undefined') return
    const tail = (v: string, on: boolean) => `${v}; path=/; max-age=${on ? 2592000 : 0}; samesite=lax; secure`
    const prev = nearKeyFromCookieHeader(document.cookie)
    document.cookie = `${NEAR_COOKIE}=${tail(key ? nearCookieValue(key) : '', !!key)}`
    if (label === null && key && prev === key) return
    const l = label || ''
    document.cookie = `${NEAR_LABEL_COOKIE}=${tail(key && l ? encodeURIComponent(l) : '', !!(key && l))}`
  } catch { /* 쿠키 차단 — 시드만 못 맞출 뿐 화면은 정상 */ }
}

/** `Cookie` 헤더 원문에서 위치 키를 읽는다. 없거나 깨졌으면 ''. */
export function nearKeyFromCookieHeader(header: string | null | undefined): string {
  if (!header) return ''
  const m = header.match(new RegExp(`(?:^|;\\s*)${NEAR_COOKIE}=([^;]+)`))
  if (!m) return ''
  try {
    return nearKeyOf(parseNearKey(decodeURIComponent(m[1])))
  } catch {
    return ''
  }
}

/** `Cookie` 헤더에서 위치 라벨. 깨졌거나 없으면 ''. 최대 20자(받은 그대로 화면에 찍힌다). */
export function nearLabelFromCookieHeader(header: string | null | undefined): string {
  if (!header) return ''
  const m = header.match(new RegExp(`(?:^|;\\s*)${NEAR_LABEL_COOKIE}=([^;]+)`))
  if (!m) return ''
  try {
    return decodeURIComponent(m[1]).replace(/[\u0000-\u001f]/g, '').trim().slice(0, NEAR_LABEL_MAX)
  } catch {
    return ''
  }
}

/** 섹션 소제목 — 위치가 적용된 줄은 서버 문구 대신 이걸 쓴다. 라벨이 없으면 '내 주변'. */
export function nearSubtitle(label: string | null | undefined): string {
  const l = (label || '').trim()
  return `${l || '내 주변'}에서 가까운 순`
}
