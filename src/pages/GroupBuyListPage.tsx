import { useEffect, useMemo, useState, useRef, memo } from 'react'
import { usePrefetchGroupBuyProduct } from '@/hooks/queries'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ChevronDown,
  Clock,
  Users,
  CheckCircle2,
  Sparkles,
  Plus,
  MapPin,
  HandCoins,
  Bell,
  Store,
} from 'lucide-react'
import api from '@/lib/api'
import { cfImage, cfSrcSet } from '@/utils/cf-image'
import { extractDominantColor, reportDominantColor } from '@/utils/dominant-color'
import { cardGradient } from '@/utils/card-gradient'
import SEO from '@/components/SEO'
import { formatPrice } from '@/utils/currency'
import { toast } from '@/hooks/useToast'
import { SORT_LABELS, STATUS_BADGES } from './group-buy-list/constants'
import { formatTimeLeft, calcDiscountRate } from './group-buy-list/utils'
import type { GroupBuyProduct, CommunityGroupBuy, MainTab, CategoryFilter, SortOption } from './group-buy-list/types'
import LiveTicker from '@/components/group-buy/LiveTicker'
import RegionPickerModal from '@/components/RegionPickerModal'
import { matchAddress, findRegionByKey, findDistrictGroup } from '@/shared/constants/korea-regions'
import { SHOPPING_TAB_HIDDEN } from '@/shared/feature-flags'

// 🛡️ 2026-05-02: TD-018 분할 — types/constants/utils 를 ./group-buy-list/ 로 추출.

// 🏭 2026-06-10 [LOADING_ADDITIVE] (사용자 신고 — "동네딜 카드 로딩 고질적"): 모듈 메모리 캐시 + 진입 전 워밍.
//   문제: 하단바 탭 진입은 SPA 라우팅이라 SSR 주입이 없음 → 매 마운트 cold fetch + 스켈레톤 재노출(탭 왕복마다).
//   해법: (1) 같은 세션 재진입은 메모리 캐시로 0ms 페인트(+60s 넘으면 백그라운드 갱신만, 스켈레톤 X)
//        (2) 하단바 pointerdown(누르는 순간) `warmGroupBuyList()` 가 데이터를 선요청 — 클릭→마운트 사이 ~200ms 선점.
//        in-flight 공유로 중복 요청 0. SSR 주입 경로/기존 fetch 동작 불변(additive).
const GB_LIST_URL = '/api/group-buy/products?status=active&limit=200'
const GB_CACHE_TTL = 60_000
let _gbListCache: { items: GroupBuyProduct[]; at: number } | null = null
let _gbListInflight: Promise<GroupBuyProduct[] | null> | null = null

function fetchGroupBuyList(): Promise<GroupBuyProduct[] | null> {
  if (_gbListInflight) return _gbListInflight
  _gbListInflight = api
    .get(GB_LIST_URL)
    .then((r) => {
      if (r.data?.success) {
        const items = (r.data.data || []) as GroupBuyProduct[]
        _gbListCache = { items, at: Date.now() }
        return items
      }
      return null
    })
    .catch(() => null)
    .finally(() => { _gbListInflight = null })
  return _gbListInflight
}

/** 하단바 prefetch 에서 호출 — 누르는 순간 데이터 선요청 (신선하면 no-op). */
export function warmGroupBuyList(): void {
  if (_gbListCache && Date.now() - _gbListCache.at < GB_CACHE_TTL) return
  void fetchGroupBuyList()
}

// 🛡️ 2026-06-04 [LOADING_ADDITIVE]: 동네딜 SSR 주입(__SSR_INITIAL_GROUPBUY__) 즉시 소비 → 마운트 fetch 워터폴 제거.
//   consume-once(el.remove) — 클라 재진입 시엔 script 없음 → 정상 fetch.
function readSsrGroupBuy(): GroupBuyProduct[] | null {
  if (typeof document === 'undefined') return null
  const el = document.getElementById('__SSR_INITIAL_GROUPBUY__')
  if (!el?.textContent) return null
  try {
    const parsed = JSON.parse(el.textContent) as { success?: boolean; data?: GroupBuyProduct[] }
    el.remove()
    return parsed?.success ? (parsed.data || []) : null
  } catch { return null }
}

