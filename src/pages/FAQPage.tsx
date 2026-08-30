import { useState } from 'react'
import { ChevronLeft, ChevronDown, Search, HelpCircle, Mail, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'

interface FAQ {
  id: number
  category: string
  question: string
  answer: string
}

export default function FAQPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(t('faq.catAll', { defaultValue: '전체' }))
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const faqs: FAQ[] = [
    { id: 1, category: t('faq.catOrder', { defaultValue: '주문/결제' }), question: t('faq.q1', { defaultValue: '주문을 취소하고 싶어요' }), answer: t('faq.a1', { defaultValue: '배송 전이라면 마이페이지 > 주문내역에서 직접 취소하실 수 있습니다. 배송이 시작된 경우 매장과 협의가 필요합니다.' }) },
    { id: 2, category: t('faq.catOrder', { defaultValue: '주문/결제' }), question: t('faq.q2', { defaultValue: '결제가 완료되지 않았어요' }), answer: t('faq.a2', { defaultValue: '결제 오류 시 카드사 또는 결제사로 문의해주세요. 토스페이먼츠 고객센터: 1544-7772' }) },
    { id: 3, category: t('faq.catShipping', { defaultValue: '배송' }), question: t('faq.q3', { defaultValue: '배송 기간은 얼마나 걸리나요?' }), answer: t('faq.a3', { defaultValue: '일반적으로 결제 완료 후 2-3일 이내 배송됩니다. 매장별로 차이가 있을 수 있으며, 상품 페이지에서 확인 가능합니다.' }) },
    { id: 4, category: t('faq.catShipping', { defaultValue: '배송' }), question: t('faq.q4', { defaultValue: '배송 조회는 어떻게 하나요?' }), answer: t('faq.a4', { defaultValue: '마이페이지 > 주문내역에서 송장번호를 확인하시고 "배송 조회" 버튼을 클릭하시면 택배사 사이트로 이동합니다.' }) },
    { id: 5, category: t('faq.catExchange', { defaultValue: '교환/환불' }), question: t('faq.q5', { defaultValue: '교환/반품은 어떻게 하나요?' }), answer: t('faq.a5', { defaultValue: '상품 수령 후 7일 이내 마이페이지 > 주문내역에서 신청하실 수 있습니다. 단순 변심의 경우 왕복 배송비가 발생합니다.' }) },
    { id: 6, category: t('faq.catExchange', { defaultValue: '교환/환불' }), question: t('faq.q6', { defaultValue: '환불은 언제 되나요?' }), answer: t('faq.a6', { defaultValue: '상품 회수 확인 후 3-7 영업일 이내 결제 수단으로 환불됩니다. 신용카드는 카드사 정산일에 따라 다를 수 있습니다.' }) },
    { id: 7, category: t('faq.catMember', { defaultValue: '회원' }), question: t('faq.q7', { defaultValue: '회원가입은 어떻게 하나요?' }), answer: t('faq.a7', { defaultValue: '카카오 로그인으로 간편하게 가입하실 수 있습니다. 별도의 회원가입 절차 없이 카카오 계정으로 이용 가능합니다.' }) },
    { id: 8, category: t('faq.catMember', { defaultValue: '회원' }), question: t('faq.q8', { defaultValue: '개인정보를 수정하고 싶어요' }), answer: t('faq.a8', { defaultValue: '마이페이지에서 배송지, 연락처 등을 수정하실 수 있습니다. 카카오 계정 정보는 카카오에서 직접 수정해주세요.' }) },
    // 🧠 2026-07-27 GEO (대표 — "구글 AI 개요에 우리 서비스가"): 영구중단된 라이브 FAQ 2건 → 서비스
    //   정의 Q&A 로 교체. "유어딜 = 무엇" 을 사이트가 스스로 답해야 검색 AI 가 엔티티로 인용 가능.
    { id: 9, category: t('faq.catService', { defaultValue: '서비스' }), question: t('faq.q9', { defaultValue: '유어딜은 어떤 서비스인가요?' }), answer: t('faq.a9', { defaultValue: '유어딜(urdeal.kr)은 우리 동네 매장 이용권을 할인가로 구매해 매장에서 QR로 바로 사용하는 로컬 커머스 플랫폼입니다. 식사·뷰티·숙소 이용권과 기프티콘 교환권, 내 주변 동네딜 지도, 나만의 유어샵을 제공합니다.' }) },
    { id: 10, category: t('faq.catService', { defaultValue: '서비스' }), question: t('faq.q10', { defaultValue: '이용권은 어떻게 사용하나요?' }), answer: t('faq.a10', { defaultValue: '구매한 이용권은 마이페이지 > 내 이용권에서 확인할 수 있고, 매장에서 QR 또는 PIN을 제시하면 바로 사용됩니다. 교환권(기프티콘)은 결제 즉시 발급됩니다.' }) },
  ]

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
    <div className="min-h-screen bg-white dark:bg-[#0D0F12]">
      <SEO title={t('faq.seoTitle', { defaultValue: CONSUMER_SURFACE_SEO['/faq'].title })} description={t('faq.seoDesc', { defaultValue: CONSUMER_SURFACE_SEO['/faq'].description })} url="/faq" jsonLd={faqJsonLd} />

      {/* 상단 헤더 */}
      <header className="sticky top-0 z-10 bg-white dark:bg-[#0D0F12] border-b border-gray-100 dark:border-[#2C2F35]">
        <div className="ur-content-medium flex items-center px-4 lg:px-8 py-3">
          <button onClick={() => navigate(-1)} aria-label="뒤로 가기" className="p-1 -ml-1">
            <ChevronLeft size={22} className="text-gray-700 dark:text-gray-200" />
          </button>
          <h1 className="text-[16px] font-bold text-gray-900 dark:text-white ml-2">{t('faq.title', { defaultValue: '자주 묻는 질문' })}</h1>
        </div>
      </header>

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
            className="w-full pl-9 pr-4 py-3 bg-gray-100 dark:bg-[#1A1C21] rounded-xl text-[14px] text-gray-900 dark:text-white placeholder:text-gray-400 focus:bg-white dark:focus:bg-[#0D0F12] focus:ring-1 focus:ring-gray-900 focus:outline-none transition-all"
          />
        </div>

        {/* 카테고리 탭 */}
        <div className="flex gap-1.5 mb-5 overflow-x-auto no-scrollbar -mx-1 px-1">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-all ${
                selectedCategory === category
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 dark:bg-[#1A1C21] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2C2F35]'
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
            <p className="text-[14px] text-gray-500 dark:text-gray-400">{t('faq.emptyTitle', { defaultValue: '검색 결과가 없습니다.' })}</p>
          </div>
        ) : (
          <div className="border-t border-gray-100 dark:border-[#2C2F35]">
            {filteredFAQs.map(faq => {
              const isOpen = expandedId === faq.id
              return (
                <div key={faq.id} className="border-b border-gray-100 dark:border-[#2C2F35]">
                  <button
                    onClick={() => setExpandedId(isOpen ? null : faq.id)}
                    className="w-full py-4 flex items-start gap-3 text-left hover:bg-gray-50 dark:hover:bg-[#1A1C21] transition-colors -mx-4 px-4"
                  >
                    <span className="shrink-0 w-6 h-6 rounded-full bg-gray-900 text-white text-[11px] font-bold flex items-center justify-center mt-0.5">
                      Q
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mb-1">{faq.category}</p>
                      <p className="text-[14px] font-medium text-gray-900 dark:text-white leading-snug">{faq.question}</p>
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
        <div className="mt-8 bg-gray-50 dark:bg-[#1A1C21] rounded-2xl p-5">
          <h2 className="text-[14px] font-bold text-gray-900 dark:text-white mb-1">{t('faq.supportTitle', { defaultValue: '도움이 더 필요하신가요?' })}</h2>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-4">{t('faq.supportDesc', { defaultValue: '궁금한 사항이 해결되지 않았다면 연락주세요.' })}</p>
          <div className="space-y-2.5">
            {/* 🧹 2026-06-21 (대표 — 고객센터 전화번호 전체 비노출): 전화 행 제거, 이메일/운영시간만 안내. */}
            <div className="flex items-center gap-2.5 text-[13px] text-gray-700 dark:text-gray-200">
              <Clock className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
              <span className="text-gray-500 dark:text-gray-400 w-16">{t('faq.supportHours', { defaultValue: '운영시간' })}</span>
              <span className="font-medium text-gray-900 dark:text-white">{t('faq.supportHoursValue', { defaultValue: '평일 09:00 - 18:00' })}</span>
            </div>
            <div className="flex items-center gap-2.5 text-[13px] text-gray-700 dark:text-gray-200">
              <Mail className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
              <span className="text-gray-500 dark:text-gray-400 w-16">{t('faq.supportEmail', { defaultValue: '이메일' })}</span>
              <span className="font-medium text-gray-900 dark:text-white">{t('faq.supportEmailValue', { defaultValue: 'support@ur-team.com' })}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
