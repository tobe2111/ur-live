/**
 * UserProfilePage - 마이페이지
 * 세션 쿠키 기반 인증 (Firebase 불필요)
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Crown, Heart, Users } from 'lucide-react'
import SEO from '@/components/SEO'
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

interface TierInfo {
  tier: 'bronze' | 'silver' | 'gold' | 'diamond'
  current_charged: number
  next_threshold: number
  discount: number
}

const TIER_STYLES: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  bronze: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Bronze', icon: '🥉' },
  silver: { bg: 'bg-gray-200', text: 'text-gray-700', label: 'Silver', icon: '🥈' },
  gold: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Gold', icon: '🥇' },
  diamond: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Diamond', icon: '💎' },
}

function VipTierCard() {
  const [tier, setTier] = useState<TierInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/loyalty/my-tier')
      .then(r => { if (r.data.success) setTier(r.data.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="px-5 py-1.5">
        <div className="bg-[#121212] rounded-2xl px-5 py-4 border border-[#2A2A2A] animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-1/3 mb-2" />
          <div className="h-3 bg-gray-700 rounded w-2/3" />
        </div>
      </div>
    )
  }

  if (!tier) return null

  const style = TIER_STYLES[tier.tier] || TIER_STYLES.bronze
  const progress = tier.next_threshold > 0
    ? Math.min(100, (tier.current_charged / tier.next_threshold) * 100)
    : 100

  return (
    <div className="px-5 py-1.5">
      <div className="bg-[#121212] rounded-2xl px-5 py-4 border border-[#2A2A2A]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-yellow-400" />
            <span className="text-[12px] text-gray-400 font-medium">VIP 등급</span>
          </div>
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${style.bg} ${style.text}`}>
            {style.icon} {style.label}
          </span>
        </div>
        {/* Progress bar */}
        <div className="mb-2">
          <div className="w-full h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-500 mt-1.5">
            {tier.next_threshold > 0
              ? `${tier.current_charged.toLocaleString()} / ${tier.next_threshold.toLocaleString()}딜`
              : '최고 등급 달성!'}
          </p>
        </div>
        <p className="text-[11px] text-pink-400 font-medium">
          현재 추가 할인: {tier.discount}%
        </p>
      </div>
    </div>
  )
}

function InterestCountButton() {
  const navigate = useNavigate()
  const [count, setCount] = useState(0)

  useEffect(() => {
    api.get('/api/interest/my')
      .then(r => {
        if (r.data.success) setCount((r.data.data || []).length)
      })
      .catch(() => {})
  }, [])

  return (
    <button
      onClick={() => navigate('/interest-list')}
      className="flex-1 py-3 bg-[#121212] border border-[#2A2A2A] rounded-xl text-xs font-medium text-gray-300 text-center relative"
    >
      <Heart className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
      관심 맛집
      {count > 0 && (
        <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-pink-500 rounded-full">
          {count}
        </span>
      )}
    </button>
  )
}

interface GroupBuy {
  id: number
  product_name: string
  status: string
  current_count: number
  target_count: number
  expires_at: string
}

function formatCountdown(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return '만료됨'
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)
  if (hours > 24) {
    const days = Math.floor(hours / 24)
    return `${days}일 ${hours % 24}시간 남음`
  }
  if (hours > 0) return `${hours}시간 ${minutes}분 ${seconds}초 남음`
  if (minutes > 0) return `${minutes}분 ${seconds}초 남음`
  return `${seconds}초 남음`
}

function ActiveGroupBuys() {
  const navigate = useNavigate()
  const [groups, setGroups] = useState<GroupBuy[]>([])
  const [, setTick] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    api.get('/api/referral/my')
      .then(r => {
        if (r.data.success) {
          const active = (r.data.data || []).filter((g: GroupBuy) => g.status === 'open')
          setGroups(active)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (groups.length === 0) return
    intervalRef.current = setInterval(() => setTick(t => t + 1), 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [groups.length])

  if (groups.length === 0) return null

  return (
    <div className="px-5 py-1.5">
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-4 h-4 text-pink-400" />
        <span className="text-[12px] text-gray-400 font-medium">진행 중인 공구</span>
      </div>
      <div className="space-y-2">
        {groups.map(group => (
          <div
            key={group.id}
            onClick={() => navigate(`/referral/${group.id}`)}
            className="bg-[#121212] border border-[#2A2A2A] rounded-2xl px-4 py-3 cursor-pointer active:scale-[0.98] transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500">진행 중인 공구</p>
                <p className="text-sm font-bold text-white truncate">{group.product_name}</p>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="text-xs text-pink-400">{formatCountdown(group.expires_at)}</p>
                <p className="text-[10px] text-gray-500">{group.current_count}/{group.target_count}명</p>
              </div>
            </div>
          </div>
        ))}
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
      <SEO title="마이페이지 - 유어딜" description="내 정보와 활동을 관리하세요" url="/user/profile" />
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

      {/* VIP 등급 */}
      <VipTierCard />

      {/* 진행 중인 공구 */}
      <ActiveGroupBuys />

      {/* 바로가기 */}
      <div className="px-5 py-3 flex gap-2">
        <button onClick={() => navigate('/my-orders')} className="flex-1 py-3 bg-[#121212] border border-[#2A2A2A] rounded-xl text-xs font-medium text-gray-300 text-center">📦 주문내역</button>
        <button onClick={() => navigate('/wishlist')} className="flex-1 py-3 bg-[#121212] border border-[#2A2A2A] rounded-xl text-xs font-medium text-gray-300 text-center">❤️ 위시리스트</button>
        <InterestCountButton />
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