// 🏭 2026-06-04 (사용자 요청): 동네딜 공구 카드 — 대표색 단색 + 사진 자연 번짐.
//   인라인 .map() 이면 카드별 상태(이미지 추출색)를 못 쓰므로 memo 컴포넌트로 추출.
//   서버 dominant_color 없으면 이미지 로드 즉시 추출색을 이 카드에 바로 적용(검정 fallback 방지).
//   (성능: React.memo → 부모 재렌더 시 카드 재조정 0 — 감사 권고 A9 반영.)
const GroupBuyGridCard = memo(function GroupBuyGridCard({
  p, idx, interested, onToggleInterest,
}: {
  p: GroupBuyProduct
  idx: number
  interested: boolean
  onToggleInterest: (e: React.MouseEvent, productId: number, restaurantName?: string) => void
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  // 🏁 2026-06-11 (플로우 감사 🟢): 메인 피드 카드(GroupBuyFeedCard)에만 있던 상세 prefetch 를
  //   동네딜 그리드에도 — hover/터치 시 상세 데이터 선로딩 → 클릭 시 fetch 워터폴 제거.
  const prefetch = usePrefetchGroupBuyProduct()
  const [cardColor, setCardColor] = useState<string | null>(p.dominant_color || null)
  // 🏭 2026-06-05 (사용자 신고 — 깨진 이미지가 빈 카드로): onError 폴백.
  const [imgError, setImgError] = useState(false)
  const grad = cardGradient(cardColor)
  const discount = calcDiscountRate(p)
  const target = p.group_buy_target || 0
  const current = p.group_buy_current || 0
  // 🏭 2026-06-07 (사용자 요청): '현재 N명 참여중' 제거 — 즉시판매 단일가 모델에서 카드 참여 수 무의미.
  //   '달성' 뱃지(이미지 우상단)는 유지. 진행률 바 + 참여 인원 텍스트 삭제 → 업장명/주소/판매자 노출.
  const achieved = target > 0 && current >= target
  const timeLeft = formatTimeLeft(p.group_buy_deadline)
  return (
    <button
      onClick={() => navigate(`/group-buy/${p.id}`)}
      onMouseEnter={() => prefetch(p.id)}
      onTouchStart={() => prefetch(p.id)}
      onFocus={() => prefetch(p.id)}
      className="text-left active:scale-[0.98] transition-transform rounded-2xl overflow-hidden flex flex-col"
      style={{ backgroundColor: grad.base }}
    >
      {/* 이미지 */}
      <div className="relative aspect-square overflow-hidden" style={{ backgroundColor: grad.base }}>
        {p.image_url && !imgError ? (
          <img
            src={cfImage(p.image_url, { width: 400, format: 'auto' })}
            srcSet={cfSrcSet(p.image_url, 400)}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 250px"
            alt={p.name}
            className="w-full h-full object-cover"
            loading={idx < 4 ? 'eager' : 'lazy'}
            fetchPriority={idx < 2 ? 'high' : 'auto'}
            decoding="async"
            onLoad={(e) => {
              const el = e.currentTarget
              el.style.opacity = '1'
              const color = extractDominantColor(el)
              if (color) {
                if (!cardColor) setCardColor(color)
                if (!p.dominant_color) reportDominantColor(p.id, color)
              }
            }}
            onError={() => setImgError(true)}
            style={{ opacity: idx < 4 ? 1 : 0, transition: 'opacity 200ms ease-out' }}
          />
        ) : (
          <div className="w-full h-full" />
        )}

        {/* 사진 하단 → 같은 카드색으로 번짐 (경계 제거) */}
        <div className="absolute inset-x-0 bottom-0 h-[42%] pointer-events-none" style={{ background: grad.imageFade }} />

        {/* 할인 뱃지 */}
        {discount > 0 && (
          <span className="absolute top-2 left-2 bg-gray-900 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow">
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
          onClick={(e) => onToggleInterest(e, p.id, p.restaurant_name)}
          className="absolute bottom-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur shadow-sm active:scale-90 transition-transform"
          aria-label={t('common.wishlist', { defaultValue: '관심 등록' })}
        >
          <Bell className={`w-3.5 h-3.5 ${interested ? 'text-gray-900 fill-gray-900 dark:text-white dark:fill-white' : 'text-gray-400'}`} />
        </button>
      </div>

      {/* 정보 — 카드 대표색 위에 올라가므로 글자색은 grad 로 자동 대비 (내용은 불변) */}
      <div className="px-2.5 pt-1 pb-2.5 flex flex-col flex-1" style={{ color: grad.text }}>
        <p className="text-[12px] leading-tight line-clamp-2">{p.name}</p>

        {/* 업장명 + 주소 (참여 인원 대신 — 즉시판매 단일가 모델: 참여 수는 카드에서 무의미) */}
        {p.restaurant_name && (
          <p className="text-[10px] mt-0.5 truncate font-medium" style={{ color: grad.sub }}>{p.restaurant_name}</p>
        )}
        {p.restaurant_address && (
          <p className="text-[10px] mt-0.5 truncate flex items-center gap-0.5" style={{ color: grad.sub }}>
            <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: grad.sub }} />
            <span className="truncate">{p.restaurant_address}</span>
          </p>
        )}

        {/* 가격 */}
        <div className="flex items-baseline gap-1 mt-1">
          {p.original_price && p.original_price > p.price && (
            <span className="text-[10px] line-through" style={{ color: grad.sub }}>{formatPrice(p.original_price)}</span>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          {discount > 0 && (
            <span className="text-[13px] font-extrabold" style={{ color: grad.accent }}>{discount}%</span>
          )}
          <span className="text-[13px] font-extrabold">{formatPrice(p.price)}</span>
        </div>

        {/* 판매자 (참여 인원 표기 제거 — 즉시판매 단일가 모델) */}
        {p.seller_name && (
          <p className="text-[10px] mt-1.5 truncate flex items-center gap-1" style={{ color: grad.sub }}>
            <Store className="w-3 h-3 flex-shrink-0" style={{ color: grad.sub }} />
            <span className="truncate">
              {t('groupBuy.sellerLabel', { defaultValue: '판매자' })} · {p.seller_name}
            </span>
          </p>
        )}

        {/* 시간 */}
        {timeLeft && (
          <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: grad.sub }}>
            <Clock className="w-3 h-3" style={{ color: grad.sub }} />
            {timeLeft}
          </p>
        )}
      </div>
    </button>
  )
})

export default function GroupBuyListPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // 🛡️ 2026-05-16: URL ?category= 처리 — 메인 hero 의 8 카테고리 각각 정확 필터
  //   voucher 6종 (meal/beauty/health/pet/stay/activity) + general + all 모두 직접 매칭
  const [searchParams, setSearchParams] = useSearchParams()
  const urlCategory = (searchParams.get('category') || '').toLowerCase()
  const urlSort = (searchParams.get('sort') || '').toLowerCase()
  const VALID_CATEGORIES: CategoryFilter[] = ['all', 'general', 'meal_voucher', 'beauty_voucher', 'stay_voucher', 'etc_voucher', 'health_voucher', 'pet_voucher', 'activity_voucher']
  const initialCategory: CategoryFilter = VALID_CATEGORIES.includes(urlCategory as CategoryFilter)
    ? (urlCategory as CategoryFilter)
    : 'all'
  const initialSort: SortOption = urlSort === 'discount' ? 'discount' : 'popular'
  // 🛡️ 2026-05-17: 지역 필터 (?region=서울&district=gangnam) — 당근 스타일 picker
  const urlRegion = searchParams.get('region') || null
  const urlDistrict = searchParams.get('district') || null

  const [mainTab, setMainTab] = useState<MainTab>('seller')
  // SSR 주입 1회 캡처 (lazy init → 첫 렌더에만 읽음). null = 미주입(클라 재진입) → 정상 fetch.
  const ssrInitialRef = useRef<GroupBuyProduct[] | null | undefined>(undefined)
  if (ssrInitialRef.current === undefined) ssrInitialRef.current = readSsrGroupBuy()
  const [items, setItems] = useState<GroupBuyProduct[]>(ssrInitialRef.current || [])
  const [communityItems, setCommunityItems] = useState<CommunityGroupBuy[]>([])
  const [loading, setLoading] = useState(ssrInitialRef.current == null)
  const [communityLoading, setCommunityLoading] = useState(true)
  const [category, setCategory] = useState<CategoryFilter>(initialCategory)
  const [sortBy, setSortBy] = useState<SortOption>(initialSort)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [interestedIds, setInterestedIds] = useState<Set<number>>(new Set())
  // 🛡️ 2026-05-17: 지역 필터 상태 + 모달
  const [regionKey, setRegionKey] = useState<string | null>(urlRegion)
  const [districtKey, setDistrictKey] = useState<string | null>(urlDistrict)
  const [regionPickerOpen, setRegionPickerOpen] = useState(false)

  // 지역 변경 시 URL 동기화 (browser back/share 지원)
  function applyRegion(r: string | null, d: string | null) {
    setRegionKey(r)
    setDistrictKey(d)
    const next = new URLSearchParams(searchParams)
    if (r) next.set('region', r); else next.delete('region')
    if (d) next.set('district', d); else next.delete('district')
    setSearchParams(next, { replace: true })
  }

  const activeRegion = findRegionByKey(regionKey)
  const activeDistrict = findDistrictGroup(regionKey, districtKey)
  const regionButtonLabel = activeDistrict
    ? activeDistrict.label
    : activeRegion
    ? `${activeRegion.label.replace('\n', ' ')} 전체`
    : '전체 지역'

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
    // SSR 주입 데이터로 이미 시드됨(prewarm fresh) → 마운트 cold fetch 스킵(워터폴 제거).
    //   + 2026-06-10: SSR 50개는 첫페인트용 — 메모리 캐시에 안 넣고 백그라운드로 limit=200 전체본 갱신
    //     (50개 cap 이 필터/정렬에 다시 생기는 것 방지, 화면은 SSR 본으로 이미 그려져 스켈레톤 X).
    if (ssrInitialRef.current !== null) {
      ssrInitialRef.current = null
      void fetchGroupBuyList().then((fresh) => { if (fresh) setItems(fresh) })
      return
    }
    // 🏭 2026-06-10 [LOADING_ADDITIVE]: 메모리 캐시 즉시 페인트 — 탭 왕복 시 스켈레톤 재노출 제거.
    //   신선(<60s)하면 그대로, 오래됐으면 화면 유지 + 백그라운드 갱신.
    if (_gbListCache) {
      setItems(_gbListCache.items)
      setLoading(false)
      if (Date.now() - _gbListCache.at >= GB_CACHE_TTL) {
        void fetchGroupBuyList().then((fresh) => { if (fresh) setItems(fresh) })
      }
      return
    }
    // 🏭 2026-06-05 [UNLOCK_LOADING] (사용자 승인 — 동네딜 50개 cap 근본수정): limit=200.
    //   하단바 pointerdown 워밍(warmGroupBuyList)과 in-flight 공유 — 중복 요청 0.
    setLoading(true)
    void fetchGroupBuyList()
      .then((items) => {
        if (items) setItems(items)
        else toast.error(t('common.networkError', { defaultValue: '네트워크 오류가 발생했습니다' }))
      })
      .finally(() => setLoading(false))
  }, [])

  // 유저 공구 로딩 — 🛡️ 2026-06-04 [LOADING_ADDITIVE]: 기본탭은 '셀러 공구'라
  //   유저공구(uncached) fetch 를 마운트마다 하던 것 → '유저 공구' 탭 첫 진입 시 1회만 로드(워밍 낭비 제거).
  const communityFetchedRef = useRef(false)
  useEffect(() => {
    if (mainTab !== 'community' || communityFetchedRef.current) return
    communityFetchedRef.current = true
    setCommunityLoading(true)
    api
      .get('/api/community-group-buy/list?status=proposed&sort=popular&limit=20')
      .then((r) => {
        if (r.data?.success) setCommunityItems(r.data.data || [])
      })
      .catch((e) => { if (import.meta.env.DEV) console.warn('[GroupBuy] community list failed:', e) })
      .finally(() => setCommunityLoading(false))
  }, [mainTab])

  useEffect(() => {
    if (!showSortDropdown) return
    const handler = () => setShowSortDropdown(false)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [showSortDropdown])

  // 🧭 2026-06-17: URL ?category= 를 카테고리 상태와 동기화 — PC 사이드바/딥링크에서 (이미 이 페이지에
  //   머문 상태에서도) 카테고리 전환이 반영되도록. 인페이지 탭은 아래에서 URL 도 함께 갱신해 양방향 일치.
  useEffect(() => {
    const c = (searchParams.get('category') || '').toLowerCase()
    const nextCat = (VALID_CATEGORIES.includes(c as CategoryFilter) ? c : 'all') as CategoryFilter
    setCategory((prev) => (prev === nextCat ? prev : nextCat))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const filtered = useMemo(() => {
    let result = [...items]

    // 🛡️ 2026-05-17: 카테고리 필터 — voucher 4종 (신규) + 레거시 3종 호환 매칭.
    //   beauty 탭은 health 도 매칭 (마이그레이션 0255 가 row 자동 변환하지만 graceful).
    //   etc 탭은 pet/activity 도 매칭.
    const VOUCHER_CATEGORIES = ['meal_voucher', 'beauty_voucher', 'stay_voucher', 'etc_voucher', 'health_voucher', 'pet_voucher', 'activity_voucher']
    const LEGACY_TO_NEW: Record<string, string> = {
      health_voucher: 'beauty_voucher',
      pet_voucher: 'etc_voucher',
      activity_voucher: 'etc_voucher',
    }
    const normalizeCat = (c: string | undefined | null) => (c && LEGACY_TO_NEW[c]) || c || ''
    // 🛡️ 2026-06-17: 숙소(stay_voucher)는 전용 /stays 페이지(객실·날짜·가격 join)에서만 표시.
    //   products.price=0 + 위치/평점이 product_stay_info 별도 테이블이라 동네딜 그리드 카드엔 ₩0·정보누락으로
    //   부적합 → 그리드(전체 포함) 전역 제외. 숙소 탭은 /stays 로 리다이렉트.
    result = result.filter((p) => normalizeCat(p.category) !== 'stay_voucher')
    if (category === 'general') {
      result = result.filter((p) => !VOUCHER_CATEGORIES.includes(p.category || ''))
    } else if (category !== 'all') {
      // 특정 voucher 카테고리 — 신규 + 레거시 row 모두 매칭 (정규화 후 비교).
      result = result.filter((p) => normalizeCat(p.category) === category)
    }

    // 🛡️ 2026-05-16: 텍스트 검색 (상품명 / 매장명)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter((p) =>
        (p.name || '').toLowerCase().includes(q) ||
        ((p as { restaurant_name?: string }).restaurant_name || '').toLowerCase().includes(q)
      )
    }

    // 🛡️ 2026-05-17: 지역 필터 — voucher 카테고리에만 적용 (general 은 배송이라 위치 무관).
    //   사용자 결정: "식사권/숙소권/헬스장 등에 필요" → general 탭은 region 무시.
    //   category='all' 일 때: voucher 류만 region 필터, general 아이템은 통과.
    if (regionKey && category !== 'general') {
      result = result.filter((p) => {
        const isVoucher = VOUCHER_CATEGORIES.includes(p.category || '')
        if (category === 'all' && !isVoucher) return true  // 전체 탭에서 general 은 region 무관 통과
        const addr = (p as { restaurant_address?: string; restaurant_name?: string }).restaurant_address
          || (p as { restaurant_name?: string }).restaurant_name
          || ''
        return matchAddress(addr, regionKey, districtKey)
      })
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
      // 🏭 2026-06-05 (사용자 신고 — 공구 낮은 가격순 없음): 가격 정렬(공구가 = current_price ?? price).
      case 'price_low':
        result.sort((a, b) => (Number((a as { current_price?: number }).current_price ?? a.price) || 0) - (Number((b as { current_price?: number }).current_price ?? b.price) || 0))
        break
      case 'price_high':
        result.sort((a, b) => (Number((b as { current_price?: number }).current_price ?? b.price) || 0) - (Number((a as { current_price?: number }).current_price ?? a.price) || 0))
        break
      case 'deadline': {
        const getTs = (p: GroupBuyProduct) =>
          p.group_buy_deadline
            ? new Date(p.group_buy_deadline).getTime()
            : Number.MAX_SAFE_INTEGER
        result.sort((a, b) => getTs(a) - getTs(b))
        break
      }
      // 🛡️ 2026-05-16: 'discount' 정렬 — 메인 hero "특가" 카테고리 진입 시
      // 🛡️ 2026-05-18: TS type 호환 — items union type 처리 (CommunityGroupBuy 등).
      case 'discount': {
        const discPct = (p: unknown) => {
          const r = (p ?? {}) as { original_price?: number | string | null; price?: number | string | null }
          const op = Number(r.original_price) || 0
          const pr = Number(r.price) || 0
          if (op > 0 && op > pr) return Math.round((1 - pr / op) * 100)
          return 0
        }
        result.sort((a, b) => discPct(b) - discPct(a))
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
  }, [items, category, sortBy, searchQuery, regionKey, districtKey])

  // 🏭 2026-06-10 [LOADING_ADDITIVE] (사용자 신고 — 카드 로딩 체감): 점진 렌더.
  //   limit=200 데이터를 한 번에 200카드 마운트 → 중저가 폰 TBT/버벅임(데이터는 빨라졌지만 렌더가 병목).
  //   첫 30개만 마운트 → 하단 sentinel 600px 선행 감지로 +30씩 — 스크롤 도달 전에 미리 붙어 끊김 없음.
  //   필터/탭/검색 변경 시 30으로 리셋. 데이터는 이미 메모리에 있어 네트워크 0.
  const GB_PAGE = 30
  const [visibleCount, setVisibleCount] = useState(GB_PAGE)
  useEffect(() => { setVisibleCount(GB_PAGE) }, [category, sortBy, searchQuery, regionKey, districtKey, mainTab])
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const ob = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setVisibleCount((c) => c + GB_PAGE)
    }, { rootMargin: '600px' })
    ob.observe(el)
    return () => ob.disconnect()
  }, [loading, mainTab])

  // 🛡️ 2026-06-04: 큐레이션 3종 — filtered 변경 시에만 재계산(매 렌더/스크롤 재계산 방지).
  const curation = useMemo(() => {
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
    return { lastOne, closingToday, almostDone }
  }, [filtered])

  const filteredCommunity = useMemo(() => {
    let result = [...communityItems]

    switch (sortBy) {
      case 'popular':
        result.sort((a, b) => b.current_count - a.current_count)
        break
      // 🏭 2026-06-05 (사용자 신고 — 공구 가격 정렬): 커뮤니티 공구가 = confirmed_price ?? proposed_price.
      case 'price_low':
        result.sort((a, b) => (Number((a as { confirmed_price?: number }).confirmed_price ?? a.proposed_price) || 0) - (Number((b as { confirmed_price?: number }).confirmed_price ?? b.proposed_price) || 0))
        break
      case 'price_high':
        result.sort((a, b) => (Number((b as { confirmed_price?: number }).confirmed_price ?? b.proposed_price) || 0) - (Number((a as { confirmed_price?: number }).confirmed_price ?? a.proposed_price) || 0))
        break
      case 'deadline': {
        const getTs = (p: CommunityGroupBuy) =>
          p.expires_at
            ? new Date(p.expires_at).getTime()
            : Number.MAX_SAFE_INTEGER
        result.sort((a, b) => getTs(a) - getTs(b))
        break
      }
      // 🛡️ 2026-05-16: 'discount' 정렬 — 메인 hero "특가" 카테고리 진입 시
      // 🛡️ 2026-05-18: TS type 호환 — items union type 처리 (CommunityGroupBuy 등).
      case 'discount': {
        const discPct = (p: unknown) => {
          const r = (p ?? {}) as { original_price?: number | string | null; price?: number | string | null }
          const op = Number(r.original_price) || 0
          const pr = Number(r.price) || 0
          if (op > 0 && op > pr) return Math.round((1 - pr / op) * 100)
          return 0
        }
        result.sort((a, b) => discPct(b) - discPct(a))
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

      {/* 🛡️ 2026-06-07 (사용자 요청): 동네딜 탭은 BottomNav/DesktopTopNav 로 직접 진입하는
          primary destination 이므로 뒤로가기 + "공동구매" 타이틀 상단바 제거. DesktopTopNav(sticky,
          md+)가 normal flow 로 상단을 차지하므로 아래 배너가 자연히 그 밑에 위치 — 별도 top offset 불필요.
          모바일은 배너의 pt-4 로 상단 여백 확보. */}

      {/* 배너 — 클릭 시 맛집 공구 시작 */}
      <div className="ur-content-wide px-4 lg:px-8 pt-4">
        <div className="bg-gray-900 rounded-2xl px-5 py-4 flex items-center gap-3">
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
            className="shrink-0 flex items-center gap-1 bg-white dark:bg-white text-gray-900 dark:text-gray-900 px-3 py-2 rounded-full text-[12px] font-extrabold shadow-sm active:scale-95 transition-transform"
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
            {t('groupBuy.tabSeller', { defaultValue: '동네 공구' })}
          </button>
          <button
            onClick={() => { setMainTab('community'); setCategory('all'); setSortBy('popular') }}
            className={`flex-1 pb-2.5 text-[14px] font-semibold text-center transition-colors border-b-2 ${
              mainTab === 'community'
                ? 'text-gray-900 dark:text-white border-gray-900 dark:border-white'
                : 'text-gray-400 dark:text-gray-600 border-transparent'
            }`}
          >
            {t('groupBuy.tabCommunity', { defaultValue: '같이 모으기' })}
          </button>
        </div>
      </div>

      {/* 카테고리 탭 (셀러 공구 전용) */}
      {mainTab === 'seller' && (
        <div className="ur-content-wide px-4 lg:px-8 mt-4 overflow-x-auto no-scrollbar">
          {/* 🛡️ 2026-05-17: 카테고리 4종 통합 + 온라인/오프라인 대분류 라벨 표시.
                탭 순서: [전체] [🏪 오프라인 4종] [🛍️ 온라인]
                health/pet/activity 는 마이그레이션 0255 가 자동 변환 — UI 에선 제거. */}
          <div className="flex gap-2 min-w-max">
            {([
              { key: 'all', label: t('groupBuy.categoryAll', { defaultValue: '전체' }) },
              { key: 'meal_voucher', label: t('groupBuy.categoryMealVoucher', { defaultValue: '🍽️ 식사권' }) },
              { key: 'beauty_voucher', label: t('groupBuy.categoryBeauty', { defaultValue: '💇 미용' }) },
              { key: 'stay_voucher', label: t('groupBuy.categoryStay', { defaultValue: '🏨 숙소' }) },
              { key: 'etc_voucher', label: t('groupBuy.categoryEtc', { defaultValue: '🎯 기타' }) },
              { key: 'general', label: t('groupBuy.categoryGeneral', { defaultValue: '🛍️ 온라인 (배송)' }) },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  // 🛡️ 숙소(stay_voucher)는 products.price=0 + 위치·객실이 product_stay_info 별도 테이블이라
                  //   그리드 카드로는 ₩0·정보누락으로 깨짐 → 전용 /stays(객실·날짜·가격 join) 페이지로.
                  if (tab.key === 'stay_voucher') { navigate('/stays'); return }
                  setCategory(tab.key)
                  // 🧭 2026-06-17: URL 도 동기화 — PC 사이드바/딥링크와 단일 소스(공유·뒤로가기 지원).
                  const next = new URLSearchParams(searchParams)
                  if (tab.key === 'all') next.delete('category'); else next.set('category', tab.key)
                  setSearchParams(next, { replace: true })
                }}
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

      {/* 🛡️ 2026-05-17: 지역 필터 버튼 — voucher 류 한정 (general 탭에선 숨김).
            사용자 결정: "공구권에는 필요. 식사권/숙소권/헬스장 등에." */}
      <div className={`ur-content-wide px-4 lg:px-8 mt-3 ${category === 'general' ? 'hidden' : 'flex items-center gap-2'}`}>
        <button
          onClick={() => setRegionPickerOpen(true)}
          className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px] font-semibold border transition-colors ${
            regionKey
              ? 'bg-gray-900 dark:bg-white border-gray-900 dark:border-white text-white dark:text-gray-900'
              : 'bg-white dark:bg-[#1A1A1A] border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-gray-300'
          }`}
          aria-label="지역 선택"
        >
          <MapPin className="w-3.5 h-3.5" />
          <span className="max-w-[150px] truncate">{regionButtonLabel}</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-70" />
        </button>
        {regionKey && (
          <button
            onClick={() => applyRegion(null, null)}
            className="text-[12px] text-gray-500 dark:text-gray-400 underline underline-offset-2"
            aria-label="지역 필터 해제"
          >
            해제
          </button>
        )}
      </div>

      {/* 🛡️ 2026-05-16: 텍스트 검색 input */}
      <div className="ur-content-wide px-4 lg:px-8 mt-3">
        <div className="relative">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('groupBuy.searchPlaceholder', { defaultValue: '공구명/매장명 검색' })}
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-[#2A2A2A] rounded-full text-sm bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-white/30"
          />
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
      </div>

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
                      ? 'bg-gray-100 dark:bg-white/[0.08] text-gray-900 dark:text-white font-semibold'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#121212]'
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
            {/* 🛡️ 2026-06-04 (사용자 요청): '최근 본 공구' 제거. */}

            {/* 🛡️ 2026-05-15: 큐레이션 섹션 — 1명 남음 / 오늘 마감 / 거의 성공 (useMemo 로 매 렌더 재계산 방지) */}
            {!loading && filtered.length > 0 && (
              <>
                {curation.lastOne.length > 0 && (
                  <CurationStrip
                    title="🔥 1명만 더 모이면 성공"
                    subtitle="지금 참여하면 바로 공구 확정"
                    items={curation.lastOne}
                    navigate={navigate}
                    accent="red"
                  />
                )}
                {curation.closingToday.length > 0 && (
                  <CurationStrip
                    title="⏰ 오늘 마감"
                    subtitle="놓치면 다음 기회까지 며칠"
                    items={curation.closingToday}
                    navigate={navigate}
                    accent="amber"
                  />
                )}
                {curation.almostDone.length > 0 && (
                  <CurationStrip
                    title="✨ 거의 성공"
                    subtitle="목표의 70% 이상"
                    items={curation.almostDone}
                    navigate={navigate}
                    accent="neutral"
                  />
                )}
              </>
            )}

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                    className="flex items-center gap-1 px-5 py-2.5 bg-gray-900 text-white text-[13px] font-semibold rounded-full"
                  >
                    <Plus className="w-3.5 h-3.5" /> {t('groupBuy.ctaStartMeal', { defaultValue: '내 동네 공구 제안' })}
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
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-2.5">
                {filtered.slice(0, visibleCount).map((p, idx) => (
                  <GroupBuyGridCard
                    key={p.id}
                    p={p}
                    idx={idx}
                    interested={interestedIds.has(p.id)}
                    onToggleInterest={toggleInterest}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          /* ── 유저 공구 (Community Group Buys) ── */
          <>
            {communityLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="border border-gray-100 dark:border-[#1A1A1A] rounded-2xl p-4 animate-pulse">
                    <div className="h-4 bg-gray-100 dark:bg-[#1A1A1A] rounded w-3/4" />
                    <div className="h-3 bg-gray-100 dark:bg-[#1A1A1A] rounded w-1/2 mt-2" />
                    <div className="h-8 bg-gray-100 dark:bg-[#1A1A1A] rounded mt-3" />
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
                          <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-[#1A1A1A] flex items-center justify-center flex-shrink-0">
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
                            className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 dark:border-[#2A2A2A] active:scale-90 transition-transform"
                            aria-label={t('common.wishlist', { defaultValue: '관심 등록' })}
                          >
                            <Bell
                              className={`w-3.5 h-3.5 ${interestedIds.has(g.id) ? 'text-gray-900 fill-gray-900 dark:text-white dark:fill-white' : 'text-gray-400'}`}
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
                          <HandCoins className="w-3.5 h-3.5 text-gray-900 dark:text-white" />
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
                        <div className="w-full h-2.5 bg-gray-100 dark:bg-[#1A1A1A] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              achieved ? 'bg-emerald-500' : 'bg-gray-900 dark:bg-white'
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
                                <span className="font-semibold text-gray-900 dark:text-white">
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

      {/* 🛡️ 2026-05-17: 지역 선택 모달 (당근 스타일) */}
      <RegionPickerModal
        open={regionPickerOpen}
        regionKey={regionKey}
        districtKey={districtKey}
        onClose={() => setRegionPickerOpen(false)}
        onSelect={(r, d) => applyRegion(r, d)}
      />
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
  accent: "red" | "amber" | "neutral"
}) {
  const accentMap = {
    red:     { bg: "bg-red-50",   text: "text-red-600",   bar: "bg-red-500"   },
    amber:   { bg: "bg-amber-50", text: "text-amber-600", bar: "bg-amber-500" },
    neutral: { bg: "bg-gray-900", text: "text-white",     bar: "bg-gray-900"  },
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
                  {accent === "red" ? "1명 남음" : accent === "amber" ? "오늘 마감" : `${Math.round(progress)}%`}
                </div>
              </div>
              <div className="p-2.5 space-y-1">
                <p className="text-[12px] font-bold text-gray-900 dark:text-white truncate">{p.name}</p>
                {p.restaurant_name && <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{p.restaurant_name}</p>}
                <div className="w-full bg-gray-100 dark:bg-[#1A1A1A] rounded-full h-1.5 overflow-hidden">
                  <div className={`h-full ${a.bar} rounded-full transition-all`} style={{ width: `${progress}%` }} />
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400"><span className={`${a.text} font-bold`}>{remaining}명</span> 남음 · ₩{p.price?.toLocaleString("ko-KR") ?? "-"}</p>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
