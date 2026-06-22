/**
 * 🏁 2026-06-22 (대표 요청 — "상품/공구권 모두 선택할 수 있는 전용 페이지"):
 *   링크샵 '상품·동네딜 추가하기' 전용 picker. 기존엔 /browse(상품) · /group-buy(동네딜)로
 *   흩어져 나가 핀 추가가 이상적이지 않았음 → 한 화면에서 상품 + 공구권·동네딜을 탭으로 둘러보며
 *   탭 1번으로 추가/제거(토글). 이미 핀된 항목은 '추가됨' 으로 표시.
 *
 *   - 인증: ProtectedRoute(requireUser) — 본인만 (me 엔드포인트 사용).
 *   - 데이터: 상품 `/api/products?exclude_deal_only=1`, 공구권·동네딜은 교환권(`deal_only=1`) +
 *     동네딜(`/api/group-buy/products`) 병합(id dedupe).
 *   - 토글: curatorApi.addPin / removePin (직접 — usePinAction 의 로그인 redirect/클립보드 흐름 불필요).
 *   - 다크 기본 + 라이트 토글 (CuratorPage 와 동일 테마 토큰).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Search, X, Check, Plus, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { curatorApi } from '@/features/curator/api/curator-api'
import { seededColor } from '@/utils/card-gradient'
import { toast } from '@/hooks/useToast'
import { CURATOR_DEFAULTS } from '@/shared/constants/policy'
import SEO from '@/components/SEO'
// 🎨 2026-06-22 (대표 — "커스텀 카드 그만, 표준 카드 재사용"): picker 도 홈/쇼핑/동네딜과 같은
//   표준 카드(BrowseProductCard)를 그대로 써 디자인 영구 동기화. 카드 위에 핀 토글 버튼만 오버레이.
import BrowseProductCard from '@/pages/browse/BrowseProductCard'
import type { Product as BrowseProduct } from '@/pages/browse/types'

type PickerTab = 'shop' | 'voucher'

interface PickItem {
  id: number
  name: string
  price: number
  original_price?: number | null
  image_url?: string | null
  category?: string | null
  deal_only?: number
  dominant_color?: string | null
  /** 동네딜(group-buy) 출처 — 카드 본문 미리보기 목적지를 /group-buy/:id 로 (그 외는 /products/:id). */
  gb?: boolean
}

const PAGE_SIZE = 30

