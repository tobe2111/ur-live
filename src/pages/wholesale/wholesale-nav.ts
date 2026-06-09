// ──────────────────────────────────────────────────────────────
// 🏭 2026-06-09 유통사 대시보드 셸 nav 정의 (단일 출처).
//   WholesaleDashboardPage / WholesaleDepositPage 가 공유 — 항목/순서 1:1 일치.
//   예치금(선불 충전) 항목 포함.
// ──────────────────────────────────────────────────────────────
import {
  ShoppingBag, ClipboardList, Receipt, FileText, Factory, Wallet, LayoutDashboard,
} from 'lucide-react'
import type { WholesaleNavItem } from '@/components/wholesale/WholesaleDashboardShell'

/** 유통사 라우트-기반 사이드바 nav. navigate 주입. */
export function buildWholesaleNav(
  pathname: string,
  navigate: (to: string) => void,
): WholesaleNavItem[] {
  return [
    { key: 'dashboard', label: '대시보드', icon: LayoutDashboard, active: pathname === '/wholesale/dashboard', onClick: () => navigate('/wholesale/dashboard') },
    { key: 'catalog', label: '카탈로그', icon: ShoppingBag, active: pathname === '/wholesale', onClick: () => navigate('/wholesale') },
    { key: 'deposits', label: '예치금', icon: Wallet, active: pathname.startsWith('/wholesale/deposits'), onClick: () => navigate('/wholesale/deposits') },
    { key: 'orders', label: '주문내역', icon: ClipboardList, active: pathname.startsWith('/wholesale/orders'), onClick: () => navigate('/wholesale/orders') },
    { key: 'statement', label: '거래내역', icon: Receipt, active: pathname.startsWith('/wholesale/statement'), onClick: () => navigate('/wholesale/statement') },
    { key: 'documents', label: '자료', icon: FileText, active: pathname.startsWith('/wholesale/documents'), onClick: () => navigate('/wholesale/documents') },
    { key: 'quotes', label: '견적', icon: ClipboardList, active: pathname.startsWith('/wholesale/quotes'), onClick: () => navigate('/wholesale/quotes') },
    { key: 'oem', label: 'OEM/ODM', icon: Factory, active: pathname.startsWith('/wholesale/oem'), onClick: () => navigate('/wholesale/oem') },
  ]
}
