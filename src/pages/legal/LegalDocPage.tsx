/**
 * 법적 문서 렌더 페이지 (공용) — LEGAL_DOCUMENTS(SSOT)의 마크다운을 BlogMarkdown 으로 안전 렌더.
 * /terms · /terms/seller · /terms/agency · /privacy · /terms/location 이 이 컴포넌트를 재사용.
 */
import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'
import { BlogMarkdown } from '@/features/blog/BlogMarkdown'
import { LEGAL_DOCUMENTS, type LegalDocKey } from '@/shared/legal'

const URL_BY_KEY: Record<LegalDocKey, string> = {
  terms: '/terms', seller: '/terms/seller', agency: '/terms/agency',
  privacy: '/privacy', location: '/terms/location',
}

export default function LegalDocPage({ docKey }: { docKey: LegalDocKey }) {
  const navigate = useNavigate()
  const doc = LEGAL_DOCUMENTS[docKey]

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#0A0A0A] pb-20">
      <SEO title={`${doc.title} - 유어딜`} description={`유어딜 ${doc.title}`} url={URL_BY_KEY[docKey]} />

      <div className="sticky top-0 md:top-14 z-40 bg-white/90 dark:bg-[#0A0A0A]/90 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="ur-content-medium flex items-center justify-between px-5 py-3">
          <button onClick={() => navigate(-1)} aria-label="뒤로 가기" className="text-gray-900 dark:text-white">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-[16px] font-bold text-gray-900 dark:text-white">{doc.title}</h1>
          <div className="w-6" />
        </div>
      </div>

      <div className="ur-content-medium px-5 pt-6">
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-6">
          시행일 {doc.effectiveDate} · 버전 {doc.version}
        </p>
        <div className="ur-legal-doc text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed">
          <BlogMarkdown content={doc.markdown} />
        </div>
      </div>
    </div>
  )
}
