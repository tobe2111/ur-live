import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Home, ShoppingCart, User, Plus, X, Radio, LayoutDashboard,
  UserPlus, LogIn, Gift, Utensils, Users, Zap, MapPin,
  Calendar, Package, Building2, Share2,
} from 'lucide-react'
import { toast } from '@/hooks/useToast'

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [profileImage, setProfileImage] = useState<string | null>(null)

  useEffect(() => {
    setProfileImage(localStorage.getItem('user_profile_image'))
  }, [location.pathname])

  const userType = localStorage.getItem('user_type')
  const hasSessionLogin = !!localStorage.getItem('session_login')
  const hasAccessToken = !!localStorage.getItem('access_token')
  const hasSellerToken = !!localStorage.getItem('seller_token')
  const hasAgencyToken = !!localStorage.getItem('agency_token')
  const isLoggedIn = hasAccessToken || hasSessionLogin || hasSellerToken || hasAgencyToken
  const isSeller = userType === 'seller' || hasSellerToken
  const isAgency = userType === 'agency' || hasAgencyToken

  const close = () => setSheetOpen(false)
  const go = (path: string) => { close(); navigate(path) }

  function copyAgencyInvite() {
    const agencyId = localStorage.getItem('agency_id')
    if (!agencyId) { toast.error('에이전시 정보를 찾을 수 없습니다'); return }
    const url = `https://live.ur-team.com/seller/register?agency=${agencyId}`
    navigator.clipboard.writeText(url)
      .then(() => { toast.success('셀러 초대 링크가 복사되었습니다!'); close() })
      .catch(() => toast.error('링크 복사에 실패했습니다'))
  }

  const isActivePath = (path: string) => {
    const cur = location.pathname
    if (cur === path) return true
    if (path !== '/' && cur.startsWith(path)) return true
    if (
      path === '/user/profile' &&
      /^\/(my-orders|my-coupons|my-reviews|my-vouchers|my-group-buys|wishlist|interest-list|account|mypage)(\/|$)/.test(cur)
    ) return true
    return false
  }

  return (
    <>
      {/* ── 네비게이션 바: 홈 / 공구 / + / 쇼핑 / 마이 ── */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-[9999] pointer-events-none hide-on-keyboard">
        <div className="pointer-events-auto">
          <nav
            className="bg-[#020202] border-t border-[#0A0A0A]"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="flex items-center h-14">
              <NavBtn icon={Home} label="홈" active={isActivePath('/')} onClick={() => navigate('/')} />
              <NavBtn icon={Gift} label="공구" active={isActivePath('/group-buy')} onClick={() => navigate('/group-buy')} />

              {/* 중앙 + 버튼 */}
              <div className="flex-1 flex items-center justify-center">
                <button
                  onClick={() => setSheetOpen(true)}
                  className="relative -mt-5 flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-pink-500 shadow-lg shadow-red-500/30 active:scale-90 transition-transform"
                  aria-label="액션 메뉴"
                >
                  <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
                </button>
              </div>

              <NavBtn icon={ShoppingCart} label="쇼핑" active={isActivePath('/browse')} onClick={() => navigate('/browse')} />
              <NavBtn
                icon={User}
                label="마이"
                active={isActivePath('/user/profile')}
                onClick={() => navigate('/user/profile')}
                profileImage={profileImage}
                onImageError={() => setProfileImage(null)}
              />
            </div>
          </nav>
        </div>
      </div>

      {/* ── 바텀 시트 ── */}
      {sheetOpen && (
        <>
          <div
            className="fixed inset-0 z-[10000] bg-black/50 animate-overlay-in"
            onClick={close}
          />
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-[10001] animate-sheet-up">
            <div
              className="bg-[#121212] rounded-t-3xl"
              style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
            >
              {/* 핸들 */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-gray-600 rounded-full" />
              </div>

              <div className="px-5 pb-5 space-y-4">
                {/* 헤더 */}
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white">무엇을 해볼까요?</h3>
                  <button onClick={close} aria-label="닫기" className="p-1 rounded-full hover:bg-white/10">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                {/* ── 비로그인 ── */}
                {!isLoggedIn && (
                  <div className="space-y-3">
                    <button
                      onClick={() => { close(); window.location.href = '/auth/kakao/start?intent=user&redirect=/' }}
                      className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#FEE500] hover:bg-[#FDD800] text-[#3C1E1E] font-bold text-[15px] rounded-2xl active:scale-[0.98] transition-transform"
                    >
                      <span className="text-lg">💬</span>
                      카카오로 시작하기
                    </button>
                    <div className="flex border-t border-white/5 pt-1 gap-1">
                      <TertiaryLink icon={LogIn} label="셀러 로그인" onClick={() => go('/seller/login')} />
                      <div className="w-px bg-white/10" />
                      <TertiaryLink icon={Building2} label="에이전시 로그인" onClick={() => go('/agency/login')} />
                    </div>
                  </div>
                )}

                {/* ── 셀러 섹션 ── */}
                {isSeller && (
                  <div className="space-y-2.5">
                    {isAgency && <Divider label="셀러 활동" />}

                    {/* 라이브 방송 — primary */}
                    <button
                      onClick={() => go('/seller/live-broadcast')}
                      className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-red-500 to-pink-500 rounded-2xl active:scale-[0.98] transition-transform"
                    >
                      <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        <Radio className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-left">
                        <p className="text-[15px] font-bold text-white">라이브 방송 시작</p>
                        <p className="text-[12px] text-white/70 mt-0.5">YouTube 연동으로 바로 방송 시작</p>
                      </div>
                    </button>

                    {/* 3열 그리드 */}
                    <div className="grid grid-cols-3 gap-2">
                      <ActionTile icon={Calendar} label="방송 예약" color="bg-orange-500/70" onClick={() => go('/seller/streams/new')} />
                      <ActionTile icon={Utensils} label="식사권 등록" color="bg-amber-500/70" onClick={() => go('/seller/meal-voucher/new')} />
                      <ActionTile icon={Package} label="상품 등록" color="bg-blue-500/70" onClick={() => go('/seller/products/new')} />
                    </div>

                    {/* 대시보드 링크 */}
                    <button
                      onClick={() => go('/seller')}
                      className="w-full flex items-center gap-3 p-3 bg-[#1A1A1A] hover:bg-[#222] rounded-xl active:scale-[0.98] transition-transform"
                    >
                      <div className="w-9 h-9 rounded-lg bg-[#2A2A2A] flex items-center justify-center">
                        <LayoutDashboard className="w-4 h-4 text-gray-400" />
                      </div>
                      <span className="text-[13px] font-semibold text-gray-300">셀러 대시보드</span>
                    </button>

                    {/* 에이전시 없으면 전환 링크 */}
                    {!isAgency && (
                      <div className="flex justify-center pt-0.5">
                        <TertiaryLink icon={Building2} label="에이전시 만들기" onClick={() => go('/agency/register/business')} />
                      </div>
                    )}
                  </div>
                )}

                {/* ── 에이전시 섹션 ── */}
                {isAgency && (
                  <div className="space-y-2.5">
                    {isSeller && <Divider label="에이전시" />}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => go('/agency')}
                        className="flex items-center gap-3 p-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl active:scale-[0.98] transition-transform"
                      >
                        <Building2 className="w-5 h-5 text-white shrink-0" />
                        <div className="text-left min-w-0">
                          <p className="text-[13px] font-bold text-white">대시보드</p>
                          <p className="text-[10px] text-white/60 mt-0.5 truncate">셀러 관리·정산</p>
                        </div>
                      </button>
                      <button
                        onClick={copyAgencyInvite}
                        className="flex items-center gap-3 p-3.5 bg-[#1A1A1A] hover:bg-[#222] rounded-2xl active:scale-[0.98] transition-transform"
                      >
                        <UserPlus className="w-5 h-5 text-purple-400 shrink-0" />
                        <div className="text-left min-w-0">
                          <p className="text-[13px] font-bold text-white">셀러 초대</p>
                          <p className="text-[10px] text-gray-500 mt-0.5 truncate">초대 링크 복사</p>
                        </div>
                      </button>
                    </div>

                    {/* 셀러 없으면 활동 링크 */}
                    {!isSeller && (
                      <button
                        onClick={() => go('/seller/register/business')}
                        className="w-full flex items-center gap-3 p-3 bg-[#1A1A1A] hover:bg-[#222] rounded-xl active:scale-[0.98]"
                      >
                        <div className="w-9 h-9 rounded-lg bg-[#2A2A2A] flex items-center justify-center">
                          <Radio className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="text-left">
                          <p className="text-[13px] font-bold text-white">셀러로 활동하기</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">에이전시 계정에 셀러 권한 추가</p>
                        </div>
                      </button>
                    )}
                  </div>
                )}

                {/* ── 일반 활동 섹션 — 로그인한 모든 유저 ── */}
                {isLoggedIn && (
                  <div className="space-y-2.5">
                    {(isSeller || isAgency) && <Divider label="일반 활동" />}

                    {/* 공구 만들기 + 친구 초대 */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => go('/referral')}
                        className="flex items-center gap-3 p-3.5 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl active:scale-[0.98] transition-transform"
                      >
                        <Users className="w-5 h-5 text-white shrink-0" />
                        <div className="text-left min-w-0">
                          <p className="text-[13px] font-bold text-white">공구 만들기</p>
                          <p className="text-[10px] text-white/60 mt-0.5 truncate">친구랑 함께 더 싸게</p>
                        </div>
                      </button>
                      <button
                        onClick={() => go('/referral')}
                        className="flex items-center gap-3 p-3.5 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl active:scale-[0.98] transition-transform"
                      >
                        <Share2 className="w-5 h-5 text-white shrink-0" />
                        <div className="text-left min-w-0">
                          <p className="text-[13px] font-bold text-white">친구 초대</p>
                          <p className="text-[10px] text-white/60 mt-0.5 truncate">딜 포인트 보상</p>
                        </div>
                      </button>
                    </div>

                    {/* 맛집 추천 + 딜 충전 */}
                    <div className="grid grid-cols-2 gap-2">
                      <ActionTile icon={MapPin} label="맛집 추천" color="bg-amber-500/70" onClick={() => go('/restaurant-map')} />
                      <ActionTile icon={Zap} label="딜 충전" color="bg-yellow-500/70" onClick={() => go('/points/charge')} />
                    </div>

                    {/* 셀러/에이전시 아닌 유저만 전환 링크 표시 */}
                    {!isSeller && !isAgency && (
                      <div className="flex border-t border-white/5 pt-1.5 gap-1">
                        <TertiaryLink icon={Radio} label="셀러 되기" onClick={() => go('/seller/register/business')} />
                        <div className="w-px bg-white/10" />
                        <TertiaryLink icon={Building2} label="에이전시 만들기" onClick={() => go('/agency/register/business')} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

// ── 서브 컴포넌트 ──────────────────────────────────

function NavBtn({
  icon: Icon, label, active, onClick, profileImage, onImageError,
}: {
  icon: React.ElementType; label: string; active: boolean; onClick: () => void
  profileImage?: string | null; onImageError?: () => void
}) {
  return (
    <button onClick={onClick} className="flex-1 flex flex-col items-center justify-center h-full" aria-label={label}>
      {label === '마이' && profileImage ? (
        <img
          src={profileImage}
          alt=""
          className={`h-6 w-6 rounded-full object-cover ${active ? 'ring-2 ring-white ring-offset-1 ring-offset-[#020202]' : 'opacity-60'}`}
          onError={onImageError}
        />
      ) : (
        <Icon size={22} className={active ? 'text-white' : 'text-gray-500'} strokeWidth={active ? 2 : 1.5} />
      )}
      <span className={`text-[9px] mt-0.5 ${active ? 'font-bold text-white' : 'text-gray-500'}`}>{label}</span>
    </button>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-px flex-1 bg-white/10" />
      <span className="text-[10px] text-gray-600 font-semibold tracking-wider">{label}</span>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  )
}

function ActionTile({ icon: Icon, label, color, onClick }: {
  icon: React.ElementType; label: string; color: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-3 bg-[#1A1A1A] hover:bg-[#222] rounded-xl active:scale-[0.98] transition-transform"
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <span className="text-[11px] text-gray-300 font-semibold">{label}</span>
    </button>
  )
}

function TertiaryLink({ icon: Icon, label, onClick }: {
  icon: React.ElementType; label: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[12px] text-gray-500 hover:text-gray-300 transition-colors"
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  )
}
