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
import ImageUpload from '@/components/ImageUpload'

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
        <p className="text-sm font-bold text-pink-800 dark:text-pink-200">✅ 사업자 유저 — 판매·현금 정산 활성</p>
        <p className="text-xs text-pink-700 dark:text-pink-300 mt-1 mb-3">
          여기서 바로 상품을 등록하거나, 셀러 대시보드에서 주문·정산을 관리하세요. 등록한 상품은 내 링크샵에 함께 표시됩니다.
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
        <p className="text-sm font-bold text-gray-900 dark:text-white">🧾 사업자 등록 신청 접수됨</p>
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

  // 셀러 아님 → 판매 시작 안내 (현행 모델: 판매=매장 등록 → /seller/register/supplier, register-from-user store_owner)
  return (
    <section className="mb-6 bg-gray-50 dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] rounded-xl p-4">
      <p className="text-sm font-bold text-gray-900 dark:text-white">🧾 사업자 등록하고 판매 시작하기</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">
        사업자 등록하면 내 상품·공구권 판매 + 추천 수익 현금 정산이 함께 열려요. 관리자 승인 후 활성화되며, 승인되면 내 링크샵에 추천 핀과 함께 표시됩니다.
      </p>
      <button
        onClick={() => navigate('/seller/register/supplier?from=curator')}
        className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold rounded-lg"
      >
        사업자 등록하기 →
      </button>
    </section>
  )
}

/**
 * 🏁 2026-06-17 (#3a 인라인 상품 등록): 콘솔/링크샵에서 대시보드 안 나가고 바로 상품 등록.
 *   기존 검증된 POST /api/seller/products(name+price 필수) 재활용 — 신규 판매/정산 코드 0.
 *   셀러 토큰은 switch-to-seller 로 보장(BottomNav DISPLAY 는 active_role 기준이라 소비자 UI 무영향).
 *   이미지=공용 ImageUpload(이미지압축 dynamic import). 상세옵션은 셀러 대시보드에서.
 */
function QuickProductModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: '', price: '', stock: '', category: 'lifestyle', image_url: '' })
  const [submitting, setSubmitting] = useState(false)
  const [sellerReady, setSellerReady] = useState(!!(typeof window !== 'undefined' && localStorage.getItem('seller_token')))

  useEffect(() => {
    if (sellerReady) return
    let cancelled = false
    ;(async () => {
      try {
        const { default: api } = await import('@/lib/api')
        const sw = await api.post('/api/seller/switch-to-seller')
        if (!cancelled && sw.data?.success) {
          const { accessToken, refreshToken, seller } = sw.data.data
          localStorage.setItem('seller_token', accessToken)
          localStorage.setItem('seller_refresh_token', refreshToken)
          localStorage.setItem('seller_id', String(seller.id))
          localStorage.setItem('seller_name', seller.name)
          localStorage.setItem('seller_email', seller.email)
          localStorage.setItem('seller_username', seller.username)
          localStorage.setItem('seller_type', seller.seller_type)
          setSellerReady(true)
        }
      } catch { /* 준비 실패 — submit 시 안내 */ }
    })()
    return () => { cancelled = true }
  }, [sellerReady])

  const submit = async () => {
    if (submitting) return
    if (!sellerReady) { toast.error('판매자 준비 중입니다. 잠시 후 다시 시도해주세요'); return }
    const price = Number(form.price)
    if (!form.name.trim()) { toast.error('상품명을 입력해주세요'); return }
    if (!Number.isFinite(price) || price < 0) { toast.error('가격을 올바르게 입력해주세요'); return }
    const stockNum = form.stock.trim() === '' ? 0 : Number(form.stock)
    if (!Number.isFinite(stockNum) || stockNum < 0) { toast.error('재고를 올바르게 입력해주세요'); return }
    setSubmitting(true)
    try {
      const { default: api } = await import('@/lib/api')
      const res = await api.post('/api/seller/products', {
        name: form.name.trim(),
        price,
        stock: stockNum,
        category: form.category,
        delivery_type: 'shipping',
        ...(form.image_url ? { image_url: form.image_url } : {}),
      })
      if (res.data?.success) {
        toast.success('상품이 등록됐어요! 내 상점·링크샵에 표시됩니다.')
        onSuccess()
      } else {
        const e = res.data?.error
        toast.error(typeof e === 'string' ? e : '상품 등록에 실패했습니다')
      }
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } }
      toast.error(err.response?.data?.error || '상품 등록 중 오류가 발생했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60" onClick={onClose} role="presentation">
      <div
        className="w-full max-w-[430px] bg-white dark:bg-[#121212] rounded-t-3xl px-5 pt-5 pb-8 max-h-[85dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label="빠른 상품 등록"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">빠른 상품 등록</h2>
          <button onClick={onClose} aria-label="닫기" className="p-1 rounded-full text-gray-500 dark:text-gray-400 text-lg leading-none">✕</button>
        </div>
        <div className="space-y-3">
          <input
            value={form.name}
            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            maxLength={200}
            placeholder="상품명 *"
            className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] rounded-xl text-sm text-gray-900 dark:text-white"
          />
          <div className="flex gap-2">
            <input
              value={form.price}
              onChange={(e) => setForm(f => ({ ...f, price: e.target.value.replace(/[^\d]/g, '') }))}
              inputMode="numeric"
              placeholder="가격(원) *"
              className="flex-1 min-w-0 px-3.5 py-2.5 bg-gray-100 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] rounded-xl text-sm text-gray-900 dark:text-white"
            />
            <input
              value={form.stock}
              onChange={(e) => setForm(f => ({ ...f, stock: e.target.value.replace(/[^\d]/g, '') }))}
              inputMode="numeric"
              placeholder="재고"
              className="w-24 px-3.5 py-2.5 bg-gray-100 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] rounded-xl text-sm text-gray-900 dark:text-white"
            />
          </div>
          <select
            value={form.category}
            onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
            className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] rounded-xl text-sm text-gray-900 dark:text-white"
          >
            <option value="fashion">패션</option>
            <option value="beauty">뷰티</option>
            <option value="food">식품</option>
            <option value="electronics">전자기기</option>
            <option value="lifestyle">라이프스타일</option>
          </select>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">상품 이미지 (선택)</label>
            {sellerReady ? (
              <ImageUpload value={form.image_url} onChange={(url) => setForm(f => ({ ...f, image_url: url }))} label="" maxSizeKB={800} />
            ) : (
              <div className="text-xs text-gray-400 dark:text-gray-500 py-3 px-3.5 bg-gray-100 dark:bg-[#1A1A1A] rounded-xl">판매자 준비 중…</div>
            )}
          </div>
        </div>
        <button
          onClick={submit}
          disabled={submitting || !sellerReady}
          className="w-full mt-5 py-3.5 bg-pink-500 text-white font-bold rounded-xl text-sm disabled:opacity-50"
        >
          {submitting ? '등록 중…' : !sellerReady ? '준비 중…' : '상품 등록'}
        </button>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 text-center mt-2">
          상세설명·옵션·디지털상품 등 자세한 설정은 셀러 대시보드에서 편집할 수 있어요.
        </p>
      </div>
    </div>
  )
}
