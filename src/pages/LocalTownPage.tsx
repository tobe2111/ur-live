/**
 * 🏙️ 2026-07-04 상권관 랜딩 (B2G 상권 패키지 — 대표 "다음 꺼 해줘").
 *
 * `/local/:code` — 시군구(5자리)/행정동(10자리) 지역코드의 동네딜·체험단(추첨)을 모은 상권 랜딩.
 * 상권 육성 사업의 소비자 표면: "서초 상권관" 처럼 QR/링크 하나로 그 상권의 딜 전체 진입.
 *
 * 조립 원칙(신규 코드 최소): 서버는 기존 자산만 소비 —
 *   · 동네딜: GET /api/group-buy/products?region=<code> (2026-06-18 additive 서버필터)
 *   · 체험단: GET /api/fcfs/active?region=<code> (2026-07-04 additive)
 *   · 상권명: GET /api/region/label?code=<code> (product_regions 조회, 카카오 무호출)
 * 테마: 소비자 dual(light+dark). 하단 네비 유지(풀스크린 아님).
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { formatNumber } from '@/utils/format'
import { ChevronLeft, MapPin, Store, Sparkles, Target } from 'lucide-react'
import FcfsBadge from '@/features/group-buy/FcfsBadge'
import GroupBuyFeedCard from '@/pages/main-home/GroupBuyFeedCard'
import DealRow from '@/components/deal/DealRow'
import { DEAL_GRID_GAP } from '@/shared/deal-card-grid'

interface TownProduct {
  id: number
  name: string
  price: number
  current_price?: number | null
  original_price?: number | null
  image_url?: string | null
  restaurant_name?: string | null
  restaurant_address?: string | null
  category?: string | null
  onnuri_merchant?: boolean // 🏪 2026-07-05 온누리 가맹 (seller_meta enrich)
}

interface TownFcfs extends TownProduct {
  fcfs?: { spots: number; appliedDisplay: number; deadline: string | null }
}

export default function LocalTownPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { code: rawCode } = useParams<{ code: string }>()
  const [sp] = useSearchParams()
  const code = /^\d{5,12}$/.test(String(rawCode || '')) ? String(rawCode) : ''

  const [label, setLabel] = useState<{ region_si?: string | null; region_gu?: string | null; region_dong?: string | null } | null>(null)
  const [deals, setDeals] = useState<TownProduct[] | null>(null)
  const [fcfs, setFcfs] = useState<TownFcfs[] | null>(null)

  useEffect(() => {
    if (!code) return
    let alive = true
    api.get(`/api/region/label?code=${code}`)
      .then(r => { if (alive && r.data?.success) setLabel(r.data.data || null) })
      .catch(() => {})
    api.get(`/api/group-buy/products?status=active&region=${code}&limit=60`)
      .then(r => {
        if (!alive) return
        const list = (r.data?.data || r.data?.products || []) as TownProduct[]
        setDeals(Array.isArray(list) ? list : [])
      })
      .catch(() => { if (alive) setDeals([]) })
    api.get(`/api/fcfs/active?region=${code}`)
      .then(r => { if (alive) setFcfs(Array.isArray(r.data?.data) ? r.data.data : []) })
      .catch(() => { if (alive) setFcfs([]) })
    return () => { alive = false }
  }, [code])

  // 표시명: ?n= 명시 > 라벨 API(동/구) > 폴백
  const townName = useMemo(() => {
    const q = (sp.get('n') || '').trim().slice(0, 20)
    if (q) return q
    if (label?.region_dong) return label.region_dong
    if (label?.region_gu) return label.region_gu
    return t('local.fallbackName', { defaultValue: '우리 동네' })
  }, [sp, label, t])

  if (!code) {
    return (
      <div className="min-h-[100dvh] bg-white dark:bg-[#11141C] flex flex-col items-center justify-center gap-3 px-6">
        <MapPin className="w-12 h-12 text-gray-200 dark:text-gray-700" />
        <p className="text-gray-900 dark:text-white font-bold">{t('local.badCode', { defaultValue: '올바르지 않은 상권 주소예요' })}</p>
        <button type="button" onClick={() => navigate('/')} className="text-sm font-bold text-gray-500 dark:text-gray-400 underline">
          {t('local.goHome', { defaultValue: '홈으로' })}
        </button>
      </div>
    )
  }

  const loading = deals === null
  const dealCount = deals?.length ?? 0
  const fcfsCount = fcfs?.length ?? 0

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#11141C]">
      <SEO
        title={`${townName} 상권관 - 유어딜`}
        description={`${townName}의 동네딜 이용권과 체험단 모음 — 우리 동네 매장을 할인가로 만나보세요`}
        url={`/local/${code}`}
      />

      {/* 헤더 */}
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-[#11141C]/90 backdrop-blur border-b border-gray-100 dark:border-[#2C2F35]">
        <div className="flex items-center gap-2 px-3 h-12">
          <button type="button" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} aria-label={t('common.back', { defaultValue: '뒤로' })} className="p-1.5 -ml-1 text-gray-700 dark:text-gray-200">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[15px] font-extrabold text-gray-900 dark:text-white truncate">
            {t('local.headerTitle', { defaultValue: '{{name}} 상권관', name: townName })}
          </h1>
        </div>
      </div>

      {/* 히어로 */}
      <div className="px-4 pt-5 pb-4">
        <p className="text-[22px] font-extrabold text-gray-900 dark:text-white leading-tight">
          {t('local.heroLine1', { defaultValue: '{{name}}의 딜을 한곳에서', name: townName })}
        </p>
        <p className="mt-1.5 text-[13px] text-gray-500 dark:text-gray-400 flex items-center gap-3">
          <span className="inline-flex items-center gap-1"><Store className="w-3.5 h-3.5" />{t('local.statDeals', { defaultValue: '동네딜 {{n}}', n: formatNumber(dealCount) })}</span>
          {fcfsCount > 0 && (
            <span className="inline-flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" />{t('local.statFcfs', { defaultValue: '체험단 {{n}}', n: formatNumber(fcfsCount) })}</span>
          )}
        </p>
      </div>

      <div className="px-4 pb-24 space-y-8">
        {/* 체험단(추첨) 섹션 */}
        {fcfsCount > 0 && (
          <section>
            <h2 className="text-[16px] font-extrabold text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-gray-400" aria-hidden="true" /> {t('local.fcfsTitle', { defaultValue: '체험단 모집' })}
            </h2>
            <div className="space-y-2">
              {(fcfs || []).map(p => (
                <DealRow
                  key={p.id}
                  to={`/group-buy/${p.id}`}
                  imageUrl={p.image_url}
                  eyebrow={p.restaurant_name || undefined}
                  title={p.name}
                  meta={p.fcfs
                    ? <FcfsBadge info={{ spots: p.fcfs.spots, appliedDisplay: p.fcfs.appliedDisplay }} />
                    : undefined}
                />
              ))}
            </div>
          </section>
        )}

        {/* 동네딜 그리드 */}
        <section>
          <h2 className="text-[16px] font-extrabold text-gray-900 dark:text-white mb-3">
            <span className="inline-flex items-center gap-1.5"><Store className="w-4 h-4 text-gray-400" aria-hidden="true" />{t('local.dealsTitle', { defaultValue: '동네딜' })} {dealCount > 0 ? dealCount : ''}</span>
          </h2>
          {loading ? (
            <div className="grid grid-cols-2 gap-3" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i}>
                  <div className="aspect-square rounded-xl bg-gray-100 dark:bg-[#1D1F29] animate-pulse" />
                  <div className="mt-2 h-3.5 w-3/4 rounded bg-gray-100 dark:bg-[#1D1F29] animate-pulse" />
                  <div className="mt-1.5 h-4 w-1/2 rounded bg-gray-100 dark:bg-[#1D1F29] animate-pulse" />
                </div>
              ))}
            </div>
          ) : dealCount === 0 ? (
            <div className="text-center py-14">
              <MapPin className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-gray-900 dark:text-white font-bold">{t('local.empty', { defaultValue: '이 상권의 딜을 준비 중이에요' })}</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{t('local.emptySub', { defaultValue: '곧 우리 동네 매장들이 입점합니다' })}</p>
              <button type="button" onClick={() => navigate('/')} className="mt-4 px-4 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[13px] font-bold">
                {t('local.browseAll', { defaultValue: '전체 동네딜 보기' })}
              </button>
            </div>
          ) : (
            <div className={`grid grid-cols-2 lg:grid-cols-4 ${DEAL_GRID_GAP}`}>
              {(deals || []).map(p => (
                <GroupBuyFeedCard key={p.id} p={p as never} />
              ))}
            </div>
          )}
        </section>

        {/* 지도로 보기 */}
        {dealCount > 0 && (
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full py-3.5 rounded-2xl border border-gray-200 dark:border-[#2C2F35] text-[13.5px] font-bold text-gray-700 dark:text-gray-200 flex items-center justify-center gap-1.5"
          >
            <MapPin className="w-4 h-4" /> {t('local.viewOnMap', { defaultValue: '지도에서 보기' })}
          </button>
        )}
      </div>
    </div>
  )
}
