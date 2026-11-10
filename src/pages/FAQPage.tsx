import { useState } from 'react'
import { MailIcon, ClockIcon } from '@/components/icons/urdeal-icons'
import { ChevronDown, Search, HelpCircle } from 'lucide-react'
import SubPageHeader, { SUB_PAGE_CLS } from '@/components/ui/sub-page-header'
import { useTranslation } from '@/lib/i18n-lite'
import SEO from '@/components/SEO'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'
import { CONCEPT_FAQ } from '@/shared/seo/concept-content'
import { FAQ_CLS, FAQ_COPY } from '@/shared/faq-page' // ❓ 2026-11-10 서버 첫 화면(worker/utils/faq-first-screen.ts)과 같은 클래스·문구
const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다 — 공유 모듈로 빼면 묶음기가 화면마다 청크를 하나 더 만든다(2026-11-02 실측)
// 🎬 2026-11-02 11차 ② — 답이 툭 생기며 아래 질문을 한 번에 미는 대신, 높이가 부드럽게 열리고 닫힌다(grid 0fr→1fr).
injectMotionCss('ur-m-faq', `.ur-faq-a { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .3s cubic-bezier(.2,.9,.3,1); }.ur-faq-a > div { overflow: hidden; }.ur-faq-a.is-open { grid-template-rows: 1fr; }.ur-faq-a p { opacity: 0; transition: opacity .2s ease; }.ur-faq-a.is-open p { opacity: 1; transition-delay: .08s; }@media (prefers-reduced-motion: reduce){.ur-faq-a,.ur-faq-a p{transition:none!important}}`)

interface FAQ {
  id: number
  category: string
  question: string
  answer: string
}