export default function LinkshopPinPicker() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialTab: PickerTab = searchParams.get('tab') === 'voucher' ? 'voucher' : 'shop'
  const [tab, setTab] = useState<PickerTab>(initialTab)
  const [query, setQuery] = useState('')

  // 이미 핀된 상품: product_id → pin_id (토글 제거에 pin_id 필요).
  const [pinMap, setPinMap] = useState<Map<number, number>>(new Map())
  const [pinsLoaded, setPinsLoaded] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  // 카탈로그
  const [shopItems, setShopItems] = useState<PickItem[]>([])
  const [voucherItems, setVoucherItems] = useState<PickItem[]>([])
  const [shopPage, setShopPage] = useState(1)
  const [shopHasMore, setShopHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const voucherFetchedRef = useRef(false)

  // ── 현재 핀 목록 (product_id → pin_id) ──
  useEffect(() => {
    let alive = true
    curatorApi.getPinStats(1)
      .then((res) => {
        if (!alive) return
        const m = new Map<number, number>()
        for (const s of res.stats || []) m.set(s.product_id, s.id)
        setPinMap(m)
      })
      .catch(() => { /* 비어있게 시작 */ })
      .finally(() => { if (alive) setPinsLoaded(true) })
    return () => { alive = false }
  }, [])

  // ── 상품 로드 (page 누적) ──
  const loadShop = useCallback((pageNum: number, reset: boolean) => {
    if (reset) setLoading(true); else setLoadingMore(true)
    const params = new URLSearchParams({
      page: String(pageNum),
      limit: String(PAGE_SIZE),
      exclude_deal_only: '1',
      sort: 'popular',
    })
    api.get(`/api/products?${params.toString()}`)
      .then((r) => {
        if (r.data?.success) {
          const items: PickItem[] = r.data.data || []
          setShopItems((prev) => reset ? items : [...prev, ...items])
          setShopHasMore(items.length === PAGE_SIZE)
          if (reset) setShopPage(1)
        }
      })
      .catch(() => { /* graceful */ })
      .finally(() => { if (reset) setLoading(false); else setLoadingMore(false) })
  }, [])

  // ── 공구권·동네딜 로드 (교환권 + 동네딜 병합, 1회) ──
  const loadVouchers = useCallback(() => {
    if (voucherFetchedRef.current) return
    voucherFetchedRef.current = true
    setLoading(true)
    Promise.allSettled([
      api.get('/api/products?deal_only=1&sort=popular&limit=100'),
      api.get('/api/group-buy/products?status=active&limit=200'),
    ])
      .then(([vouchersRes, groupBuyRes]) => {
        const merged = new Map<number, PickItem>()
        const push = (arr: PickItem[]) => { for (const it of arr) if (it?.id && !merged.has(it.id)) merged.set(it.id, it) }
        if (vouchersRes.status === 'fulfilled' && vouchersRes.value.data?.success) push(vouchersRes.value.data.data || [])
        if (groupBuyRes.status === 'fulfilled' && groupBuyRes.value.data?.success) {
          push(((groupBuyRes.value.data.data || []) as PickItem[]).map((it) => ({ ...it, gb: true })))
        }
        setVoucherItems(Array.from(merged.values()))
      })
      .finally(() => setLoading(false))
  }, [])

  // 탭 진입 시 데이터 보장
  useEffect(() => {
    if (tab === 'shop') {
      if (shopItems.length === 0) loadShop(1, true)
      else setLoading(false)
    } else {
      loadVouchers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // 링크샵의 핀 분류(deal_only===1 || voucher 카테고리)와 일치 — 같은 항목이 두 탭에 중복 노출되지 않도록.
  const isVoucherItem = (it: PickItem) => it.deal_only === 1 || /voucher/i.test(it.category || '')
  const items = tab === 'shop' ? shopItems.filter((it) => !isVoucherItem(it)) : voucherItems
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) => (it.name || '').toLowerCase().includes(q))
  }, [items, query])

  const pinnedCount = pinMap.size

  async function toggle(item: PickItem) {
    if (busyId) return
    const existingPinId = pinMap.get(item.id)
    setBusyId(item.id)
    try {
      if (existingPinId) {
        const res = await curatorApi.removePin(existingPinId)
        if (res?.success) {
          setPinMap((prev) => { const n = new Map(prev); n.delete(item.id); return n })
          toast.success('링크샵에서 제거됨')
        } else {
          toast.error('제거 실패')
        }
      } else {
        if (pinMap.size >= CURATOR_DEFAULTS.PIN_MAX_PER_USER) {
          toast.error(`최대 ${CURATOR_DEFAULTS.PIN_MAX_PER_USER}개까지 추가할 수 있어요`)
          return
        }
        const res = await curatorApi.addPin(item.id)
        if (res?.success && res.pin) {
          setPinMap((prev) => { const n = new Map(prev); n.set(item.id, res.pin!.id); return n })
          toast.success('링크샵에 추가됨')
        } else if (res?.code === 'ALREADY_PINNED') {
          toast.info('이미 추가된 상품이에요')
        } else {
          toast.error(res?.error || '추가 실패')
        }
      }
    } catch {
      toast.error('처리 중 오류가 발생했어요')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <SEO title="링크샵에 추가 - 유어딜" description="상품과 공구권을 내 링크샵에 추가하세요" url="/u/me/add" />
      <div className="min-h-screen bg-white dark:bg-[#020202] text-gray-900 dark:text-white pb-28">
        {/* 상단 바 */}
        <div className="sticky top-0 z-40 bg-white/90 dark:bg-[#0A0A0A]/90 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A]">
          <div className="max-w-3xl mx-auto px-3 h-14 flex items-center gap-2">
            <button
              onClick={() => navigate('/u/me')}
              aria-label="뒤로"
              className="shrink-0 w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-gray-700 dark:text-gray-200 active:bg-gray-100 dark:active:bg-[#1A1A1A]"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-[15px] font-extrabold leading-tight truncate">내 링크샵에 추가</h1>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight">
                {pinnedCount > 0 ? `${pinnedCount}개 추가됨` : '마음에 든 상품·공구권을 담아보세요'}
              </p>
            </div>
            <button
              onClick={() => navigate('/u/me')}
              className="shrink-0 px-3.5 h-9 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-[#020202] text-[13px] font-bold active:opacity-80"
            >
              완료
            </button>
          </div>
          {/* 탭 */}
          <div className="max-w-3xl mx-auto px-3 flex gap-1">
            {([['shop', '상품'], ['voucher', '공구권·동네딜']] as [PickerTab, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setTab(key); setQuery('') }}
                className={`relative flex-1 py-2.5 text-[13.5px] font-bold transition-colors ${
                  tab === key ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {label}
                {tab === key && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-[2.5px] rounded-full bg-gray-900 dark:bg-white" />}
              </button>
            ))}
          </div>
        </div>

        {/* 검색 */}
        <div className="max-w-3xl mx-auto px-4 pt-3">
          <div className="flex items-center gap-2 h-11 px-3.5 rounded-xl border border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#121212]">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === 'shop' ? '상품 이름으로 검색' : '공구권·동네딜 이름으로 검색'}
              className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-gray-900 dark:text-white placeholder:text-gray-400"
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="지우기" className="shrink-0 w-5 h-5 rounded-full bg-gray-300 dark:bg-[#3A3A3A] text-white flex items-center justify-center">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* 그리드 */}
        {loading && items.length === 0 ? (
          <div className="max-w-3xl mx-auto px-4 grid grid-cols-2 gap-3 pt-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-2xl bg-gray-100 dark:bg-[#121212] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="max-w-3xl mx-auto px-4 py-20 text-center">
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              {query ? '검색 결과가 없어요' : tab === 'shop' ? '담을 수 있는 상품이 없어요' : '담을 수 있는 공구권이 없어요'}
            </p>
            {!query && (
              <Link to={tab === 'shop' ? '/browse' : '/group-buy'} className="inline-block mt-3 text-[13px] font-bold text-gray-500 dark:text-gray-400 underline">
                전체 {tab === 'shop' ? '쇼핑' : '동네딜'} 둘러보기 →
              </Link>
            )}
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 grid grid-cols-2 gap-3 pt-4">
            {filtered.map((item) => (
              <PickCard
                key={item.id}
                item={item}
                pinned={pinMap.has(item.id)}
                busy={busyId === item.id || !pinsLoaded}
                onToggle={() => toggle(item)}
              />
            ))}
          </div>
        )}

        {/* 더 보기 (상품 탭만 page 누적) */}
        {tab === 'shop' && !query && shopHasMore && filtered.length > 0 && (
          <div className="max-w-3xl mx-auto px-4 pt-4">
            <button
              onClick={() => { const next = shopPage + 1; setShopPage(next); loadShop(next, false) }}
              disabled={loadingMore}
              className="w-full py-3 rounded-xl border border-gray-200 dark:border-[#2A2A2A] text-[13.5px] font-bold text-gray-700 dark:text-gray-200 active:opacity-70 disabled:opacity-50"
            >
              {loadingMore ? '불러오는 중…' : '더 보기'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// 🎨 2026-06-22 (대표 — A안): 표준 BrowseProductCard 재사용(디자인 영구 동기화) + 핀 토글 버튼 오버레이.
//   카드 본문 클릭 = 상품/동네딜 상세 미리보기, 우상단 버튼 = 추가/제거 토글(stopPropagation).
//   PinCard(링크샵 핀) 의 래핑 패턴과 동일.
function PickCard({ item, pinned, busy, onToggle }: { item: PickItem; pinned: boolean; busy: boolean; onToggle: () => void }) {
  const product: BrowseProduct = {
    id: item.id,
    name: item.name,
    price: item.price,
    current_price: item.price,
    original_price: item.original_price ?? undefined,
    discount_rate: 0, // BrowseProductCard 가 original_price 로 자동 계산
    image_url: item.image_url || '',
    stock: 0,
    dominant_color: item.dominant_color,
    deal_only: item.deal_only,
  }
  // dominant_color 없고 외부호스트 CORS 로 추출 실패 시 회색 단색 방지(PinCard 와 동일 폴백).
  const fallbackColor = item.dominant_color || seededColor(item.category || item.id)
  const to = item.gb ? `/group-buy/${item.id}` : `/products/${item.id}`

  function handleToggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onToggle()
  }

  return (
    <div className={`relative group rounded-2xl ${pinned ? 'ring-2 ring-gray-900 dark:ring-white ring-offset-2 ring-offset-white dark:ring-offset-[#020202]' : ''}`}>
      <BrowseProductCard product={product} aboveFold={false} to={to} fallbackColor={fallbackColor} />
      {/* 핀 토글 버튼 — 추가됨(잉크 필) / 추가(글래스) */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={busy}
        aria-pressed={pinned}
        aria-label={pinned ? '링크샵에서 제거' : '링크샵에 추가'}
        className={`absolute top-2 right-2 z-10 inline-flex items-center gap-1 h-8 pl-2 pr-2.5 rounded-full text-[12px] font-bold shadow-sm backdrop-blur-md ring-1 transition-colors active:scale-95 disabled:opacity-50 ${
          pinned
            ? 'bg-gray-900 dark:bg-white text-white dark:text-[#020202] ring-white/30'
            : 'bg-white/90 dark:bg-black/55 text-gray-900 dark:text-white ring-black/10 dark:ring-white/25'
        }`}
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : pinned ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
        {pinned ? '추가됨' : '추가'}
      </button>
    </div>
  )
}
