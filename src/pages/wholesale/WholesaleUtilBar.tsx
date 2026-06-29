import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LogIn, LogOut, Factory, ChevronDown, LayoutDashboard, Wallet, ShoppingBag, FileText, Store, Receipt, User } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { logout as authLogout } from '@/utils/auth'
import { getSupplierToken, clearSupplierSession } from '@/lib/supplier-api'
import { useWholesaleMe, useWholesaleDeposit, useSupplierBalance } from '@/hooks/queries/useWholesale'
import { WT, won, GRADE_NAME } from './wholesale-theme'

/**
 * 🏭 2026-06-27 (대표 — 모든 도매 페이지 공통 상단바 + 예치금 실시간): 도매몰 다크 유틸바.
 *
 *   기존엔 카탈로그 헤더(CatalogHeader)에만 박혀 있어 상세/장바구니/결제/대시보드 등 다른 도매
 *   페이지엔 회원·예치금·충전·로그아웃 진입이 없었다. 이 컴포넌트는 **데이터를 스스로 fetch**해
 *   (useWholesaleMe=등급, useWholesaleDeposit=잔액, useSupplierBalance=제조사 정산) 어느 페이지에
 *   놓아도 동일하게 동작한다. 잔액은 해당 훅(refetchOnMount/focus + 주문 후 무효화)으로 실시간 반영.
 *
 *   🏭 2026-06-29 (통합 셸 Phase 1~3): 전 도매 표면(카탈로그/판매사/제조사)이 이 한 바를 공유(SSOT).
 *     역할 인지(판매사=예치금·충전 / 제조사=정산) + 2차 메뉴는 '내 공간' 드롭다운으로 정리(디클러터).
 *
 *   사용: CatalogHeader + WholesaleLayout(판매사·제조사 대시보드)이 상단에 렌더(로그인/가입/랜딩 제외).
 */
