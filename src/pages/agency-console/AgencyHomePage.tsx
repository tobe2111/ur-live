import { Navigate, useSearchParams } from 'react-router-dom'
import { agencyMyPath, readAgencyToken } from './agency-api'

/**
 * 🏢 `/agency` — 2026-10-26 대표 확정 **안 A** 로 에이전시 화면은 **마이 안 '에이전시' 구역**이 됐다.
 *   대표: *"응 마이로 합치자 일단은"* → 시안 셋 중 *"안 A · 구역"*.
 *
 * 이 주소는 이미 나간 메일·알림·셀러 깊은 링크(`sellerEntryRedirect` → `/agency?tool=`)가 물고 있어서
 * 지우지 않고 **마이로 보낸다**. `?tool=` 은 마이에서 `?atool=` 로 바꿔 싣는다 — 마이의 `?tool=` 은
 * 사장님 판매 구역이 쓰므로 같은 이름이면 두 판이 같은 화면을 동시에 열려고 다툰다.
 *
 * 화면 자체: 카카오 손님 마이 → `user-profile` 안의 구역 / 이메일 전용 → `AgencyMyPage`(마이 자리).
 */
export default function AgencyHomePage() {
  const [params] = useSearchParams()
  const token = readAgencyToken()
  const tool = params.get('tool')

  // 🚪 `?tool=`(알림·메일의 셀러 화면 주소)을 로그인 뒤까지 잇는다 — 잃으면 직원이 같은 링크를 다시 눌러야 한다(2026-10-12).
  if (!token) {
    const back = tool ? `/agency?tool=${encodeURIComponent(tool)}` : '/agency'
    return <Navigate to={`/agency/login?returnUrl=${encodeURIComponent(back)}`} replace />
  }
  return <Navigate to={agencyMyPath(tool)} replace />
}
