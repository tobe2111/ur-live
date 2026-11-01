import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { toast } from '@/hooks/useToast'
import { runAfterLoad } from '@/lib/after-load'
import { hasAgencyLogin } from '@/lib/agency-presence'

export { hasAgencyLogin }

/**
 * 🏢 마이 안 '에이전시' 구역의 문 — 2026-10-26 대표 확정 **안 A**(*"안 A · 구역"*).
 *
 * 이 브라우저에 에이전시 로그인(`agency_console_token`)이 있을 때만 구역을 받는다(lazy) —
 * 에이전시가 아닌 손님 대다수는 그 코드를 한 바이트도 안 받는다.
 * 로그인이 끊기거나 에이전시에서 로그아웃하면 구역만 접는다(손님 마이는 그대로).
 *
 * 🟡 카카오로 만든 에이전시(2026-10-26 대표 *"카카오 로그인으로 해도 되고"*) — 에이전시 로그인이 없으면
 *   이 카카오 계정과 이어진 에이전시가 있는지 **한 탭에 한 번** 묻는다(첫 화면을 다 그린 뒤). 있으면 그 자리에서
 *   로그인해 구역을 연다 — 카카오로 들어온 사람이 에이전시 로그인을 따로 할 일이 없다.
 */
const AgencySection = lazy(() => import('@/pages/agency-console/AgencySection'))

/** ⚠️ 짝: `pages/agency-console/agency-kakao-client.ts` `KAKAO_AGENCY_PROBE_KEY` — 시험이 대조한다. */
const KAKAO_PROBE_KEY_MIRROR = 'ur_agency_kakao_probe'

function probedThisTab(uid: string): boolean {
  try { return sessionStorage.getItem(KAKAO_PROBE_KEY_MIRROR) === uid } catch { return true }
}

export default function MyAgencyZone() {
  const [on, setOn] = useState(hasAgencyLogin)
  const onSessionEnd = useCallback((why: 'expired' | 'logout') => {
    if (why === 'expired') toast.error('에이전시 로그인이 끝났어요. 에이전시 화면은 다시 로그인하면 보여요.')
    setOn(false)
  }, [])

  useEffect(() => {
    if (on) return
    let uid = ''
    try { uid = localStorage.getItem('user_id') || '' } catch { /* 막힘 */ }
    if (!uid || probedThisTab(uid)) return
    return runAfterLoad(() => {
      try { sessionStorage.setItem(KAKAO_PROBE_KEY_MIRROR, uid) } catch { /* 막힘 */ }
      void import('@/pages/agency-console/agency-kakao-client')
        .then((m) => m.connectKakaoAgency())
        .then((ok) => { if (ok) setOn(true) })
        .catch(() => { /* 없으면 그만 */ })
    })
  }, [on])

  if (!on) return null
  return (
    <Suspense fallback={null}>
      <AgencySection stacked onSessionEnd={onSessionEnd} />
    </Suspense>
  )
}
