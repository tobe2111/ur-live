import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams, Navigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { isKorea } from '@/shared/config/region'
import SEO from '@/components/SEO'
import { cfImage } from '@/utils/cf-image'
import { logoutAll } from '@/features/auth/login-flow.service'
import { getUserProfileImage } from '@/utils/auth'
import { RewardAdCard } from '@/components/my-page/reward-ad-card'
import { ChevronRight, Store, ScanLine } from 'lucide-react'
import TeamPointsCard from './user-profile/TeamPointsCard'
import EarningsGroup from './user-profile/EarningsGroup'
import ReferralEarnedCard from './user-profile/ReferralEarnedCard'
import CuratorEarningsCard from './user-profile/CuratorEarningsCard'
import MyReferralCard from '@/components/MyReferralCard'
import RoleCtaGrid from './user-profile/RoleCtaGrid'
import ShoppingGroup from './user-profile/ShoppingGroup'
import OrderStatusBar from './user-profile/OrderStatusBar'
import ReviewLevelCard from './user-profile/ReviewLevelCard'
import SellerSwitchInline from './user-profile/SellerSwitchInline'
import SettingsGroup from './user-profile/SettingsGroup'
import { useMyCounts } from './user-profile/useMyCounts'
import ThemeToggleSection from '@/components/settings/ThemeToggleSection'
import LanguageSection from '@/components/settings/LanguageSection'
import { CONSUMER_LANGUAGE_SWITCH_HIDDEN } from '@/shared/feature-flags'
// 🛡️ 2026-05-24: /account/settings 와 통합 — unique 섹션들 import.
import {
  NotificationToggleSection,
  AppVersionSection,
  DeleteAccountLink,
  ProfileEditModal,
} from './user-profile/AccountControlsSection'
import api from '@/lib/api'
import BrandLoader from '@/components/brand/BrandLoader'
import AccountSideNav from './user-profile/AccountSideNav'

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
  const authStore = useAuthKR // 🔥 2026-08-04: GLOBAL 스토어 제거(#804)
  const { user, isAuthReady } = authStore()

  const [userName, setUserName] = useState('')
  const [profileImage, setProfileImage] = useState<string | undefined>(() => getUserProfileImage() || undefined)
  const hasProcessedToken = useRef(false)
  // 🛡️ 2026-05-24: 프로필 편집 모달 — /account/settings 에서 흡수.
  const [editOpen, setEditOpen] = useState(false)
  const [profileForm, setProfileForm] = useState({ name: '', phone: '' })
  useEffect(() => {
    // 모달 열릴 때 최신 phone 가져오기 (initial 으로 전달).
    if (!editOpen) return
    api.get('/api/auth/me').then(r => {
      const phone = r.data?.data?.phone || ''
      setProfileForm({ name: userName, phone })
    }).catch(() => setProfileForm({ name: userName, phone: '' }))
  }, [editOpen, userName])

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
  // 🚑 2026-07-10 (로딩 전수조사 — 로더 전면 통일): ad-hoc 스피너 → BrandLoader.
  if (!isAuthReady && !isKorea()) {
    return (
      <div className="min-h-[100dvh] bg-white dark:bg-[#0F151D]">
        <BrandLoader fullScreen />
      </div>
    )
  }

  // 🚫 로그인 안 됨
  // 🏭 2026-06-04 (사용자 신고 — 마이 클릭 시 / 로 튕김 영구수정):
  //   기존 `user_type === 'user'` 검사는 셀러+유저 이중 로그인 시 user_type 이 'seller' 로
  //   덮여 실패 → /login → PublicRoute(이미 로그인 판단) → / 로 튕기는 무한 redirect 유발.
  //   ProtectedRoute.isUserLoggedIn() 과 동일 기준(user_id / session_login 존재)으로 통일 —
  //   CLAUDE.md 잠금규칙("토큰/ID 존재만으로 인증 판단, user_type 추가검사 X")과 정합.
  const isLoggedInViaLocalStorage = !!localStorage.getItem('user_id') || !!localStorage.getItem('session_login')
  if (!user && !isLoggedInViaLocalStorage) {
    return <Navigate to="/login" replace />
  }

  // ✅ 로그아웃 핸들러
  // 🔑 2026-07-07 (대표 확정 "전부 로그아웃"): 마이페이지 로그아웃 = 소비자+셀러+어드민+에이전시 전 세션 종료.
  //   배경: 이전엔 logout('user') 로 소비자만 지웠으나, 다중역할 계정(어드민/셀러 + 소비자)에선
  //   대시보드 Bearer 토큰(seller_token/admin_token 등)이 남아 isLoggedInSync()=true → 홈이 여전히
  //   "로그인됨"으로 보임 → 대표 신고 "로그아웃이 안 됨". 이중 로그인 편의를 포기하고 명시적
  //   로그아웃은 전 역할을 완전히 종료(logoutAll — 서버 ur_* 세션쿠키 전체 삭제 await + 전 역할 localStorage 정리).
  const handleLogout = async () => {
    try {
      await logoutAll()  // 내부에서 하드 리로드('/') 로 마무리
    } catch (error) {
      if (import.meta.env.DEV) console.error('[UserProfilePage] ❌ 로그아웃 실패:', error)
      window.location.href = '/'
    }
  }

  // 🛡️ 2026-04-30 v4 Wallet 디자인 시안 매칭 — InsetGroup 형태로 정돈, 모든 기능 보존
  return (
    <div className="bg-white dark:bg-[#0F151D] flex flex-col min-h-screen pb-7">
      <SEO title={t('userProfile.docTitle')} description={t('userProfile.seoDesc')} url="/user/profile" noindex />
      <h1 className="sr-only">{t('nav.mypage', { defaultValue: '마이페이지' })}</h1>

      {/* v4 Hero Profile — 프로필 + 알림/설정 버튼 (상단 Large Title 바 제거) */}
      {/* 🏭 2026-06-05 (사용자 요청): 헤더 배경 은은한 그라데이션(라이트/다크 모두 자연스럽게). */}
      <div className="bg-gradient-to-b from-gray-50 via-white to-white dark:from-[#171026] dark:via-[#0a0712] dark:to-[#0F151D]">
      <div className="ur-content-medium px-4 lg:px-8 pt-5 pb-5">
        <div className="flex items-center gap-3">
          <img
            src={profileImage ? cfImage(profileImage, { width: 128 }) : `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=111827&color=ffffff&size=128`}
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
            <button onClick={() => setEditOpen(true)} className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 mt-1.5 bg-gray-100 dark:bg-white/[0.08] text-[10px] text-gray-900 dark:text-white/75 font-semibold">
              {t('userProfile.editProfile', { defaultValue: '프로필 편집' })} <ChevronRight className="w-2.5 h-2.5" aria-hidden="true" />
            </button>
          </div>
          {/* 알림 버튼 — 프로필 우측 (설정 톱니는 '프로필 편집' 알약과 중복이라 제거, 설정은 하단 '설정' 그룹) */}
          <div className="flex items-center gap-1 flex-shrink-0 self-start pt-1">
            <button onClick={() => navigate('/notifications')} aria-label={t('userProfile.ariaNotifications')} className="rounded-full flex items-center justify-center w-[34px] h-[34px] bg-gray-100 dark:bg-white/[0.06] hover:bg-gray-200 dark:hover:bg-white/[0.12] transition-colors">
              <svg className="w-4 h-4 text-gray-700 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-5-5.917V4a1 1 0 10-2 0v1.083A6 6 0 006 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            </button>
          </div>
        </div>
      </div>
      </div>{/* /헤더 그라데이션 wrapper */}

      {/* 🧭 2026-08-19 (대표 시안 — 그루폰 `My Account`): PC 는 [좌 내비 | 우 내용] 2단.
          모바일(<lg)에서는 `ur-account-pc` 가 아무 일도 하지 않아 **지금 흐름 그대로**다. */}
      <div className="hidden lg:block max-w-[1200px] mx-auto px-8 pt-1 pb-3">
        <p className="text-[12px] text-gray-400 dark:text-gray-500">
          <Link to="/" className="hover:underline">홈</Link>
          <span className="mx-1.5">/</span>
          <span className="text-gray-600 dark:text-gray-300 font-semibold">내 계정</span>
        </p>
      </div>
      <div className="ur-account-pc">
        <AccountSideNav />
        <div className="ur-account-pane min-w-0">

      {/* v4 딜 잔액 + 충전 (큰 박스) */}
      <TeamPointsCard />

      {/* v4 광고 리워드 카드 — 딜 버는 수단이라 딜 잔액 바로 아래(웹은 null 렌더·네이티브 전용) */}
      <RewardAdCard />

      {/* 🧹 2026-06-22 (대표 — '내 자산 먼저' IA 재배치): 소비자 본인 자산(주문현황+나의 이용내역)을
          역할 진입/수익 CTA 보다 위로. 순서: 딜 잔액(딜 벌기) → 나의 이용내역 → 수익·추천(접힘) → 역할 진입. */}

      {/* v4 주문 현황 */}
      <OrderStatusBar />

      {/* 🗺️ 2026-07-02 동네 리뷰어 레벨 (카카오맵 리뷰 게이미피케이션) — 자산 흐름 안에서 동기부여 노출 */}
      <ReviewLevelCard />

      {/* v4 쇼핑 InsetGroup — 나의 이용 내역 (이용권·자산 / 관심 / 주문·배송) */}
      <ShoppingGroup counts={counts} />

      {/* 🧭 2026-06-10 (UI 100점 패스): 수익·추천 3카드 도배 → 접이식 그룹(자산 다음으로 1탭 뒤). */}
      <EarningsGroup>
      {/* 🧹 2026-06-22 (대표 — 수익·추천 폴드 압축): 큰 카드 도배 → 컴팩트 행 한 묶음(B&W).
            ReferralEarnedCard/CuratorEarningsCard 는 행으로(데이터/라우트 불변, 빈값이면 null →
            divide-y 가 자동 정렬). 각 행 라우트는 단일 진입점이라 제거 없이 한 카드로 통합만. */}
      <div className="mt-1 rounded-2xl overflow-hidden bg-gray-100 dark:bg-white/[0.04] divide-y divide-black/[0.05] dark:divide-white/[0.05]">
        {/* referral 적립 현황 → /influencer (entry point) */}
        <ReferralEarnedCard />
        {/* 유어샵(큐레이터) 수익 → /creator. 누적 0 이면 null. 사업자=현금 / user=딜 */}
        <CuratorEarningsCard />
        {/* /user/affiliate 고아 라우트 진입점 — 추천 링크 실적 */}
        <button
          type="button"
          onClick={() => navigate('/user/affiliate')}
          className="w-full flex items-center gap-3 px-3.5 py-3 active:bg-gray-200 dark:active:bg-white/[0.06] text-left"
        >
          <span className="text-lg" aria-hidden="true">🔗</span>
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-medium text-gray-900 dark:text-white">
              {t('my.affiliateLinkTitle', { defaultValue: '상품 추천 링크' })}
            </span>
            <span className="block text-[10px] text-gray-500 dark:text-white/45 mt-0.5">
              {t('my.affiliateLinkSub', { defaultValue: '내 링크로 구매하면 딜 적립 — 실적 보기' })}
            </span>
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-gray-400 dark:text-white/30 shrink-0" aria-hidden="true" />
        </button>
        {/* 추천 수익 정산(출금) → /influencer/settlement */}
        <button
          type="button"
          onClick={() => navigate('/influencer/settlement')}
          className="w-full flex items-center gap-3 px-3.5 py-3 active:bg-gray-200 dark:active:bg-white/[0.06] text-left"
        >
          <span className="text-lg" aria-hidden="true">🧾</span>
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-medium text-gray-900 dark:text-white">
              {t('my.settlementTitle', { defaultValue: '추천 수익 정산' })}
            </span>
            <span className="block text-[10px] text-gray-500 dark:text-white/45 mt-0.5">
              {t('my.settlementSub', { defaultValue: '추천·영입 적립 출금 및 내역' })}
            </span>
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-gray-400 dark:text-white/30 shrink-0" aria-hidden="true" />
        </button>
      </div>

      {/* 🛡️ 2026-05-27 (P2 referral): 친구 초대 카드 — 초대링크 복사가 핵심이라 행 압축 대신 카드 유지(B&W) */}
      <MyReferralCard />
      </EarningsGroup>

      {/* 🛡️ 2026-05-21: 역할 진입 CTA 2x2 grid — 공구개최 / 사장님 / 셀러 / 에이전시.
            ur-content-medium 부모 wrap — 다른 섹션과 동일 폭 정렬 (overflow 영구 fix). */}
      <div className="ur-content-medium px-4 lg:px-8 pt-5">
        <RoleCtaGrid />
      </div>

      {/* 🧹 2026-06-22 (대표 — 도움말 비중 축소): 도움말/약관 InsetGroup 을 최하단 footer 로 이동(아래 로그아웃 다음). */}

      {/* 🧹 2026-06-19 (대표 신고 — 마이 번잡): 흩어진 설정(알림/테마/언어/앱정보)을 접이식 '설정' 그룹으로 합침.
           기능/데이터 로직 불변 — 표시만 1탭 뒤로. 탈퇴는 파괴적 동작이라 그룹 밖 최하단 유지. */}
      <SettingsGroup>
        <NotificationToggleSection />
        <ThemeToggleSection className="ur-content-medium px-4 lg:px-8 pt-5" />
        {/* 🌐 2026-08-11: 번역이 반쯤 빈 상태(언어당 [TODO] 289개)에서 전환을 열어 두면
            어중간한 화면이 된다. 한국 전용 서비스라 문을 닫는다 — 플래그 false 로 즉시 복원. */}
        {!CONSUMER_LANGUAGE_SWITCH_HIDDEN && <LanguageSection className="ur-content-medium px-4 lg:px-8 pt-3" />}
        <AppVersionSection />
      </SettingsGroup>

      {/* v4 로그아웃 + 계정 전환 + 회원 탈퇴 — 한 묶음, 동일 간격(space-y-2) */}
      <div className="ur-content-medium px-4 lg:px-8 pt-6 space-y-2">
        {/* 🛡️ 2026-05-01: linked seller 가 있으면 셀러 대시보드 전환 버튼 표시.
            이전: BottomNav 가 seller_token 만 보고 자동으로 셀러 UI 표시 → 사용자 혼란.
            이번: 명시 전환만 셀러 모드로. */}
        {/* 🎟️ 2026-07-06 (대표 — 계산대 스캔을 셀러 대시보드 말고 메인에서): 사업자 유저 '매장 계산대'
            강조 카드. 손님 이용권 QR 스캔 = 매일 수십 번 쓰는 계산대 동선 → 최상단·큰 카드로 노출. */}
        {!!localStorage.getItem('seller_token') && (
          <button
            type="button"
            onClick={() => navigate('/store/scan')}
            className="w-full flex items-center gap-3.5 p-4 rounded-2xl bg-gray-900 dark:bg-white active:scale-[0.99] transition-transform"
          >
            <span className="w-11 h-11 rounded-xl bg-white/15 dark:bg-gray-900/10 flex items-center justify-center shrink-0">
              <ScanLine className="w-6 h-6 text-white dark:text-gray-900" aria-hidden="true" />
            </span>
            <span className="text-left min-w-0">
              <span className="block text-[15px] font-extrabold text-white dark:text-gray-900">{t('userProfile.storeCheckout', { defaultValue: '매장 계산대' })}</span>
              <span className="block text-[11.5px] text-white/75 dark:text-gray-900/70 mt-0.5">{t('userProfile.storeCheckoutDesc', { defaultValue: '손님 이용권 QR을 스캔해 바로 사용 처리' })}</span>
            </span>
          </button>
        )}

        {/* 🏪 2026-06-22 (대표 — 소상공인은 풀 대시보드 대신 앱에서 바로): 사업자 유저 경량 '내 매장'. */}
        {!!localStorage.getItem('seller_token') && (
          <button
            type="button"
            onClick={() => navigate('/my-store')}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gray-100 dark:bg-white/[0.06] text-[13px] font-bold text-gray-900 dark:text-white active:opacity-80 transition-opacity"
          >
            <Store className="w-4 h-4" aria-hidden="true" />
            {t('userProfile.myStore', { defaultValue: '내 매장 · 이용권·정산' })}
          </button>
        )}
        {!!localStorage.getItem('seller_token') && (
          <button
            type="button"
            onClick={() => {
              localStorage.setItem('active_role', 'seller')
              window.location.href = '/seller'
            }}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gray-900 dark:bg-white text-[13px] font-semibold text-white dark:text-gray-900 active:bg-gray-800 dark:active:bg-gray-100 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h18v4H3zM3 9h18v12H3zM9 13h6" />
            </svg>
            {t('userProfile.switchToSeller')}
          </button>
        )}
        {/* 🛡️ 2026-05-01: 다른 계정으로 로그인 — hidden per product decision 2026-05-04 */}
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gray-100 dark:bg-white/[0.04] text-[13px] font-semibold text-gray-900 dark:text-white/75 active:bg-white/[0.08] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          {t('userProfile.logout')}
        </button>
        {/* 🛡️ 회원 탈퇴 — 파괴적 동작이라 로그아웃 바로 아래, 빨강 아웃라인으로 구분(동일 간격) */}
        <DeleteAccountLink />
      </div>

      {/* 🧹 2026-06-22 (대표 — 도움말 비중 축소): 도움말/약관을 최하단 footer 로.
            볼드 헤더+카드 InsetGroup → 점 구분 muted 텍스트 링크(항목/경로 불변). */}
      <div className="ur-content-medium px-4 lg:px-8 pb-10 pt-4">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          {[
            { label: t('userProfile.kakaoConsult', { defaultValue: '카카오톡 상담' }), emphasize: true, action: () => window.open('http://pf.kakao.com/_AITdn/chat', '_blank', 'noopener,noreferrer') },
            { label: t('userProfile.faq'), path: '/faq' },
            { label: t('userProfile.terms'), path: '/terms' },
            { label: t('userProfile.privacy'), path: '/privacy' },
            // 🛡️ 2026-07-02: '배송정책' 라벨이 /refund(환불·반품 정책)로 리다이렉트돼 라벨-도착지 불일치 — 정합.
            { label: t('userProfile.refundPolicy', { defaultValue: '환불·반품 정책' }), path: '/refund' },
          ].map((item, i) => (
            <span key={item.label} className="flex items-center gap-2.5">
              {i > 0 && <span className="text-[10px] text-gray-300 dark:text-white/15" aria-hidden="true">·</span>}
              <button
                type="button"
                onClick={() => (item as any).action ? (item as any).action() : item.path && navigate(item.path)}
                className={`text-[11px] ${(item as any).emphasize ? 'font-medium text-gray-600 dark:text-white/55' : 'text-gray-500 dark:text-white/40'} active:text-gray-800 dark:active:text-white/75`}
              >
                {item.label}
              </button>
            </span>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 dark:text-white/30 mt-2">{t('userProfile.kakaoConsultSub', { defaultValue: '평일 10:00~18:00 응대' })}</p>
      </div>

        </div>{/* /우측 내용 칸 */}
      </div>{/* /ur-account-pc */}

      {/* 🛡️ 2026-05-24: 프로필 편집 모달 (/account/settings 에서 흡수). */}
      <ProfileEditModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        initial={profileForm}
        onSaved={({ name }) => {
          setUserName(name)
          localStorage.setItem('user_name', name)
        }}
      />
    </div>
  )
}
