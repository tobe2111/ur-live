import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronDown,
  Clock,
  Users,
  CheckCircle2,
  Flame,
  Sparkles,
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

type CategoryFilter = 'all' | 'meal_voucher' | 'general'
type SortOption = 'popular' | 'deadline' | 'newest'

const SORT_LABELS: Record<SortOption, string> = {
  popular: '인기순',
  deadline: '마감임박순',
  newest: '신규순',
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
  const [items, setItems] = useState<GroupBuyProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [sortBy, setSortBy] = useState<SortOption>('popular')
  const [showSortDropdown, setShowSortDropdown] = useState(false)

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
            🎁 공동구매
          </h1>
        </div>
      </header>

      {/* 배너 */}
      <div className="px-4 pt-4">
        <div className="bg-gradient-to-r from-pink-500 via-rose-500 to-red-500 rounded-2xl px-5 py-4">
          <p className="text-white text-[15px] font-extrabold">
            <Sparkles className="inline w-4 h-4 mr-1 -mt-0.5" />
            함께 모일수록 더 싸져요!
          </p>
          <p className="text-white/90 text-[11px] mt-1">
            최대 50% 할인 — 목표 달성 시 특가로 구매 가능
          </p>
        </div>
      </div>

      {/* 카테고리 탭 */}
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

      {/* 정렬 pills */}
      <div className="px-4 mt-3 flex items-center justify-between">
        <span className="text-[12px] text-gray-500">
          총 <span className="font-semibold text-gray-900">{filtered.length}</span>
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

      {/* 상품 그리드 (2열) */}
      <div className="px-4 py-4 pb-20">
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
            <button
              onClick={() => navigate('/browse')}
              className="mt-5 px-5 py-2.5 bg-gray-900 text-white text-[13px] font-semibold rounded-full"
            >
              쇼핑하러 가기
            </button>
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
      </div>
    </div>
  )
}
