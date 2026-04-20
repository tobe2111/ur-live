import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/shared/config/region'
import { loginWithFirebaseToken, logout } from '@/features/auth/login-flow.service'
import { getUserProfileImage } from '@/utils/auth'
import { UserInfo } from '@/components/my-page/user-info'
import { MenuList } from '@/components/my-page/menu-list'
import { Footer } from '@/components/my-page/footer'
import { RewardAdCard } from '@/components/my-page/reward-ad-card'
import { ArrowLeft, Store, ChevronRight, X } from 'lucide-react'
import { toast } from '@/hooks/useToast'

/**
 * UserProfilePage - 마이페이지
 * 세션 쿠키 기반 인증 (Firebase 불필요)
 */
import { useState, useEffect, useRef } from 'react'
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

function SellerApplyModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    business_name: '',
    business_number: '',
    phone: '',
    seller_type: 'influencer' as 'influencer' | 'store_owner' | 'both',
    youtube_email: '',
    description: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!form.business_name || !form.business_number || !form.phone) {
      toast.error('사업자명, 사업자번호, 연락처를 입력해주세요')
      return
    }
    if (!/^\d{3}-\d{2}-\d{5}$/.test(form.business_number)) {
      toast.error('사업자번호 형식: XXX-XX-XXXXX')
      return
    }
    setSubmitting(true)
    try {
      const { default: api } = await import('@/lib/api')
      const res = await api.post('/api/seller/register-from-user', form)
      if (res.data.success) {
        toast.success('셀러 전환 신청 완료! 관리자 승인을 기다려주세요.')
        onSuccess()
        onClose()
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || '셀러 전환 신청에 실패했습니다'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const sellerTypes = [
    { value: 'influencer', label: '인플루언서', desc: '유튜브/SNS 라이브 방송' },
    { value: 'store_owner', label: '매장 사장님', desc: '맛집/매장 식사권 판매' },
    { value: 'both', label: '둘 다', desc: '방송 + 매장 운영' },
  ] as const

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-[430px] bg-[#121212] rounded-t-3xl px-5 pt-5 pb-8 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">셀러로 활동하기</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <p className="text-xs text-gray-400 mb-5">
          현재 계정으로 셀러 활동을 시작하세요. 관리자 승인 후 셀러 대시보드에 접근할 수 있습니다.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">셀러 유형</label>
            <div className="grid grid-cols-3 gap-2">
              {sellerTypes.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, seller_type: t.value }))}
                  className={`py-2.5 px-2 rounded-xl text-center transition-all ${
                    form.seller_type === t.value
                      ? 'bg-pink-500/20 border border-pink-500/50 text-pink-400'
                      : 'bg-[#1A1A1A] border border-[#2A2A2A] text-gray-400'
                  }`}
                >
                  <p className="text-[11px] font-bold">{t.label}</p>
                  <p className="text-[9px] mt-0.5 opacity-70">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">사업자명 (상호) *</label>
            <input
              value={form.business_name}
              onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-sm text-white placeholder-gray-600 focus:border-pink-500/50 focus:outline-none"
              placeholder="예: 유어딜 스튜디오"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">사업자번호 *</label>
            <input
              value={form.business_number}
              onChange={e => setForm(f => ({ ...f, business_number: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-sm text-white placeholder-gray-600 focus:border-pink-500/50 focus:outline-none"
              placeholder="123-45-67890"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">연락처 *</label>
            <input
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-sm text-white placeholder-gray-600 focus:border-pink-500/50 focus:outline-none"
              placeholder="010-1234-5678"
            />
          </div>

          {form.seller_type !== 'store_owner' && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">유튜브 구글 이메일</label>
              <input
                value={form.youtube_email}
                onChange={e => setForm(f => ({ ...f, youtube_email: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-sm text-white placeholder-gray-600 focus:border-pink-500/50 focus:outline-none"
                placeholder="라이브 방송에 사용할 구글 계정"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">소개 (선택)</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full px-3.5 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-sm text-white placeholder-gray-600 focus:border-pink-500/50 focus:outline-none resize-none"
              placeholder="채널 소개나 매장 설명을 간단히 적어주세요"
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full mt-6 py-3.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold rounded-xl text-sm active:scale-[0.97] transition-all disabled:opacity-50"
        >
          {submitting ? '신청 중...' : '셀러 전환 신청하기'}
        </button>
      </div>
    </div>
  )
}

interface SellerStatus {
  has_seller: boolean
  seller_id?: number
  status?: string
  seller_type?: string
  business_name?: string
}

function SellerSwitchCard() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<SellerStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const fetchStatus = () => {
    import('@/lib/api').then(({ default: api }) => {
      api.get('/api/seller/my-seller-status')
        .then(r => { if (r.data.success) setStatus(r.data.data) })
        .catch(() => {})
        .finally(() => setLoading(false))
    })
  }

  useEffect(() => { fetchStatus() }, [])

  const handleSwitch = async () => {
    setSwitching(true)
    try {
      const { default: api } = await import('@/lib/api')
      const res = await api.post('/api/seller/switch-to-seller')
      if (res.data.success) {
        const { accessToken, refreshToken, seller } = res.data.data

        // 듀얼 세션: 셀러 토큰만 추가 (유저 세션은 유지)
        // user_type은 'user'로 유지 — 메인페이지에서 쇼핑/공구 계속 가능
        localStorage.setItem('seller_token', accessToken)
        localStorage.setItem('seller_refresh_token', refreshToken)
        localStorage.setItem('seller_id', String(seller.id))
        localStorage.setItem('seller_name', seller.name)
        localStorage.setItem('seller_email', seller.email)
        localStorage.setItem('seller_username', seller.username)
        localStorage.setItem('seller_type', seller.seller_type)

        toast.success('셀러 대시보드로 이동합니다!')
        navigate('/seller')
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || '셀러 전환에 실패했습니다'
      toast.error(msg)
    } finally {
      setSwitching(false)
    }
  }

  if (loading) {
    return (
      <div className="px-5 py-1.5">
        <div className="bg-[#121212] rounded-2xl px-5 py-4 border border-[#2A2A2A] animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-1/3" />
        </div>
      </div>
    )
  }

  if (status?.has_seller && status.status === 'pending') {
    return (
      <div className="px-5 py-1.5">
        <div className="bg-[#121212] rounded-2xl px-5 py-4 border border-[#2A2A2A]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-yellow-500/10">
              <Store className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">셀러 전환 심사 중</p>
              <p className="text-[11px] text-yellow-400 mt-0.5">{status.business_name} — 관리자 승인 대기 중</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (status?.has_seller && (status.status === 'rejected' || status.status === 'suspended')) {
    return (
      <div className="px-5 py-1.5">
        <div className="bg-[#121212] rounded-2xl px-5 py-4 border border-[#2A2A2A]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/10">
              <Store className="w-5 h-5 text-red-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">
                {status.status === 'rejected' ? '셀러 신청이 반려되었습니다' : '셀러 계정이 정지되었습니다'}
              </p>
              <p className="text-[11px] text-red-400 mt-0.5">관리자에게 문의해주세요</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (status?.has_seller && (status.status === 'approved' || status.status === 'active')) {
    return (
      <div className="px-5 py-1.5">
        <button
          onClick={handleSwitch}
          disabled={switching}
          className="w-full bg-gradient-to-r from-pink-500/10 to-purple-600/10 border border-pink-500/30 rounded-2xl px-5 py-4 flex items-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-pink-500/20">
            <Store className="w-5 h-5 text-pink-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-white">
              {switching ? '전환 중...' : '셀러 대시보드로 전환'}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">{status.business_name}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-500" />
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="px-5 py-1.5">
        <button
          onClick={() => setShowModal(true)}
          className="w-full bg-[#121212] border border-[#2A2A2A] rounded-2xl px-5 py-4 flex items-center gap-3 active:scale-[0.98] transition-all"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-500/10">
            <Store className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-white">셀러로 활동하기</p>
            <p className="text-[11px] text-gray-400 mt-0.5">같은 계정으로 판매자 활동을 시작하세요</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-500" />
        </button>
      </div>
      {showModal && (
        <SellerApplyModal
          onClose={() => setShowModal(false)}
          onSuccess={fetchStatus}
        />
      )}
    </>
  )
}

export default function UserProfilePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  // ✅ Zustand 스토어 사용 (지역별)
  const authStore = isKorea() ? useAuthKR : useAuthWorld
  const { user, isAuthReady } = authStore()
  
  const [userName, setUserName] = useState('')
  const [profileImage, setProfileImage] = useState<string | undefined>(undefined)
  const [isProcessingToken, setIsProcessingToken] = useState(false)
  const hasProcessedToken = useRef(false)

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

    // ✅ 이미 로그인되어 있고 URL에 파라미터가 있으면 즉시 정리
    const currentUser = authStore.getState().user
    if ((firebaseToken || userNameParam) && currentUser) {
      if (userNameParam) localStorage.setItem('user_name', userNameParam)
      if (profileImageParam) localStorage.setItem('user_profile_image', profileImageParam)
      navigate('/user/profile', { replace: true })
      return
    }

    // 조건: 토큰 있음 + 아직 안 처리 + 로그인 안 됨
    if (firebaseToken && !hasProcessedToken.current && !currentUser) {
      hasProcessedToken.current = true
      setIsProcessingToken(true)

      if (userNameParam) {
        localStorage.setItem('user_name', userNameParam)
      }
      if (profileImageParam) {
        localStorage.setItem('user_profile_image', profileImageParam)
      }

      loginWithFirebaseToken(firebaseToken)
        .then(async () => {
          try {
            const { isKorea } = await import('@/shared/config/region')
            const { useAuthKR } = await import('@/shared/stores/useAuthKR')
            const { useAuthWorld } = await import('@/shared/stores/useAuthWorld')
            const firebaseUser = (isKorea() ? useAuthKR : useAuthWorld).getState().user
            if (firebaseUser && (!firebaseUser.displayName || !firebaseUser.photoURL)) {
              const { updateProfile } = await import('firebase/auth')
              await updateProfile(firebaseUser, {
                ...(userNameParam && !firebaseUser.displayName ? { displayName: userNameParam } : {}),
                ...(profileImageParam && !firebaseUser.photoURL ? { photoURL: profileImageParam } : {}),
              })
              if (isKorea()) {
                useAuthKR.getState().setUser({ ...firebaseUser } as any)
              } else {
                useAuthWorld.getState().setUser({ ...firebaseUser } as any)
              }
            }
          } catch (e) {
            console.warn('[UserProfilePage] ⚠️ Firebase 프로필 업데이트 실패 (무시):', e)
          }

          navigate('/user/profile', { replace: true })
          setIsProcessingToken(false)
        })
        .catch((error) => {
          console.error('[UserProfilePage] ❌ 토큰 처리 실패:', error)
          setIsProcessingToken(false)
          navigate('/login', { replace: true })
        })
    }
  }, [isAuthReady]) // ✅ isAuthReady만 의존: auth 준비 완료 시 1회 실행

  // ✅ 사용자 이름 + 프로필 이미지 설정
  useEffect(() => {
    if (user) {
      const name = user?.displayName || localStorage.getItem('user_name') || '사용자'
      setUserName(name)
      const image = user.photoURL || getUserProfileImage() || undefined
      setProfileImage(image)
      
    }
  }, [user])

  // 🔄 로딩 중
  if (!isAuthReady || isProcessingToken) {
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

      {/* 셀러 전환 */}
      <SellerSwitchCard />

      {/* 광고 시청으로 딜 받기 */}
      <RewardAdCard />

      {/* 바로가기 */}
      <div className="px-5 py-3 flex gap-2">
        <button onClick={() => navigate('/my-orders')} className="flex-1 py-3 bg-[#121212] border border-[#2A2A2A] rounded-xl text-xs font-medium text-gray-300 text-center">📦 주문내역</button>
        <button onClick={() => navigate('/wishlist')} className="flex-1 py-3 bg-[#121212] border border-[#2A2A2A] rounded-xl text-xs font-medium text-gray-300 text-center">❤️ 위시리스트</button>
        <InterestCountButton />
      </div>


      {/* 메뉴 */}
      <MenuList />

      {/* 로그아웃 */}
      <div className="px-5 py-6 pb-24">
        <button onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#2A2A2A] bg-[#121212] py-3.5 text-sm font-medium text-gray-400">
          <LogOut className="w-4 h-4" /> 로그아웃
        </button>
      </div>
    </div>
  )
}
