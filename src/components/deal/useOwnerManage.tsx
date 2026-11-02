/**
 * 🏪 주인 [관리하기] 한 벌 — 이용권·숙소·쇼핑 상품 상세가 같이 쓴다(2026-10-19 대표 확정 안 A).
 *
 * 판정(`useOwnedView` — 구매 차단과 같은 서버 함수) · 시트 열림 상태 · 시트 JSX 를 한 번에 준다.
 * 세 상세가 각자 이 셋을 짜면 한 곳만 판정을 바꾸는 날이 온다. 종류는 **서버가 정한 것**을 먼저 쓴다
 * (주소가 `/products/:id` 라도 그 행이 이용권이면 이용권 시트가 맞다).
 */
import { lazy, Suspense, useState } from 'react'
import OwnerManagePanel from '@/pages/group-buy/OwnerManagePanel'
import { useOwnedView, type OwnedKind } from '@/pages/group-buy/useViewerIsOwner'

// 시트는 주인이 [관리하기]를 누를 때만 받는다 — 손님 첫 화면(상세·마이)에 실리면 화면 무게 예산을 넘긴다.
const OwnerManageSheet = lazy(() => import('./OwnerManageSheet'))

export function useOwnerManage(productId: number, loggedIn: boolean, kind: OwnedKind) {
  const q = useOwnedView(productId, loggedIn)
  const [open, setOpen] = useState(false)
  const isOwner = q.data?.is_owner === true
  const sheet = open && isOwner
    ? <Suspense fallback={null}><OwnerManageSheet productId={productId} kind={q.data?.kind ?? kind} view={q.data} onClose={() => setOpen(false)} /></Suspense>
    : null
  return { isOwner, openManage: () => setOpen(true), sheet }
}

/**
 * 📱 하단 고정 바 — 숙소·쇼핑 상세의 구매 바 자리.
 * 숙소는 폰 전용(PC 는 우측 예약 상자 → `OwnerManageCard`), 쇼핑은 구매 바가 PC 에도 떠 있어 `framed`
 * 로 **같은 자리·같은 폭**을 쓴다(구매 바와 다른 자리에 서면 주인만 다른 화면을 본다).
 */
export function OwnerManageBar({ kind, onManage, framed = false }: { kind: OwnedKind; onManage: () => void; framed?: boolean }) {
  const pos = framed
    ? 'fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] lg:max-w-screen-md app-frame-bar'
    : 'lg:hidden fixed bottom-0 left-0 right-0'
  return (
    <div className={`${pos} z-50 bg-surface border-t border-rule px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]`} data-testid="owner-manage-bar">
      <div className="max-w-md mx-auto"><OwnerManagePanel kind={kind} compact onManage={onManage} /></div>
    </div>
  )
}

/** 🖥️ PC 우측 구매·예약 상자 자리. */
export function OwnerManageCard({ kind, onManage }: { kind: OwnedKind; onManage: () => void }) {
  return (
    <div className="rounded-2xl p-5 [&>div]:mt-0">
      <OwnerManagePanel kind={kind} onManage={onManage} />
    </div>
  )
}