export default function WholesaleUtilBar() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const token = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  const supplierToken = getSupplierToken()
  const loggedIn = !!token
  const companyName = (typeof window !== 'undefined' && localStorage.getItem('seller_name')) || '회원'
  const supplierName = (typeof window !== 'undefined' && localStorage.getItem('supplier_name')) || '제조사'

  const meQ = useWholesaleMe()
  const depositQ = useWholesaleDeposit()
  const supBalQ = useSupplierBalance()
  const grade = (meQ.data?.grade as string) || 'C'
  const gradeLabel = GRADE_NAME[grade] || grade
  const depositBalance = Number(depositQ.data?.balance) || 0
  const settleBalance = Number(supBalQ.data?.available_amount) || 0

  // '내 공간' 드롭다운 — 바깥 클릭/Esc 로 닫힘.
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc) }
  }, [menuOpen])

  const go = (to: string) => { setMenuOpen(false); navigate(to) }
  const goLogin = () => navigate('/wholesale/login')
  const logout = async () => {
    setMenuOpen(false)
    // 도매몰 로그아웃 — 판매사(seller) + 제조사(supplier) 세션 모두 정리(유저/어드민 세션 보존). CatalogHeader 와 동일.
    // 🔑 2026-06-29: 서버 httpOnly 세션쿠키(ur_seller_session) 삭제를 **await** 후 하드이동 — 없으면 잔존 재인증.
    await authLogout('seller')
    try { localStorage.removeItem('is_distributor') } catch { /* noop */ }
    try { clearSupplierSession() } catch { /* noop */ }
    toast.success('로그아웃되었어요')
    if (typeof window !== 'undefined') window.location.assign('/wholesale')
  }

  // 역할별 '내 공간' 메뉴 — 판매사(구매자) vs 제조사(공급자). 로그아웃은 항상 하단(구분선 아래).
  const menuItems: { icon: typeof Wallet; label: string; to: string }[] = loggedIn
    ? [
        { icon: LayoutDashboard, label: t('wholesale.util.my', { defaultValue: '대시보드' }), to: '/wholesale/dashboard' },
        { icon: ShoppingBag, label: t('wholesale.util.orders', { defaultValue: '주문 내역' }), to: '/wholesale/orders' },
        { icon: FileText, label: t('wholesale.util.statement', { defaultValue: '거래내역서' }), to: '/wholesale/statement' },
        { icon: Receipt, label: t('wholesale.icon.quotes', { defaultValue: '견적함' }), to: '/wholesale/quotes' },
      ]
    : [
        { icon: Factory, label: t('wholesale.util.supplierDash', { defaultValue: '제조사 대시보드' }), to: '/supplier' },
        { icon: ShoppingBag, label: t('wholesale.util.supplierOrders', { defaultValue: '주문 관리' }), to: '/supplier/wholesale-orders' },
        { icon: Wallet, label: t('wholesale.util.settlement', { defaultValue: '정산·출금' }), to: '/supplier?tab=settlements' },
        { icon: Store, label: t('wholesale.util.catalogPreview', { defaultValue: '카탈로그 미리보기' }), to: '/wholesale?preview=1' },
      ]

  return (
    <div style={{ background: WT.ink, color: '#C2C6CC' }}>
      <div className="ur-content-wide px-5 lg:px-8 h-9 flex items-center justify-between text-[12px]">
        <div className="flex items-center gap-3 lg:gap-4 min-w-0">
          <button onClick={() => navigate('/wholesale/board')} className="font-semibold text-white whitespace-nowrap">{t('wholesale.util.notice', { defaultValue: '공지사항' })}</button>
          <span className="opacity-30 hidden sm:inline">|</span>
          <button onClick={() => navigate('/wholesale/support')} className="hidden sm:inline whitespace-nowrap">{t('wholesale.util.cs', { defaultValue: '고객센터' })}</button>
          <button onClick={() => navigate('/wholesale/board?tab=report')} className="hidden sm:inline whitespace-nowrap">{t('wholesale.util.report', { defaultValue: '제안·신고' })}</button>
        </div>
        <div className="flex items-center gap-2.5 lg:gap-3.5 shrink-0">
          {!loggedIn && !supplierToken ? (
            <>
              <button onClick={goLogin} className="inline-flex items-center gap-1 whitespace-nowrap"><LogIn className="w-3 h-3" /> {t('wholesale.util.login', { defaultValue: '로그인' })}</button>
              <span className="opacity-30">|</span>
              <button onClick={() => navigate('/wholesale/start')} className="font-bold text-white whitespace-nowrap">{t('wholesale.util.join', { defaultValue: '회원가입' })}</button>
            </>
          ) : (
            <>
              {/* 신원 + 잔액 칩 (역할별) */}
              {loggedIn ? (
                <>
                  <span className="hidden md:inline whitespace-nowrap"><b className="text-white">{companyName}</b> 님 · <span className="font-bold" style={{ color: WT.inkPink }}>{gradeLabel} 회원</span></span>
                  <span className="opacity-30 hidden md:inline">|</span>
                  <button onClick={() => navigate('/wholesale/deposits')} className="whitespace-nowrap" title={t('wholesale.icon.deposit', { defaultValue: '예치금' })}>{t('wholesale.icon.deposit', { defaultValue: '예치금' })} <b className="text-white tabular-nums">{won(depositBalance)}</b></button>
                  <button onClick={() => navigate('/wholesale/deposits')} className="font-bold text-white rounded-md px-2.5 py-1 whitespace-nowrap" style={{ background: WT.brand }}>{t('wholesale.charge', { defaultValue: '충전' })}</button>
                </>
              ) : (
                <>
                  <span className="hidden md:inline whitespace-nowrap"><b className="text-white">{supplierName}</b> 님 · <span className="font-bold" style={{ color: WT.inkPink }}>제조사</span></span>
                  <span className="opacity-30 hidden md:inline">|</span>
                  <button onClick={() => navigate('/supplier?tab=settlements')} className="whitespace-nowrap" title={t('wholesale.util.settlement', { defaultValue: '정산' })}>{t('wholesale.util.settlementShort', { defaultValue: '정산' })} <b className="text-white tabular-nums">{won(settleBalance)}</b></button>
                </>
              )}
              <span className="opacity-30">|</span>
              {/* 마이 드롭다운 (사람 아이콘 + '마이') */}
              <div className="relative" ref={menuRef}>
                <button onClick={() => setMenuOpen(o => !o)} aria-expanded={menuOpen} aria-haspopup="menu"
                  className="inline-flex items-center gap-1 font-semibold text-white whitespace-nowrap">
                  <User className="w-4 h-4" strokeWidth={1.9} />
                  {t('wholesale.util.mySpace', { defaultValue: '마이' })}
                  <ChevronDown className={'w-3 h-3 transition-transform ' + (menuOpen ? 'rotate-180' : '')} />
                </button>
                {menuOpen && (
                  <div role="menu" className="absolute right-0 top-full mt-1.5 w-48 rounded-xl py-1.5 z-50 overflow-hidden"
                    style={{ background: '#fff', color: WT.ink, boxShadow: WT.shCard, border: '1px solid ' + WT.line2 }}>
                    {menuItems.map((it) => (
                      <button key={it.to + it.label} role="menuitem" onClick={() => go(it.to)}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-left hover:bg-[#F4F5F7] transition-colors">
                        <it.icon className="w-4 h-4 shrink-0" style={{ color: WT.ink3 }} strokeWidth={1.9} />
                        <span className="font-medium">{it.label}</span>
                      </button>
                    ))}
                    <div className="my-1 h-px" style={{ background: WT.line2 }} />
                    <button role="menuitem" onClick={logout}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-left hover:bg-[#F4F5F7] transition-colors font-semibold" style={{ color: WT.brand }}>
                      <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.9} />
                      <span>{t('wholesale.util.logout', { defaultValue: '로그아웃' })}</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
