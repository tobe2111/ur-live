import { useCallback, useEffect, useState } from 'react'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/hooks/useToast'
import { SectionTitle } from '@/pages/user-profile/list-grammar'
import Sheet from '@/pages/user-profile/seller-section/Sheet'
import { AgencyStaffPanel, type StaffRow } from './AgencyStaffPanel'
import { AgencyInfoPanel } from './AgencyInfoPanel'
import { AgencyMoveToEmailSheet } from './AgencyMoveToEmailSheet'
import { agencyStaffLoginLabel } from '@/shared/agency-kakao'
import { AgencyStoresPanel, FlatRow } from './AgencyStoresPanel'
import AgencyPayoutSheet, { payoutRowHint, type AgencyPayoutsResponse } from './AgencyPayoutSheet'
import {
  AGENCY_TOOL_PARAM, agencyRequest, clearAgencySession, readAgencyProfile,
  type AgencyInfo, type AgencyStaffInfo,
} from './agency-api'

/**
 * 🏢 마이 안 **'에이전시' 구역** — 2026-10-26 대표 확정 **안 A**.
 *   대표: *"응 마이로 합치자 일단은"* → 시안 셋 중 *"안 A · 구역"*.
 *
 * '내 가게'(사장님 판매 구역) 바로 아래, 같은 문법으로 선다 — 제목 한 줄 + 고른 매장의 판 + 에이전시 줄.
 * 종전 에이전시 콘솔(`/agency`) 화면이 하던 일을 그대로 옮긴 것이고, `/agency` 는 이제 마이로 보낸다.
 *
 * - 카카오 손님 마이 안(`stacked`) — 마이의 칸이 좁아 PC 에서도 한 칸으로 그린다.
 * - 이메일 전용 에이전시 마이(`AgencyMyPage`) — 손님 메뉴가 없으니 PC 에서 두 칸(목록 + 판)으로 넓게.
 *
 * 🔑 신원은 여전히 **에이전시 직원 토큰**(`agency_console_token`)이다. 손님 세션과 섞지 않는다 —
 *   성과·몫이 사람이 아니라 에이전시 단위로 잡혀야 하기 때문이다(2026-10-11 결정).
 */
