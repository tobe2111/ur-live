/**
 * 🏁 2026-06-18 (사용자 결정 — 사업자 진입 "상태별 직접 노출"): 링크샵 오너 화면 + 크리에이터 콘솔
 *   공용 사업자(판매) 진입 CTA. 기존 CuratorEarningsPage 내부 정의를 공유 컴포넌트로 추출(코드 동일).
 *   - 셀러 아님 → '사업자 등록하고 판매 시작' (→ /seller/register/supplier?from=curator)
 *   - 승인됨 → '빠른 상품 등록'(QuickProductModal, 대시보드 안 나감) + '셀러 대시보드' 전환
 *   - 심사중/반려/정지 → 상태 안내
 *   QuickProductModal: 검증된 POST /api/seller/products 재활용. seller_token 보장(switch-to-seller).
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '@/hooks/useToast'
import QuickProductModal from './QuickProductModal'

export default function SellOwnProductsCTA() {
  const navigate = useNavigate()
  const [sellerStatus, setSellerStatus] = useState<{ has_seller?: boolean; status?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)

  useEffect(() => {
    import('@/lib/api').then(({ default: api }) => {
      api.get('/api/seller/my-seller-status')
        .then((r) => { if (r.data?.success) setSellerStatus(r.data.data) })
        .catch((e) => { if (import.meta.env.DEV) console.warn('[curator:sell-cta]', e) })
        .finally(() => setLoading(false))
    })
  }, [])

  if (loading) return null

  const st = sellerStatus?.status
  const hasSeller = !!sellerStatus?.has_seller

  // 승인됨 → (a) 인라인 빠른 상품 등록 (대시보드 안 나감) + (b) 셀러 대시보드(주문·정산 관리)로 전환
  if (hasSeller && (st === 'approved' || st === 'active')) {
    const goDashboard = async () => {
      if (switching) return
      setSwitching(true)
      try {
        const { default: api } = await import('@/lib/api')
        const res = await api.post('/api/seller/switch-to-seller')
        if (res.data?.success) {
          const { accessToken, refreshToken, seller } = res.data.data
          localStorage.setItem('seller_token', accessToken)
          localStorage.setItem('seller_refresh_token', refreshToken)
          localStorage.setItem('seller_id', String(seller.id))
          localStorage.setItem('seller_name', seller.name)
          localStorage.setItem('seller_email', seller.email)
          localStorage.setItem('seller_username', seller.username)
          localStorage.setItem('seller_type', seller.seller_type)
          navigate('/seller')
        } else {
          toast.error('셀러 전환에 실패했습니다')
        }
      } catch {
        toast.error('셀러 전환에 실패했습니다')
      } finally {
        setSwitching(false)
      }
    }
    return (
      <section className="mb-6 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 rounded-xl p-4">
        <p className="text-sm font-bold text-pink-800 dark:text-pink-200">🛍️ 내 쇼핑몰 운영 중 — 판매·현금 정산 활성</p>
        <p className="text-xs text-pink-700 dark:text-pink-300 mt-1 mb-3">
          여기서 바로 상품을 올리거나, 셀러 대시보드에서 주문·정산을 관리하세요. 등록한 상품은 내 쇼핑몰에 표시됩니다.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowQuickAdd(true)}
            className="px-4 py-2 bg-pink-500 text-white text-xs font-bold rounded-lg"
          >
            + 빠른 상품 등록
          </button>
          <button
            onClick={goDashboard}
            disabled={switching}
            className="px-4 py-2 bg-white dark:bg-[#1A1A1A] border border-pink-300 dark:border-pink-700 text-pink-700 dark:text-pink-300 text-xs font-bold rounded-lg disabled:opacity-50"
          >
            {switching ? '이동 중…' : '셀러 대시보드 →'}
          </button>
        </div>
        {showQuickAdd && (
          <QuickProductModal
            onClose={() => setShowQuickAdd(false)}
            onSuccess={() => setShowQuickAdd(false)}
          />
        )}
      </section>
    )
  }

  // 심사 중 (셀러 신청 접수됨)
  if (hasSeller && st === 'pending') {
    return (
      <section className="mb-6 bg-gray-50 dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] rounded-xl p-4">
        <p className="text-sm font-bold text-gray-900 dark:text-white">🛍️ 내 쇼핑몰 개설 신청 접수됨</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          관리자 승인 후 판매·현금 정산이 활성화됩니다.
        </p>
      </section>
    )
  }

  // 반려/정지
  if (hasSeller && (st === 'rejected' || st === 'suspended')) {
    return (
      <section className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
        <p className="text-sm font-bold text-red-800 dark:text-red-200">🧾 사업자 등록 신청 {st === 'rejected' ? '반려됨' : '정지됨'}</p>
        <p className="text-xs text-red-700 dark:text-red-300 mt-1">자세한 내용은 고객센터로 문의해주세요.</p>
      </section>
    )
  }

  // 셀러 아님 → 내 쇼핑몰 개설 안내 (현행 모델: 판매=매장 등록 → /seller/register/supplier, register-from-user store_owner)
  return (
    <section className="mb-6 bg-gray-50 dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] rounded-xl p-4">
      <p className="text-sm font-bold text-gray-900 dark:text-white">🛍️ 내 쇼핑몰 열기</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">
        내 상품을 직접 파는 쇼핑몰을 가질 수 있어요. 사업자 등록 → 관리자 승인 후 활성화되며, 추천 수익도 현금으로 정산받아요. (공구권 판매도 함께)
      </p>
      <button
        onClick={() => navigate('/seller/register/supplier?from=curator')}
        className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold rounded-lg"
      >
        내 쇼핑몰 만들기 →
      </button>
    </section>
  )
}
