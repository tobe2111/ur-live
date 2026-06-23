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
import { invalidateCurator } from '@/features/curator/curator-page-cache'

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
  /** 추천 적립률(%) — 담으면 얼마 적립되는지 신호. /api/products 만 포함(동네딜 group-buy 는 없음). */
  referral_commission_rate?: number
  /** 동네딜(group-buy) 출처 — 카드 본문 미리보기 목적지를 /group-buy/:id 로 (그 외는 /products/:id). */
  gb?: boolean
}

const PAGE_SIZE = 30

// 🏁 2026-06-22 (로딩 워밍): picker 재진입 시 cold fetch 없이 즉시 페인트(세션 모듈 캐시, 60s TTL).
//   핀 맵은 캐시 안 함 — 항상 fresh(다른 곳에서 담/뺐을 수 있음).
const PICKER_CACHE_TTL = 60_000
let _shopCache: { items: PickItem[]; page: number; hasMore: boolean; at: number } | null = null
let _voucherCache: { items: PickItem[]; at: number } | null = null
const freshShop = () => (_shopCache && Date.now() - _shopCache.at < PICKER_CACHE_TTL ? _shopCache : null)
const freshVoucher = () => (_voucherCache && Date.now() - _voucherCache.at < PICKER_CACHE_TTL ? _voucherCache : null)

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
  // 🏁 2026-06-22 (추천 코멘트 루프): 담은 직후 한 줄 추천 코멘트 입력(선택) — 동기 부여 최고 시점.
  const [noteFor, setNoteFor] = useState<{ pinId: number; name: string } | null>(null)

  // 카탈로그 — 세션 캐시가 신선하면 즉시 페인트(cold fetch 스킵).
  const [shopItems, setShopItems] = useState<PickItem[]>(() => freshShop()?.items ?? [])
  const [voucherItems, setVoucherItems] = useState<PickItem[]>(() => freshVoucher()?.items ?? [])
  const [shopPage, setShopPage] = useState(() => freshShop()?.page ?? 1)
  const [shopHasMore, setShopHasMore] = useState(() => freshShop()?.hasMore ?? true)
  const [loading, setLoading] = useState(() => !(initialTab === 'shop' ? freshShop() : freshVoucher()))
  const [loadingMore, setLoadingMore] = useState(false)
  const voucherFetchedRef = useRef(!!freshVoucher())

  // 신선한 카탈로그를 모듈 캐시에 동기화 → 다음 진입 instant.
  useEffect(() => { if (shopItems.length) _shopCache = { items: shopItems, page: shopPage, hasMore: shopHasMore, at: Date.now() } }, [shopItems, shopPage, shopHasMore])
  useEffect(() => { if (voucherItems.length) _voucherCache = { items: voucherItems, at: Date.now() } }, [voucherItems])

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
          invalidateCurator() // 링크샵 재진입 시 즉시 반영(stale flash 방지)
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
          const newPinId = res.pin.id
          setPinMap((prev) => { const n = new Map(prev); n.set(item.id, newPinId); return n })
          invalidateCurator() // 링크샵 재진입 시 즉시 반영
          // 추천 코멘트 입력(선택) — 담은 직후 바로. 닫으면 코멘트 없이 유지.
          setNoteFor({ pinId: newPinId, name: item.name })
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
      {noteFor && (
        <NoteModal
          pinId={noteFor.pinId}
          productName={noteFor.name}
          onClose={() => setNoteFor(null)}
        />
      )}
    </>
  )
}

// 🏁 2026-06-22 (추천 코멘트 루프): 담은 직후 한 줄 추천 코멘트(선택) 바텀시트. 링크샵의 핵심 차별점
//   ("왜 추천하는지")을 담는 순간 입력받음. 건너뛰면 코멘트 없이 핀 유지(이미 추가됨).
function NoteModal({ pinId, productName, onClose }: { pinId: number; productName: string; onClose: () => void }) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    const trimmed = note.trim()
    if (!trimmed) { onClose(); return }
    setSaving(true)
    try {
      const res = await curatorApi.updatePinNote(pinId, trimmed.slice(0, CURATOR_DEFAULTS.PIN_NOTE_MAX_LEN))
      if (res?.success) { invalidateCurator(); toast.success('추천 코멘트 저장됨') }
      else toast.error('코멘트 저장 실패')
    } catch { toast.error('코멘트 저장 실패') } finally { setSaving(false); onClose() }
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white dark:bg-[#121212] rounded-t-3xl sm:rounded-3xl p-5 pb-7 animate-slideUp">
        <div className="flex items-start gap-2 mb-1">
          <span className="text-[15px] font-extrabold text-gray-900 dark:text-white flex-1">✓ 링크샵에 추가됨</span>
          <button onClick={onClose} aria-label="닫기" className="shrink-0 w-7 h-7 -mt-0.5 -mr-1 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[13px] text-gray-500 dark:text-gray-400 line-clamp-1 mb-3">{productName}</p>
        <label className="block text-[12.5px] font-bold text-gray-700 dark:text-gray-200 mb-1.5">추천 코멘트 <span className="font-medium text-gray-400">(선택 · 전환율 ↑)</span></label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          autoFocus
          rows={2}
          maxLength={CURATOR_DEFAULTS.PIN_NOTE_MAX_LEN}
          placeholder="예: 재구매만 3번째예요. 향이 진짜 좋아요!"
          className="w-full rounded-xl border border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#0A0A0A] px-3.5 py-2.5 text-[14px] text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-gray-400 dark:focus:border-[#3A3A3A] resize-none"
        />
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-[#2A2A2A] text-[13.5px] font-bold text-gray-600 dark:text-gray-300 active:opacity-70">건너뛰기</button>
          <button onClick={save} disabled={saving} className="flex-1 py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-[#020202] text-[13.5px] font-bold active:opacity-80 disabled:opacity-50">
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
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
  const commission = Math.round(Number(item.referral_commission_rate) || 0)

  function handleToggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onToggle()
  }

  return (
    <div className={`relative group rounded-2xl ${pinned ? 'ring-2 ring-gray-900 dark:ring-white ring-offset-2 ring-offset-white dark:ring-offset-[#020202]' : ''}`}>
      <BrowseProductCard product={product} aboveFold={false} to={to} fallbackColor={fallbackColor} />
      {/* 적립률 신호 — 담으면 얼마 적립되는지(있을 때만). 동네딜(group-buy)은 데이터 없어 미표시. */}
      {commission > 0 && (
        <span className="absolute top-2 left-2 z-10 inline-flex items-center gap-0.5 h-6 px-2 rounded-full bg-black/55 backdrop-blur-md ring-1 ring-white/20 text-white text-[11px] font-bold pointer-events-none">
          적립 {commission}%
        </span>
      )}
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
