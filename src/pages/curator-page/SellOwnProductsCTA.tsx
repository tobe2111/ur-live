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
  // 🏁 2026-06-26 (대표 — 일반 유저용 전환 혜택 안내): 티저 누르면 혜택 바텀시트.
  const [showBenefits, setShowBenefits] = useState(false)

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
      <section className="mb-6 bg-gray-50 dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] rounded-xl p-4">
        <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">🛍️ 내 쇼핑몰 운영 중 <USeal size={15} /> <span className="font-medium text-gray-500 dark:text-gray-400">· 판매·현금 정산 활성</span></p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">
          여기서 바로 상품을 올리거나, 셀러 대시보드에서 주문·정산을 관리하세요. 등록한 상품은 내 쇼핑몰에 표시됩니다.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowQuickAdd(true)}
            className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-[#020202] text-xs font-bold rounded-lg"
          >
            + 빠른 상품 등록
          </button>
          <button
            onClick={goDashboard}
            disabled={switching}
            className="px-4 py-2 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-gray-200 text-xs font-bold rounded-lg disabled:opacity-50"
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

  // 셀러 아님(=일반 유저) → 전환 혜택 티저. 누르면 혜택 바텀시트 → 사업자 등록 플로우.
  return (
    <>
      <button
        onClick={() => setShowBenefits(true)}
        className="w-full mb-6 flex items-center gap-3 rounded-2xl bg-gray-900 dark:bg-[#161616] text-white p-4 text-left active:scale-[0.99] transition-transform shadow-lg shadow-gray-900/10 dark:ring-1 dark:ring-[#2A2A2A]"
      >
        <span className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0"><USeal size={22} /></span>
        <span className="flex-1 min-w-0">
          <span className="block text-[14.5px] font-extrabold">인증받고 내 쇼핑몰 열기</span>
          <span className="block text-[11.5px] text-gray-300 mt-0.5">내 상품 판매 · 현금 정산 · 파란 인증 씰</span>
        </span>
        <span className="text-gray-400 text-lg leading-none">›</span>
      </button>
      {showBenefits && (
        <BenefitsSheet
          onClose={() => setShowBenefits(false)}
          onStart={() => navigate('/seller/register/supplier?from=curator')}
        />
      )}
    </>
  )
}

// 🔵 유어딜 인증 씰 (인스타 파란딱지 스타일 + U). CuratorHeader 와 동일 비주얼.
function USeal({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z" fill="#1d9bf0" />
      <text x="12" y="12" textAnchor="middle" dominantBaseline="central" fontSize="11" fontWeight="900" fill="#ffffff" fontFamily="-apple-system, system-ui, sans-serif">U</text>
    </svg>
  )
}

// 🏁 2026-06-26 (대표 — 일반→인증 유저 전환 혜택 안내): 혜택 바텀시트.
function BenefitsSheet({ onClose, onStart }: { onClose: () => void; onStart: () => void }) {
  const benefits: { icon?: string; seal?: boolean; t: string; d: string }[] = [
    { icon: '🛍️', t: '내 상품 직접 판매', d: '링크샵이 곧 내 쇼핑몰 — 내가 파는 상품이 주인공' },
    { icon: '💰', t: '현금 정산', d: '판매 대금과 추천 수익을 현금으로 받아요' },
    { seal: true, t: '이름 옆 파란 인증 씰', d: '방문자에게 신뢰를, 다른 링크샵과 차별을' },
    { icon: '🎟️', t: '이용권 판매 채널', d: '동네 공구·교환권도 함께 판매' },
  ]
  return (
    <div className="fixed inset-0 z-[10600] flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white dark:bg-[#121212] rounded-t-3xl px-5 pt-2 pb-7 animate-slideUp">
        <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-[#2A2A2A] mx-auto mt-1.5 mb-4" />
        <h2 className="text-[21px] font-extrabold text-gray-900 dark:text-white tracking-tight">내 쇼핑몰을 열어보세요</h2>
        <div className="flex items-center gap-1.5 mt-2 text-[13px] text-gray-500 dark:text-gray-400 flex-wrap">
          <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#1A1A1A] text-[11px] font-bold">유저</span>
          <span className="font-extrabold text-gray-400">→</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#eaf5ff] dark:bg-[#0d2a40] text-[#1d9bf0] text-[11px] font-bold"><USeal size={13} /> 인증 유저</span>
          로 전환하면
        </div>
        <div className="mt-5 space-y-4">
          {benefits.map((b, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-[20px] ${b.seal ? 'bg-[#eaf5ff] dark:bg-[#0d2a40]' : 'bg-gray-100 dark:bg-[#1A1A1A]'}`}>{b.seal ? <USeal size={22} /> : b.icon}</span>
              <div>
                <p className="text-[15px] font-extrabold text-gray-900 dark:text-white">{b.t}</p>
                <p className="text-[12.5px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{b.d}</p>
              </div>
            </div>
          ))}
        </div>
        <button onClick={onStart} className="mt-6 w-full h-[52px] rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-[#020202] text-[15.5px] font-extrabold active:opacity-80">
          ✓ 사업자 인증 시작하기
        </button>
        <p className="text-center text-[11.5px] text-gray-400 dark:text-gray-500 mt-2.5">사업자등록 → 관리자 승인 후 활성화 · 무료</p>
      </div>
    </div>
  )
}
