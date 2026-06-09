// ──────────────────────────────────────────────────────────────
// 🏭 2026-06-09 Wave 2 — /wholesale/proposals 풀페이지 (헤더 모달과 동일 폼/내역).
//   라이트 고정 B2B (WT 토큰). 비로그인 → 로그인 유도.
// ──────────────────────────────────────────────────────────────
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import SEO from '@/components/SEO'
import { WT } from './wholesale-theme'
import { WholesaleProposalForm } from './WholesaleProposalModal'
import WholesaleFooter from './WholesaleFooter'

const hasSellerToken = () => typeof window !== 'undefined' && !!localStorage.getItem('seller_token')

export default function WholesaleProposalsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const loggedIn = hasSellerToken()

  return (
    <div className="min-h-screen" style={{ background: '#fff', color: WT.ink }}>
      <SEO
        domain="wholesale"
        title={t('wholesale.proposal.seoTitle', { defaultValue: '제안 / 신고 — 유통스타트 도매몰' })}
        description={t('wholesale.proposal.seoDesc', { defaultValue: '필요한 상품 제안과 불편/문제 신고를 운영팀에 전달하세요.' })}
        url="/wholesale/proposals"
      />
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur" style={{ borderBottom: '1px solid ' + WT.line }}>
        <div className="ur-content-narrow px-5 lg:px-8 h-14 flex items-center gap-3">
          <button onClick={() => navigate('/wholesale')} aria-label={t('common.back', { defaultValue: '뒤로' })} className="p-1 -ml-1" style={{ color: WT.ink2 }}>
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[16px] font-extrabold" style={{ color: WT.ink }}>
            {t('wholesale.proposal.title', { defaultValue: '제안 / 신고' })}
          </h1>
        </div>
      </header>

      <main className="ur-content-narrow px-5 lg:px-8 py-6">
        <p className="text-[13px] mb-5" style={{ color: WT.ink3 }}>
          {t('wholesale.proposal.desc', { defaultValue: '필요한 상품 제안이나 불편/문제를 운영팀에 전달해 주세요' })}
        </p>
        {loggedIn ? (
          <WholesaleProposalForm />
        ) : (
          <div className="py-12 text-center">
            <p className="text-[14px] mb-4" style={{ color: WT.ink2 }}>
              {t('wholesale.proposal.loginNeeded', { defaultValue: '로그인하면 제안/신고를 보낼 수 있어요' })}
            </p>
            <button onClick={() => navigate('/wholesale/login')} className="rounded-xl px-5 py-3 text-[14px] font-bold text-white" style={{ background: WT.brand }}>
              {t('wholesale.login', { defaultValue: '유통회원 로그인' })}
            </button>
          </div>
        )}
      </main>
      <WholesaleFooter />
    </div>
  )
}
