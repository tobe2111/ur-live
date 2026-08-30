/**
 * 🏁 2026-06-18 (사용자 결정 — 사업자 진입 "상태별 직접 노출"): 유어샵 오너 화면 + 소개 콘솔
 *   공용 사업자(판매) 진입 CTA. 기존 CuratorEarningsPage 내부 정의를 공유 컴포넌트로 추출(코드 동일).
 *   - 셀러 아님 → '사업자 인증하고 내 상품 팔기' (혜택 시트 → /seller/register/supplier?from=curator)
 *   - 승인됨 → '상품 등록'(/seller/products/new) · '이용권 등록'(/seller/meal-voucher/new) · '셀러 대시보드'
 *   - 심사중/반려/정지 → 상태 안내
 *   🏁 2026-06-26 (대표 — "상품·이용권 모두 전체 등록 페이지로"): 얄팍한 빠른등록 모달 제거 →
 *     switch-to-seller 로 토큰 보장 후 정식 등록 풀페이지(이미지·상세·옵션)로 이동.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '@/hooks/useToast'
import VerifiedSeal from '@/components/VerifiedSeal'

export default function SellOwnProductsCTA() {
  const navigate = useNavigate()
  const [sellerStatus, setSellerStatus] = useState<{ has_seller?: boolean; status?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
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

  // 승인됨 → 정식 등록 풀페이지로 (상품/이용권 각자) + 셀러 대시보드(주문·정산). seller_token 보장(switch-to-seller).
  if (hasSeller && (st === 'approved' || st === 'active')) {
    // 🏁 2026-06-26 (대표 — "상품·이용권 모두 전체 등록 페이지로"): 얄팍한 빠른등록 모달 대신
    //   switch-to-seller 로 토큰 보장 후 정식 등록 페이지로 이동(이미지·상세·옵션 풀폼).
    const goSeller = async (path: string) => {
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
          navigate(path)
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
      <section className="mb-6 bg-gray-50 dark:bg-[#1A1C21] border border-gray-200 dark:border-[#2C2F35] rounded-xl p-4">
        <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">🏪 판매 활성 · 내 유어샵 <VerifiedSeal size={15} /> <span className="font-medium text-gray-500 dark:text-gray-400">· 판매·현금 정산 활성</span></p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">
          이용권·상품을 정식 등록(이미지·상세·옵션)하거나, 셀러 대시보드에서 주문·정산을 관리하세요. 등록한 것은 내 유어샵에 바로 진열됩니다.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => goSeller('/seller/products/new')}
            disabled={switching}
            className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-[#0D0F12] text-xs font-bold rounded-lg disabled:opacity-50"
          >
            {switching ? '이동 중…' : '+ 상품 등록'}
          </button>
          <button
            onClick={() => goSeller('/seller/meal-voucher/new')}
            disabled={switching}
            className="px-4 py-2 bg-white dark:bg-[#1A1C21] border border-gray-200 dark:border-[#2C2F35] text-gray-700 dark:text-gray-200 text-xs font-bold rounded-lg disabled:opacity-50"
          >
            + 이용권 등록
          </button>
          <button
            onClick={() => goSeller('/seller')}
            disabled={switching}
            className="px-4 py-2 bg-white dark:bg-[#1A1C21] border border-gray-200 dark:border-[#2C2F35] text-gray-700 dark:text-gray-200 text-xs font-bold rounded-lg disabled:opacity-50"
          >
            셀러 대시보드 →
          </button>
        </div>
      </section>
    )
  }

  // 심사 중 (셀러 신청 접수됨)
  if (hasSeller && st === 'pending') {
    return (
      <section className="mb-6 bg-gray-50 dark:bg-[#1A1C21] border border-gray-200 dark:border-[#2C2F35] rounded-xl p-4">
        <p className="text-sm font-bold text-gray-900 dark:text-white">🏪 매장 등록 심사 중</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          등록증을 확인하는 중이에요. 승인되면 내 유어샵에서 판매·현금 정산이 열립니다.
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
        className="w-full mb-6 flex items-center gap-3 rounded-2xl bg-gray-900 dark:bg-[#161616] text-white p-4 text-left active:scale-[0.99] transition-transform shadow-lg shadow-gray-900/10 dark:ring-1 dark:ring-[#2C2F35]"
      >
        <span className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0"><VerifiedSeal size={22} /></span>
        <span className="flex-1 min-w-0">
          <span className="block text-[14.5px] font-extrabold">내 가게 등록하고 이용권 팔기</span>
          <span className="block text-[11.5px] text-gray-300 mt-0.5">이용권 판매 · 현금 정산 · 파란 인증 씰</span>
        </span>
        <span className="text-gray-400 text-lg leading-none">›</span>
      </button>
      {showBenefits && (
        <BenefitsSheet
          onClose={() => setShowBenefits(false)}
          onStart={() => navigate('/store/new?from=curator')}
        />
      )}
    </>
  )
}

// 🏁 2026-06-26 (대표 — 일반→인증 유저 전환 혜택 안내): 혜택 바텀시트.
function BenefitsSheet({ onClose, onStart }: { onClose: () => void; onStart: () => void }) {
  const benefits: { icon?: string; seal?: boolean; t: string; d: string }[] = [
    { icon: '🎟️', t: '내 이용권 직접 판매', d: '내 이용권이 내 유어샵 맨 앞에 진열돼요' },
    { icon: '💰', t: '현금 정산', d: '판매 대금과 추천 수익을 현금으로 받아요' },
    { seal: true, t: '이름 옆 파란 인증 씰', d: '방문자에게 신뢰를, 다른 유어샵과 차별을' },
    { icon: '🛍️', t: '상품도 함께', d: '이용권 외에 배송 상품·교환권도 같은 자리에서' },
  ]
  return (
    <div className="fixed inset-0 z-[10600] flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white dark:bg-[#1A1C21] rounded-t-3xl px-5 pt-2 pb-7 animate-slideUp">
        <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-[#2C2F35] mx-auto mt-1.5 mb-4" />
        <h2 className="text-[21px] font-extrabold text-gray-900 dark:text-white tracking-tight">내 유어샵에서 직접 팔아보세요</h2>
        <div className="flex items-center gap-1.5 mt-2 text-[13px] text-gray-500 dark:text-gray-400 flex-wrap">
          <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#1A1C21] text-[11px] font-bold">유저</span>
          <span className="font-extrabold text-gray-400">→</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#eaf5ff] dark:bg-[#0d2a40] text-[#1d9bf0] text-[11px] font-bold"><VerifiedSeal size={13} /> 인증 유저</span>
          로 전환하면
        </div>
        <div className="mt-5 space-y-4">
          {benefits.map((b, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-[20px] ${b.seal ? 'bg-[#eaf5ff] dark:bg-[#0d2a40]' : 'bg-gray-100 dark:bg-[#1A1C21]'}`}>{b.seal ? <VerifiedSeal size={22} /> : b.icon}</span>
              <div>
                <p className="text-[15px] font-extrabold text-gray-900 dark:text-white">{b.t}</p>
                <p className="text-[12.5px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{b.d}</p>
              </div>
            </div>
          ))}
        </div>
        <button onClick={onStart} className="mt-6 w-full h-[52px] rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-[#0D0F12] text-[15.5px] font-extrabold active:opacity-80">
          ✓ 사업자 인증 시작하기
        </button>
        <p className="text-center text-[11.5px] text-gray-400 dark:text-gray-500 mt-2.5">사업자등록 → 관리자 승인 후 활성화 · 무료</p>
      </div>
    </div>
  )
}
