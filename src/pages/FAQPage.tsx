import { useState } from 'react'
import { MailIcon, ClockIcon } from '@/components/icons/urdeal-icons'
import { ChevronDown, Search, HelpCircle } from 'lucide-react'
import SubPageHeader, { SUB_PAGE_CLS } from '@/components/ui/sub-page-header'
import { useTranslation } from '@/lib/i18n-lite'
import SEO from '@/components/SEO'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'
import { CONCEPT_FAQ } from '@/shared/seo/concept-content'

interface FAQ {
  id: number
  category: string
  question: string
  answer: string
}

export default function FAQPage() {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(t('faq.catAll', { defaultValue: '전체' }))
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

  const catAll = t('faq.catAll', { defaultValue: '전체' })
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

      <SubPageHeader title={t('faq.title', { defaultValue: '자주 묻는 질문' })} backLabel={t('common.back', { defaultValue: '뒤로가기' })} />

      <div className="ur-content-medium px-4 lg:px-8 pt-4 pb-20">
        {/* Hero */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <HelpCircle className="w-5 h-5 text-gray-900 dark:text-white" />
            <p className="text-[15px] font-bold text-gray-900 dark:text-white">{t('faq.heroTitle', { defaultValue: '무엇을 도와드릴까요?' })}</p>
          </div>
          <p className="text-[13px] text-gray-500 dark:text-gray-400">{t('faq.heroDesc', { defaultValue: '궁금한 내용을 빠르게 찾아보세요.' })}</p>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('faq.searchPlaceholder', { defaultValue: '궁금한 내용을 검색해보세요' })}
            className="w-full pl-9 pr-4 py-3 bg-gray-100 dark:bg-[#1D1F29] rounded-xl text-[15px] text-gray-900 dark:text-white placeholder:text-gray-400 focus:bg-white dark:focus:bg-[#11141C] focus:ring-1 focus:ring-gray-900 focus:outline-none transition-all"
          />
        </div>

        {/* 카테고리 탭 */}
        <div className="flex gap-2 mb-5 overflow-x-auto scrollbar-hide -mx-1 px-1">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full text-[13px] font-medium whitespace-nowrap transition-all ${
                selectedCategory === category
                  ? 'bg-brand text-white'
                  : 'bg-gray-100 dark:bg-[#1D1F29] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2C2F35]'
              }`}
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
          <div className="border-t border-gray-100 dark:border-[#2C2F35]">
            {filteredFAQs.map(faq => {
              const isOpen = expandedId === faq.id
              return (
                <div key={faq.id} className="border-b border-gray-100 dark:border-[#2C2F35]">
                  <button
                    onClick={() => setExpandedId(isOpen ? null : faq.id)}
                    className="w-full py-4 flex items-start gap-3 text-left hover:bg-gray-50 dark:hover:bg-[#1D1F29] transition-colors -mx-4 px-4"
                  >
                    <span className="shrink-0 w-6 h-6 rounded-full bg-brand text-white text-[12px] font-medium flex items-center justify-center mt-1">
                      Q
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-gray-500 dark:text-gray-400 font-medium mb-1">{faq.category}</p>
                      <p className="text-[15px] font-medium text-gray-900 dark:text-white leading-snug">{faq.question}</p>
                    </div>
                    <ChevronDown
                      className={`shrink-0 w-4 h-4 text-gray-400 dark:text-gray-500 mt-1 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {isOpen && (
                    <div className="pb-4 pl-9 pr-4 -mt-1">
                      <p className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">{faq.answer}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 고객센터 */}
        <div className="mt-8 bg-gray-50 dark:bg-[#1D1F29] rounded-2xl p-5">
          <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-1">{t('faq.supportTitle', { defaultValue: '도움이 더 필요하신가요?' })}</h2>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-4">{t('faq.supportDesc', { defaultValue: '궁금한 사항이 해결되지 않았다면 연락주세요.' })}</p>
          <div className="space-y-2">
            {/* 🧹 2026-06-21 (대표 — 고객센터 전화번호 전체 비노출): 전화 행 제거, 이메일/운영시간만 안내. */}
            <div className="flex items-center gap-2 text-[13px] text-gray-700 dark:text-gray-200">
              <ClockIcon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
              <span className="text-gray-500 dark:text-gray-400 w-16">{t('faq.supportHours', { defaultValue: '운영시간' })}</span>
              <span className="font-medium text-gray-900 dark:text-white">{t('faq.supportHoursValue', { defaultValue: '평일 09:00 - 18:00' })}</span>
            </div>
            <div className="flex items-center gap-2 text-[13px] text-gray-700 dark:text-gray-200">
              <MailIcon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
              <span className="text-gray-500 dark:text-gray-400 w-16">{t('faq.supportEmail', { defaultValue: '이메일' })}</span>
              <span className="font-medium text-gray-900 dark:text-white">{t('faq.supportEmailValue', { defaultValue: 'urteam.corp@gmail.com' })}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
