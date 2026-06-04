/**
 * 🏭 2026-06-03 유통스타트 도매몰 — 유통회원(유통사) 가입 안내 페이지.
 *   유통사 = 셀러 계정. 가입 즉시 C등급(distributor-pricing DEFAULT_UNGRADED) 자동 적용.
 *   기존 셀러 온보딩(/seller/register)으로 funnel — 가입 후 returnUrl=/wholesale 로 카탈로그 진입.
 *   이미 셀러 로그인 상태면 바로 카탈로그로.
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'
import { Store, ArrowRight, CheckCircle2, Boxes } from 'lucide-react'

export default function WholesaleJoinPage() {
  const navigate = useNavigate()
  const hasSeller = typeof window !== 'undefined' && !!localStorage.getItem('seller_token')

  // 이미 유통사(셀러) 로그인 상태면 카탈로그로 바로.
  useEffect(() => {
    if (hasSeller) navigate('/wholesale', { replace: true })
  }, [hasSeller, navigate])

  const goSignup = () => navigate('/seller/register?returnUrl=/wholesale')

  return (
    <div className="min-h-screen bg-white text-[#17181C]">
      <SEO
        title="유통사 가입 — 유통스타트 B2B 도매몰"
        description="유통사로 가입하고 검증된 제조사 상품을 내 등급 공급가로 사입하세요. 가입 즉시 C등급 적용, 가입비·월 고정비 0원."
        url="/wholesale/join"
      />
      <header className="border-b border-[#ECEEF1]">
        <div className="ur-content-narrow mx-auto px-4 lg:px-8 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/wholesale/intro')} className="flex items-center gap-2">
            <Boxes className="w-6 h-6 text-[#FF0033]" /><span className="text-lg font-extrabold">유통스타트</span>
          </button>
          <button onClick={() => navigate('/seller/login')} className="text-sm text-[#4E5560] hover:text-[#17181C] font-medium">이미 가입했어요</button>
        </div>
      </header>

      <main className="ur-content-narrow mx-auto px-4 lg:px-8 py-12 lg:py-16">
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-[#FF0033]/10 flex items-center justify-center mx-auto mb-5">
            <Store className="w-7 h-7 text-[#FF0033]" />
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold mb-3">유통사로 가입하기</h1>
          <p className="text-[#4E5560]">검증된 제조사 상품을 내 등급 공급가로 사입하세요.</p>
        </div>

        <div className="rounded-2xl border border-[#ECEEF1] p-6 mb-8">
          <h2 className="font-bold mb-4 text-sm text-[#F4F5F7]0">가입하면 이런 게 가능해요</h2>
          <ul className="space-y-3 text-sm text-[#4E5560]">
            {[
              '가입 즉시 C등급 공급가 적용 — 실적 쌓이면 A·B 상향',
              '제조사 신원·원가 비공개, 내 등급 공급가만 열람',
              '주문서 엑셀 업로드로 대량 주문 · 카탈로그 엑셀 다운',
              'OEM/ODM 신청 → 유통스타트가 제조사 매칭·생산 지원',
              '가입비·월 고정비 0원',
            ].map((t, i) => (
              <li key={i} className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#FF0033] shrink-0 mt-0.5" />{t}</li>
            ))}
          </ul>
        </div>

        <button onClick={goSignup}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-[#FF0033] text-white font-bold text-[15px] hover:bg-[#e0002e] transition-colors">
          유통사 가입 시작하기 <ArrowRight className="w-5 h-5" />
        </button>
        <p className="text-center text-xs text-[#B6BCC4] mt-4">
          가입은 셀러 계정으로 진행됩니다. 가입 후 자동으로 도매 카탈로그(/wholesale)로 이동합니다.
        </p>

        <div className="mt-10 text-center text-sm text-[#F4F5F7]0">
          제조사이신가요?{' '}
          <button onClick={() => navigate('/supplier/register')} className="text-[#FF0033] font-semibold">제조사 입점 신청 →</button>
        </div>
      </main>
    </div>
  )
}
