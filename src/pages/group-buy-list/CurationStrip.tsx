// 🧱 2026-06-29 TD: GroupBuyListPage god 파일 분해 — 큐레이션 스트립(verbatim 추출). 동작/스타일 불변.
import { useTranslation } from 'react-i18next'
import { cfImage, cfSrcSet } from '@/utils/cf-image'
import type { GroupBuyProduct } from './types'

export default function CurationStrip({
  title, subtitle, items, navigate, accent,
}: {
  title: string
  subtitle: string
  items: GroupBuyProduct[]
  navigate: (to: string) => void
  accent: "red" | "amber" | "neutral"
}) {
  const { t } = useTranslation()
  const accentMap = {
    red:     { bg: "bg-red-50",   text: "text-red-600"   },
    amber:   { bg: "bg-amber-50", text: "text-amber-600" },
    neutral: { bg: "bg-gray-900", text: "text-white"     },
  }
  const a = accentMap[accent]
  const badge = accent === "red"
    ? t('groupBuy.curBadgePopular', { defaultValue: '🔥 인기' })
    : accent === "amber"
    ? t('groupBuy.curBadgeClosing', { defaultValue: '오늘 마감' })
    : t('groupBuy.curBadgeGoal', { defaultValue: '달성 🎉' })
  return (
    <section className="mb-6">
      <div className="flex items-baseline justify-between mb-2 px-1">
        <h3 className="text-[15px] font-extrabold text-gray-900 dark:text-white tracking-tight">{title}</h3>
        <span className="text-[10px] text-gray-400">{subtitle}</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 lg:-mx-8 px-4 lg:px-8 scrollbar-hide snap-x snap-mandatory">
        {items.map((p) => {
          const current = p.group_buy_current ?? 0
          return (
            <button
              key={p.id}
              onClick={() => navigate(`/group-buy/${p.id}`)}
              className="snap-start shrink-0 w-[160px] text-left rounded-2xl overflow-hidden border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] hover:shadow-md transition-shadow"
            >
              {/* 🏭 2026-06-04 (카드 로딩 체감): 큐레이션 스트립도 cfImage(리사이즈)+srcSet+dominant_color
                  — 기존 원본 풀사이즈 <img> → 첫 화면 이미지 지연. 메인 그리드와 동일 최적화. */}
              <div className="relative w-full aspect-square bg-gray-100 dark:bg-[#1A1A1A]" style={p.dominant_color ? { backgroundColor: p.dominant_color } : undefined}>
                {p.image_url ? (
                  <img
                    src={cfImage(p.image_url, { width: 320, format: 'auto' })}
                    srcSet={cfSrcSet(p.image_url, 320)}
                    sizes="160px"
                    alt={p.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-[#1A1A1A] dark:to-[#0A0A0A]" />
                )}
                <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full ${a.bg} ${a.text} text-[9px] font-extrabold`}>
                  {badge}
                </div>
              </div>
              <div className="p-2.5 space-y-1">
                <p className="text-[12px] font-bold text-gray-900 dark:text-white truncate">{p.name}</p>
                {p.restaurant_name && <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{p.restaurant_name}</p>}
                {/* 즉시판매 단일가 — 진행률 바 제거. 인원은 소셜 증거로만 노출(0명이면 가격만). */}
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  {current > 0 && (
                    <span className={`${a.text} font-bold`}>
                      {t('groupBuy.curBuying', { defaultValue: '👥 {{count}}명 함께', count: current })} ·{' '}
                    </span>
                  )}
                  ₩{p.price?.toLocaleString("ko-KR") ?? "-"}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
