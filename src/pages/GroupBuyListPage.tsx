import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

interface GroupBuyProduct {
  id: number
  name: string
  price: number
  original_price?: number
  image_url?: string
  category?: string
  seller_name?: string
  restaurant_name?: string
  restaurant_address?: string
  group_buy_target?: number
  group_buy_current?: number
  group_buy_deadline?: string
  group_buy_status?: string
  sold_count?: number
  created_at?: string
}

interface CommunityGroupBuy {
  id: number
  creator_name: string
  restaurant_name: string
  restaurant_address?: string
  proposed_price: number
  deposit_per_person: number
  target_count: number
  current_count: number
  total_deposited: number
  status: string
  invite_code: string
  expires_at?: string
  created_at?: string
}

type MainTab = 'seller' | 'community'
type CategoryFilter = 'all' | 'meal_voucher' | 'general'
type SortOption = 'popular' | 'deadline' | 'newest'

const SORT_LABELS: Record<SortOption, string> = {
  popular: '인기순',
  deadline: '마감임박순',
  newest: '신규순',
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  proposed: { label: '모집중', className: 'bg-pink-500 text-white' },
  negotiating: { label: '협상중', className: 'bg-amber-500 text-white' },
  confirmed: { label: '확정', className: 'bg-emerald-500 text-white' },
  achieved: { label: '달성', className: 'bg-blue-500 text-white' },
  failed: { label: '마감', className: 'bg-gray-400 text-white' },
  refunded: { label: '환불됨', className: 'bg-gray-400 text-white' },
}

// 남은 시간 포맷
function formatTimeLeft(deadline?: string): string {
  if (!deadline) return ''
  const diff = new Date(deadline).getTime() - Date.now()
  if (diff <= 0) return '마감'
  const days = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  const mins = Math.floor((diff % 3_600_000) / 60_000)
  if (days > 0) return `${days}일 ${hours}시간 남음`
  if (hours > 0) return `${hours}시간 ${mins}분 남음`
  return `${mins}분 남음`
}

// 최대 할인율 계산
function calcDiscountRate(p: GroupBuyProduct): number {
  if (!p.original_price || p.original_price <= p.price) return 0
  return Math.round((1 - p.price / p.original_price) * 100)
}

