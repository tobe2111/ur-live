import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams, Navigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { isKorea } from '@/shared/config/region'
import SEO from '@/components/SEO'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { logoutAll } from '@/features/auth/login-flow.service'
import { getUserProfileImage } from '@/utils/auth'
import { RewardAdCard } from '@/components/my-page/reward-ad-card'
import { ChevronRight } from 'lucide-react'
// 🎨 2026-09-28: 남은 lucide 는 `ChevronRight`(이동) 하나뿐 — 조작이라 그대로 둔다.
import { LogOutIcon, ReceiptIcon, ScanIcon, UrShopIcon } from '@/components/icons/urdeal-icons'
import MyStats from './user-profile/MyStats'
import EarningsGroup from './user-profile/EarningsGroup'
import ReferralEarnedCard from './user-profile/ReferralEarnedCard'
import CuratorEarningsCard from './user-profile/CuratorEarningsCard'
import MyReferralCard from '@/components/MyReferralCard'
import RoleCtaGrid from './user-profile/RoleCtaGrid'
import ShoppingGroup from './user-profile/ShoppingGroup'
import OrderStatusBar from './user-profile/OrderStatusBar'
import ReviewLevelCard from './user-profile/ReviewLevelCard'
import SellerSwitchInline from './user-profile/SellerSwitchInline'
import SellerSection from './user-profile/SellerSectionLazy'
import SettingsGroup from './user-profile/SettingsGroup'
import { useMyCounts } from './user-profile/useMyCounts'
import { useMyStores } from './user-profile/useMyStores'
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
import AccountPcPane from './user-profile/AccountPcPane'
import { useMediaQuery } from '@/hooks/useMediaQuery'

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
  // 🪑 2026-09-25 (설계 §14 단계 1): 좌석(내 가게)은 **이 페이지가 한 번만** 묻고 둘에게 나눠 준다 —
  //   이름 옆 칩과 "내 가게" 섹션이 각자 물으면 같은 화면이 서로 다른 답을 말하는 날이 온다.
  const sellerSeats = useMyStores()
  // 🖥️ 2026-09-02 (대표 — "PC 모드 답지 않은 페이지"): lg+ 는 우측 칸 상단을 `AccountPcPane`(내용)으로,
  //   모바일은 종전 세로 흐름 그대로. 동기 초기화 훅이라 첫 렌더부터 정확(모바일↔PC 플래시 없음).
  const isPc = useMediaQuery('(min-width: 1024px)')

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
      <div className="min-h-[100dvh] bg-warm dark:bg-[#11141C]">
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
    /* 🎨 2026-08-30 (대표 — "마이는 UX/UI 전반이 문제"): 표면을 뒤집었다.
       이전엔 **흰 배경 위에 회색 카드 8개**였다 — 딜 잔액도, 주문 현황도, 리뷰어 레벨도,
       이용 내역도, 수익도, 설정도 전부 `bg-gray-100 rounded-2xl` 로 같은 무게였다.
       화면이 "이 중 무엇이 중요한지" 를 한 마디도 안 하고 기능을 나열만 한다 — 그게
       대표가 본 "AI 티" 다. 사람이 만든 마이페이지에는 강조가 **하나**뿐이다.
       ⇒ 바탕을 웜 화이트(#F8F7FC)로 내리고 그룹을 **흰 카드**로 띄운다. 유어샵에서 같은
          문제를 같은 방법으로 이미 고쳤고(surface-token 테스트가 지킨다) — 두 화면의
          표면 언어가 이제 같다.
       ⚠️ `min-h-screen`(=100vh)은 모바일에서 주소창을 포함해 실제 보이는 영역보다 크다
          (CLAUDE.md 모바일 뷰포트 룰) → `min-h-[100dvh]`. */
    <div className="bg-warm dark:bg-[#11141C] flex flex-col min-h-[100dvh] pb-7">
      <SEO title={t('userProfile.docTitle')} description={t('userProfile.seoDesc')} url="/user/profile" noindex />
      <h1 className="sr-only">{t('nav.mypage', { defaultValue: '마이페이지' })}</h1>

      {/* v4 Hero Profile — 프로필 + 알림/설정 버튼 (상단 Large Title 바 제거) */}
      {/* 🎫 2026-09-02: 06-05 의 보라 그라디언트 띠 삭제(표면 규칙 ⑥ 그라디언트 0 — 다크에서 남보라 색이
          체계 밖 색이었다). PC(lg+)에서는 이 헤더 자체를 숨기고 우측 칸의 프로필 카드가 대신한다. */}
      <div className={isPc ? 'hidden' : ''}>
      <div className="ur-content-medium px-4 lg:px-8 pt-5 pb-5">
        <div className="flex items-center gap-3">
          <img
            src={profileImage ? cfImage(profileImage, { width: 128 }) : `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=111827&color=ffffff&size=128`}
            alt={`${userName} 프로필 이미지`}
            loading="lazy"
            decoding="async"
            className="w-16 h-16 rounded-full object-cover flex-shrink-0"
            style={{ border: '2px solid rgba(255,255,255,0.15)' }}
            onError={(e) => cfImageOnError(e.currentTarget, profileImage)}
          />
          {/* 🎨 2026-09-28 (대표 *"대기업수준이 필요해"*) — **'프로필 편집' 회색 알약을 없애고
              프로필 줄 전체를 누르게 했다.** 그 알약은 크림 바탕 위 `bg-gray-100` 이라 배경과 거의
              같은 색이었고(떠 있지도 눌러 보이지도 않았다), 이름·이메일 아래 **세 번째 줄**을 차지해
              헤더만 세 층이 됐다. 토스·카카오페이·당근의 마이 헤더는 전부 *프로필 블록 자체가 한 행*
              이고 오른쪽에 화살표 하나다 — 요소는 하나 줄고 누를 면적은 훨씬 넓어진다.
              ⚠️ 알림 벨은 **바깥에 그대로** 둔다(이 버튼 안에 넣으면 벨이 편집을 여는 셈이 된다). */}
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="flex-1 min-w-0 flex items-center gap-2 text-left active:opacity-70 transition-opacity"
            aria-label={t('userProfile.editProfile', { defaultValue: '프로필 편집' })}
          >
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-2 flex-wrap">
                <span className="text-[17px] font-extrabold text-gray-900 dark:text-white truncate" style={{ letterSpacing: '-0.01em' }}>{userName}</span>
              </span>
              <span className="block text-[13px] text-gray-500 dark:text-white/50 mt-1 truncate">{localStorage.getItem('user_email') || ''}</span>
            </span>
            <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />
          </button>
          <SellerSwitchInline seats={sellerSeats} />
          {/* 알림 버튼 — 프로필 우측 (설정 톱니는 '프로필 편집' 알약과 중복이라 제거, 설정은 하단 '설정' 그룹) */}
          <div className="flex items-center gap-1 flex-shrink-0 self-start pt-1">
            <button onClick={() => navigate('/notifications')} aria-label={t('userProfile.ariaNotifications')} className="rounded-full flex items-center justify-center w-[34px] h-[34px] bg-gray-100 dark:bg-white/[0.06] hover:bg-gray-200 dark:hover:bg-white/[0.12] transition-colors">
              <svg className="w-4 h-4 text-gray-700 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-5-5.917V4a1 1 0 10-2 0v1.083A6 6 0 006 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            </button>
          </div>
        </div>
      </div>
      </div>{/* /모바일 헤더 */}

      {/* 🧭 2026-09-28 (대표 *"PC 버전이나 모바일이나 너무 별로 · 허술해"*): **좌측 내비를 걷어냈다.**
          🩸 그 내비(`AccountSideNav`, 08-19 그루폰 시안)는 두 가지가 동시에 틀려 있었다 —
            ① **자기가 사는 페이지에만 있었다.** `/user/profile` 에서만 렌더되므로 '주문 내역' 을 누르면
               `/my-orders` 로 가고 **거기엔 그 내비가 없다.** 누르는 순간 사라지는 내비였다.
            ② 일곱 항목 중 **넷이 오른쪽 열과 중복**(이용권·교환권·찜·설정)이었다. 그건 09-02 에
               대표가 *"PC 모드 답지 않다 · 같은 항목을 두 번"* 이라고 지적해 `AccountPcPane` 을
               만들게 한 바로 그 증상이고, 내비가 남아 있어서 되살아나 있었다.
          걷어내니 본문이 888 → 1200px 을 쓴다(216 내비 + 32 gap 회수). 목적지는 하나도 안 잃었다 —
          넷은 오른쪽 열이 **숫자와 함께** 갖고 있고, 배송지·주문 내역은 `내가 산 것` 목록에 있다.
          모바일(<lg)에서는 `ur-account-pc` 가 아무 일도 하지 않아 **지금 흐름 그대로**다. */}
      <div className="hidden lg:block max-w-[1200px] mx-auto px-8 pt-1 pb-3">
        <p className="text-[12px] text-gray-400 dark:text-gray-500">
          <Link to="/" className="hover:underline">홈</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-600 dark:text-gray-300 font-semibold">내 계정</span>
        </p>
      </div>
      <div className="ur-account-pc">
        <div className="ur-account-pane min-w-0">

      {/* 🖥️ 2026-09-02 PC: 우측 칸 상단 = 내용(프로필 카드 · 숫자 넷 · 주문/리뷰어 · 곧 쓸 이용권 · 타일).
          모바일: 종전 흐름(딜 잔액 카드 → 주문 현황 → 리뷰어 → 이용 내역 목록) 그대로. */}
      {/* 🖥️ 2026-09-28 (대표 확정 **PC 1안 — "오늘이 머리"** · 시안 `PcFull1`): 판매 구역은 **전폭**이고
          그 아래부터 **두 열**이다. 안 나누면 888px 한 줄에 블록 열한 개가 세로로 1,900px 쌓이고,
          좌측 내비는 440px 에서 끝나 그 아래 1,500px 가 빈다 — 대표 *"PC 가 너무 별로, 허술하다"*(09-28)의
          실체가 그것이었다.
          ⚠️ **모바일에서는 이 래퍼가 아무 일도 안 한다**(`display:block`) — 자식이 종전 순서 그대로 흐른다.
          ⚠️ 균등 2열이 아니다. 왼쪽이 1.25, 오른쪽이 1 — 균등으로 쪼개면 한 칸이 폰보다 좁아진다
             (09-28 에 그 계산만 보고 "2열 안 함" 으로 결론 냈던 것이 오판이었다. 시안은 비대칭이고
              내비를 216 → 178 로 좁혀 본문을 996px 로 쓴다). */}
      {/* ⚠️ **가게가 없으면 두 열로 나누지 않는다.** 왼쪽 열은 판매 전용이라, 좌석이 0 이면
          그 칸이 통째로 비고 손님 블록이 전부 좁은 오른쪽으로 몰린다(첫 판에서 실제로 그랬다).
          판매가 있을 때만 쪼갠다 — 없으면 종전 한 열 그대로다. */}
      {/* 🔢 2026-09-29 (대표 확정 **안 C**) — 숫자 한 줄이 **맨 위**이고 폰·PC 가 같다.
          종전엔 같은 숫자가 두 벌이었다: 폰은 딜 잔액 카드 하나(`TeamPointsCard`, 판매 구역 *아래*),
          PC 는 우측에 **큰 카드 넷**(딜·이용권·교환권·쿠폰)인데 **그중 셋이 0** 이었다 — 0 을 네 번
          말하려고 우측 칸의 절반을 쓰고 있었다. 코레일톡이 같은 일을 구분선 한 줄로 하는 것을
          보고 대표가 이 형태를 골랐다.
          ⚠️ 2열 래퍼 **밖**이다 — 숫자는 판매/손님 어느 쪽 것도 아니라 두 칸 위에 걸쳐야 한다. */}
      <MyStats voucher={counts.voucher} gifticon={counts.gifticon} coupon={counts.coupon} />

      <div className={sellerSeats.stores.length > 0 ? 'ur-account-cols ur-account-cols--split' : 'ur-account-cols'}>
      <div className="ur-account-col min-w-0">

      {/* 🖥️ 판매는 **넓은 쪽**(1.25)에 산다 — 시안 `PcFull1` 과 같은 자리다.
          목록 행이 [이름 + 설명 + ›] 이라 좁히면 설명이 먼저 잘린다. */}
      {isPc ? <SellerSection state={sellerSeats} /> : null}

      </div>{/* /왼쪽 열 — 판매 */}
      <div className="ur-account-col ur-account-col--narrow min-w-0">

      {isPc ? (
      <>
        {/* 🖥️ 2026-09-28: 프로필·숫자 넷·티켓·타일은 **좁은 오른쪽 열**에 그대로 있다(하나도 안 지웠다).
            ⚠️ 그 안의 4열·3열 격자는 좁은 칸에서 글자가 잘린다 — `--narrow` 가 CSS 로 접어 준다
               (첫 판에서 실제로 `내...` `찜.` 으로 잘렸다).
            종전엔 프로필 카드가 이 칸의 머리였는데, PC 를 여는 사장님이 보려는 건 *오늘 얼마고 무엇이
            대기인가* 하나다. 프로필·숫자 넷·티켓·타일은 그대로 그 아래에 있다(하나도 안 지웠다 —
            시안이 그것들을 빠뜨렸던 게 09-28 에 "PC가 심플하다" 로 드러난 실수다).
            ⚠️ 모바일은 이 분기를 안 타고 아래 `<>` 쪽이 그대로다(종전과 동일 순서). */}
        <AccountPcPane counts={counts} userName={userName} profileImage={profileImage} onEditProfile={() => setEditOpen(true)} sellerSeats={sellerSeats} />
      </>
      ) : (
      <>
      {/* 🏪 2026-09-25 (대표 확정 §14 — "하는 것도 마이에서"): 판매가 **맨 위**.
          사장님은 하루에 이 화면을 가장 많이 열고, 그때 보려는 건 오늘 숫자다. 셀러가 아니면 렌더 0. */}
      <SellerSection state={sellerSeats} />

      {/* v4 광고 리워드 카드 — 딜 버는 수단이라 딜 잔액 바로 아래(웹은 null 렌더·네이티브 전용) */}
      <RewardAdCard />

      {/* 🧹 2026-06-22 (대표 — '내 자산 먼저' IA 재배치): 소비자 본인 자산(주문현황+나의 이용내역)을
          역할 진입/수익 CTA 보다 위로. 순서: 딜 잔액(딜 벌기) → 나의 이용내역 → 수익·추천(접힘) → 역할 진입. */}

      {/* v4 주문 현황 */}
      {/* 🎟️ 2026-09-02 (대표 "매장 계산대는 셀러 계정이라면 위에 있어야하지 않을까"): 최상단으로.
          손님 앞에서 QR 을 찍는 동작이라 **하루에 가장 많이 누르는 버튼**인데, 그동안 로그아웃·탈퇴
          바로 위(페이지 최하단)에 있어 매번 끝까지 스크롤해야 했다. 셀러 계정에서만 뜬다. */}
      <div className="ur-content-medium px-4 lg:px-8 pt-4">
        {/* 🎟️ 2026-07-06 (대표 — 계산대 스캔을 셀러 대시보드 말고 메인에서): 사업자 유저 '매장 계산대'
            강조 카드. 손님 이용권 QR 스캔 = 매일 수십 번 쓰는 계산대 동선 → 최상단·큰 카드로 노출.
            🎟️ 2026-09-25 (설계 §18 단계 3): 평소엔 "내 가게" 섹션의 브랜드 줄이 이 자리를 대신한다
            (그쪽은 **먼저 그 가게 좌석에 앉히고** 보낸다 — 소각은 되돌릴 수 없다).
            여기 남긴 건 **폴백**이다: 좌석 목록을 못 받았거나(요약 실패) 정지 매장이라 섹션이
            안 뜨는 경우. 그때도 계산대로 가는 길이 사라지면 안 된다. 둘은 상호배타다. */}
        {!!localStorage.getItem('seller_token') && sellerSeats.stores.length === 0 && (
          <button
            type="button"
            onClick={() => navigate('/store/scan')}
            className="w-full flex items-center gap-3 p-4 rounded-2xl bg-gray-900 dark:bg-white active:scale-[0.99] transition-transform"
          >
            <span className="w-11 h-11 rounded-xl bg-white/15 dark:bg-gray-900/10 flex items-center justify-center shrink-0">
              <ScanIcon className="w-6 h-6 text-white dark:text-gray-900" aria-hidden="true" />
            </span>
            <span className="text-left min-w-0">
              <span className="block text-[15px] font-extrabold text-white dark:text-gray-900">{t('userProfile.storeCheckout', { defaultValue: '매장 계산대' })}</span>
              <span className="block text-[12px] text-white/75 dark:text-gray-900/70 mt-1">{t('userProfile.storeCheckoutDesc', { defaultValue: '손님 이용권 QR을 스캔해 바로 사용 처리' })}</span>
            </span>
          </button>
        )}
      </div>

      <OrderStatusBar />

      {/* 🗺️ 2026-07-02 동네 리뷰어 레벨 (카카오맵 리뷰 게이미피케이션) — 자산 흐름 안에서 동기부여 노출 */}
      <ReviewLevelCard />

      {/* v4 쇼핑 InsetGroup — '내가 산 것'(이용권·자산 / 관심 / 주문·배송). 2026-09-28 이름 E. */}
      <ShoppingGroup counts={counts} />
      </>
      )}

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
          className="w-full flex items-center gap-3 px-4 py-3 active:bg-gray-200 dark:active:bg-white/[0.06] text-left"
        >
          <UrShopIcon className="w-[18px] h-[18px] text-gray-500 dark:text-gray-400" aria-hidden="true" />
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-medium text-gray-900 dark:text-white">
              {t('my.affiliateLinkTitle', { defaultValue: '상품 추천 링크' })}
            </span>
            <span className="block text-[12px] text-gray-500 dark:text-white/45 mt-1">
              {t('my.affiliateLinkSub', { defaultValue: '내 링크로 구매하면 딜 적립 — 실적 보기' })}
            </span>
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-gray-400 dark:text-white/30 shrink-0" aria-hidden="true" />
        </button>
        {/* 추천 수익 정산(출금) → /influencer/settlement */}
        <button
          type="button"
          onClick={() => navigate('/influencer/settlement')}
          className="w-full flex items-center gap-3 px-4 py-3 active:bg-gray-200 dark:active:bg-white/[0.06] text-left"
        >
          <ReceiptIcon className="w-[18px] h-[18px] text-gray-500 dark:text-gray-400" aria-hidden="true" />
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-medium text-gray-900 dark:text-white">
              {t('my.settlementTitle', { defaultValue: '추천 수익 정산' })}
            </span>
            <span className="block text-[12px] text-gray-500 dark:text-white/45 mt-1">
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
      {/* 🧱 2026-09-29(안 C): 가로 패딩 없음 — 평면 줄이 자기 `px-4` 를 갖는다.
          여기서 또 주면 이 구역만 16px 들여쓰여 제목 줄이 옆 구역과 안 맞는다(첫 렌더에서 실제로 그랬다). */}
      <div className="ur-content-medium lg:px-4">
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
        {/* 🧹 2026-09-02 (대표 "앱 정보는 맨 밑에 넣어줘"): 버전 표기는 **찾을 수 있으면 되는 정보**라
            설정 그룹을 열어야 보이는 자리가 아니라 페이지 맨 아래(약관·FAQ 옆)로 내렸다. */}
      </SettingsGroup>

      {/* v4 로그아웃 + 계정 전환 + 회원 탈퇴 — 한 묶음, 동일 간격(space-y-2) */}
      <div className="ur-content-medium px-4 lg:px-8 pt-6 space-y-2">
        {/* 🛡️ 2026-05-01: linked seller 가 있으면 셀러 대시보드 전환 버튼 표시.
            이전: BottomNav 가 seller_token 만 보고 자동으로 셀러 UI 표시 → 사용자 혼란.
            이번: 명시 전환만 셀러 모드로. */}

        {/* 🚪 2026-09-28 (대표 확정) — **'내 매장' 버튼을 없앴다.** 2026-06-22 에 "소상공인은 풀
            대시보드 대신 앱에서 바로" 로 만든 문인데, 2026-09-25 에 페이지 **맨 위**에 '내 가게'
            섹션이 생기면서 **같은 일을 하는 화면이 둘**이 됐다(`/my-store` 는 297줄짜리 별도 페이지에
            타일 여섯을 자기 손으로 다시 그린다 — 도구가 하나 늘면 두 곳을 고쳐야 하고, 반드시 한쪽을
            잊는다). 게다가 이 버튼은 **로그아웃 바로 위**에 있어서, 하루에 가장 많이 쓰는 도구가
            페이지 맨 끝까지 스크롤해야 나왔다.
            ⚠️ 라우트 `/my-store` 는 **남긴다** — 이미 나간 링크·북마크가 있다. 페이지 삭제는 별건. */}
        {/* 🎨 2026-09-28 (대표 *"디자인 및 UI 퀄리티가 너무 허술해"*) — **검정 면을 내렸다.**
            이 버튼은 화면에서 **가장 무거운 요소**였다(유일한 검정 면). 그런데 하는 일은 *다른 화면으로
            나가기*이고, 09-25 §14 "하는 것도 마이에서" 이후 판매 도구는 이미 이 페이지 맨 위에 있다 —
            즉 화면이 "여기서 나가라" 고 가장 크게 말하고 있었다.
            표면 규칙 ②(*"강조색 하나, 자리 셋 — 밴드 · 주 행동 **글자** · 강조 단어"*)에도 어긋났다:
            파란 면(사용처리)과 검정 면이 같은 화면에서 주 행동을 다퉜다.
            ⇒ 흰 판 + **브랜드 글자**로. 무게 순서가 서고(사용처리 면 › 전환 글자 › 로그아웃 회색 ›
              탈퇴 링크), 찾기는 그대로 쉽다. 2026-08-30 에 회원 탈퇴를 격하한 것과 같은 판단이다. */}
        {!!localStorage.getItem('seller_token') && (
          <button
            type="button"
            onClick={() => {
              localStorage.setItem('active_role', 'seller')
              window.location.href = '/seller'
            }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-surface shadow-lift text-[13px] font-bold text-brand-text active:opacity-70 transition-opacity"
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
          className="ur-btn ur-btn-lg ur-btn-block bg-surface text-gray-900 dark:text-white/75"
        >
          <LogOutIcon className="w-4 h-4" aria-hidden="true" />
          {t('userProfile.logout')}
        </button>
        {/* 🛡️ 회원 탈퇴 — 파괴적 동작이다.
            🩸 2026-08-30: 그런데 **빨강 아웃라인 박스**라서 바로 위 로그아웃(회색)보다
               시각적으로 **더 강했다.** 화면이 "탈퇴를 누르라" 고 말하고 있던 셈이다 —
               파괴적 동작은 눈에 띄면 안 되고, 찾을 수는 있어야 한다.
            ⇒ 조용한 텍스트 링크로 격하. 라우트·경고 화면(/account/delete-warning)은 그대로다. */}
        <DeleteAccountLink />
      </div>

      </div>{/* /오른쪽 열 — 손님 */}
      </div>{/* /ur-account-cols */}

      {/* 🧹 2026-06-22 (대표 — 도움말 비중 축소): 도움말/약관을 최하단 footer 로.
            볼드 헤더+카드 InsetGroup → 점 구분 muted 텍스트 링크(항목/경로 불변). */}
      <div className="ur-content-medium px-4 lg:px-8 pb-10 pt-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {[
            { label: t('userProfile.kakaoConsult', { defaultValue: '카카오톡 상담' }), emphasize: true, action: () => window.open('http://pf.kakao.com/_AITdn/chat', '_blank', 'noopener,noreferrer') },
            { label: t('userProfile.faq'), path: '/faq' },
            { label: t('userProfile.terms'), path: '/terms' },
            { label: t('userProfile.privacy'), path: '/privacy' },
            // 🛡️ 2026-07-02: '배송정책' 라벨이 /refund(환불·반품 정책)로 리다이렉트돼 라벨-도착지 불일치 — 정합.
            { label: t('userProfile.refundPolicy', { defaultValue: '환불·반품 정책' }), path: '/refund' },
          ].map((item, i) => (
            <span key={item.label} className="flex items-center gap-3">
              {i > 0 && <span className="text-[12px] text-gray-300 dark:text-white/15" aria-hidden="true">·</span>}
              <button
                type="button"
                onClick={() => (item as any).action ? (item as any).action() : item.path && navigate(item.path)}
                className={`text-[12px] ${(item as any).emphasize ? 'font-medium text-gray-600 dark:text-white/55' : 'text-gray-500 dark:text-white/40'} active:text-gray-800 dark:active:text-white/75`}
              >
                {item.label}
              </button>
            </span>
          ))}
        </div>
        <p className="text-[12px] text-gray-400 dark:text-white/30 mt-2">{t('userProfile.kakaoConsultSub', { defaultValue: '평일 10:00~18:00 응대' })}</p>
        {/* 📱 앱 정보 — 페이지 맨 밑(대표 2026-09-02). 설정 그룹에서 이동, 컴포넌트 자체는 불변. */}
        <AppVersionSection />
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
