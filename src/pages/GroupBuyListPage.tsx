import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ChevronLeft,
  ChevronDown,
  Clock,
  Users,
  CheckCircle2,
  Sparkles,
  Plus,
  MapPin,
  HandCoins,
  Bell,
} from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { formatPrice } from '@/utils/currency'
import { toast } from '@/hooks/useToast'
import { SORT_LABELS, STATUS_BADGES } from './group-buy-list/constants'
import { formatTimeLeft, calcDiscountRate } from './group-buy-list/utils'
import type { GroupBuyProduct, CommunityGroupBuy, MainTab, CategoryFilter, SortOption } from './group-buy-list/types'
import LiveTicker from '@/components/group-buy/LiveTicker'
import RecentlyViewedStrip from '@/components/group-buy/RecentlyViewedStrip'

// 🛡️ 2026-05-02: TD-018 분할 — types/constants/utils 를 ./group-buy-list/ 로 추출.

export default function GroupBuyListPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [mainTab, setMainTab] = useState<MainTab>('seller')
  const [items, setItems] = useState<GroupBuyProduct[]>([])
  const [communityItems, setCommunityItems] = useState<CommunityGroupBuy[]>([])
  const [loading, setLoading] = useState(true)
  const [communityLoading, setCommunityLoading] = useState(true)
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [sortBy, setSortBy] = useState<SortOption>('popular')
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [interestedIds, setInterestedIds] = useState<Set<number>>(new Set())

  const toggleInterest = (e: React.MouseEvent, productId: number, restaurantName?: string) => {
    e.stopPropagation()
    e.preventDefault()
    const isAdding = !interestedIds.has(productId)
    setInterestedIds(prev => {
      const next = new Set(prev)
      if (isAdding) next.add(productId)
      else next.delete(productId)
      return next
    })
    if (isAdding) {
      api.post('/api/interest/add', {
        restaurant_name: restaurantName || '',
        product_id: productId,
        type: 'group_buy',
      }).catch(() => {
        setInterestedIds(prev => { const next = new Set(prev); next.delete(productId); return next })
      })
      toast.success(t('common.interestAdded'))
    } else {
      api.post('/api/interest/remove', { product_id: productId, type: 'group_buy' }).catch(() => {
        setInterestedIds(prev => { const next = new Set(prev); next.add(productId); return next })
      })
      toast.info(t('common.interestRemoved'))
    }
  }

  // 셀러 공구 로딩
  useEffect(() => {
    setLoading(true)
    api
      .get('/api/group-buy/products?status=active')
      .then((r) => {
        if (r.data?.success) setItems(r.data.data || [])
        else toast.error(t('common.loadFailed'))
      })
      .catch(() => toast.error(t('common.networkError', { defaultValue: '네트워크 오류가 발생했습니다' })))
      .finally(() => setLoading(false))
  }, [])

  // 유저 공구 로딩
  useEffect(() => {
    setCommunityLoading(true)
    api
      .get('/api/community-group-buy/list?status=proposed&sort=popular&limit=20')
      .then((r) => {
        if (r.data?.success) setCommunityItems(r.data.data || [])
      })
      .catch((e) => { if (import.meta.env.DEV) console.warn('[GroupBuy] community list failed:', e) })
      .finally(() => setCommunityLoading(false))
  }, [])

  useEffect(() => {
    if (!showSortDropdown) return
    const handler = () => setShowSortDropdown(false)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [showSortDropdown])

  const filtered = useMemo(() => {
    let result = [...items]

    // 카테고리 필터
    if (category === 'meal_voucher') {
      result = result.filter((p) => p.category === 'meal_voucher')
    } else if (category === 'general') {
      result = result.filter((p) => p.category !== 'meal_voucher')
    }

    // 정렬
    switch (sortBy) {
      case 'popular':
        result.sort(
          (a, b) =>
            (b.group_buy_current || b.sold_count || 0) -
            (a.group_buy_current || a.sold_count || 0)
        )
        break
      case 'deadline': {
        const getTs = (p: GroupBuyProduct) =>
          p.group_buy_deadline
            ? new Date(p.group_buy_deadline).getTime()
            : Number.MAX_SAFE_INTEGER
        result.sort((a, b) => getTs(a) - getTs(b))
        break
      }
      case 'newest':
        result.sort((a, b) => {
          const aTs = a.created_at ? new Date(a.created_at).getTime() : 0
          const bTs = b.created_at ? new Date(b.created_at).getTime() : 0
          return bTs - aTs
        })
        break
    }

    return result
  }, [items, category, sortBy])

  const filteredCommunity = useMemo(() => {
    let result = [...communityItems]

    switch (sortBy) {
      case 'popular':
        result.sort((a, b) => b.current_count - a.current_count)
        break
      case 'deadline': {
        const getTs = (p: CommunityGroupBuy) =>
          p.expires_at
            ? new Date(p.expires_at).getTime()
            : Number.MAX_SAFE_INTEGER
        result.sort((a, b) => getTs(a) - getTs(b))
        break
      }
      case 'newest':
        result.sort((a, b) => {
          const aTs = a.created_at ? new Date(a.created_at).getTime() : 0
          const bTs = b.created_at ? new Date(b.created_at).getTime() : 0
          return bTs - aTs
        })
        break
    }

    return result
  }, [communityItems, sortBy])

  const currentCount = mainTab === 'seller' ? filtered.length : filteredCommunity.length
  const isCurrentLoading = mainTab === 'seller' ? loading : communityLoading

  return (
    <div className="bg-white dark:bg-[#0A0A0A] min-h-screen">
      <SEO
        title={t('groupBuy.seoTitle', { defaultValue: '공동구매 — 식사권 / 뷰티 / 헬스 / 펫 / 숙박 / 액티비티' })}
        description={t('groupBuy.seoDesc', { defaultValue: '맛집 식사권, 뷰티 시술, 헬스 PT, 펜션, 액티비티까지 — 함께 모이면 더 싸게! 진행 중인 공동구매를 한 눈에 확인하세요.' })}
        url="/group-buy"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: '유어딜 공동구매',
            description: '맛집·뷰티·헬스·펫·숙박·액티비티 공동구매 모음',
            url: 'https://live.ur-team.com/group-buy',
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: '홈', item: 'https://live.ur-team.com/' },
              { '@type': 'ListItem', position: 2, name: '공동구매', item: 'https://live.ur-team.com/group-buy' },
            ],
          },
          // 진행 중 공구가 있으면 ItemList 로 노출 (SERP rich result)
          ...(items.length > 0 ? [{
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            itemListElement: items.slice(0, 10).map((p, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: p.name,
              url: `https://live.ur-team.com/group-buy/${p.id}`,
              ...(p.image_url ? { image: p.image_url } : {}),
            })),
          }] : []),
        ]}
      />

      {/* 헤더 */}
      <header className="sticky top-0 md:top-14 z-40 bg-white dark:bg-[#0A0A0A] border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="ur-content-wide flex items-center h-12 px-2 lg:px-8">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-1"
            aria-label={t('common.back', { defaultValue: '뒤로' })}
          >
            <ChevronLeft className="w-6 h-6 text-gray-900 dark:text-white" />
          </button>
          <h1 className="text-[16px] font-extrabold text-gray-900 dark:text-white flex-1 text-center pr-8">
            {t('groupBuy.title', { defaultValue: '공동구매' })}
          </h1>
        </div>
      </header>

      {/* 배너 — 클릭 시 맛집 공구 시작 */}
      <div className="ur-content-wide px-4 lg:px-8 pt-4">
        <div className="bg-gradient-to-r from-pink-500 via-rose-500 to-red-500 rounded-2xl px-5 py-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-white text-[15px] font-extrabold">
              <Sparkles className="inline w-4 h-4 mr-1 -mt-0.5" />
              {t('groupBuy.bannerHeadline', { defaultValue: '함께 모일수록 더 싸져요!' })}
            </p>
            <p className="text-white/90 text-[11px] mt-1">
              {t('groupBuy.bannerSubline', { defaultValue: '최대 50% 할인 — 목표 달성 시 특가로 구매 가능' })}
            </p>
          </div>
          <button
            onClick={() => navigate('/community-group-buy/new')}
            className="shrink-0 flex items-center gap-1 bg-white text-rose-600 px-3 py-2 rounded-full text-[12px] font-extrabold shadow-sm active:scale-95 transition-transform"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('groupBuy.startCta', { defaultValue: '시작' })}
          </button>
        </div>
      </div>

      {/* 메인 탭: 셀러 공구 | 유저 공구 */}
      <div className="ur-content-wide px-4 lg:px-8 mt-4">
        <div className="flex border-b border-gray-200 dark:border-[#1A1A1A]">
          <button
            onClick={() => { setMainTab('seller'); setCategory('all'); setSortBy('popular') }}
            className={`flex-1 pb-2.5 text-[14px] font-semibold text-center transition-colors border-b-2 ${
              mainTab === 'seller'
                ? 'text-gray-900 dark:text-white border-gray-900 dark:border-white'
                : 'text-gray-400 dark:text-gray-600 border-transparent'
            }`}
          >
            {t('groupBuy.tabSeller', { defaultValue: '셀러 공구' })}
          </button>
          <button
            onClick={() => { setMainTab('community'); setCategory('all'); setSortBy('popular') }}
            className={`flex-1 pb-2.5 text-[14px] font-semibold text-center transition-colors border-b-2 ${
              mainTab === 'community'
                ? 'text-gray-900 dark:text-white border-gray-900 dark:border-white'
                : 'text-gray-400 dark:text-gray-600 border-transparent'
            }`}
          >
            {t('groupBuy.tabCommunity', { defaultValue: '유저 공구' })}
          </button>
        </div>
      </div>

      {/* 카테고리 탭 (셀러 공구 전용) */}
      {mainTab === 'seller' && (
        <div className="ur-content-wide px-4 lg:px-8 mt-4">
          <div className="flex gap-2">
            {([
              { key: 'all', label: t('groupBuy.categoryAll', { defaultValue: '전체' }) },
              { key: 'meal_voucher', label: t('groupBuy.categoryMealVoucher', { defaultValue: '맛집 식사권' }) },
              { key: 'general', label: t('groupBuy.categoryGeneral', { defaultValue: '일반 상품' }) },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setCategory(tab.key)}
                className={`px-4 py-2 rounded-full text-[12px] font-semibold whitespace-nowrap border transition-colors ${
                  category === tab.key
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white'
                    : 'bg-white dark:bg-transparent text-gray-700 dark:text-gray-300 border-gray-200 dark:border-[#2A2A2A]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 정렬 pills */}
      <div className={`ur-content-wide px-4 lg:px-8 ${mainTab === 'seller' ? 'mt-3' : 'mt-4'} flex items-center justify-between`}>
        <span className="text-[12px] text-gray-500 dark:text-gray-400">
          {t('groupBuy.totalCount', { defaultValue: '총 {{count}}개', count: currentCount })}
        </span>
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowSortDropdown((v) => !v)}
            className="flex items-center gap-1 text-[13px] text-gray-700 dark:text-gray-300 font-semibold"
          >
            {SORT_LABELS[sortBy]}
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                showSortDropdown ? 'rotate-180' : ''
              }`}
            />
          </button>
          {showSortDropdown && (
            <div className="absolute top-full right-0 mt-1 w-36 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#2A2A2A] rounded-xl shadow-lg z-30 overflow-hidden">
              {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    setSortBy(opt)
                    setShowSortDropdown(false)
                  }}
                  className={`w-full text-left px-3 py-2.5 text-[13px] ${
                    sortBy === opt
                      ? 'bg-pink-50 dark:bg-pink-500/10 text-pink-600 dark:text-pink-400 font-semibold'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.06]'
                  }`}
                >
                  {SORT_LABELS[opt]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 🛡️ 2026-04-27: 맛집 공구 시작 FAB 제거.
          기존엔 우측 하단 floating 버튼이 카카오 상담 버튼과 겹치고 우측 벽에 붙어 어색했음.
          현재는 hero banner 우측 '시작' 버튼 + empty state CTA 로 자연스럽게 통합. */}

      {/* 🛡️ 2026-05-15: 실시간 ticker — "지금 이 사람이 참여" SNS 흐름 */}
      <div className="ur-content-wide px-4 lg:px-8 mt-3">
        <LiveTicker />
      </div>

      {/* 콘텐츠 영역 */}
      <div className="ur-content-wide px-4 lg:px-8 py-4 pb-20">
        {mainTab === 'seller' ? (
          /* ── 셀러 공구 상품 그리드 (2열) ── */
          <>
            {/* 🛡️ 2026-05-15: 최근 본 공구 — localStorage 기반 (재방문 promote) */}
            <RecentlyViewedStrip />

            {/* 🛡️ 2026-05-15: 큐레이션 섹션 — 1명 남음 / 오늘 마감 / 거의 성공 */}
            {!loading && filtered.length > 0 && (() => {
              const lastOne = filtered.filter(p => (p.group_buy_target ?? 0) > 0 && ((p.group_buy_target ?? 0) - (p.group_buy_current ?? 0)) === 1).slice(0, 4)
              const closingToday = filtered.filter(p => {
                if (!p.group_buy_deadline) return false
                const ms = new Date(p.group_buy_deadline).getTime() - Date.now()
                return ms > 0 && ms < 24 * 3600 * 1000
              }).slice(0, 4)
              const almostDone = filtered.filter(p => {
                if (!p.group_buy_target) return false
                const pct = (p.group_buy_current ?? 0) / p.group_buy_target
                return pct >= 0.7 && pct < 1
              }).slice(0, 4)

              return (
                <>
                  {lastOne.length > 0 && (
                    <CurationStrip
                      title="🔥 1명만 더 모이면 성공"
                      subtitle="지금 참여하면 바로 공구 확정"
                      items={lastOne}
                      navigate={navigate}
                      accent="red"
                    />
                  )}
                  {closingToday.length > 0 && (
                    <CurationStrip
                      title="⏰ 오늘 마감"
                      subtitle="놓치면 다음 기회까지 며칠"
                      items={closingToday}
                      navigate={navigate}
                      accent="amber"
                    />
                  )}
                  {almostDone.length > 0 && (
                    <CurationStrip
                      title="✨ 거의 성공"
                      subtitle="목표의 70% 이상"
                      items={almostDone}
                      navigate={navigate}
                      accent="pink"
                    />
                  )}
                </>
              )
            })()}

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i}>
                    <div className="aspect-square bg-gray-100 dark:bg-[#1A1A1A] animate-pulse rounded-xl" />
                    <div className="mt-2 h-3 bg-gray-100 dark:bg-[#1A1A1A] rounded animate-pulse" />
                    <div className="mt-1 h-3 bg-gray-100 dark:bg-[#1A1A1A] rounded animate-pulse w-2/3" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="space-y-4 py-8">
                {/* 🛡️ 2026-05-15: 빈 화면 → "곧 오픈 예정" Coming Soon 카드 (3 AI 합의) */}
                <div className="text-center mb-4">
                  <p className="text-[28px] mb-2">🚀</p>
                  <p className="text-gray-900 dark:text-white font-bold text-[15px]">
                    {t('groupBuy.emptySellerNew', { defaultValue: '곧 오픈 예정' })}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 text-[12px] mt-1">
                    {t('groupBuy.emptySellerNewSub', { defaultValue: '셀러들이 매일 새 공구를 등록 중이에요. 알림 받아두세요!' })}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
                  {[
                    { emoji: '🍽️', label: '식사권 공구', desc: '맛집 단체 할인' },
                    { emoji: '💇', label: '뷰티 공구', desc: '시술 공동 예약' },
                    { emoji: '💪', label: '헬스 PT 공구', desc: '월 회원권 공동' },
                    { emoji: '🏨', label: '숙박 공구', desc: '펜션·호텔 단체' },
                  ].map((c, i) => (
                    <div key={i} className="bg-white dark:bg-[#0A0A0A] border-2 border-dashed border-gray-200 dark:border-[#2A2A2A] rounded-2xl p-4 text-center opacity-70 hover:opacity-100 transition-opacity">
                      <p className="text-3xl mb-1.5">{c.emoji}</p>
                      <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{c.label}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{c.desc}</p>
                      <span className="inline-block mt-2 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[9px] font-bold">곧 오픈</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex gap-2 justify-center flex-wrap">
                  <button
                    onClick={() => navigate('/community-group-buy/new')}
                    className="flex items-center gap-1 px-5 py-2.5 bg-pink-500 text-white text-[13px] font-semibold rounded-full"
                  >
                    <Plus className="w-3.5 h-3.5" /> {t('groupBuy.ctaStartMeal', { defaultValue: '내 동네 공구 제안' })}
                  </button>
                  <button
                    onClick={() => navigate('/browse')}
                    className="px-5 py-2.5 bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-300 text-[13px] font-semibold rounded-full"
                  >
                    {t('groupBuy.ctaShop', { defaultValue: '쇼핑하러 가기' })}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-3 gap-y-5">
                {filtered.map((p, idx) => {
                  const discount = calcDiscountRate(p)
                  const target = p.group_buy_target || 0
                  const current = p.group_buy_current || 0
                  const achieved = target > 0 && current >= target
                  const progress =
                    target > 0 ? Math.min(100, (current / target) * 100) : 0
                  const timeLeft = formatTimeLeft(p.group_buy_deadline)

                  return (
                    <button
                      key={p.id}
                      onClick={() => navigate(`/group-buy/${p.id}`)}
                      className="text-left active:scale-[0.98] transition-transform"
                    >
                      {/* 이미지 */}
                      <div className="relative aspect-square overflow-hidden bg-gray-100 rounded-xl">
                        {p.image_url ? (
                          // 🛡️ 2026-05-15: LCP 최적화 — 첫 row (idx < 4) eager + fetchpriority high.
                          //   above-the-fold 이미지 즉시 로딩 → Lighthouse LCP 개선.
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="w-full h-full object-cover"
                            loading={idx < 4 ? 'eager' : 'lazy'}
                            fetchPriority={idx < 2 ? 'high' : 'auto'}
                            decoding="async"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200" />
                        )}

                        {/* 할인 뱃지 */}
                        {discount > 0 && (
                          <span className="absolute top-2 left-2 bg-pink-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow">
                            {t('groupBuy.maxDiscount', { defaultValue: '최대 -{{rate}}%', rate: discount })}
                          </span>
                        )}

                        {/* 달성 뱃지 */}
                        {achieved && (
                          <span className="absolute top-2 right-2 flex items-center gap-0.5 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow">
                            <CheckCircle2 className="w-3 h-3" />
                            {t('groupBuy.achieved', { defaultValue: '달성' })}
                          </span>
                        )}

                        {/* 관심 등록 */}
                        <button
                          onClick={(e) => toggleInterest(e, p.id, p.restaurant_name)}
                          className="absolute bottom-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-white/80 backdrop-blur shadow-sm active:scale-90 transition-transform"
                          aria-label={t('common.wishlist', { defaultValue: '관심 등록' })}
                        >
                          <Bell
                            className={`w-3.5 h-3.5 ${interestedIds.has(p.id) ? 'text-pink-500 fill-pink-500' : 'text-gray-400'}`}
                          />
                        </button>
                      </div>

                      {/* 정보 */}
                      <div className="mt-2">
                        <p className="text-[12px] text-gray-900 dark:text-white leading-tight line-clamp-2">
                          {p.name}
                        </p>

                        {p.restaurant_name && (
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                            {p.restaurant_name}
                          </p>
                        )}

                        {/* 가격 */}
                        <div className="flex items-baseline gap-1 mt-1">
                          {p.original_price && p.original_price > p.price && (
                            <span className="text-[10px] text-gray-400 dark:text-gray-600 line-through">
                              {formatPrice(p.original_price)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-baseline gap-1">
                          {discount > 0 && (
                            <span className="text-[13px] font-extrabold text-pink-500">
                              {discount}%
                            </span>
                          )}
                          <span className="text-[13px] font-extrabold text-gray-900 dark:text-white">
                            {formatPrice(p.price)}
                          </span>
                        </div>

                        {/* 진행률 */}
                        {target > 0 && (
                          <div className="mt-2">
                            <div className="w-full h-2.5 bg-gray-100 dark:bg-[#2A2A2A] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  achieved ? 'bg-emerald-500' : 'bg-pink-500'
                                }`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-gray-600 mt-1 flex items-center gap-1">
                              <Users className="w-3 h-3 text-gray-400" />
                              {achieved ? (
                                <span className="text-emerald-600 font-semibold">
                                  {t('groupBuy.goalReached', { defaultValue: '목표 달성!' })}
                                </span>
                              ) : (
                                <>{t('groupBuy.currentParticipants', { defaultValue: '현재 {{count}}명 참여중', count: current })}</>
                              )}
                            </p>
                          </div>
                        )}

                        {/* 시간 */}
                        {timeLeft && (
                          <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-gray-400" />
                            {timeLeft}
                          </p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          /* ── 유저 공구 (Community Group Buys) ── */
          <>
            {communityLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="border border-gray-100 rounded-2xl p-4 animate-pulse">
                    <div className="h-4 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2 mt-2" />
                    <div className="h-8 bg-gray-100 rounded mt-3" />
                  </div>
                ))}
              </div>
            ) : filteredCommunity.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-[36px] mb-3">🙋</p>
                <p className="text-gray-900 dark:text-white font-semibold text-[14px]">
                  {t('groupBuy.emptyCommunity', { defaultValue: '진행 중인 유저 공구가 없습니다' })}
                </p>
                <p className="text-gray-500 dark:text-gray-400 text-[12px] mt-1">
                  {t('groupBuy.emptyCommunitySub', { defaultValue: '원하는 맛집 공구를 직접 시작해보세요!' })}
                </p>
                <button
                  onClick={() => navigate('/community-group-buy/new')}
                  className="mt-5 px-5 py-2.5 bg-gray-900 text-white text-[13px] font-semibold rounded-full"
                >
                  {t('groupBuy.ctaStart', { defaultValue: '공구 시작하기' })}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCommunity.map((g) => {
                  const progress =
                    g.target_count > 0
                      ? Math.min(100, (g.current_count / g.target_count) * 100)
                      : 0
                  const achieved = g.current_count >= g.target_count
                  const badge = STATUS_BADGES[g.status] || STATUS_BADGES.proposed
                  const timeLeft = formatTimeLeft(g.expires_at)

                  return (
                    <button
                      key={g.id}
                      onClick={() => navigate(`/community-group-buy/${g.invite_code}`)}
                      className="w-full text-left border border-gray-100 dark:border-[#2A2A2A] rounded-2xl p-4 active:scale-[0.98] transition-transform bg-white dark:bg-[#121212] hover:border-gray-200 dark:hover:border-[#3A3A3A]"
                    >
                      {/* 상단: 아이콘 + 식당명 + 상태 배지 */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-pink-50 flex items-center justify-center flex-shrink-0">
                            <span className="text-[18px]">🙋</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[14px] font-bold text-gray-900 dark:text-white truncate">
                              {g.restaurant_name}
                            </p>
                            {g.restaurant_address && (
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate flex items-center gap-0.5 mt-0.5">
                                <MapPin className="w-3 h-3 flex-shrink-0" />
                                {g.restaurant_address}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={(e) => toggleInterest(e, g.id, g.restaurant_name)}
                            className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 active:scale-90 transition-transform"
                            aria-label={t('common.wishlist', { defaultValue: '관심 등록' })}
                          >
                            <Bell
                              className={`w-3.5 h-3.5 ${interestedIds.has(g.id) ? 'text-pink-500 fill-pink-500' : 'text-gray-400'}`}
                            />
                          </button>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                      </div>

                      {/* 가격 + 보증금 정보 */}
                      <div className="flex items-center gap-3 mt-3">
                        <div className="flex items-center gap-1">
                          <HandCoins className="w-3.5 h-3.5 text-pink-500" />
                          <span className="text-[12px] text-gray-600 dark:text-gray-400">{t('groupBuy.proposedPrice', { defaultValue: '제안가' })}</span>
                          <span className="text-[13px] font-extrabold text-gray-900 dark:text-white">
                            {formatPrice(g.proposed_price)}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-400 dark:text-gray-600">|</div>
                        <div className="text-[12px] text-gray-500 dark:text-gray-400">
                          {t('groupBuy.depositLabel', { defaultValue: '보증금' })} <span className="font-semibold text-gray-700 dark:text-gray-200">{formatPrice(g.deposit_per_person)}</span>
                        </div>
                      </div>

                      {/* 진행률 바 */}
                      <div className="mt-3">
                        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              achieved ? 'bg-emerald-500' : 'bg-pink-500'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <p className="text-[11px] text-gray-600 dark:text-gray-400 flex items-center gap-1">
                            <Users className="w-3 h-3 text-gray-400" />
                            {achieved ? (
                              <span className="text-emerald-600 font-semibold">
                                {t('groupBuy.goalReached', { defaultValue: '목표 달성!' })}
                              </span>
                            ) : (
                              <>
                                <span className="font-semibold text-pink-500">
                                  {g.current_count}
                                </span>
                                <span className="text-gray-400">/</span>
                                <span>{t('groupBuy.peopleSuffix', { defaultValue: '{{count}}명', count: g.target_count })}</span>
                              </>
                            )}
                          </p>
                          {timeLeft && (
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-0.5">
                              <Clock className="w-3 h-3" />
                              {timeLeft}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* 참여하기 CTA */}
                      <div className="mt-3 bg-gray-900 text-white text-center py-2 rounded-xl text-[13px] font-bold">
                        참여하기
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}


// 🛡️ 2026-05-15: 큐레이션 strip — horizontal scroll 카드 (1명 남음 / 오늘 마감 / 거의 성공)
function CurationStrip({
  title, subtitle, items, navigate, accent,
}: {
  title: string
  subtitle: string
  items: GroupBuyProduct[]
  navigate: (to: string) => void
  accent: "red" | "amber" | "pink"
}) {
  const accentMap = {
    red:   { bg: "bg-red-50",   text: "text-red-600",   bar: "bg-red-500"   },
    amber: { bg: "bg-amber-50", text: "text-amber-600", bar: "bg-amber-500" },
    pink:  { bg: "bg-pink-50",  text: "text-pink-600",  bar: "bg-pink-500"  },
  }
  const a = accentMap[accent]
  return (
    <section className="mb-6">
      <div className="flex items-baseline justify-between mb-2 px-1">
        <h3 className="text-[15px] font-extrabold text-gray-900 dark:text-white tracking-tight">{title}</h3>
        <span className="text-[10px] text-gray-400">{subtitle}</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 lg:-mx-8 px-4 lg:px-8 scrollbar-hide snap-x snap-mandatory">
        {items.map((p) => {
          const progress = (p.group_buy_target ?? 0) > 0
            ? Math.min(100, ((p.group_buy_current ?? 0) / (p.group_buy_target ?? 1)) * 100)
            : 0
          const remaining = Math.max(0, (p.group_buy_target ?? 0) - (p.group_buy_current ?? 0))
          return (
            <button
              key={p.id}
              onClick={() => navigate(`/group-buy/${p.id}`)}
              className="snap-start shrink-0 w-[160px] text-left rounded-2xl overflow-hidden border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] hover:shadow-md transition-shadow"
            >
              <div className="relative w-full aspect-square bg-gray-100">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-pink-100 to-rose-200" />
                )}
                <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full ${a.bg} ${a.text} text-[9px] font-extrabold`}>
                  {accent === "red" ? "1명 남음" : accent === "amber" ? "오늘 마감" : `${Math.round(progress)}%`}
                </div>
              </div>
              <div className="p-2.5 space-y-1">
                <p className="text-[12px] font-bold text-gray-900 dark:text-white truncate">{p.name}</p>
                {p.restaurant_name && <p className="text-[10px] text-gray-500 truncate">{p.restaurant_name}</p>}
                <div className="w-full bg-gray-100 dark:bg-[#1A1A1A] rounded-full h-1.5 overflow-hidden">
                  <div className={`h-full ${a.bar} rounded-full transition-all`} style={{ width: `${progress}%` }} />
                </div>
                <p className="text-[10px] text-gray-500"><span className={`${a.text} font-bold`}>{remaining}명</span> 남음 · ₩{p.price?.toLocaleString("ko-KR") ?? "-"}</p>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
