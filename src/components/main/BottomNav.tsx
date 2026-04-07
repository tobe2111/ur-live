import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Play, ShoppingCart, User, Plus, X, Radio, LayoutDashboard, UserPlus, LogIn } from 'lucide-react'

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [profileImage, setProfileImage] = useState<string | null>(null)

  useEffect(() => {
    const loadProfile = () => {
      setProfileImage(localStorage.getItem('user_profile_image'))
    }
    loadProfile()
    window.addEventListener('storage', loadProfile)
    return () => window.removeEventListener('storage', loadProfile)
  }, [])

  const userType = localStorage.getItem('user_type')
  const isLoggedIn = !!localStorage.getItem('access_token')
  const isSeller = userType === 'seller'

  const leftItems = [
    { icon: Home, label: '홈', path: '/' },
    { icon: Play, label: '쇼츠', path: '/live' },
  ]

  const rightItems = [
    { icon: ShoppingCart, label: '쇼핑', path: '/browse' },
    { icon: User, label: '마이', path: '/user/profile' },
  ]

  const isActivePath = (path: string) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path))

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
            onError={() => setProfileImage(null)}
          />
        ) : (
          <Icon
            size={22}
            className={active ? 'text-white' : 'text-gray-500'}
            strokeWidth={active ? 2 : 1.5}
          />
        )}
        <span className={`text-[9px] mt-0.5 ${
          active ? 'font-bold text-white' : 'text-gray-500'
        }`}>
          {label}
        </span>
      </button>
    )
  }

  return (
    <>
      {/* Nav bar */}
      <div className="fixed bottom-0 left-0 right-0 z-[9999] pointer-events-none">
        <div className="max-w-screen-sm mx-auto pointer-events-auto">
          <nav
            className="bg-[#020202] border-t border-[#0A0A0A]"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="flex items-center h-14">
              {leftItems.map(renderItem)}

              {/* Center + button */}
              <div className="flex-1 flex items-center justify-center">
                <button
                  onClick={() => setSheetOpen(true)}
                  className="relative -mt-5 flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-pink-500 shadow-lg shadow-red-500/30 active:scale-90 transition-transform"
                  aria-label="라이브 시작"
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

          {/* Sheet */}
          <div className="fixed inset-x-0 bottom-0 z-[10001] animate-sheet-up">
            <div className="max-w-screen-sm mx-auto">
              <div
                className="bg-[#121212] rounded-t-3xl"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
              >
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-2">
                  <div className="w-10 h-1 bg-gray-600 rounded-full" />
                </div>

                <div className="px-6 pb-6">
                  {/* Close */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">
                      {isSeller ? '라이브 방송' : !isLoggedIn ? '로그인이 필요합니다' : '셀러로 시작하기'}
                    </h3>
                    <button onClick={() => setSheetOpen(false)} className="p-1 rounded-full hover:bg-white/10">
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>

                  {/* Seller: live + dashboard */}
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
                          <p className="text-[15px] font-bold text-white">라이브 방송 시작하기</p>
                          <p className="text-[12px] text-white/70 mt-0.5">YouTube 연동으로 바로 방송 시작</p>
                        </div>
                      </button>

                      <button
                        onClick={() => { setSheetOpen(false); navigate('/seller') }}
                        className="w-full flex items-center gap-4 p-4 bg-[#1A1A1A] rounded-2xl active:scale-[0.98] transition-transform"
                      >
                        <div className="w-12 h-12 rounded-xl bg-[#333] flex items-center justify-center">
                          <LayoutDashboard className="w-6 h-6 text-gray-600" />
                        </div>
                        <div className="text-left">
                          <p className="text-[15px] font-bold text-white">셀러 대시보드</p>
                          <p className="text-[12px] text-gray-500 mt-0.5">상품 관리, 주문, 매출 확인</p>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Logged in but not seller */}
                  {isLoggedIn && !isSeller && (
                    <div className="space-y-4">
                      <div className="text-center py-2">
                        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-red-100 to-pink-100 flex items-center justify-center">
                          <Radio className="w-7 h-7 text-red-500" />
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          셀러가 되어 라이브 방송을 시작하세요!<br />
                          <span className="text-gray-400">누구나 무료로 셀러 등록이 가능합니다</span>
                        </p>
                      </div>

                      <button
                        onClick={() => { setSheetOpen(false); navigate('/seller/register') }}
                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold text-[15px] rounded-2xl active:scale-[0.98] transition-transform"
                      >
                        <UserPlus className="w-5 h-5" />
                        셀러 등록하기
                      </button>

                      <p className="text-center text-[11px] text-gray-400">
                        이미 셀러 계정이 있나요?{' '}
                        <button
                          onClick={() => { setSheetOpen(false); navigate('/seller/login') }}
                          className="text-blue-500 font-medium"
                        >
                          셀러 로그인
                        </button>
                      </p>
                    </div>
                  )}

                  {/* Not logged in */}
                  {!isLoggedIn && (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-400 mb-2">
                        라이브 방송을 시작하려면 먼저 로그인해주세요.
                      </p>

                      <button
                        onClick={() => { setSheetOpen(false); navigate('/login') }}
                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-yellow-300 text-gray-900 font-bold text-[15px] rounded-2xl active:scale-[0.98] transition-transform"
                      >
                        카카오로 시작하기
                      </button>

                      <button
                        onClick={() => { setSheetOpen(false); navigate('/seller/login') }}
                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-gray-100 text-gray-700 font-bold text-[15px] rounded-2xl active:scale-[0.98] transition-transform"
                      >
                        <LogIn className="w-5 h-5" />
                        셀러 로그인
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
