import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, ShoppingBag, User, Plus, X, Radio, LayoutDashboard, UserPlus, LogIn, Utensils } from 'lucide-react'

// 카카오 유저가 같은 계정을 셀러로 확장 — 비즈니스 정보 입력 페이지로 안내.
function SellerUpgradePanel({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // 🛡️ 2026-05-01: 이미 셀러로 등록된 user 면 "전환" UX, 아니면 "등록" UX.
  const hasSellerToken = !!localStorage.getItem('seller_token')
  const hasAgencyToken = !!localStorage.getItem('agency_token')

  if (hasSellerToken) {
    return (
      <div className="space-y-4">
        <div className="text-center py-2">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-red-100 to-pink-100 flex items-center justify-center">
            <Radio className="w-7 h-7 text-red-500" />
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {t('bottomNav.sellerHasToken', { defaultValue: '등록된 셀러 계정이 있습니다' })}<br />
            <span className="text-gray-500 text-xs">{t('bottomNav.sellerHasTokenSub', { defaultValue: '셀러 대시보드로 전환합니다' })}</span>
          </p>
        </div>
        <button
          onClick={() => {
            localStorage.setItem('active_role', 'seller')
            onDone()
            window.location.href = '/seller'
          }}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold text-[15px] rounded-2xl active:scale-[0.98] transition-transform"
        >
          <Radio className="w-5 h-5" />
          {t('bottomNav.goToSellerDashboard', { defaultValue: '셀러 대시보드로 전환' })}
        </button>
        {!hasAgencyToken && (
          <button
            onClick={() => { onDone(); navigate('/agency/register/business') }}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-white/10 text-gray-700 dark:text-gray-300 font-semibold text-[13px] rounded-xl"
          >
            {t('bottomNav.alsoRegisterAgency', { defaultValue: '에이전시로도 등록하기 →' })}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-center py-2">
        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-red-100 to-pink-100 flex items-center justify-center">
          <Radio className="w-7 h-7 text-red-500" />
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          {t('bottomNav.sellerNoToken', { defaultValue: '지금 카카오 계정에 셀러 권한을 추가합니다' })}<br />
          <span className="text-gray-500 text-xs">{t('bottomNav.sellerNoTokenSub', { defaultValue: '별도 가입·로그인 없이 한 번에' })}</span>
        </p>
      </div>

      <button
        onClick={() => { onDone(); navigate('/seller/register/business?from=kakao') }}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold text-[15px] rounded-2xl active:scale-[0.98] transition-transform"
      >
        <UserPlus className="w-5 h-5" />
        {t('bottomNav.startAsSeller', { defaultValue: '셀러로 시작하기' })}
      </button>

      {!hasAgencyToken && (
        <button
          onClick={() => { onDone(); navigate('/agency/register/business') }}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-white/10 text-gray-700 dark:text-gray-300 font-semibold text-[13px] rounded-xl"
        >
          {t('bottomNav.registerAsAgency', { defaultValue: '에이전시로 등록하기 →' })}
        </button>
      )}
    </div>
  )
}

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [profileImage, setProfileImage] = useState<string | null>(null)

  useEffect(() => {
    setProfileImage(localStorage.getItem('user_profile_image'))
  }, [location.pathname])

  // 🛡️ 2026-05-01: ACCESS 와 DISPLAY 분리 (사용자 신고 — 사업자 자동 표시 버그).
  //   - ACCESS (라우트/API): seller_token / agency_token 존재로 판단 (CLAUDE.md duality 의도)
  //   - DISPLAY (BottomNav UI): active_role 로 판단 → 사용자가 명시 전환해야 셀러 UI 표시
  //   기본 active_role='user' — Kakao 콜백에서 set. 사용자가 마이페이지에서 '셀러
  //   대시보드로 전환' 클릭 시 active_role='seller' 로 변경.
  const userType = localStorage.getItem('user_type')
  const activeRole = localStorage.getItem('active_role') || userType || 'user'
  const hasSessionLogin = !!localStorage.getItem('session_login')
  const hasAccessToken = !!localStorage.getItem('access_token')
  const hasSellerToken = !!localStorage.getItem('seller_token')
  const hasAgencyToken = !!localStorage.getItem('agency_token')
  const isLoggedIn = hasAccessToken || hasSessionLogin || hasSellerToken || hasAgencyToken
  // DISPLAY 는 active_role 로만 판단 — seller_token 자동 발급 이 user UI 를 변형하지 않음
  const isSeller = activeRole === 'seller'
  const isAgency = activeRole === 'agency'

  const leftItems = [
    { icon: Home, label: t('nav.home', { defaultValue: '홈' }), path: '/' },
    { icon: Radio, label: t('nav.live', { defaultValue: '라이브' }), path: '/live' },
  ]

  const rightItems = [
    { icon: ShoppingBag, label: t('nav.shop', { defaultValue: '쇼핑' }), path: '/browse' },
    { icon: User, label: t('nav.my', { defaultValue: '마이' }), path: '/user/profile' },
  ]

  const isActivePath = (path: string) => {
    const cur = location.pathname
    if (cur === path) return true
    if (path !== '/' && cur.startsWith(path)) return true
    // v37 FIX: 마이페이지 범주에 /my-* 및 관련 계정/주문 경로 포함
    if (path === '/user/profile' && /^\/(my-orders|my-coupons|my-reviews|my-vouchers|my-group-buys|wishlist|interest-list|account|mypage)(\/|$)/.test(cur)) {
      return true
    }
    return false
  }

  const renderItem = ({ icon: Icon, label, path }: typeof leftItems[0]) => {
    const active = isActivePath(path)
    const isMyTab = path === '/user/profile'

    return (
      <button
        key={label}
        onClick={() => navigate(path)}
        className="flex-1 flex flex-col items-center justify-center h-full"
        aria-label={label}
      >
        {isMyTab && profileImage ? (
          <img
            src={profileImage}
            alt="Profile"
            className={`h-6 w-6 rounded-full object-cover transition-all ${
              active ? 'ring-2 ring-white ring-offset-1 ring-offset-[#020202]' : 'opacity-60'
            }`}
            loading="lazy"
            decoding="async"
            onError={() => setProfileImage(null)}
          />
        ) : (
          <Icon
            size={22}
            className={active ? 'text-gray-900 dark:text-white' : 'text-gray-500'}
            strokeWidth={active ? 2 : 1.5}
          />
        )}
        <span className={`text-[9px] mt-0.5 ${
          active ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-500'
        }`}>
          {label}
        </span>
      </button>
    )
  }

  return (
    <>
      {/* Nav bar — 모바일 + 큰 폰 + 태블릿 표시. PC (lg+) 는 DesktopTopNav 가 대신 표시. */}
      {/* 🛡️ 2026-05-16 (반응형 영구 fix): 화면 폭에 따라 inner nav 자연스럽게 확장.
         - 모바일 (≤640px): max-w-[430px] (한 손 조작 친화)
         - sm (640~768px): max-w-[540px] (큰 폰 가로모드)
         - md (768~1024px): max-w-[640px] (작은 태블릿)
         - lg+ (≥1024px): hidden, DesktopTopNav 사용
         배경 + border 는 항상 화면 전체 폭. */}
      <div className="fixed bottom-0 left-0 right-0 z-[9999] pointer-events-none hide-on-keyboard lg:hidden">
        <div className="pointer-events-auto bg-white dark:bg-[#020202] border-t border-[#0A0A0A]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <nav className="max-w-[430px] sm:max-w-[540px] md:max-w-[640px] mx-auto px-2 sm:px-4">
            <div className="flex items-center h-14">
              {leftItems.map(renderItem)}

              {/* Center + button */}
              <div className="flex-1 flex items-center justify-center">
                <button
                  onClick={() => setSheetOpen(true)}
                  className="relative -mt-5 flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-pink-500 shadow-lg shadow-red-500/30 active:scale-90 transition-transform"
                  aria-label={t('bottomNav.liveStartAria', { defaultValue: '라이브 시작' })}
                >
                  <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
                </button>
              </div>

              {rightItems.map(renderItem)}
            </div>
          </nav>
        </div>
      </div>

      {/* Bottom Sheet */}
      {sheetOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[10000] bg-black/50 animate-overlay-in"
            onClick={() => setSheetOpen(false)}
          />

          {/* Sheet — 🛡️ 2026-05-14: max-h-[85dvh] + 태블릿 max-w-[540px]. */}
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] sm:max-w-[540px] z-[10001] animate-sheet-up max-h-[85dvh] overflow-y-auto">
            <div>
              <div
                className="bg-gray-50 dark:bg-[#121212] rounded-t-3xl"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
              >
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-2">
                  <div className="w-10 h-1 bg-gray-600 rounded-full" />
                </div>

                <div className="px-6 pb-6">
                  {/* Close */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {/* 🛡️ 2026-05-01: linked seller 있는 user 는 "전환" 으로 안내 (등록 X) */}
                      {isSeller
                        ? t('bottomNav.sheetTitleLive', { defaultValue: '라이브 방송' })
                        : isAgency
                        ? t('bottomNav.sheetTitleAgency', { defaultValue: '에이전시' })
                        : !isLoggedIn
                        ? t('bottomNav.sheetTitleLoginRequired', { defaultValue: '로그인이 필요합니다' })
                        : hasSellerToken
                        ? t('bottomNav.sheetTitleSellerDashboard', { defaultValue: '셀러 대시보드' })
                        : t('bottomNav.sheetTitleStartSeller', { defaultValue: '셀러로 시작하기' })}
                    </h3>
                    <button onClick={() => setSheetOpen(false)} aria-label={t('bottomNav.closeSheetAria', { defaultValue: '시트 닫기' })} className="p-1 rounded-full hover:bg-white/10">
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>

                  {/* Seller: live + 식사권 + dashboard (+ agency 겸직이면 아래 블록도) */}
                  {isSeller && (
                    <div className="space-y-3">
                      <button
                        onClick={() => { setSheetOpen(false); navigate('/seller/live-broadcast') }}
                        className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-red-500 to-pink-500 rounded-2xl active:scale-[0.98] transition-transform"
                      >
                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                          <Radio className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-left">
                          <p className="text-[15px] font-bold text-white">{t('bottomNav.liveBroadcastStart', { defaultValue: '라이브 방송 시작하기' })}</p>
                          <p className="text-[12px] text-white/70 mt-0.5">{t('bottomNav.liveBroadcastDesc', { defaultValue: 'YouTube 연동으로 바로 방송 시작' })}</p>
                        </div>
                      </button>

                      <button
                        onClick={() => { setSheetOpen(false); navigate('/seller/meal-voucher/new') }}
                        className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl active:scale-[0.98] transition-transform"
                      >
                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                          <Utensils className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-left">
                          <p className="text-[15px] font-bold text-white">{t('bottomNav.mealVoucherRegister', { defaultValue: '식사권 상품 등록' })}</p>
                          <p className="text-[12px] text-white/80 mt-0.5">{t('bottomNav.mealVoucherDesc', { defaultValue: '맛집 식사권을 공구 상품으로 올리기' })}</p>
                        </div>
                      </button>

                      <button
                        onClick={() => { setSheetOpen(false); navigate('/seller') }}
                        className="w-full flex items-center gap-4 p-4 bg-gray-100 dark:bg-[#1A1A1A] rounded-2xl active:scale-[0.98] transition-transform"
                      >
                        <div className="w-12 h-12 rounded-xl bg-[#333] flex items-center justify-center">
                          <LayoutDashboard className="w-6 h-6 text-gray-600" />
                        </div>
                        <div className="text-left">
                          <p className="text-[15px] font-bold text-gray-900 dark:text-white">{t('bottomNav.sellerDashboard', { defaultValue: '셀러 대시보드' })}</p>
                          <p className="text-[12px] text-gray-500 mt-0.5">{t('bottomNav.sellerDashboardDesc', { defaultValue: '상품 관리, 주문, 매출 확인' })}</p>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* 에이전시 권한도 있으면 (셀러 + 에이전시 겸직) 별도 링크 */}
                  {isSeller && isAgency && (
                    <button
                      onClick={() => { setSheetOpen(false); navigate('/agency') }}
                      className="w-full mt-2 flex items-center gap-3 p-3 bg-gray-100 dark:bg-[#1A1A1A] hover:bg-[#222] rounded-xl active:scale-[0.98] transition-transform"
                    >
                      <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <span className="text-lg">💼</span>
                      </div>
                      <div className="text-left flex-1">
                        <p className="text-[13px] font-bold text-gray-900 dark:text-white">{t('bottomNav.agencyDashboard', { defaultValue: '에이전시 대시보드' })}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{t('bottomNav.agencyDashboardDesc', { defaultValue: '소속 셀러 관리' })}</p>
                      </div>
                    </button>
                  )}

                  {/* 에이전시만 있고 셀러 아님 */}
                  {!isSeller && isAgency && (
                    <div className="space-y-3">
                      <button
                        onClick={() => { setSheetOpen(false); navigate('/agency') }}
                        className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-2xl active:scale-[0.98] transition-transform"
                      >
                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                          <span className="text-xl">💼</span>
                        </div>
                        <div className="text-left">
                          <p className="text-[15px] font-bold text-gray-900 dark:text-white">{t('bottomNav.agencyDashboard', { defaultValue: '에이전시 대시보드' })}</p>
                          <p className="text-[12px] text-gray-900 dark:text-white/70 mt-0.5">{t('bottomNav.agencyDashboardDesc2', { defaultValue: '소속 셀러 관리, 계약, 정산' })}</p>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Logged in but no seller/agency role — 권한 추가 유도 */}
                  {isLoggedIn && !isSeller && !isAgency && (
                    <SellerUpgradePanel
                      onDone={() => { setSheetOpen(false) }}
                    />
                  )}

                  {/* Not logged in — 셀러 전용 */}
                  {!isLoggedIn && (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                        {t('bottomNav.loginDesc', { defaultValue: '셀러 계정으로 로그인하세요.' })}
                      </p>

                      <button
                        onClick={() => { setSheetOpen(false); navigate('/seller/login') }}
                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold text-[15px] rounded-2xl active:scale-[0.98] transition-transform"
                      >
                        <LogIn className="w-5 h-5" />
                        {t('bottomNav.sellerLogin', { defaultValue: '셀러 로그인' })}
                      </button>

                      <button
                        onClick={() => { setSheetOpen(false); navigate('/seller/register') }}
                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-gray-100 dark:bg-[#1A1A1A] text-gray-900 dark:text-white font-bold text-[15px] rounded-2xl active:scale-[0.98] transition-transform"
                      >
                        <UserPlus className="w-5 h-5" />
                        {t('bottomNav.sellerSignup', { defaultValue: '셀러 회원가입' })}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
