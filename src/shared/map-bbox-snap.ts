/**
 * 🗺️ 2026-11-17 지도 영역(bbox)을 격자에 맞춰 보낸다 — 사람이 몰려도 지도 이동이 DB 까지 안 가게.
 *
 * 왜: 지도를 몇 픽셀만 움직여도 `37.51234567,…` 같은 날 좌표가 그대로 URL 에 실려,
 *   에지 캐시 키(전체 URL)가 **매번 달랐다** → 모든 이동이 캐시를 못 쓰고 D1 에서 목록(LIMIT 500)
 *   + 부가 조회 4~6개를 새로 돌렸다. 서버는 자기 메모리 키만 0.02° 로 반올림하고 있었다
 *   (`group-buy-public.routes.ts` `rnd`) — 그 단위에 맞춘다.
 *
 * 어떻게: 남서는 **내림**, 북동은 **올림**으로 0.02°(≈2km) 칸에 맞춘다 → 보내는 영역은 늘
 *   보이는 영역을 **감싼다**(가장자리 딜이 빠지지 않는다). 같은 동네 안의 이동은 같은 URL 이 된다.
 */
export const MAP_BBOX_STEP = 0.02

const snap = (n: number, dir: 'down' | 'up'): string => {
  const k = n / MAP_BBOX_STEP
  // 부동소수 오차(37.52 / 0.02 = 1875.9999…)로 칸이 하나 밀리지 않게 아주 작은 여유를 둔다.
  const cell = dir === 'down' ? Math.floor(k + 1e-9) : Math.ceil(k - 1e-9)
  return (cell * MAP_BBOX_STEP).toFixed(2)
}

/** `swLat,swLng,neLat,neLng` — 서버 bbox 파라미터 모양 그대로. */
export function snapMapBbox(swLat: number, swLng: number, neLat: number, neLng: number): string {
  return [snap(swLat, 'down'), snap(swLng, 'down'), snap(neLat, 'up'), snap(neLng, 'up')].join(',')
}
