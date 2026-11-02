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
  useEffect(() => {
    const h = () => setState(read())
    window.addEventListener(AGENCY_PRESENCE_EVENT, h)
    return () => window.removeEventListener(AGENCY_PRESENCE_EVENT, h)
  }, [])
  return state
}
