// 🧱 2026-06-29 TD: GroupBuyListPage god 파일 분해 — 빈 화면 '곧 오픈' showcase(verbatim 추출). 동작 불변.
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { SHOPPING_TAB_HIDDEN } from '@/shared/feature-flags'

interface ShowcaseCard { emoji: string; label: string; desc: string }

export default function EmptyShowcase({ catEmpty, showcaseCards, createPath, startCtaLabel, navigate }: {
  catEmpty?: { noun: string } | null
  showcaseCards: ShowcaseCard[]
  createPath: string
  startCtaLabel: string
  navigate: (to: string) => void
}) {
  const { t } = useTranslation()
  return (
              <div className="space-y-4 py-8">
                {/* 🛡️ 2026-05-15: 빈 화면 → "곧 오픈 예정" Coming Soon 카드 (3 AI 합의) */}
                <div className="text-center mb-4">
                  <p className="text-[28px] mb-2">🚀</p>
                  <p className="text-gray-900 dark:text-white font-bold text-[15px]">
                    {t('groupBuy.emptySellerNew', { defaultValue: '곧 오픈 예정' })}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 text-[12px] mt-1">
                    {catEmpty
                      ? t('groupBuy.emptyCatSub', { defaultValue: '{{noun}} 공구가 곧 시작될 예정이에요. 알림 받아두세요!', noun: catEmpty.noun })
                      : t('groupBuy.emptySellerNewSub', { defaultValue: '셀러들이 매일 새 공구를 등록 중이에요. 알림 받아두세요!' })}
                  </p>
                </div>
                <div className={`max-w-md mx-auto ${showcaseCards.length === 1 ? 'flex justify-center' : 'grid grid-cols-2 gap-3'}`}>
                  {showcaseCards.map((c, i) => (
                    <div key={i} className={`bg-white dark:bg-[#0A0A0A] border-2 border-dashed border-gray-200 dark:border-[#2A2A2A] rounded-2xl p-4 text-center opacity-70 hover:opacity-100 transition-opacity ${showcaseCards.length === 1 ? 'w-44' : ''}`}>
                      <p className="text-3xl mb-1.5">{c.emoji}</p>
                      <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{c.label}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{c.desc}</p>
                      <span className="inline-block mt-2 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[9px] font-bold">{t('groupBuy.soonOpen', { defaultValue: '곧 오픈' })}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex gap-2 justify-center flex-wrap">
                  <button
                    onClick={() => navigate(createPath)}
                    className="flex items-center gap-1 px-5 py-2.5 bg-gray-900 text-white text-[13px] font-semibold rounded-full"
                  >
                    <Plus className="w-3.5 h-3.5" /> {startCtaLabel}
                  </button>
                  {/* 🧭 2026-06-10: 쇼핑 잠정 숨김 동안엔 숨겨진 표면으로 보내지 않음 — 홈(교환권)으로 */}
                  <button
                    onClick={() => navigate(SHOPPING_TAB_HIDDEN ? '/' : '/browse')}
                    className="px-5 py-2.5 bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-300 text-[13px] font-semibold rounded-full"
                  >
                    {SHOPPING_TAB_HIDDEN
                      ? t('groupBuy.ctaVouchers', { defaultValue: '교환권 보러가기' })
                      : t('groupBuy.ctaShop', { defaultValue: '쇼핑하러 가기' })}
                  </button>
                </div>
              </div>
  )
}
