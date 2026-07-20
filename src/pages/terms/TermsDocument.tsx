/**
 * 약관 문서 공통 렌더러 — CONSUMER/SELLER/AGENCY 약관 페이지가 공유.
 * 소비자 라우트라 다크 토글 대응(dark: variants).
 */
import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'
import type { TermsDoc } from './terms-types'

export default function TermsDocument({ doc, url }: { doc: TermsDoc; url: string }) {
  const navigate = useNavigate()
  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#0F151D] pb-20">
      <SEO title={`${doc.title} - 유어딜`} description={`${doc.title} (시행 ${doc.effective} · v${doc.version})`} url={url} />

      <div className="sticky top-0 md:top-14 z-40 bg-white/90 dark:bg-[#0F151D]/90 backdrop-blur border-b border-gray-100 dark:border-[#2A3446]">
        <div className="ur-content-medium flex items-center justify-between px-5 py-3">
          <button onClick={() => navigate(-1)} aria-label="뒤로 가기" className="text-gray-900 dark:text-white">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-[16px] font-bold text-gray-900 dark:text-white">{doc.title}</h1>
          <div className="w-6" />
        </div>
      </div>

      <div className="ur-content-medium px-5 pt-6">
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1">시행일: {doc.effective} · 버전 {doc.version}</p>
        {doc.preamble?.map((p, i) => (
          <p key={i} className="text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed mt-2">{p}</p>
        ))}

        <div className="mt-5">
          {doc.sections.map((s, i) => (
            <section key={i} className={i > 0 ? 'border-t border-gray-100 dark:border-[#2A3446] pt-6 mt-6' : ''}>
              {s.chapter && (
                <p className="text-[12px] font-bold tracking-wide text-gray-400 dark:text-gray-500 mb-3">{s.chapter}</p>
              )}
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">{s.title}</h2>
              {s.paras?.map((p, j) => (
                <p key={j} className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed mb-3">{p}</p>
              ))}
              {s.items && (
                <ol className="list-decimal list-outside pl-5 space-y-2 text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                  {s.items.map((it, j) => <li key={j}>{it}</li>)}
                </ol>
              )}
            </section>
          ))}
        </div>

        <div className="bg-gray-50 dark:bg-[#1A2334] rounded-lg p-4 mt-8">
          <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed">{doc.footer}</p>
        </div>
      </div>
    </div>
  )
}
