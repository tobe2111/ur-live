import { lazy } from 'react'

const MyVouchersSheet = lazy(() => import('./MyVouchersSheet'))
const MyOrdersSheet = lazy(() => import('./MyOrdersSheet'))
const MyAnalyticsSheet = lazy(() => import('./MyAnalyticsSheet'))

export type MySalesSheet = 'myVouchers' | 'myOrders' | 'myAnalytics'
export const MY_SALES_SHEETS: readonly MySalesSheet[] = ['myVouchers', 'myOrders', 'myAnalytics']

/**
 * 🧾 마이용 판매 시트 셋(2026-11-03 대표 확정 — 시안 M1~M5)을 고르는 자리. `SellerSection` 이 600줄 래칫에 닿아 뺐다.
 * @param onDeep 깊은 셀러 화면(고치기·더 보기)을 `ToolPageSheet` 로 — 닫으면 이 시트(`which`)로 돌아온다.
 * @param onNew 이용권 등록 시트 — 닫으면 이 시트로 돌아온다.
 */
export default function MySalesSheets({ which, onClose, onDeep, onNew }: {
  which: MySalesSheet
  onClose: () => void
  onDeep: (path: string, title: string, from: MySalesSheet) => void
  onNew: (from: MySalesSheet) => void
}) {
  if (which === 'myVouchers') return <MyVouchersSheet onClose={onClose} onOpenPage={(p, t) => onDeep(p, t, which)} onNew={() => onNew(which)} />
  if (which === 'myOrders') return <MyOrdersSheet onClose={onClose} />
  return <MyAnalyticsSheet onClose={onClose} onOpenPage={(p, t) => onDeep(p, t, which)} onNew={() => onNew(which)} />
}