export default function AgencySection({ stacked = false, headless = false, onSessionEnd }: {
  stacked?: boolean
  /** 페이지가 머리(에이전시 이름·직원)를 따로 그릴 때 — 같은 말을 두 번 하지 않게 구역 제목을 뺀다. */
  headless?: boolean
  /** 로그인이 끊기거나 로그아웃했을 때 — 손님 마이는 구역만 접고, 에이전시 전용 마이는 로그인으로 보낸다. */
  onSessionEnd: (why: 'expired' | 'logout') => void
}) {
  const cached = readAgencyProfile()
  const [me, setMe] = useState<{ staff: AgencyStaffInfo; agency: AgencyInfo } | null>(cached)
  const [staff, setStaff] = useState<StaffRow[] | null>(null)
  const [canManage, setCanManage] = useState(cached?.staff.role === 'admin')
  const [loadError, setLoadError] = useState('')
  const [sheet, setSheet] = useState<'staff' | 'info' | 'move' | 'payout' | null>(null)
  // 💸 유어딜 지급(결재 3단계) — 꺼져 있으면 '정산' 줄을 안 그린다. 조회 실패도 줄을 숨긴다(없는 길을 안 보인다).
  const [payouts, setPayouts] = useState<AgencyPayoutsResponse | null>(null)

  const load = useCallback(async () => {
    setLoadError('')
    const [m, s, p] = await Promise.all([
      agencyRequest<{ staff: AgencyStaffInfo; agency: AgencyInfo }>('/me'),
      agencyRequest<{ staff: StaffRow[]; canManage: boolean }>('/staff'),
      agencyRequest<AgencyPayoutsResponse>('/payouts'),
    ])
    if (m.status === 401 || s.status === 401) { onSessionEnd('expired'); return }
    if (!m.ok || !s.ok) { setLoadError(m.data.error || s.data.error || '불러오지 못했어요.'); return }
    setMe({ staff: m.data.staff, agency: m.data.agency })
    setStaff(s.data.staff)
    setCanManage(!!s.data.canManage)
    setPayouts(p.ok ? p.data : null)
  }, [onSessionEnd])

  useEffect(() => { void load() }, [load])
  const onExpired = useCallback(() => onSessionEnd('expired'), [onSessionEnd])

  async function logout() {
    if (!(await confirmDialog('에이전시에서 로그아웃할까요?'))) return
    clearAgencySession()
    toast.success('에이전시에서 로그아웃했어요.')
    onSessionEnd('logout')
  }

  const role = me ? (me.staff.role === 'admin' ? '관리자' : '직원') : ''
  // 🟡 카카오로 만든 혼자 쓰는 계정(2026-10-26 대표) — 주인에게만 '이메일 계정으로 옮기기' 를 연다.
  const solo = me?.staff.loginKind === 'kakao'
  const canMove = solo && !!me?.staff.isOwner

  return (
    <section aria-label="에이전시" data-testid="my-agency-section">
      {!headless && <SectionTitle>{me ? `에이전시 · ${me.agency.name}` : '에이전시'}</SectionTitle>}
      <div className="px-4">
        {me && !headless && <p className="mb-3 text-[13px] text-gray-500 dark:text-gray-400">{me.staff.name || agencyStaffLoginLabel(me.staff.email)} · {role}</p>}

        {loadError && (
          <div className="mb-3 rounded-2xl bg-white dark:bg-[#1D1F29] p-5 shadow-lift">
            <p className="text-[15px] text-gray-700 dark:text-gray-200">{loadError}</p>
            <button type="button" onClick={() => { void load() }} className="mt-3 h-10 rounded-xl bg-brand px-4 text-[15px] font-medium text-white">다시 시도</button>
          </div>
        )}

        {me && (
          <AgencyStoresPanel
            onExpired={onExpired}
            staffId={me.staff.id}
            stacked={stacked}
            toolParam={AGENCY_TOOL_PARAM}
            agencyRows={(
              <>
                {payouts?.enabled && <FlatRow label="정산" hint={payoutRowHint(payouts)} urgent={(payouts.balance?.available ?? 0) > 0} onClick={() => setSheet('payout')} />}
                <FlatRow label="직원" hint={staff ? `${staff.length}명` : undefined} onClick={() => setSheet('staff')} />
                {canManage && <FlatRow label="에이전시 정보" onClick={() => setSheet('info')} />}
                {canMove && <FlatRow label="이메일 계정으로 옮기기" hint="직원과 함께 쓰기" onClick={() => setSheet('move')} />}
              </>
            )}
            trailingRows={<FlatRow label="에이전시 로그아웃" onClick={() => { void logout() }} last />}
          />
        )}
      </div>

      {sheet === 'staff' && me && (
        <Sheet title="직원" onClose={() => setSheet(null)}>
          <div className="min-h-full bg-[#F8F7FC] dark:bg-[#11141C] p-4">
            <AgencyStaffPanel staff={staff} canManage={canManage} onChanged={load} bare solo={solo}
              onMove={canMove ? () => setSheet('move') : undefined} />
          </div>
        </Sheet>
      )}
      {sheet === 'payout' && payouts?.enabled && (
        <AgencyPayoutSheet canManage={canManage} initial={payouts} onChanged={setPayouts} onClose={() => setSheet(null)} />
      )}
      {sheet === 'move' && canMove && (
        <Sheet title="이메일 계정으로 옮기기" onClose={() => setSheet(null)}>
          <div className="min-h-full bg-[#F8F7FC] dark:bg-[#11141C] p-4">
            <AgencyMoveToEmailSheet />
          </div>
        </Sheet>
      )}
      {sheet === 'info' && canManage && me && (
        <Sheet title="에이전시 정보" onClose={() => setSheet(null)}>
          <div className="min-h-full bg-[#F8F7FC] dark:bg-[#11141C] p-4">
            <AgencyInfoPanel agency={me.agency} onSaved={load} bare />
          </div>
        </Sheet>
      )}
    </section>
  )
}
