import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Users, Gift, ShoppingBag, Share2 } from 'lucide-react'
import SEO from '@/components/SEO'

export default function ReferralIndexPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A]">
      <SEO title={t('referral.seoTitle', { defaultValue: '친구초대 - 유어딜' })} description={t('referral.seoDesc', { defaultValue: '친구와 함께 공동구매로 더 저렴하게 쇼핑하세요' })} url="/referral" />

      <header className="sticky top-0 md:top-14 z-40 bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="ur-content-narrow flex items-center justify-between px-4 lg:px-8 h-[52px]">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center"
            aria-label={t('referral.backAria', { defaultValue: '뒤로가기' })}
          >
            <ArrowLeft className="h-5 w-5 text-gray-900 dark:text-white" />
          </button>
          <h1 className="text-[15px] font-bold text-gray-900 dark:text-white">{t('referral.title', { defaultValue: '친구초대 공동구매' })}</h1>
          <div className="w-9" />
        </div>
      </header>

      <main className="ur-content-narrow px-4 lg:px-8 pb-20">
        {/* Hero */}
        <section className="pt-6 pb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 mb-4">
            <Users className="h-8 w-8 text-white" strokeWidth={2} />
          </div>
          <h2 className="text-[22px] font-extrabold text-gray-900 dark:text-white leading-tight">
            {t('referral.heroTitle1', { defaultValue: '친구와 함께' })}<br />
            <span className="text-pink-500">{t('referral.heroTitle2', { defaultValue: '더 저렴하게' })}</span> {t('referral.heroTitle3', { defaultValue: '쇼핑하세요' })}
          </h2>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
            {t('referral.heroDesc', { defaultValue: '공동구매 인원이 모일수록 할인율이 커져요' })}
          </p>
        </section>

        {/* 이용 방법 */}
        <section className="mb-8">
          <h3 className="text-[13px] font-bold text-gray-900 dark:text-white mb-3 px-1">{t('referral.howTitle', { defaultValue: '이용 방법' })}</h3>
          <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl border border-gray-100 dark:border-[#1A1A1A] divide-y divide-gray-100 dark:divide-[#1A1A1A]">
            {[
              {
                icon: ShoppingBag,
                title: t('referral.step1Title', { defaultValue: '공동구매 상품 선택' }),
                desc: t('referral.step1Desc', { defaultValue: '라이브나 쇼핑 페이지에서 공동구매 가능한 상품을 둘러보세요' }),
                tint: 'bg-blue-50 text-blue-500',
              },
              {
                icon: Share2,
                title: t('referral.step2Title', { defaultValue: '초대 링크 공유' }),
                desc: t('referral.step2Desc', { defaultValue: '상품 페이지에서 "친구초대하기" 버튼을 눌러 링크를 공유하세요' }),
                tint: 'bg-pink-50 text-pink-500',
              },
              {
                icon: Gift,
                title: t('referral.step3Title', { defaultValue: '목표 달성 시 할인 적용' }),
                desc: t('referral.step3Desc', { defaultValue: '정해진 인원이 모이면 모두에게 추가 할인이 자동 적용됩니다' }),
                tint: 'bg-amber-50 text-amber-500',
              },
            ].map((step, i) => {
              const Icon = step.icon
              return (
                <div key={i} className="flex items-start gap-3 p-4">
                  <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${step.tint}`}>
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-gray-900 dark:text-white">
                      <span className="text-pink-500 mr-1">0{i + 1}</span>
                      {step.title}
                    </p>
                    <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* CTA */}
        <section className="space-y-2">
          <button
            onClick={() => navigate('/browse?filter=group-buy')}
            className="w-full py-3.5 bg-gray-900 text-white text-[14px] font-bold rounded-full hover:bg-gray-800 active:bg-gray-700 transition-colors"
          >
            {t('referral.ctaBrowse', { defaultValue: '공동구매 상품 둘러보기' })}
          </button>
          <button
            onClick={() => navigate('/group-buy')}
            className="w-full py-3.5 bg-white dark:bg-[#0A0A0A] text-gray-900 dark:text-white border border-gray-200 dark:border-[#2A2A2A] text-[14px] font-semibold rounded-full hover:bg-gray-50 dark:hover:bg-[#121212] transition-colors"
          >
            {t('referral.ctaList', { defaultValue: '진행 중인 공동구매 모아보기' })}
          </button>
        </section>

        {/* 안내 */}
        <p className="mt-6 text-[11px] text-gray-400 dark:text-gray-500 text-center leading-relaxed">
          {t('referral.footerNote', { defaultValue: '친구가 보낸 공동구매 링크를 받았다면 해당 링크를 눌러 그룹에 참여할 수 있습니다' })}
        </p>
      </main>
    </div>
  )
}
