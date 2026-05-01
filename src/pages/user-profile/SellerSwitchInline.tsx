/**
 * 🛡️ 2026-05-01: TD-018 분할 — UserProfilePage 이름 옆 셀러 전환 inline 컨트롤.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Store } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import SellerApplyModal from './SellerApplyModal'

interface SellerStatus {
  has_seller: boolean
  seller_id?: number
  status?: string
  seller_type?: string
  business_name?: string
}

export default function SellerSwitchInline() {
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
      toast.error(err?.response?.data?.error || '셀러 전환에 실패했습니다')
    } finally {
      setSwitching(false)
    }
  }

  if (loading) return null

  if (status?.has_seller && status.status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-yellow-500/15 text-[10px] text-yellow-300 font-semibold border border-yellow-500/30">
        <Store className="w-2.5 h-2.5" aria-hidden="true" /> 심사 중
      </span>
    )
  }

  if (status?.has_seller && (status.status === 'rejected' || status.status === 'suspended')) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-red-500/15 text-[10px] text-red-300 font-semibold border border-red-500/30">
        <Store className="w-2.5 h-2.5" aria-hidden="true" />
        {status.status === 'rejected' ? '반려' : '정지'}
      </span>
    )
  }

  if (status?.has_seller && (status.status === 'approved' || status.status === 'active')) {
    return (
      <button
        onClick={handleSwitch}
        disabled={switching}
        aria-label="셀러 대시보드로 전환"
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 bg-pink-500/15 border border-pink-500/40 text-[10px] text-pink-300 font-semibold active:scale-95 transition-all disabled:opacity-50"
      >
        <Store className="w-2.5 h-2.5" aria-hidden="true" />
        {switching ? '전환 중...' : '셀러 모드'}
      </button>
    )
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        aria-label="셀러로 활동하기"
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 bg-white/[0.08] border border-white/[0.12] text-[10px] text-white/85 font-semibold active:scale-95 transition-all"
      >
        <Store className="w-2.5 h-2.5" aria-hidden="true" /> 셀러로 활동하기
      </button>
      {showModal && (
        <SellerApplyModal
          onClose={() => setShowModal(false)}
          onSuccess={fetchStatus}
        />
      )}
    </>
  )
}
