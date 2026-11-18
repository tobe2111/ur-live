/**
 * 약관 문서 공통 렌더러 — CONSUMER/SELLER/AGENCY 약관 페이지가 공유.
 * 소비자 라우트라 다크 토글 대응(dark: variants).
 */
import { ChevronLeft } from 'lucide-react'
import SEO from '@/components/SEO'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'
import type { TermsDoc } from './terms-types'
import { useSafeBack } from '@/hooks/useSafeBack'
import { TERMS_CLS, TERMS_COPY, termsEffectiveLine } from '@/shared/terms-page' // ⚖️ 2026-11-18 클래스 SSOT — 서버 첫 화면(`worker/utils/legal-first-screen.ts`)과 한 벌

export default function TermsDocument({ doc, url }: { doc: TermsDoc; url: string }) {
  const goBack = useSafeBack('/')
  // 메타는 서버(비-JS 크롤러)와 같은 표에서 읽는다 — 두 벌이면 갈라진다.
  // 표에 없는 약관(도매 등 향후 추가분)은 기존처럼 문서에서 파생.
  const seo = CONSUMER_SURFACE_SEO[url]
  return (
    <div className={TERMS_CLS.root}>
      <SEO
        title={seo?.title ?? doc.title}
        description={seo?.description ?? `${doc.title} (시행 ${doc.effective} · v${doc.version})`}
        url={url}
      />

      <div className={TERMS_CLS.header}>
        <div className={TERMS_CLS.headerRow}>
          <button onClick={goBack} aria-label={TERMS_COPY.back} className={TERMS_CLS.back}>
            <ChevronLeft className={TERMS_CLS.backIcon} />
          </button>
          <h1 className={TERMS_CLS.title}>{doc.title}</h1>
          <div className={TERMS_CLS.spacer} />
        </div>
      </div>

      <div className={TERMS_CLS.content}>
        <p className={TERMS_CLS.effective}>{termsEffectiveLine(doc.effective, doc.version)}</p>
        {doc.preamble?.map((p, i) => (
          <p key={i} className={TERMS_CLS.preamble}>{p}</p>
        ))}

        <div className={TERMS_CLS.sections}>
          {doc.sections.map((s, i) => (
            <section key={i} className={i > 0 ? TERMS_CLS.sectionRest : ''}>
              {s.chapter && (
                <p className={TERMS_CLS.chapter}>{s.chapter}</p>
              )}
              <h2 className={TERMS_CLS.h2}>{s.title}</h2>
              {s.paras?.map((p, j) => (
                <p key={j} className={TERMS_CLS.para}>{p}</p>
              ))}
              {s.items && (
                <ol className={TERMS_CLS.items}>
                  {s.items.map((it, j) => <li key={j}>{it}</li>)}
                </ol>
              )}
            </section>
          ))}
        </div>

        <div className={TERMS_CLS.footer}>
          <p className={TERMS_CLS.footerText}>{doc.footer}</p>
        </div>
      </div>
    </div>
  )
}
