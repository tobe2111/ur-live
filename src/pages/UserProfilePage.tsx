import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/shared/config/region'
import SEO from '@/components/SEO'
import { logout } from '@/features/auth/login-flow.service'
import { getUserProfileImage } from '@/utils/auth'
import { RewardAdCard } from '@/components/my-page/reward-ad-card'
import { ChevronRight } from 'lucide-react'
import TeamPointsCard from './user-profile/TeamPointsCard'
import ChatNameSetting from './user-profile/ChatNameSetting'
import CouponVoucherStats from './user-profile/CouponVoucherStats'
import ShoppingGroup from './user-profile/ShoppingGroup'
import OrderStatusBar from './user-profile/OrderStatusBar'
import SellerSwitchInline from './user-profile/SellerSwitchInline'
import { useMyCounts } from './user-profile/useMyCounts'
import ThemeToggleSection from '@/components/settings/ThemeToggleSection'

/**
 * 🛡️ 2026-05-01: TD-018 분할 — sub-component 들을 ./user-profile/ 디렉토리로 이동.
 *   원본 inline 컴포넌트는 동일 동작을 보존하며 props 전달 패턴 유지.
 */
export default function UserProfilePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // 🛡️ 2026-04-30: 카운트 통합 fetch — 자식 컴포넌트 (CouponVoucherStats / ShoppingGroup) 가
  //   각자 호출하던 wishlist / coupon / voucher endpoint 를 1회만 호출.
  const counts = useMyCounts()

  // ✅ Zustand 스토어 사용 (지역별)
  const authStore = isKorea() ? useAuthKR : useAuthWorld
  const { user, isAuthReady } = authStore()

  const [userName, setUserName] = useState('')
  const [profileImage, setProfileImage] = useState<string | undefined>(undefined)
  const hasProcessedToken = useRef(false)

  useEffect(() => { document.title = t('userProfile.docTitle') }, [t])

  // 🛡️ 2026-05-01: Firebase 100% 제거 — firebase_token URL 파라미터 처리 dead path 가 됨.
  //   카카오 콜백은 세션 쿠키로 인증되므로 별도 토큰 교환 불필요.
  //   URL 에 userName / profileImage 가 들어오면 localStorage 만 업데이트 후 정리.
  useEffect(() => {
    const userNameParam = searchParams.get('userName')
    const profileImageParam = searchParams.get('profileImage')
    const firebaseToken = searchParams.get('firebase_token') // legacy — 그냥 무시

    if (userNameParam || profileImageParam || firebaseToken) {
      if (userNameParam) localStorage.setItem('user_name', userNameParam)
      if (profileImageParam) localStorage.setItem('user_profile_image', profileImageParam)
      hasProcessedToken.current = true
      navigate('/user/profile', { replace: true })
    }
  }, [isAuthReady])

  // ✅ 사용자 이름 + 프로필 이미지 설정
  useEffect(() => {
    const name = user?.displayName || localStorage.getItem('user_name') || t('userProfile.defaultName')
    setUserName(name)
    const image = user?.photoURL || getUserProfileImage() || undefined
    setProfileImage(image)
  }, [user])

  // 🔄 로딩 중 (한국: localStorage 인증이므로 isAuthReady 무시)
  if (!isAuthReady && !isKorea()) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#020202] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b35] mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">로딩 중...</p>
        </div>
      </div>
    )
  }

  // 🚫 로그인 안 됨
  // 한국: localStorage 기반 인증이므로 Zustand user 없어도 OK
  const isLoggedInViaLocalStorage = localStorage.getItem('user_type') === 'user' && !!localStorage.getItem('user_id')
  if (!user && !isLoggedInViaLocalStorage) {
    return <Navigate to="/login" replace />
  }

  // ✅ 로그아웃 핸들러
  const handleLogout = async () => {
    try {
      await logout()
      navigate('/', { replace: true })
    } catch (error) {
      if (import.meta.env.DEV) console.error('[UserProfilePage] ❌ 로그아웃 실패:', error)
    }
  }

  // 🛡️ 2026-04-30 v4 Wallet 디자인 시안 매칭 — InsetGroup 형태로 정돈, 모든 기능 보존
  return (
    <div className="bg-white dark:bg-[#020202] flex flex-col min-h-screen pb-7">
      <SEO title={t('userProfile.docTitle')} description={t('userProfile.seoDesc')} url="/user/profile" noindex />
      <h1 className="sr-only">마이페이지</h1>

      {/* v4 Wallet sticky chrome — 알림 + 설정 (한 손 도달 영역 우측) */}
      <div className="sticky top-0 z-50" style={{ background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(20px) saturate(140%)', WebkitBackdropFilter: 'blur(20px) saturate(140%)', borderBottom: '0.5px solid rgba(84,84,88,0.34)' }}>
        <div className="ur-content-medium flex items-center justify-end px-2 lg:px-8 py-3 gap-1">
          <button onClick={() => navigate('/notifications')} aria-label={t('userProfile.ariaNotifications')} className="rounded-full flex items-center justify-center w-[34px] h-[34px] bg-gray-100 dark:bg-white/[0.06]">
            <svg className="w-4 h-4 text-gray-900 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-5-5.917V4a1 1 0 10-2 0v1.083A6 6 0 006 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          </button>
          <button onClick={() => navigate('/account/settings')} aria-label={t('userProfile.ariaSettings')} className="rounded-full flex items-center justify-center w-[34px] h-[34px] bg-gray-100 dark:bg-white/[0.06]">
            <svg className="w-4 h-4 text-gray-900 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
        </div>
      </div>

      {/* v4 Wallet Large Title */}
      <div className="ur-content-medium px-4 lg:px-8 pt-3 pb-1">
        <h2 style={{ fontSize: 32, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em', lineHeight: 1.1 }}>My</h2>
      </div>

      {/* v4 Hero Profile — 단색 배경 + 이름 옆 셀러 버튼 + 편집 */}
      <div className="ur-content-medium px-4 lg:px-8 pt-2 pb-5">
        <div className="flex items-center gap-3">
          <img
            src={profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=random&size=64`}
            alt={`${userName} 프로필 이미지`}
            loading="lazy"
            decoding="async"
            className="w-16 h-16 rounded-full object-cover flex-shrink-0"
            style={{ border: '2px solid rgba(255,255,255,0.15)' }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[17px] font-extrabold text-gray-900 dark:text-white truncate" style={{ letterSpacing: '-0.01em' }}>{userName}</p>
              <SellerSwitchInline />
            </div>
            <p className="text-[11px] text-gray-900 dark:text-white/50 mt-0.5 truncate">{localStorage.getItem('user_email') || ''}</p>
            <button onClick={() => navigate('/account/settings')} className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 mt-1.5 bg-gray-100 dark:bg-white/[0.08] text-[10px] text-gray-900 dark:text-white/75 font-semibold">
              프로필 편집 <ChevronRight className="w-2.5 h-2.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* v4 딜 잔액 + 충전 (큰 박스) */}
      <TeamPointsCard />

      {/* v4 쿠폰 / 바우처 카운트 2분할 */}
      <CouponVoucherStats counts={counts} />

      {/* v4 주문 현황 */}
      <OrderStatusBar />

      {/* v4 쇼핑 InsetGroup — 시안 매칭 (4개) */}
      <ShoppingGroup counts={counts} />

      {/* v4 활동 InsetGroup — 채팅 이름 (셀러 전환은 상단 이름 옆으로 이동) */}
      <ChatNameSetting />

      {/* 🛡️ 2026-05-04 (재추가): 사용자 신고 "테마 버튼 또 없어졌어".
           마이페이지 자체는 강제 다크라 시각 변화 없지만, 토글은 다른 화이트 페이지
           (쇼핑/결제/마이리뷰 등) 에 즉시 반영됨. 사용자 접근성 위해 마이페이지에 노출. */}
      <ThemeToggleSection />

      {/* v4 더보기 InsetGroup — 배송지 / 리뷰 / 친구초대 / 광고 보고 포인트 */}
      <div className="ur-content-medium px-4 lg:px-8 pt-5">
        <p className="text-[12px] font-bold text-gray-900 dark:text-white mb-2">{t('userProfile.moreSection')}</p>
        <div className="rounded-2xl overflow-hidden bg-gray-100 dark:bg-white/[0.04]">
          {[
            { icon: '📍', label: t('userProfile.addressManage'), path: '/mypage/addresses' },
            { icon: '📝', label: t('userProfile.myReviews'), path: '/my-reviews' },
            { icon: '👥', label: t('userProfile.inviteFriends'), path: '/referral' },
          ].map((item, i) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="w-full flex items-center gap-3 px-3.5 py-3 text-left active:bg-white/[0.06]"
              style={{ borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
            >
              <span className="text-base" aria-hidden="true">{item.icon}</span>
              <span className="flex-1 text-[13px] text-gray-900 dark:text-white">{item.label}</span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-900 dark:text-white/30" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>

      {/* v4 광고 리워드 카드 */}
      <RewardAdCard />

      {/* v4 도움말 InsetGroup */}
      <div className="ur-content-medium px-4 lg:px-8 pt-5">
        <p className="text-[12px] font-bold text-gray-900 dark:text-white mb-2">{t('userProfile.helpSection')}</p>
        <div className="rounded-2xl overflow-hidden bg-gray-100 dark:bg-white/[0.04]">
          {[
            { label: t('userProfile.customerCenter'), sub: '0507-0177-0432', action: () => window.open('tel:0507-0177-0432') },
            { label: t('userProfile.faq'), path: '/faq' },
            { label: t('userProfile.terms'), path: '/terms' },
            { label: t('userProfile.privacy'), path: '/privacy' },
            { label: t('userProfile.shippingPolicy'), path: '/shipping-policy' },
          ].map((item, i) => (
            <button
              key={item.label}
              onClick={() => (item as any).action ? (item as any).action() : item.path && navigate(item.path)}
              className="w-full flex items-center gap-3 px-3.5 py-3 text-left active:bg-white/[0.06]"
              style={{ borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
            >
              <div className="flex-1">
                <p className="text-[13px] text-gray-900 dark:text-white">{item.label}</p>
                {item.sub && <p className="text-[10px] text-gray-900 dark:text-white/45 mt-0.5">{item.sub}</p>}
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-900 dark:text-white/30" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>

      {/* v4 로그아웃 + 계정 전환 + 버전 */}
      <div className="ur-content-medium px-4 lg:px-8 py-6 space-y-2">
        {/* 🛡️ 2026-05-01: linked seller 가 있으면 셀러 대시보드 전환 버튼 표시.
            이전: BottomNav 가 seller_token 만 보고 자동으로 셀러 UI 표시 → 사용자 혼란.
            이번: 명시 전환만 셀러 모드로. */}
        {!!localStorage.getItem('seller_token') && (
          <button
            type="button"
            onClick={() => {
              localStorage.setItem('active_role', 'seller')
              window.location.href = '/seller'
            }}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-pink-500/[0.15] border border-pink-500/30 text-[13px] font-semibold text-pink-300 active:bg-pink-500/[0.25] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h18v4H3zM3 9h18v12H3zM9 13h6" />
            </svg>
            {t('userProfile.switchToSeller')}
          </button>
        )}
        {/* 🛡️ 2026-05-01: 다른 계정으로 로그인 — 다른 사람 디바이스에서 본인 계정 전환 UI.
            클릭 → /login?switch=1 → localStorage 청소 + cookie 무효화 + 카카오 prompt=login. */}
        <button
          type="button"
          onClick={() => { window.location.href = '/login?switch=1' }}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gray-100 dark:bg-white/[0.04] text-[13px] font-semibold text-gray-900 dark:text-white/65 active:bg-white/[0.08] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h8" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l3 3m0 0l-3 3m3-3h-7" />
          </svg>
          {t('userProfile.switchAccount')}
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gray-100 dark:bg-white/[0.04] text-[13px] font-semibold text-gray-900 dark:text-white/75 active:bg-white/[0.08] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          {t('userProfile.logout')}
        </button>
        <p className="text-[10px] text-gray-900 dark:text-white/25 text-center mt-3">
          유어딜 v1.0.0
          {import.meta.env.VITE_APP_VERSION && (
            <span className="font-mono ml-1">· {String(import.meta.env.VITE_APP_VERSION).slice(0, 7)}</span>
          )}
        </p>
      </div>
    </div>
  )
}
