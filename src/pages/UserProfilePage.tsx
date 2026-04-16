/**
 * UserProfilePage - 마이페이지
 * 세션 쿠키 기반 인증 (Firebase 불필요)
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { MenuList } from '@/components/my-page/menu-list'
import { logout as authLogout, getUserProfileImage } from '@/utils/auth'

function TeamPointsCard() {
  const navigate = useNavigate()
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/points/balance')
      .then(r => { if (r.data.success) setBalance(r.data.data.balance) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="px-5 py-3">
      <div
        onClick={() => navigate('/points/charge')}
        className="flex items-center justify-between bg-[#121212] rounded-2xl px-5 py-4 cursor-pointer active:scale-[0.98] transition-all border border-[#2A2A2A]"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎁</span>
          <div>
            <p className="text-[11px] text-gray-500 font-medium">내 딜 잔액</p>
            <p className="text-lg font-bold text-white">
              {loading ? <span className="inline-block w-16 h-5 bg-gray-700 rounded animate-pulse" /> : `${balance.toLocaleString()}딜`}
            </p>
          </div>
        </div>
        <button className="px-3 py-1.5 text-xs font-bold text-pink-400 bg-pink-500/10 rounded-lg border border-pink-500/30">
          충전
        </button>
      </div>
    </div>
  )
}

export default function UserProfilePage() {
  const navigate = useNavigate()
  const isLoggedIn = localStorage.getItem('user_type') === 'user' && localStorage.getItem('user_id')
  const userName = localStorage.getItem('user_name') || '사용자'
  const profileImage = localStorage.getItem('user_profile_image') || getUserProfileImage()

  useEffect(() => { document.title = '마이페이지 - 유어딜' }, [])

  if (!isLoggedIn) {
    localStorage.setItem('loginReturnUrl', '/user/profile')
    navigate('/login', { replace: true })
    return (
      <div className="min-h-screen bg-[#020202] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    )
  }

  const handleLogout = () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      authLogout('user')
      localStorage.removeItem('session_login')
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="min-h-screen bg-[#020202]">
      {/* 헤더 */}
      <div className="sticky top-0 z-50 bg-[#020202]/90 backdrop-blur border-b border-[#1A1A1A]">
        <div className="flex items-center justify-between px-5 py-3">
          <button onClick={() => navigate(-1)} className="text-white">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-white font-bold text-[15px]">마이페이지</h1>
          <div className="w-6" />
        </div>
      </div>

      {/* 프로필 */}
      <div className="px-5 py-5">
        <div className="flex items-center gap-4">
          <img
            src={profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=random&size=56`}
            alt="" className="w-14 h-14 rounded-full object-cover"
          />
          <div>
            <p className="text-white text-lg font-bold">{userName}</p>
            <p className="text-gray-500 text-xs">{localStorage.getItem('user_email') || ''}</p>
          </div>
        </div>
      </div>

      {/* 딜 포인트 */}
      <TeamPointsCard />

      {/* 바로가기 */}
      <div className="px-5 py-3 flex gap-2">
        <button onClick={() => navigate('/my-orders')} className="flex-1 py-3 bg-[#121212] border border-[#2A2A2A] rounded-xl text-xs font-medium text-gray-300 text-center">📦 주문내역</button>
        <button onClick={() => navigate('/wishlist')} className="flex-1 py-3 bg-[#121212] border border-[#2A2A2A] rounded-xl text-xs font-medium text-gray-300 text-center">❤️ 위시리스트</button>
        <button onClick={() => navigate('/user/affiliate')} className="flex-1 py-3 bg-[#121212] border border-[#2A2A2A] rounded-xl text-xs font-medium text-gray-300 text-center">💰 추천수익</button>
      </div>


      {/* 메뉴 */}
      <MenuList />

      {/* 로그아웃 */}
      <div className="px-5 py-6">
        <button onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#2A2A2A] bg-[#121212] py-3.5 text-sm font-medium text-gray-400">
          <LogOut className="w-4 h-4" /> 로그아웃
        </button>
      </div>
    </div>
  )
}
