/**
 * 🎟️ 공구 마켓플레이스 — 인플루언서 딜 탐색·수익 뷰 (2026-07-06 공구 엔진 §4)
 *   현재 promo 걸린 공구를 promo% 높은 순으로 탐색 → "내 예상 소개비" → 담기(기존 핀 재사용).
 *   ⚠️ GB_ENGINE_ENABLED(클라) + 서버 platform_settings.gb_engine_enabled 이중 게이트.
 *   소비자/인플루언서 대면 — 다크 토글 지원.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Megaphone, Loader2, Plus } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'
import { formatNumber } from '@/utils/format'
import DealRow from '@/components/deal/DealRow'
import { usePinAction } from '@/features/curator/hooks/usePinAction'
import { GB_ENGINE_ENABLED } from '@/shared/feature-flags'
import GbMyProposals from './gb-market/GbMyProposals'
import GbMyPerformance from './gb-market/GbMyPerformance'
import BrandLoader from '@/components/brand/BrandLoader'

interface GbDeal {
  product_id: number; name: string; image_url: string | null; category: string
  region_si: string | null; region_gu: string | null; restaurant_name: string | null
  list_price: number; gb_price: number; discount_pct: number; promo_pct: number
  deadline: string | null; target: number | null; per_unit_commission: number; link_only: boolean
}

export default function GbMarketplacePage() {
  const navigate = useNavigate()
  const [deals, setDeals] = useState<GbDeal[]>([])
  const [loading, setLoading] = useState(true)
  const { togglePin, isPinning } = usePinAction()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.get('/api/gb-marketplace')
        if (!cancelled && res.data?.success) setDeals(res.data.data || [])
      } catch { /* 게이트 OFF / 오류 — 빈 목록 */ }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#11141C] pb-24">
      <SEO title={CONSUMER_SURFACE_SEO['/gb-market'].title} description={CONSUMER_SURFACE_SEO['/gb-market'].description} url="/gb-market" noindex />
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-[#11141C]/90 backdrop-blur border-b border-gray-100 dark:border-[#2C2F35]">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} aria-label="뒤로" className="text-gray-900 dark:text-white"><ChevronLeft className="w-5 h-5" /></button>
          <h1 className="text-[16px] font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
            <Megaphone className="w-4 h-4 text-emerald-500" /> 공구 마켓
          </h1>
        </div>
      </div>

      <div className="px-4 pt-4">
        <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
          지금 <strong className="text-gray-700 dark:text-gray-200">소개비가 걸린 공구</strong>를 소개비 높은 순으로 모았어요.
          담으면 내 유어샵에 추가되고, 내 추천 링크로 팔린 만큼 소개비를 받아요.
        </p>

        {/* 🎟️ 소개 콘솔: 진행 중 공구별 내 실적(판매·확정/예정 소개비) */}
        <GbMyPerformance />

        {/* 🎟️ §2-B 인플루언서 인박스: 받은 협업 제안 승인/거절 + 내가 낸 제안 상태 */}
        <GbMyProposals />

        {loading ? (
          /* 🚑 2026-07-10 로더 통일: Loader2 → BrandLoader */
          <BrandLoader />
        ) : deals.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500 text-sm">
            {GB_ENGINE_ENABLED ? '지금 진행 중인 공구가 없어요.' : '공구 마켓 준비 중이에요.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {deals.map(d => (
              /* 🎫 2026-09-03: 자체 카드 → 줄 SSOT(`DealRow`) + 그 아래 소개자 전용 액션.
                 딜 자체를 보여 주는 부분은 다른 화면과 같은 그림이어야 하고, '소개비·담기' 는
                 이 화면에만 있는 것이라 카드 밖에 둔다. */
              <div key={d.product_id} className="rounded-2xl bg-white dark:bg-[#1D1F29] shadow-lift overflow-hidden">
                <DealRow
                  imageUrl={d.image_url}
                  eyebrow={`${d.restaurant_name || ''}${d.region_gu ? ` · ${d.region_gu}` : ''}` || undefined}
                  title={d.name}
                  price={d.gb_price}
                  discountPct={d.discount_pct > 0 ? d.discount_pct : 0}
                  className="!shadow-none !rounded-none"
                  meta={
                    <span className="inline-flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-brand text-white text-[10px] font-bold">소개비 {d.promo_pct}%</span>
                      {d.link_only && <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 text-[10px] font-semibold">링크전용</span>}
                    </span>
                  }
                />
                <div className="px-3 pb-3">
                  <p className="text-[11px] text-gray-600 dark:text-gray-300 mb-2 px-0.5">
                    건당 내 소개비 <strong className="text-gray-900 dark:text-white">{formatNumber(d.per_unit_commission)}원</strong> · 100건 팔면 약 <strong className="text-gray-900 dark:text-white">{formatNumber(d.per_unit_commission * 100)}원</strong>
                  </p>
                  <button
                    onClick={() => togglePin(d.product_id, d.gb_price)}
                    disabled={isPinning}
                    className="w-full py-2.5 rounded-xl bg-brand hover:bg-brand-dark text-white text-[13px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" /> 내 유어샵에 담기
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