export default function GroupBuyListPage() {
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
      toast.success('관심 등록됨! 공구 시작 시 알려드릴게요')
    } else {
      api.post('/api/interest/remove', { product_id: productId, type: 'group_buy' }).catch(() => {
        setInterestedIds(prev => { const next = new Set(prev); next.add(productId); return next })
      })
      toast.info('관심 등록이 해제되었습니다')
    }
  }

  // 셀러 공구 로딩
  useEffect(() => {
    setLoading(true)
    api
      .get('/api/group-buy/products?status=active')
      .then((r) => {
        if (r.data?.success) setItems(r.data.data || [])
        else toast.error('공동구매 상품을 불러오지 못했습니다')
      })
      .catch(() => toast.error('네트워크 오류가 발생했습니다'))
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
      .catch(() => { /* silent fail for community list */ })
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
    <div className="bg-white min-h-screen">
      <SEO
        title="공동구매"
        description="인기 공동구매 상품을 한눈에. 맛집 식사권부터 공동구매 특가 상품까지"
        url="/group-buy"
      />

      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="flex items-center h-12 px-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-1"
            aria-label="뒤로"
          >
            <ChevronLeft className="w-6 h-6 text-gray-900" />
          </button>
          <h1 className="text-[16px] font-extrabold text-gray-900 flex-1 text-center pr-8">
            공동구매
          </h1>
        </div>
      </header>

      {/* 배너 — 클릭 시 맛집 공구 시작 */}
      <div className="px-4 pt-4">
        <div className="bg-gradient-to-r from-pink-500 via-rose-500 to-red-500 rounded-2xl px-5 py-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-white text-[15px] font-extrabold">
              <Sparkles className="inline w-4 h-4 mr-1 -mt-0.5" />
              함께 모일수록 더 싸져요!
            </p>
            <p className="text-white/90 text-[11px] mt-1">
              최대 50% 할인 — 목표 달성 시 특가로 구매 가능
            </p>
          </div>
          <button
            onClick={() => navigate('/community-group-buy/new')}
            className="shrink-0 flex items-center gap-1 bg-white text-rose-600 px-3 py-2 rounded-full text-[12px] font-extrabold shadow-sm active:scale-95 transition-transform"
          >
            <Plus className="w-3.5 h-3.5" />
            시작
          </button>
        </div>
      </div>

      {/* 메인 탭: 셀러 공구 | 유저 공구 */}
      <div className="px-4 mt-4">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setMainTab('seller')}
            className={`flex-1 pb-2.5 text-[14px] font-semibold text-center transition-colors border-b-2 ${
              mainTab === 'seller'
                ? 'text-gray-900 border-gray-900'
                : 'text-gray-400 border-transparent'
            }`}
          >
            셀러 공구
          </button>
          <button
            onClick={() => setMainTab('community')}
            className={`flex-1 pb-2.5 text-[14px] font-semibold text-center transition-colors border-b-2 ${
              mainTab === 'community'
                ? 'text-gray-900 border-gray-900'
                : 'text-gray-400 border-transparent'
            }`}
          >
            유저 공구
          </button>
        </div>
      </div>

      {/* 카테고리 탭 (셀러 공구 전용) */}
      {mainTab === 'seller' && (
        <div className="px-4 mt-4">
          <div className="flex gap-2">
            {([
              { key: 'all', label: '전체' },
              { key: 'meal_voucher', label: '맛집 식사권' },
              { key: 'general', label: '일반 상품' },
            ] as const).map((t) => (
              <button
                key={t.key}
                onClick={() => setCategory(t.key)}
                className={`px-4 py-2 rounded-full text-[12px] font-semibold whitespace-nowrap border transition-colors ${
                  category === t.key
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 정렬 pills */}
      <div className={`px-4 ${mainTab === 'seller' ? 'mt-3' : 'mt-4'} flex items-center justify-between`}>
        <span className="text-[12px] text-gray-500">
          총 <span className="font-semibold text-gray-900">{currentCount}</span>
          개
        </span>
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowSortDropdown((v) => !v)}
            className="flex items-center gap-1 text-[13px] text-gray-700 font-semibold"
          >
            {SORT_LABELS[sortBy]}
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                showSortDropdown ? 'rotate-180' : ''
              }`}
            />
          </button>
          {showSortDropdown && (
            <div className="absolute top-full right-0 mt-1 w-36 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
              {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    setSortBy(opt)
                    setShowSortDropdown(false)
                  }}
                  className={`w-full text-left px-3 py-2.5 text-[13px] ${
                    sortBy === opt
                      ? 'bg-pink-50 text-pink-600 font-semibold'
                      : 'text-gray-700 hover:bg-gray-50'
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

      {/* 콘텐츠 영역 */}
      <div className="px-4 py-4 pb-20">
        {mainTab === 'seller' ? (
          /* ── 셀러 공구 상품 그리드 (2열) ── */
          <>
            {loading ? (
              <div className="grid grid-cols-2 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i}>
                    <div className="aspect-square bg-gray-100 animate-pulse rounded-xl" />
                    <div className="mt-2 h-3 bg-gray-100 rounded animate-pulse" />
                    <div className="mt-1 h-3 bg-gray-100 rounded animate-pulse w-2/3" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-[36px] mb-3">🛒</p>
                <p className="text-gray-900 font-semibold text-[14px]">
                  진행 중인 공동구매가 없습니다
                </p>
                <p className="text-gray-500 text-[12px] mt-1">
                  곧 새로운 상품이 올라와요!
                </p>
                <div className="mt-5 flex gap-2 justify-center">
                  <button
                    onClick={() => navigate('/browse')}
                    className="px-5 py-2.5 bg-gray-900 text-white text-[13px] font-semibold rounded-full"
                  >
                    쇼핑하러 가기
                  </button>
                  <button
                    onClick={() => navigate('/community-group-buy/new')}
                    className="flex items-center gap-1 px-5 py-2.5 bg-rose-50 text-rose-600 border border-rose-200 text-[13px] font-semibold rounded-full"
                  >
                    <Plus className="w-3.5 h-3.5" /> 맛집 공구 시작
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-3 gap-y-5">
                {filtered.map((p) => {
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
                      onClick={() => navigate(`/products/${p.id}`)}
                      className="text-left active:scale-[0.98] transition-transform"
                    >
                      {/* 이미지 */}
                      <div className="relative aspect-square overflow-hidden bg-gray-100 rounded-xl">
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200" />
                        )}

                        {/* 할인 뱃지 */}
                        {discount > 0 && (
                          <span className="absolute top-2 left-2 bg-pink-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow">
                            최대 -{discount}%
                          </span>
                        )}

                        {/* 달성 뱃지 */}
                        {achieved && (
                          <span className="absolute top-2 right-2 flex items-center gap-0.5 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow">
                            <CheckCircle2 className="w-3 h-3" />
                            달성
                          </span>
                        )}

                        {/* 관심 등록 */}
                        <button
                          onClick={(e) => toggleInterest(e, p.id, p.restaurant_name)}
                          className="absolute bottom-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-white/80 backdrop-blur shadow-sm active:scale-90 transition-transform"
                          aria-label="관심 등록"
                        >
                          <Bell
                            className={`w-3.5 h-3.5 ${interestedIds.has(p.id) ? 'text-pink-500 fill-pink-500' : 'text-gray-400'}`}
                          />
                        </button>
                      </div>

                      {/* 정보 */}
                      <div className="mt-2">
                        <p className="text-[12px] text-gray-900 leading-tight line-clamp-2">
                          {p.name}
                        </p>

                        {p.restaurant_name && (
                          <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                            {p.restaurant_name}
                          </p>
                        )}

                        {/* 가격 */}
                        <div className="flex items-baseline gap-1 mt-1">
                          {p.original_price && p.original_price > p.price && (
                            <span className="text-[10px] text-gray-400 line-through">
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
                          <span className="text-[13px] font-extrabold text-gray-900">
                            {formatPrice(p.price)}
                          </span>
                        </div>

                        {/* 진행률 */}
                        {target > 0 && (
                          <div className="mt-2">
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
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
                                  목표 달성!
                                </span>
                              ) : (
                                <>
                                  현재 <span className="font-semibold">{current}</span>
                                  명 참여중
                                </>
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
                <p className="text-gray-900 font-semibold text-[14px]">
                  진행 중인 유저 공구가 없습니다
                </p>
                <p className="text-gray-500 text-[12px] mt-1">
                  원하는 맛집 공구를 직접 시작해보세요!
                </p>
                <button
                  onClick={() => navigate('/community-group-buy/new')}
                  className="mt-5 px-5 py-2.5 bg-gray-900 text-white text-[13px] font-semibold rounded-full"
                >
                  공구 시작하기
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
                      className="w-full text-left border border-gray-100 rounded-2xl p-4 active:scale-[0.98] transition-transform bg-white hover:border-gray-200"
                    >
                      {/* 상단: 아이콘 + 식당명 + 상태 배지 */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-pink-50 flex items-center justify-center flex-shrink-0">
                            <span className="text-[18px]">🙋</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[14px] font-bold text-gray-900 truncate">
                              {g.restaurant_name}
                            </p>
                            {g.restaurant_address && (
                              <p className="text-[11px] text-gray-500 truncate flex items-center gap-0.5 mt-0.5">
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
                            aria-label="관심 등록"
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
                          <span className="text-[12px] text-gray-600">제안가</span>
                          <span className="text-[13px] font-extrabold text-gray-900">
                            {formatPrice(g.proposed_price)}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-400">|</div>
                        <div className="text-[12px] text-gray-500">
                          보증금 <span className="font-semibold text-gray-700">{formatPrice(g.deposit_per_person)}</span>
                        </div>
                      </div>

                      {/* 진행률 바 */}
                      <div className="mt-3">
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              achieved ? 'bg-emerald-500' : 'bg-pink-500'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <p className="text-[11px] text-gray-600 flex items-center gap-1">
                            <Users className="w-3 h-3 text-gray-400" />
                            {achieved ? (
                              <span className="text-emerald-600 font-semibold">
                                목표 달성!
                              </span>
                            ) : (
                              <>
                                <span className="font-semibold text-pink-500">
                                  {g.current_count}
                                </span>
                                <span className="text-gray-400">/</span>
                                <span>{g.target_count}명</span>
                              </>
                            )}
                          </p>
                          {timeLeft && (
                            <p className="text-[10px] text-gray-400 flex items-center gap-0.5">
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
