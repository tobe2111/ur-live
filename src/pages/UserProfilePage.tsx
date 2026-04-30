import { useEffect, useState, useRef } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/shared/config/region'
import SEO from '@/components/SEO'
import { loginWithFirebaseToken, logout } from '@/features/auth/login-flow.service'
import { getUserProfileImage } from '@/utils/auth'
import { UserInfo } from '@/components/my-page/user-info'
import { MenuList } from '@/components/my-page/menu-list'
import { Footer } from '@/components/my-page/footer'
import { RewardAdCard } from '@/components/my-page/reward-ad-card'
import { ArrowLeft, Store, ChevronRight, X } from 'lucide-react'
import { toast } from '@/hooks/useToast'

/**
 * 🧹 완전히 단순화된 UserProfilePage
 * - firebase_token 처리는 여기서만
 * - RouteGuard와 협력해 무한 루프 방지
 */
function TeamPointsCard() {
  const navigate = useNavigate()
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchBalance = () => {
    import('@/lib/api').then(({ default: api }) => {
      api.get('/api/points/balance')
        .then(r => { if (r.data.success) setBalance(r.data.data.balance) })
        .catch(() => { setLoading(false) })
        .finally(() => setLoading(false))
    })
  }

  useEffect(() => {
    fetchBalance()
    // 광고 리워드 등으로 잔액 변경 시 자동 갱신
    const handler = () => fetchBalance()
    window.addEventListener('pointsBalanceChanged', handler)
    return () => window.removeEventListener('pointsBalanceChanged', handler)
  }, [])
  return (
    <div className="px-5 py-3">
      <button
        type="button"
        onClick={() => navigate('/points/charge')}
        className="w-full text-left flex items-center justify-between bg-[#121212] rounded-2xl px-5 py-4 cursor-pointer active:scale-[0.98] transition-all border border-[#2A2A2A]"
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
        <span className="px-3 py-1.5 text-xs font-bold text-pink-400 bg-pink-500/10 rounded-lg border border-pink-500/30">
          충전
        </span>
      </button>
    </div>
  )
}

