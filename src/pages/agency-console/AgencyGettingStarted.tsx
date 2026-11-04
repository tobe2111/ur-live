import { lazy, Suspense, useState } from 'react'
import { TOSS_CARD_CLS } from './agency-toss'

const AgencyInviteSheet = lazy(() => import('./AgencyInviteSheet'))

/**
 * 🚀 매장 0곳 에이전시의 첫 화면 — 2026-11-04 대표 확정 **안 A · 시작 3단계**.
 *   대표: *"들어오면 이런 시안으로만 뜨네 너무 뭐가 없이 나온다"* → 시안 셋 중 *"A로 하자"*.
 *   시안: `docs/design/agency-first-screen-2026-11-04.md`.
 *
 * 매장이 없는데 오늘 매출 `—` · 주문 `—` · '판매 알림 없음' 이 먼저 서면 화면이 "아무것도 없다" 고만 말한다.
 * 그 자리에 **지금 할 일 셋**을 순서대로 세우고, 첫 매장이 연결되는 순간 원래 대시보드로 돌아간다
 * (판정은 `AgencyStoresPanel` — 운영 중 매장 0곳 · 관리자).
 *
 * 완료 표시는 **잴 수 있는 것만** 한다: ③ 직원은 2명 이상이면 끝. ①②는 매장이 연결돼야 끝나는데,
 * 연결되면 이 화면 자체가 사라지므로 여기서는 늘 '할 일' 이다(보낸 링크 수 같은 것을 지어내지 않는다).
 */
export function AgencyGettingStarted({ staffCount, pendingCount, onRegister, onInviteStaff, onRequests }: {
  staffCount: number | null
  /** 사장님이 맡겨 놓고 수락을 기다리는 매장 — 있으면 1단계 대신 그것부터 한다. */
  pendingCount: number
  onRegister: () => void
  onInviteStaff: () => void
  onRequests: () => void
}) {
  const [inviteOpen, setInviteOpen] = useState(false)
  const staffDone = (staffCount ?? 0) >= 2
  const done = staffDone ? 1 : 0

  return (
    <section aria-label="시작하기" data-testid="agency-getting-started" className={`${TOSS_CARD_CLS} py-5`}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-[20px] font-semibold text-gray-900 dark:text-white">시작하기</h2>
        <span className="text-[13px] text-gray-500 dark:text-gray-400 tabular-nums">{done} / 3</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-gray-200 dark:bg-[#2A2A2A]" aria-hidden="true">
        <div className="h-2 rounded-full bg-brand" style={{ width: `${Math.max(4, (done / 3) * 100)}%` }} />
      </div>
      <p className="mt-3 text-[13px] text-gray-500 dark:text-gray-400">매장을 하나 맡으면 매출·주문·정산이 여기에 바로 떠요.</p>

      <ol className="mt-3">
        <Step n={1} title={pendingCount > 0 ? `맡김 요청 ${pendingCount}건 수락하기` : '사장님께 영입 링크 보내기'}
          desc={pendingCount > 0 ? '사장님이 이미 맡겨 두셨어요' : '카톡으로 보내면 사장님이 수락만 하면 돼요'} active>
          <button type="button" onClick={() => (pendingCount > 0 ? onRequests() : setInviteOpen(true))}
            className="mt-3 h-10 rounded-xl bg-brand px-4 text-[15px] font-medium text-white active:opacity-80">
            {pendingCount > 0 ? '요청 보기' : '링크 보내기'}
          </button>
        </Step>
        <Step n={2} title="유어딜에 없는 매장은 대신 등록" desc="사업자 정보만 있으면 돼요" action="등록" onAction={onRegister} />
        <Step n={3} title="함께 일할 직원 초대" desc={staffDone ? `지금 ${staffCount}명이 함께 써요` : '혼자 하시면 건너뛰어도 돼요'}
          action={staffDone ? '보기' : '초대'} onAction={onInviteStaff} done={staffDone} last />
      </ol>

      {inviteOpen && (
        <Suspense fallback={null}>
          <AgencyInviteSheet canManage onClose={() => setInviteOpen(false)} />
        </Suspense>
      )}
    </section>
  )
}

function Step({ n, title, desc, action, onAction, active = false, done = false, last = false, children }: {
  n: number; title: string; desc: string
  action?: string; onAction?: () => void
  active?: boolean; done?: boolean; last?: boolean
  children?: React.ReactNode
}) {
  const badge = done
    ? 'bg-brand-tint text-brand-text'
    : active ? 'bg-brand text-white' : 'bg-gray-200 text-gray-600 dark:bg-[#2A2A2A] dark:text-gray-300'
  return (
    <li className={`flex gap-3 py-4 ${last ? '' : 'border-b border-rule'}`}>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-medium ${badge}`} aria-hidden="true">
        {done ? '✓' : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-gray-900 dark:text-white">{title}</p>
        <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">{desc}</p>
        {children}
      </div>
      {action && onAction && (
        <button type="button" onClick={onAction} className="min-h-[44px] shrink-0 self-center px-2 text-[13px] font-medium text-brand-text active:opacity-70">
          {action} ›
        </button>
      )}
    </li>
  )
}
