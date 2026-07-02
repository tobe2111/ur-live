/**
 * 🛡️ 2026-05-01: TD-018 분할 — UserProfilePage 이름 옆 셀러 전환 inline 컨트롤.
 * 🏁 2026-07-02 (대표 "B — 단일 퍼널"): 가입 UI 를 SellerApplyModal(별도 3번째 폼)에서
 *   단일 관문(/seller/register/supplier)으로 통일 + 카카오 유저 숨김(구 :67 return null — 한국
 *   라이브는 카카오 전용이라 사실상 전원에게 진입점이 안 보였음) 제거. 심사중 배지는 상태
 *   페이지(/seller/waiting)로 연결 — 유저가 항상 다음 행동을 알 수 있게.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Store } from 'lucide-react'
import { toast } from '@/hooks/useToast'

interface SellerStatus {
  has_seller: boolean
  seller_id?: number
  status?: string
  seller_type?: string
  business_name?: string
  is_kakao_user?: boolean
}

export default function SellerSwitchInline() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [status, setStatus] = useState<SellerStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)

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
        toast.success(t('sellerSwitch.successMsg', { defaultValue: '셀러 대시보드로 이동합니다!' }))
        navigate('/seller')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || t('sellerSwitch.errorMsg', { defaultValue: '셀러 전환에 실패했습니다' }))
    } finally {
      setSwitching(false)
    }
  }

  if (loading) return null

  if (status?.has_seller && status.status === 'pending') {
    // 🏁 심사중 배지 → 탭 시 상태 페이지 (자동갱신 + 승인 시 대시보드 자동 진입)
    return (
      <button
        onClick={() => navigate('/seller/waiting')}
        aria-label={t('sellerSwitch.pendingAria', { defaultValue: '셀러 심사 상태 보기' })}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-yellow-500/15 text-[10px] text-yellow-300 font-semibold border border-yellow-500/30 active:scale-95 transition-all"
      >
        <Store className="w-2.5 h-2.5" aria-hidden="true" /> {t('sellerSwitch.pending', { defaultValue: '심사 중' })}
      </button>
    )
  }

  if (status?.has_seller && (status.status === 'rejected' || status.status === 'suspended')) {
    return (
      <button
        onClick={() => navigate('/seller/waiting')}
        aria-label={t('sellerSwitch.statusAria', { defaultValue: '셀러 상태 보기' })}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-red-500/15 text-[10px] text-red-300 font-semibold border border-red-500/30 active:scale-95 transition-all"
      >
        <Store className="w-2.5 h-2.5" aria-hidden="true" />
        {status.status === 'rejected' ? t('sellerSwitch.rejected', { defaultValue: '반려' }) : t('sellerSwitch.suspended', { defaultValue: '정지' })}
      </button>
    )
  }

  if (status?.has_seller && (status.status === 'approved' || status.status === 'active')) {
    return (
      <button
        onClick={handleSwitch}
        disabled={switching}
        aria-label={t('sellerSwitch.dashboardAria', { defaultValue: '셀러 대시보드로 전환' })}
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 bg-gray-100 dark:bg-white/[0.08] border border-gray-300 dark:border-white/20 text-[10px] text-gray-900 dark:text-white font-semibold active:scale-95 transition-all disabled:opacity-50"
      >
        <Store className="w-2.5 h-2.5" aria-hidden="true" />
        {switching ? t('sellerSwitch.switching', { defaultValue: '전환 중...' }) : t('sellerSwitch.sellerMode', { defaultValue: '셀러 모드' })}
      </button>
    )
  }

  // 비셀러 (카카오 포함 전원) → 단일 가입 관문
  return (
    <button
      onClick={() => navigate('/seller/register/supplier')}
      aria-label={t('sellerSwitch.applyAria', { defaultValue: '내 쇼핑몰 열기 (사업자 가입)' })}
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 bg-gray-100 dark:bg-white/[0.08] border border-white/[0.12] text-[10px] text-gray-900 dark:text-white/85 font-semibold active:scale-95 transition-all"
    >
      <Store className="w-2.5 h-2.5" aria-hidden="true" /> {t('sellerSwitch.openMyShop', { defaultValue: '내 쇼핑몰 열기' })}
    </button>
  )
}
