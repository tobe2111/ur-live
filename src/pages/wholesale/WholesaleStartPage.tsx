/**
 * 🚪 2026-06-12 (사용자 결정): 가입 역할 선택 관문 — /wholesale/start.
 *   "제조사 or 판매사(유통사) 먼저 선택하고 가입" — 모든 '회원가입' 진입점이 이 화면을
 *   거치게 해 잘못된 퍼널 진입(제조사가 유통 폼으로 등)을 차단. 수동 승인 체제라
 *   역할 오류 가입은 어드민 검수 비용으로 직결 — 관문에서 미리 가른다.
 *   인트로(/wholesale/intro)의 듀얼 CTA 와 같은 목적지 — 이 화면은 가입 의도가 확실한
 *   사용자용 경량 버전(마케팅 카피 없이 선택만). WT 라이트 고정.
 */
import { useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'
import { Store, Factory, ArrowRight } from 'lucide-react'
import { WT } from './wholesale-theme'

export default function WholesaleStartPage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: WT.fill }}>
      <SEO domain="wholesale" title="회원가입 — 유통스타트 B2B 도매몰" description="유통사(사입·판매) 또는 제조사(상품 공급)로 가입하세요. 가입비·월 고정비 0원." url="/wholesale/start" noindex />
      <div className="w-full max-w-md">
        <h1 className="text-[22px] font-extrabold text-center mb-1" style={{ color: WT.ink }}>어떤 회원으로 시작하시나요?</h1>
        <p className="text-[13px] text-center mb-6" style={{ color: WT.ink3 }}>역할에 따라 가입 절차와 화면이 달라요. 가입비·월 고정비 0원.</p>

        {/* 판매(유통)회원 — 주 퍼널이라 먼저/강조 */}
        <button
          onClick={() => navigate('/wholesale/join')}
          className="w-full text-left rounded-2xl p-5 mb-3 active:scale-[0.99] transition-transform"
          style={{ background: '#fff', border: `1.5px solid ${WT.brand}`, boxShadow: WT.shCard }}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl shrink-0" style={{ background: WT.brandSoft }}>
              <Store className="w-6 h-6" style={{ color: WT.brand }} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-extrabold" style={{ color: WT.ink }}>판매사(유통회원)로 가입</p>
              <p className="text-[12.5px] mt-0.5" style={{ color: WT.ink2 }}>상품을 등급 도매가로 사입해 판매해요 — 스마트스토어 연동 지원</p>
            </div>
            <ArrowRight className="w-5 h-5 shrink-0" style={{ color: WT.brand }} />
          </div>
        </button>

        {/* 제조회원 */}
        <button
          onClick={() => navigate('/supplier/register')}
          className="w-full text-left rounded-2xl p-5 active:scale-[0.99] transition-transform"
          style={{ background: '#fff', border: `1px solid ${WT.line}`, boxShadow: WT.shSoft }}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl shrink-0" style={{ background: WT.fill }}>
              <Factory className="w-6 h-6" style={{ color: WT.ink }} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-extrabold" style={{ color: WT.ink }}>제조사(공급회원)로 가입</p>
              <p className="text-[12.5px] mt-0.5" style={{ color: WT.ink2 }}>상품을 공급하고 전국 유통사에게 판매해요 — 신원·원가 비공개</p>
            </div>
            <ArrowRight className="w-5 h-5 shrink-0" style={{ color: WT.ink3 }} />
          </div>
        </button>

        <p className="text-[12px] text-center mt-5" style={{ color: WT.ink3 }}>
          둘 다 해당되나요? 겸업 가능 — 먼저 주 역할로 가입한 뒤 다른 역할을 추가할 수 있어요.
        </p>
        <p className="text-[12.5px] text-center mt-3" style={{ color: WT.ink3 }}>
          이미 회원이신가요?{' '}
          <button onClick={() => navigate('/wholesale/login')} className="font-bold underline" style={{ color: WT.ink2 }}>유통회원 로그인</button>
          {' · '}
          <button onClick={() => navigate('/supplier/login')} className="font-bold underline" style={{ color: WT.ink2 }}>제조회원 로그인</button>
        </p>
      </div>
    </div>
  )
}
