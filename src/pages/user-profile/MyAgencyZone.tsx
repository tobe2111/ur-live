import { lazy, Suspense, useCallback, useState } from 'react'
import { toast } from '@/hooks/useToast'

/**
 * 🏢 마이 안 '에이전시' 구역의 문 — 2026-10-26 대표 확정 **안 A**(*"안 A · 구역"*).
 *
 * 이 브라우저에 에이전시 로그인(`agency_console_token`)이 있을 때만 구역을 받는다(lazy) —
 * 에이전시가 아닌 손님 대다수는 그 코드를 한 바이트도 안 받는다.
 * 로그인이 끊기거나 에이전시에서 로그아웃하면 구역만 접는다(손님 마이는 그대로).
 */
const AgencySection = lazy(() => import('@/pages/agency-console/AgencySection'))

/** ⚠️ 짝: `pages/agency-console/agency-api.ts` `AGENCY_TOKEN_KEY` — 시험이 대조한다. */
const AGENCY_TOKEN_KEY_MIRROR = 'agency_console_token'

export function hasAgencyLogin(): boolean {
  try { return !!(localStorage.getItem(AGENCY_TOKEN_KEY_MIRROR) || sessionStorage.getItem(AGENCY_TOKEN_KEY_MIRROR)) } catch { return false }
}

export default function MyAgencyZone() {
  const [on, setOn] = useState(hasAgencyLogin)
  const onSessionEnd = useCallback((why: 'expired' | 'logout') => {
    if (why === 'expired') toast.error('에이전시 로그인이 끝났어요. 에이전시 화면은 다시 로그인하면 보여요.')
    setOn(false)
  }, [])
  if (!on) return null
  return (
    <Suspense fallback={null}>
      <AgencySection stacked onSessionEnd={onSessionEnd} />
    </Suspense>
  )
}
