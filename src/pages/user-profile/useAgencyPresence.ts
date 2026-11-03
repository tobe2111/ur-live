import { useEffect, useState } from 'react'
import { AGENCY_PRESENCE_EVENT, hasAgencyLogin, readAgencyProfileLite } from '@/lib/agency-presence'

/**
 * 🏢 이 브라우저에 에이전시 로그인이 있는가 + 그 이름·역할 — 마이의 여러 자리가 같은 값을 본다
 *   (머리 '매장 영입' 버튼 · 합친 구역의 제목 · 에이전시 구역). 로그인이 생기거나 끊기면
 *   `announceAgencyPresence()` 로 다시 읽는다.
 */
export function useAgencyPresence(): { on: boolean; agencyName: string; isAdmin: boolean } {
  const read = () => {
    const on = hasAgencyLogin()
    const p = on ? readAgencyProfileLite() : null
    return { on, agencyName: p?.agencyName ?? '', isAdmin: !!p?.isAdmin }
  }
  const [state, setState] = useState(read)
  /**
   * 🐢 2026-11-03 대표 *"마이페이지도 확인해주고"* — 화면이 뜬 **뒤** 켜지는 것은 이번 화면에 반영하지 않는다(꺼지는 것은 즉시).
   *   켜짐이 늦게 오는 길은 하나뿐이다 — `MyAgencyZone` 의 카카오 자동 연결(부팅 뒤). 그때 머리 버튼·합친 제목·
   *   폰 '나 | 에이전시' 탭(#2128 에이전시 기본)이 한꺼번에 생겨 보던 '나' 화면이 통째로 사라졌다
   *   (실사용 CLS 원인: `div.ur-content-medium.lg:px-4 | y657→0 h70→0 | t1376`). 연결은 저장되므로 다음 화면부터 처음부터 켜져 있다.
   */
  const [startedOn] = useState(state.on)
  useEffect(() => {
    const h = () => setState((prev) => { const next = read(); return next.on && !startedOn ? prev : next })
    window.addEventListener(AGENCY_PRESENCE_EVENT, h)
    return () => window.removeEventListener(AGENCY_PRESENCE_EVENT, h)
  }, [])
  return state
}