function ChatNameSetting() {
  const [masked, setMasked] = useState(() => localStorage.getItem('chat_name_mask') !== 'off')
  const userName = localStorage.getItem('user_name') || '사용자'

  const preview = masked
    ? (userName.length <= 1 ? userName + '*'
      : userName.length === 2 ? userName[0] + '*'
      : userName.length === 3 ? userName[0] + '*' + userName[2]
      : userName[0] + '*'.repeat(userName.length - 2) + userName[userName.length - 1])
    : userName

  const toggle = () => {
    const next = !masked
    setMasked(next)
    localStorage.setItem('chat_name_mask', next ? 'on' : 'off')
  }

  return (
    <div className="px-5 py-1.5">
      <div className="bg-[#121212] rounded-2xl px-5 py-4 border border-[#2A2A2A]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white">채팅 이름 표시</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              라이브 채팅에서 내 이름: <span className="text-pink-400 font-medium">{preview}</span>
            </p>
          </div>
          <button
            onClick={toggle}
            className={`relative w-11 h-6 rounded-full transition-colors ${masked ? 'bg-pink-500' : 'bg-gray-600'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${masked ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
        <p className="text-[10px] text-gray-600 mt-2">
          {masked ? '이름이 마스킹됩니다 (개인정보 보호)' : '원본 이름이 그대로 표시됩니다'}
        </p>
      </div>
    </div>
  )
}

// 🛡️ 2026-04-30 v4 시안 매칭: 쿠폰 / 바우처 카운트 2분할 카드
function CouponVoucherStats() {
  const navigate = useNavigate()
  const [couponCount, setCouponCount] = useState<number | null>(null)
  const [voucherCount, setVoucherCount] = useState<number | null>(null)

  useEffect(() => {
    import('@/lib/api').then(({ default: api }) => {
      api.get('/api/coupons/my')
        .then(r => {
          if (r.data?.success) {
            const list = Array.isArray(r.data.data) ? r.data.data : (r.data.data?.items || [])
            setCouponCount(list.length)
          }
        }).catch(() => setCouponCount(0))
      api.get('/api/vouchers/my')
        .then(r => {
          if (r.data?.success) {
            const list = Array.isArray(r.data.data) ? r.data.data : (r.data.data?.items || [])
            setVoucherCount(list.length)
          }
        }).catch(() => setVoucherCount(0))
    })
  }, [])

  return (
    <div className="px-4 pt-2">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => navigate('/my-coupons')}
          className="rounded-2xl px-4 py-3.5 bg-white/[0.04] active:bg-white/[0.08] transition-colors text-left"
        >
          <p className="text-[10px] text-white/55">쿠폰</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-[20px] font-extrabold text-white" style={{ letterSpacing: '-0.02em' }}>
              {couponCount ?? '-'}
            </span>
            <span className="text-[11px] text-white/55">장</span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => navigate('/my-vouchers')}
          className="rounded-2xl px-4 py-3.5 bg-white/[0.04] active:bg-white/[0.08] transition-colors text-left"
        >
          <p className="text-[10px] text-white/55">바우처</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-[20px] font-extrabold text-white" style={{ letterSpacing: '-0.02em' }}>
              {voucherCount ?? '-'}
            </span>
            <span className="text-[11px] text-white/55">장</span>
          </div>
        </button>
      </div>
    </div>
  )
}

// 🛡️ 2026-04-30 v4 시안 매칭: 쇼핑 InsetGroup (찜 / 바우처 / 쿠폰함 / 주문)
function ShoppingGroup() {
  const navigate = useNavigate()
  const [wishCount, setWishCount] = useState<number | null>(null)
  const [couponCount, setCouponCount] = useState<number | null>(null)
  const [voucherCount, setVoucherCount] = useState<number | null>(null)

  useEffect(() => {
    import('@/lib/api').then(({ default: api }) => {
      api.get('/api/wishlists').then(r => {
        if (r.data?.success) {
          const list = Array.isArray(r.data.data) ? r.data.data : (r.data.data?.items || [])
          setWishCount(list.length)
        }
      }).catch(() => setWishCount(0))
      api.get('/api/coupons/my').then(r => {
        if (r.data?.success) {
          const list = Array.isArray(r.data.data) ? r.data.data : (r.data.data?.items || [])
          setCouponCount(list.length)
        }
      }).catch(() => setCouponCount(0))
      api.get('/api/vouchers/my').then(r => {
        if (r.data?.success) {
          const list = Array.isArray(r.data.data) ? r.data.data : (r.data.data?.items || [])
          setVoucherCount(list.length)
        }
      }).catch(() => setVoucherCount(0))
    })
  }, [])

  const items = [
    { icon: '❤️', label: '찜한 상품', count: wishCount, path: '/wishlist' },
    { icon: '🎟️', label: '내 바우처', sub: '식사권·이용권', count: voucherCount, path: '/my-vouchers' },
    { icon: '🎫', label: '쿠폰함', count: couponCount, path: '/my-coupons' },
    { icon: '📦', label: '주문 내역', sub: '최근 3개월', path: '/my-orders' },
  ]

  return (
    <div className="px-4 pt-5">
      <p className="text-[12px] font-bold text-white mb-2">쇼핑</p>
      <div className="rounded-2xl overflow-hidden bg-white/[0.04]">
        {items.map((item, i) => (
          <button
            key={item.label}
            type="button"
            onClick={() => navigate(item.path)}
            className="w-full flex items-center gap-3 px-3.5 py-3.5 text-left active:bg-white/[0.06]"
            style={{ borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
          >
            <span className="text-lg" aria-hidden="true">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-white font-medium">{item.label}</p>
              {item.sub && <p className="text-[10px] text-white/45 mt-0.5">{item.sub}</p>}
            </div>
            {item.count !== undefined && item.count !== null && (
              <span className="text-[12px] text-white/55 font-semibold">{item.count}</span>
            )}
            <ChevronRight className="w-3.5 h-3.5 text-white/30" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  )
}

function OrderStatusBar() {
  const navigate = useNavigate()
  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    import('@/lib/api').then(({ default: api }) => {
      api.get('/api/orders').then(r => {
        if (r.data.success) {
          const orders = Array.isArray(r.data.data) ? r.data.data : (r.data.data?.items || r.data.data?.orders || [])
          const c: Record<string, number> = {}
          orders.forEach((o: { status?: string }) => {
            const s = (o.status || '').toUpperCase()
            if (s === 'PAID' || s === 'DONE') c.paid = (c.paid || 0) + 1
            else if (s === 'PREPARING') c.preparing = (c.preparing || 0) + 1
            else if (s === 'SHIPPING') c.shipping = (c.shipping || 0) + 1
            else if (s === 'DELIVERED') c.delivered = (c.delivered || 0) + 1
          })
          setCounts(c)
        }
      }).catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
    })
  }, [])

  const items = [
    { label: '결제완료', key: 'paid', path: '/my-orders' },
    { label: '배송준비', key: 'preparing', path: '/my-orders' },
    { label: '배송중', key: 'shipping', path: '/my-orders' },
    { label: '배송완료', key: 'delivered', path: '/my-orders' },
    { label: '리뷰', key: 'review', path: '/my-orders' },
  ]

  return (
    <div className="px-4 pt-3">
      <p className="text-[12px] font-bold text-white mb-3">주문 현황</p>
      <div className="flex items-center justify-between rounded-2xl px-2 py-4 bg-white/[0.04]">
        {items.map(o => (
          <button key={o.label} onClick={() => navigate(o.path)} className="flex-1 text-center">
            <p className={`text-[18px] font-extrabold ${counts[o.key] ? 'text-pink-400' : 'text-white/20'}`} style={{ letterSpacing: '-0.02em' }}>
              {counts[o.key] || 0}
            </p>
            <p className="text-[9px] text-white/55 mt-0.5">{o.label}</p>
          </button>
        ))}
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
  const dialogRef = useFocusTrap<HTMLDivElement>(true)

  // 🛡️ 2026-04-28 a11y: ESC 키로 모달 닫기 (키보드 사용자)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

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
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-[430px] bg-[#121212] rounded-t-3xl px-5 pt-5 pb-8 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="셀러 전환 신청"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">셀러로 활동하기</h2>
          <button onClick={onClose} aria-label="닫기" className="p-1 rounded-full hover:bg-white/10">
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
        .catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
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

  useEffect(() => { document.title = '마이페이지 - 유어딜' }, [])

  // ✅ firebase_token 한 번만 처리
  // 의존성에서 searchParams, user 제거 → 무한 루프 방지
  // searchParams는 마운트 시 읽고, user 변화는 hasProcessedToken으로 제어
  useEffect(() => {
    const firebaseToken = searchParams.get('firebase_token')
    const userNameParam = searchParams.get('userName')
    const profileImageParam = searchParams.get('profileImage')

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
            if (import.meta.env.DEV) console.warn('[UserProfilePage] ⚠️ Firebase 프로필 업데이트 실패 (무시):', e)
          }

          navigate('/user/profile', { replace: true })
          setIsProcessingToken(false)
        })
        .catch((error) => {
          if (import.meta.env.DEV) console.error('[UserProfilePage] ❌ 토큰 처리 실패:', error)
          setIsProcessingToken(false)
          navigate('/login', { replace: true })
        })
    }
  }, [isAuthReady]) // ✅ isAuthReady만 의존: auth 준비 완료 시 1회 실행

  // ✅ 사용자 이름 + 프로필 이미지 설정
  useEffect(() => {
    const name = user?.displayName || localStorage.getItem('user_name') || '사용자'
    setUserName(name)
    const image = user?.photoURL || getUserProfileImage() || undefined
    setProfileImage(image)
  }, [user])

  // 🔄 로딩 중 (한국: localStorage 인증이므로 isAuthReady 무시)
  if ((!isAuthReady && !isKorea()) || isProcessingToken) {
    return (
      <div className="min-h-screen bg-[#020202] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b35] mx-auto mb-4"></div>
          <p className="text-gray-400">
            {isProcessingToken ? '로그인 처리 중...' : '로딩 중...'}
          </p>
        </div>
      </div>
    )
  }

  // 🚫 로그인 안 됨
  // 한국: localStorage 기반 인증이므로 Zustand user 없어도 OK
  const isLoggedInViaLocalStorage = localStorage.getItem('user_type') === 'user' && !!localStorage.getItem('user_id')
  if (!user && !isLoggedInViaLocalStorage) {
    const firebaseToken = searchParams.get('firebase_token')
    
    // firebase_token이 있거나 처리 중이면 대기 (리다이렉트 방지)
    if (firebaseToken || isProcessingToken) {
      return (
        <div className="min-h-screen bg-[#020202] flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b35] mx-auto mb-4"></div>
            <p className="text-gray-400">로그인 처리 중...</p>
          </div>
        </div>
      )
    }
    
    // 토큰 없고 처리 중도 아니면 로그인 페이지로
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
    <div className="bg-[#020202] flex flex-col min-h-screen pb-7">
      <SEO title="마이페이지 - 유어딜" description="내 프로필, 주문내역, 쿠폰 등을 관리하세요" url="/user/profile" noindex />
      <h1 className="sr-only">마이페이지</h1>

      {/* v4 Wallet sticky chrome — 알림 + 설정 (한 손 도달 영역 우측) */}
      <div className="sticky top-0 z-50 flex items-center justify-end px-2 py-3 gap-1" style={{ background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(20px) saturate(140%)', WebkitBackdropFilter: 'blur(20px) saturate(140%)', borderBottom: '0.5px solid rgba(84,84,88,0.34)' }}>
        <button onClick={() => navigate('/notifications')} aria-label="알림" className="rounded-full flex items-center justify-center w-[34px] h-[34px] bg-white/[0.06]">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-5-5.917V4a1 1 0 10-2 0v1.083A6 6 0 006 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
        </button>
        <button onClick={() => navigate('/account/settings')} aria-label="설정" className="rounded-full flex items-center justify-center w-[34px] h-[34px] bg-white/[0.06]">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </button>
      </div>

      {/* v4 Wallet Large Title */}
      <div className="px-4 pt-3 pb-1">
        <h2 style={{ fontSize: 32, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em', lineHeight: 1.1 }}>My</h2>
      </div>

      {/* v4 Hero Profile — 그라데이션 배경 + 이메일 + 편집 */}
      <div className="px-4 pt-2 pb-5 relative" style={{ background: 'radial-gradient(ellipse at top, rgba(236,72,153,0.25), transparent 60%), #0A0A0A' }}>
        <div className="flex items-center gap-3">
          <img
            src={profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=random&size=64`}
            alt={`${userName} 프로필 이미지`}
            loading="lazy"
            decoding="async"
            className="w-16 h-16 rounded-full object-cover"
            style={{ border: '2px solid rgba(255,255,255,0.15)' }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-[17px] font-extrabold text-white truncate" style={{ letterSpacing: '-0.01em' }}>{userName}</p>
            <p className="text-[11px] text-white/50 mt-0.5 truncate">{localStorage.getItem('user_email') || ''}</p>
            <button onClick={() => navigate('/account/settings')} className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 mt-1.5 bg-white/[0.08] text-[10px] text-white/75 font-semibold">
              프로필 편집 <ChevronRight className="w-2.5 h-2.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* v4 딜 잔액 + 충전 (큰 박스) */}
      <TeamPointsCard />

      {/* v4 쿠폰 / 바우처 카운트 2분할 */}
      <CouponVoucherStats />

      {/* v4 주문 현황 */}
      <OrderStatusBar />

      {/* v4 쇼핑 InsetGroup — 시안 매칭 (4개) */}
      <ShoppingGroup />

      {/* v4 활동 InsetGroup — 셀러 전환 / 채팅 이름 */}
      <SellerSwitchCard />
      <ChatNameSetting />

      {/* v4 더보기 InsetGroup — 배송지 / 리뷰 / 친구초대 / 광고 보고 포인트 */}
      <div className="px-4 pt-5">
        <p className="text-[12px] font-bold text-white mb-2">더보기</p>
        <div className="rounded-2xl overflow-hidden bg-white/[0.04]">
          {[
            { icon: '📍', label: '배송지 관리', path: '/mypage/addresses' },
            { icon: '📝', label: '내 리뷰', path: '/my-reviews' },
            { icon: '👥', label: '친구 초대', path: '/referral' },
          ].map((item, i) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="w-full flex items-center gap-3 px-3.5 py-3 text-left active:bg-white/[0.06]"
              style={{ borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
            >
              <span className="text-base" aria-hidden="true">{item.icon}</span>
              <span className="flex-1 text-[13px] text-white">{item.label}</span>
              <ChevronRight className="w-3.5 h-3.5 text-white/30" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>

      {/* v4 광고 리워드 카드 */}
      <RewardAdCard />

      {/* v4 도움말 InsetGroup */}
      <div className="px-4 pt-5">
        <p className="text-[12px] font-bold text-white mb-2">도움말</p>
        <div className="rounded-2xl overflow-hidden bg-white/[0.04]">
          {[
            { label: '고객센터', sub: '0507-0177-0432', action: () => window.open('tel:0507-0177-0432') },
            { label: '자주 묻는 질문', path: '/faq' },
            { label: '이용약관', path: '/terms' },
            { label: '개인정보 처리방침', path: '/privacy' },
            { label: '배송 정책', path: '/shipping-policy' },
          ].map((item, i) => (
            <button
              key={item.label}
              onClick={() => (item as any).action ? (item as any).action() : item.path && navigate(item.path)}
              className="w-full flex items-center gap-3 px-3.5 py-3 text-left active:bg-white/[0.06]"
              style={{ borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
            >
              <div className="flex-1">
                <p className="text-[13px] text-white">{item.label}</p>
                {item.sub && <p className="text-[10px] text-white/45 mt-0.5">{item.sub}</p>}
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-white/30" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>

      {/* v4 로그아웃 + 버전 */}
      <div className="px-4 py-6">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white/[0.04] text-[13px] font-semibold text-white/75 active:bg-white/[0.08] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          로그아웃
        </button>
        <p className="text-[10px] text-white/25 text-center mt-3">
          유어딜 v1.0.0
          {import.meta.env.VITE_APP_VERSION && (
            <span className="font-mono ml-1">· {String(import.meta.env.VITE_APP_VERSION).slice(0, 7)}</span>
          )}
        </p>
      </div>
    </div>
  )
}
