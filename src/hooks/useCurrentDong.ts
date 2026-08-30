/**
 * 🧭 현재 위치 → 동네 이름 (2026-08-30 — 대표 "홈에선 현재 위치가 어딘지도 나와야지")
 *
 * ■ 왜 이제야 만드나
 *   서버 엔드포인트(`/api/proxy/kakao/coord2region`)는 **2026-07-07 에 이미 있었다.**
 *   주석까지 *"대표 — 홈 '내 주변' 기준: GPS 좌표를 동네 이름으로"* 라고 적혀 있다.
 *   그런데 **클라이언트에서 한 번도 호출한 적이 없다**(소비처 0). 그래서 위치를 잡아도
 *   화면은 일반명사 "내 주변" 만 말했다 — 대표가 본 것이 그것이다.
 *   ⇒ 원인은 디자인이 아니라 **배선 누락**이었다. 이 레포가 반복해 겪는
 *      "만들었는데 아무도 안 부르는" 클래스(에러가 안 나서 안 보인다).
 *
 * ■ 비용 (이게 배선을 미룬 이유였을 수 있으니 명시한다)
 *   서버가 좌표를 **~110m 그리드로 라운딩해 30일 KV 캐시**한다 → 같은 동네 방문자들이
 *   카카오 API 콜 1개를 공유한다. 여기서 추가로 **localStorage 에 같은 그리드 키로**
 *   캐시해 재방문·재마운트에는 네트워크를 아예 안 탄다.
 *
 * ■ 실패하면 조용히 없는 값
 *   키 미설정·레이트리밋·오프라인이면 `null` 을 준다. 호출부는 기존 문구("내 주변")로
 *   폴백해야 한다 — 위치 이름이 없다고 화면이 깨지면 안 된다.
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'

export interface DongInfo { dong: string; city: string }

/** 좌표를 캐시 키로 쓰기 위한 그리드(서버와 같은 3자리 = 약 110m). */
const gridKey = (lat: number, lng: number) => `${lat.toFixed(3)},${lng.toFixed(3)}`
const LS_PREFIX = 'ur_dong_v1:'

function readCache(k: string): DongInfo | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + k)
    if (!raw) return null
    const v = JSON.parse(raw) as DongInfo
    return v && typeof v.dong === 'string' ? v : null
  } catch { return null }
}

export function useCurrentDong(loc: { lat: number; lng: number } | null): DongInfo | null {
  const [info, setInfo] = useState<DongInfo | null>(() => (loc ? readCache(gridKey(loc.lat, loc.lng)) : null))

  useEffect(() => {
    if (!loc) { setInfo(null); return }
    const k = gridKey(loc.lat, loc.lng)
    const cached = readCache(k)
    if (cached) { setInfo(cached); return }
    let alive = true
    api.get(`/api/proxy/kakao/coord2region?lat=${loc.lat}&lng=${loc.lng}`)
      .then((res) => {
        const d = res.data?.data as DongInfo | undefined
        if (!alive || !d?.dong) return
        setInfo(d)
        try { localStorage.setItem(LS_PREFIX + k, JSON.stringify(d)) } catch { /* private mode */ }
      })
      .catch(() => { /* 조용히 — 호출부가 '내 주변' 으로 폴백한다 */ })
    return () => { alive = false }
  }, [loc?.lat, loc?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  return info
}
