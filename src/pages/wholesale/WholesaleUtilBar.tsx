import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LogIn, LogOut, Factory } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { logout as authLogout } from '@/utils/auth'
import { getSupplierToken, clearSupplierSession } from '@/lib/supplier-api'
import { useWholesaleMe, useWholesaleDeposit } from '@/hooks/queries/useWholesale'
import { WT, won, GRADE_NAME } from './wholesale-theme'

/**
 * 🏭 2026-06-27 (대표 — 모든 도매 페이지 공통 상단바 + 예치금 실시간): 도매몰 다크 유틸바.
 *
 *   기존엔 카탈로그 헤더(CatalogHeader)에만 박혀 있어 상세/장바구니/결제/대시보드 등 다른 도매
 *   페이지엔 회원·예치금·충전·로그아웃 진입이 없었다. 이 컴포넌트는 **데이터를 스스로 fetch**해
 *   (useWholesaleMe=등급, useWholesaleDeposit=잔액) 어느 페이지에 놓아도 동일하게 동작한다.
 *   예치금은 deposit 훅(refetchOnMount/focus + 주문 후 무효화)으로 **실시간** 반영된다.
 *
 *   사용: WholesaleLayout 이 모든 도매 app 페이지 상단에 렌더(로그인/가입/인트로/랜딩 제외).
 */
export default function WholesaleUtilBar() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const token = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  const supplierToken = getSupplierToken()
  const loggedIn = !!token
  const companyName = (typeof window !== 'undefined' && localStorage.getItem('seller_name')) || '회원'
  // 🏭 2026-06-29 (통합 셸 Phase 3): 제조사 분기도 판매사처럼 신원(회사명·역할) + 빠른 네비를 표시 — 역할 인지 일관.
  const supplierName = (typeof window !== 'undefined' && localStorage.getItem('supplier_name')) || '제조사'

  const meQ = useWholesaleMe()
  const depositQ = useWholesaleDeposit()
  const grade = (meQ.data?.grade as string) || 'C'
  const gradeLabel = GRADE_NAME[grade] || grade
  const depositBalance = Number(depositQ.data?.balance) || 0

  const goLogin = () => navigate('/wholesale/login')
  const logout = async () => {
    // 도매몰 로그아웃 — 판매사(seller) + 제조사(supplier) 세션 모두 정리(유저/어드민 세션 보존). CatalogHeader 와 동일.
    // 🔑 2026-06-29: 서버 httpOnly 세션쿠키(ur_seller_session) 삭제를 **await** 후 하드이동 — 없으면 잔존 재인증.
    await authLogout('seller')
    try { localStorage.removeItem('is_distributor') } catch { /* noop */ }
    try { clearSupplierSession() } catch { /* noop */ }
    toast.success('로그아웃되었어요')
    if (typeof window !== 'undefined') window.location.assign('/wholesale')
  }

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
          {loggedIn ? (
            <>
              <span className="hidden md:inline whitespace-nowrap"><b className="text-white">{companyName}</b> 님 · <span className="font-bold" style={{ color: WT.inkPink }}>{gradeLabel} 회원</span></span>
              <span className="opacity-30 hidden md:inline">|</span>
              <span className="whitespace-nowrap">{t('wholesale.icon.deposit', { defaultValue: '예치금' })} <b className="text-white tabular-nums">{won(depositBalance)}</b></span>
              <button onClick={() => navigate('/wholesale/deposits')} className="font-bold text-white rounded-md px-2.5 py-1 whitespace-nowrap" style={{ background: WT.brand }}>{t('wholesale.charge', { defaultValue: '충전' })}</button>
              <span className="opacity-30">|</span>
              <button onClick={() => navigate('/wholesale/dashboard')} className="font-semibold whitespace-nowrap">{t('wholesale.util.my', { defaultValue: '대시보드' })}</button>
              <button onClick={logout} className="inline-flex items-center gap-1 whitespace-nowrap"><LogOut className="w-3 h-3" /> {t('wholesale.util.logout', { defaultValue: '로그아웃' })}</button>
            </>
          ) : supplierToken ? (
            <>
              <span className="hidden md:inline whitespace-nowrap"><b className="text-white">{supplierName}</b> 님 · <span className="font-bold" style={{ color: WT.inkPink }}>제조사</span></span>
              <span className="opacity-30 hidden md:inline">|</span>
              <button onClick={() => navigate('/supplier/wholesale-orders')} className="font-semibold whitespace-nowrap">{t('wholesale.util.orders', { defaultValue: '주문 관리' })}</button>
              <button onClick={() => navigate('/supplier')} className="font-bold text-white inline-flex items-center gap-1 whitespace-nowrap"><Factory className="w-3.5 h-3.5" /> {t('wholesale.util.supplierDash', { defaultValue: '제조사 대시보드' })}</button>
              <span className="opacity-30">|</span>
              <button onClick={logout} className="inline-flex items-center gap-1 whitespace-nowrap"><LogOut className="w-3 h-3" /> {t('wholesale.util.logout', { defaultValue: '로그아웃' })}</button>
            </>
          ) : (
            <>
              <button onClick={goLogin} className="inline-flex items-center gap-1 whitespace-nowrap"><LogIn className="w-3 h-3" /> {t('wholesale.util.login', { defaultValue: '로그인' })}</button>
              <span className="opacity-30">|</span>
              <button onClick={() => navigate('/wholesale/start')} className="font-bold text-white whitespace-nowrap">{t('wholesale.util.join', { defaultValue: '회원가입' })}</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