export default function FAQPage() {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(t('faq.catAll', { defaultValue: FAQ_COPY.catAll }))
  const [expandedId, setExpandedId] = useState<number | null>(null)

  /**
   * 🧭 2026-10-12: 문구를 `shared/seo/concept-content.ts` 로 옮겼다 — **워커가 같은 배열로
   * 서버 `FAQPage` JSON-LD 와 크롤러 본문을 만든다.** 종전엔 이 화면에만 있어서 JS 를 돌리지
   * 않는 크롤러는 `/faq` 에서 **33자**(제목뿐)를 받았고 `FAQPage` 구조화 데이터는 0건이었다.
   * `t(key, { defaultValue })` 는 그대로다 — 언어별 번역이 있으면 그쪽이 이긴다(한국어 기본값만 SSOT).
   */
  const faqs: FAQ[] = CONCEPT_FAQ.map((f, i) => ({
    id: i + 1,
    category: t(f.categoryKey, { defaultValue: f.category }),
    question: t(f.key, { defaultValue: f.question }),
    answer: t(f.key.replace(/\.q/, '.a'), { defaultValue: f.answer }),
  }))

  // FAQPage 구조화 데이터 — 리스트 실데이터에서 생성(내용-스키마 불일치 구조적 0).
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }

  const catAll = t('faq.catAll', { defaultValue: FAQ_COPY.catAll })
  const categories = [catAll, ...Array.from(new Set(faqs.map(f => f.category)))]

  const filteredFAQs = faqs.filter(faq => {
    const matchesCategory = selectedCategory === catAll || faq.category === selectedCategory
    const matchesSearch = searchQuery === '' ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <div className={SUB_PAGE_CLS}>
      <SEO title={t('faq.seoTitle', { defaultValue: CONSUMER_SURFACE_SEO['/faq'].title })} description={t('faq.seoDesc', { defaultValue: CONSUMER_SURFACE_SEO['/faq'].description })} url="/faq" jsonLd={faqJsonLd} />

      <SubPageHeader title={t('faq.title', { defaultValue: FAQ_COPY.title })} fallback="/" backLabel={t('common.back', { defaultValue: '뒤로가기' })} />

      <div className={FAQ_CLS.content}>
        {/* Hero */}
        <div className={FAQ_CLS.hero}>
          <div className={FAQ_CLS.heroRow}>
            <HelpCircle className={FAQ_CLS.heroIcon} />
            <p className={FAQ_CLS.heroTitle}>{t('faq.heroTitle', { defaultValue: FAQ_COPY.heroTitle })}</p>
          </div>
          <p className={FAQ_CLS.heroDesc}>{t('faq.heroDesc', { defaultValue: FAQ_COPY.heroDesc })}</p>
        </div>

        {/* Search */}
        <div className={FAQ_CLS.search}>
          <Search className={FAQ_CLS.searchIcon} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('faq.searchPlaceholder', { defaultValue: FAQ_COPY.searchPlaceholder })}
            className={FAQ_CLS.searchInput}
          />
        </div>

        {/* 카테고리 탭 */}
        <div className={FAQ_CLS.chips}>
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`${FAQ_CLS.chip} ${selectedCategory === category ? FAQ_CLS.chipOn : FAQ_CLS.chipOff}`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* FAQ 리스트 */}
        {filteredFAQs.length === 0 ? (
          <div className="py-16 text-center">
            <HelpCircle className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-[15px] text-gray-500 dark:text-gray-400">{t('faq.emptyTitle', { defaultValue: '검색 결과가 없습니다.' })}</p>
          </div>
        ) : (
          <div className={FAQ_CLS.list}>
            {filteredFAQs.map(faq => {
              const isOpen = expandedId === faq.id
              return (
                <div key={faq.id} className={FAQ_CLS.item}>
                  <button
                    onClick={() => setExpandedId(isOpen ? null : faq.id)}
                    className={FAQ_CLS.q}
                  >
                    <span className={FAQ_CLS.qBadge}>
                      {FAQ_COPY.badge}
                    </span>
                    <div className={FAQ_CLS.qText}>
                      <p className={FAQ_CLS.qCat}>{faq.category}</p>
                      <p className={FAQ_CLS.qTitle}>{faq.question}</p>
                    </div>
                    <ChevronDown
                      className={`${FAQ_CLS.qChev} ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* 답은 늘 그려 두고 높이만 연다 — 닫힌 동안은 읽기 프로그램·탭 이동에서 빠진다(inert). */}
                  <div className={`ur-faq-a${isOpen ? ' is-open' : ''}`} aria-hidden={!isOpen} {...(isOpen ? {} : { inert: '' })}>
                    <div>
                      <div className={FAQ_CLS.aInner}>
                        <p className={FAQ_CLS.aText}>{faq.answer}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 고객센터 */}
        <div className={FAQ_CLS.support}>
          <h2 className={FAQ_CLS.supportTitle}>{t('faq.supportTitle', { defaultValue: FAQ_COPY.supportTitle })}</h2>
          <p className={FAQ_CLS.supportDesc}>{t('faq.supportDesc', { defaultValue: FAQ_COPY.supportDesc })}</p>
          <div className={FAQ_CLS.supportRows}>
            {/* 🧹 2026-06-21 (대표 — 고객센터 전화번호 전체 비노출): 전화 행 제거, 이메일/운영시간만 안내. */}
            <div className={FAQ_CLS.supportRow}>
              <ClockIcon className={FAQ_CLS.supportIcon} />
              <span className={FAQ_CLS.supportLabel}>{t('faq.supportHours', { defaultValue: FAQ_COPY.supportHours })}</span>
              <span className={FAQ_CLS.supportValue}>{t('faq.supportHoursValue', { defaultValue: FAQ_COPY.supportHoursValue })}</span>
            </div>
            <div className={FAQ_CLS.supportRow}>
              <MailIcon className={FAQ_CLS.supportIcon} />
              <span className={FAQ_CLS.supportLabel}>{t('faq.supportEmail', { defaultValue: FAQ_COPY.supportEmail })}</span>
              <span className={FAQ_CLS.supportValue}>{t('faq.supportEmailValue', { defaultValue: FAQ_COPY.supportEmailValue })}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
