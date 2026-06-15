import { useState, useMemo, useEffect, useCallback, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import SEO, { wholesaleStoreJsonLd, itemListJsonLd } from '@/components/SEO'
import { ChevronRight, FileSpreadsheet } from 'lucide-react'
import { useWholesaleMe, useWholesaleHome, useWholesaleStatement, useWholesaleRecentItems, useWholesaleDeposit, useWholesaleMall } from '@/hooks/queries/useWholesale'
import WholesaleBannerCarousel from './wholesale/WholesaleBannerCarousel'
import { queryKeys } from '@/hooks/queries/queryKeys'
import { getSupplierToken, clearSupplierSession } from '@/lib/supplier-api'
import { clearAuthData } from '@/utils/auth'
import { toast } from '@/hooks/useToast'
import {
  WT, comma, WHOLESALE_CATEGORIES,
} from './wholesale/wholesale-theme'
import { useWholesaleCart } from './wholesale/useWholesaleCart'
import WholesaleFooter from './wholesale/WholesaleFooter'
// 분해 (순수 추출, 동작 변화 0): 카드/헤더/섹션/타입은 ./wholesale-catalog/ 폴더로 추출.
import type { CatalogItem, BrandEntry, ReorderItem, CatOpt } from './wholesale-catalog/types'
import { type CatalogSort, PRICE_BANDS } from './wholesale-catalog/catalog-controls'
import { ProductCard, SectionHead } from './wholesale-catalog/cards'
import { CatChips, Sidebar } from './wholesale-catalog/cat-nav'
import GradeSheet from './wholesale-catalog/GradeSheet'
import { readSsrWholesale } from './wholesale-catalog/ssr'
import CatalogHeader from './wholesale-catalog/CatalogHeader'
import HeroSection from './wholesale-catalog/HeroSection'
import BrandHero from './wholesale-catalog/BrandHero'
import HomeRails from './wholesale-catalog/HomeRails'
import ShowcaseBanners from './wholesale-catalog/ShowcaseBanners'
import FilterControls from './wholesale-catalog/FilterControls'
import BulkOrderPanel from './wholesale-catalog/BulkOrderPanel'
import { TrustBar, SupplierCTA } from './wholesale-catalog/HomeSections'

// 🏭 2026-06-09 Wave 4b: 채팅 floating 버튼 — lazy(채팅 코드 0 byte in 초기 번들).
//   버튼 자체는 unread 배지 폴링만, 무거운 위젯은 버튼 클릭 시 한 번 더 lazy 로드.
const WholesaleChatButton = lazy(() => import('@/components/wholesale/WholesaleChatButton'))
// 🏭 perf: 제안/신고 모달 — 헤더 아이콘 클릭 시에만 필요. lazy 로 카탈로그 초기 청크에서 제외
//   (제안 폼 + useWholesaleFeedbacks 훅 코드를 첫 페인트 번들 밖으로).
const WholesaleProposalModal = lazy(() => import('./wholesale/WholesaleProposalModal'))

// ──────────────────────────────────────────────────────────────
// 🏭 2026-06-04 유통스타트 도매몰 홈 — Claude Design 시안 구현 (TDS/Toss 라이트).
//   무채색 베이스 + #FF0033 1포인트 · 브랜드 히어로 · 사입 대시보드 · 정제된 카드.
//   제조사 신원·원가(supply_price) 비노출, 등급 공급가 + 권장가(마진 산출)만.
//   라이트 고정 B2B 서피스 (대시보드 계열) — dark: variant 없음.
// ──────────────────────────────────────────────────────────────

// 🏬 2026-06-14 (사용자 요청): 컬렉션 페이지 분리 — 같은 데이터 로직 재사용, mode 로 초기 필터/게이팅.
//   /wholesale(home) | /wholesale/best|new|margin|premium|brands.
export type WholesaleCollectionMode = 'best' | 'new' | 'margin' | 'premium' | 'brands'

export default function WholesaleCatalogPage({ mode }: { mode?: WholesaleCollectionMode } = {}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const token = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  // 🏭 2026-06-10 (사용자 요청): 찜리스트 — 로그인 시 1회 로드, 카드 하트 토글(낙관 업데이트).
  const [wishedIds, setWishedIds] = useState<Set<number>>(new Set())
  useEffect(() => {
    const tk = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
    if (!tk) return
    api.get('/api/wholesale/wishlist', { headers: { Authorization: `Bearer ${tk}` } })
      .then(r => {
        if (r.data?.success) setWishedIds(new Set((r.data.items || []).map((i: { product_id: number }) => Number(i.product_id))))
      })
      .catch(() => { /* graceful */ })
  }, [])
  const toggleWish = useCallback((p: CatalogItem) => {
    const tk = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
    if (!tk) { toast.error('찜은 유통회원 전용이에요 — 로그인해주세요'); navigate('/wholesale/login'); return }
    setWishedIds(prev => { const n = new Set(prev); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n })
    api.post(`/api/wholesale/wishlist/${p.id}/toggle`, {}, { headers: { Authorization: `Bearer ${tk}` } })
      .catch(() => {
        setWishedIds(prev => { const n = new Set(prev); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n })
        toast.error('찜 처리 실패 — 다시 시도해주세요')
      })
  }, [navigate])

  const [search, setSearch] = useState('')
  const [committedSearch, setCommittedSearch] = useState('')
  const [cat, setCat] = useState('all')
  // 🏬 컬렉션 모드 초기 정렬: 신상품=newest, 마진=discount, 그 외=popular(베스트).
  const [sort, setSort] = useState<CatalogSort>(mode === 'new' ? 'newest' : mode === 'margin' ? 'discount' : 'popular')
  const [inStock, setInStock] = useState(false)
  const [priceBand, setPriceBand] = useState<string>('')   // PRICE_BANDS.id | ''
  const [gradeOpen, setGradeOpen] = useState(false)
  // 🧹 2026-06-15 (사용자 요청 — 홈 정리): 대량주문 엑셀 패널은 상시 펼침 → 토글(기본 접힘).
  //   파워유저 기능이 기본 둘러보기 그리드를 점령하던 혼잡 제거.
  const [bulkOpen, setBulkOpen] = useState(false)
  // 🏭 Wave 2 — Sellpie형 카테고리 네비 + 메가메뉴 + 제안/신고 모달 + 프리미엄 전용관.
  const [megaOpen, setMegaOpen] = useState(false)
  const [proposalOpen, setProposalOpen] = useState(false)
  // 네비 항목(베스트/신상품/마진/프리미엄)은 기존 sort/cat 필터를 재활용 — 새 상태 아님.
  const [premiumView, setPremiumView] = useState(mode === 'premium')
  // 🏷️ 2026-06-09 브랜드 전시관 — brandView(브랜드 그리드 모드) + selectedBrand(특정 브랜드 클릭 시 필터).
  //   selectedBrand 가 있으면 catalog 가 ?brand=<name> 으로 그 브랜드 상품만; 없으면 브랜드 그리드를 보여줌.
  const [brandView, setBrandView] = useState(mode === 'brands')
  const [selectedBrand, setSelectedBrand] = useState<string>('')
  // 🏬 컬렉션 모드 = 전용 페이지(홈 레일/배너/히어로 숨김, 해당 컬렉션 그리드만).
  const collectionMode = !!mode
  const COLLECTION_TITLE: Record<WholesaleCollectionMode, string> = {
    best: '월간 베스트', new: '신상품', margin: '판매마진 높은 상품', premium: '프리미엄 전용관', brands: '브랜드 전시관',
  }

  // 검색 디바운스(300ms) — 타이핑마다 fetch 폭주 방지. form submit 도 즉시 커밋.
  useEffect(() => {
    const id = setTimeout(() => setCommittedSearch(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  // 활성 가격대 → min/max (원). 미선택이면 둘 다 null.
  const band = useMemo(() => PRICE_BANDS.find(b => b.id === priceBand) ?? null, [priceBand])

  // ── 서버사이드 카탈로그 쿼리(BIZ-4) — 모든 컨트롤을 `/catalog` 파라미터에 위임.
  //   기본값(검색 없음·cat all·popular·재고off·가격 미설정)은 전부 생략 → URL = `/api/wholesale/catalog?`
  //   (= 기존 useWholesaleCatalog('') 와 byte-identical 요청). 그 외엔 새 캐시키 + 새 쿼리.
  const catalogKey = `${committedSearch}|${cat}|${sort}|${inStock ? 1 : 0}|${band?.id ?? ''}|${premiumView ? 'P' : ''}|${selectedBrand ? `B:${selectedBrand}` : ''}`
  // 🏭 2026-06-10 [LOADING_ADDITIVE] (사용자 신고 — "로드되자마자 상품이 안 떠"): worker SSR 주입
  //   (__SSR_INITIAL_WHOLESALE__) 즉시 소비. 기본 파라미터에서만.
  //   - guest: initialData — fetch 자체가 없음 (0-RTT 완결)
  //   - 로그인: placeholderData — 카드(사진/이름/재고)는 즉시 그리고, 등급가 fetch 가 도착하면 가격 교체.
  //     (가격 영역은 isPlaceholderData 동안 스켈레톤 — 잠금 칩 오표시 방지)
  const isDefaultCatalog = !committedSearch && cat === 'all' && sort === 'popular' && !inStock && !band && !premiumView && !selectedBrand
  const catalogQ = useQuery<CatalogItem[]>({
    queryKey: queryKeys.wholesale('catalog', catalogKey),
    initialData: () => {
      if (!isDefaultCatalog) return undefined
      if (typeof window !== 'undefined' && localStorage.getItem('seller_token')) return undefined // 로그인 = 등급가 fetch 필수
      return readSsrWholesale() ?? undefined
    },
    placeholderData: () => {
      if (!isDefaultCatalog) return undefined
      if (typeof window === 'undefined' || !localStorage.getItem('seller_token')) return undefined
      return readSsrWholesale() ?? undefined
    },
    queryFn: () => {
      const params = new URLSearchParams()
      if (committedSearch) params.set('search', committedSearch)
      if (cat !== 'all') params.set('category', cat)
      if (sort !== 'popular') params.set('sort', sort)
      if (inStock) params.set('in_stock', '1')
      if (band?.min != null) params.set('min_price', String(band.min))
      if (band?.max != null) params.set('max_price', String(band.max))
      // 🏭 Wave 2: 프리미엄 전용관 — is_premium=1 필터. 기본 요청 URL 불변(premiumView false 시 생략).
      if (premiumView) params.set('premium', '1')
      // 🏷️ 브랜드 전시관 — 특정 브랜드 선택 시 그 브랜드 상품만. 미선택이면 생략(기본 요청 URL 불변).
      if (selectedBrand) params.set('brand', selectedBrand)
      const tk = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
      const qs = params.toString()
      return api
        .get(`/api/wholesale/catalog${qs ? `?${qs}` : '?'}`, { headers: tk ? { Authorization: `Bearer ${tk}` } : {} })
        .then((r) => (r.data?.success ? ((r.data.items || []) as CatalogItem[]) : []))
        .catch(() => [])
    },
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
  // 🏷️ 2026-06-09 브랜드 전시관 — ?brands=1 로 현재 몰의 브랜드 distinct 목록(이름+상품수) 로드.
  //   브랜드 전시관 진입(brandView) + 특정 브랜드 미선택일 때만 활성(enabled) → 그 외엔 fetch 안 함.
  const brandsQ = useQuery<BrandEntry[]>({
    queryKey: queryKeys.wholesale('catalog-brands', ''),
    queryFn: () => {
      const tk = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
      return api
        .get('/api/wholesale/catalog?brands=1', { headers: tk ? { Authorization: `Bearer ${tk}` } : {} })
        .then((r) => (r.data?.success ? ((r.data.brands || []) as BrandEntry[]) : []))
        .catch(() => [])
    },
    enabled: brandView,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
  // 🏭 2026-06-10 (최속화): 부가 데이터(월 통계/재주문 레일)는 첫 페인트와 대역폭 경쟁하지 않게
  //   idle 이후로 지연 — 카탈로그(상품)가 항상 최우선. 헤더 필수(me/예치금/카테고리)는 즉시.
  const [deferredReady, setDeferredReady] = useState(false)
  useEffect(() => {
    const fire = () => setDeferredReady(true)
    type IdleWindow = Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
    const w = window as IdleWindow
    if (typeof w.requestIdleCallback === 'function') { w.requestIdleCallback(fire, { timeout: 1500 }) }
    else { setTimeout(fire, 600) }
  }, [])
  // 🏭 idle 에 상세/장바구니 chunk 도 예열 — 카드 클릭/담기 시 chunk fetch 대기 0.
  useEffect(() => {
    if (!deferredReady) return
    import('./WholesaleProductPage').catch(() => {})
    import('./WholesaleCartPage').catch(() => {})
  }, [deferredReady])
  const meQ = useWholesaleMe()
  const depositQ = useWholesaleDeposit()
  const homeQ = useWholesaleHome()
  // 🏬 2026-06-09 멀티-몰 브랜딩 — host → mall (없으면 유통스타트/#FF0033 기본 → byte-identical).
  //   헤더 워드마크(name+logo) + 브랜드 색(CSS 변수 --ud-brand). 기본 몰이면 모든 값이 현 디폴트와 동일.
  const { displayName: mallName, brandColor: mallBrand, logoUrl: mallLogo } = useWholesaleMall()
  // 도매 서피스에서 문서 타이틀을 몰 이름으로(선택). 기본 몰이면 '유통스타트' → 동작 불변.
  useEffect(() => {
    if (typeof document !== 'undefined' && mallName) document.title = `${mallName} 도매몰`
  }, [mallName])
  // 이번달 사입액 (거래내역서 summary 재사용).
  const monthFrom = useMemo(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` }, [])
  const monthTo = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const stmtQ = useWholesaleStatement(monthFrom, monthTo, { enabled: deferredReady })

  const allItems = (catalogQ.data ?? []) as unknown as CatalogItem[]
  const me = (meQ.data ?? null) as { grade: string; margin_pct: number; special_active: boolean; special_discount_until: string | null } | null
  const home = homeQ.data
  const loading = catalogQ.isLoading
  // 그리드 = 서버가 이미 검색/카테고리/정렬/필터 적용한 결과 그대로(클라 재정렬/재필터 없음).
  const items = allItems
  // 🏭 2026-06-15 시안: 비로그인 히어로 우측 추천 상품 — 첫 이미지 보유 상품(공급가는 비노출).
  const featured = items.find((p) => p.image_url) ?? null

  // 🏭 2026-06-08 SEO: 카탈로그 상품 ItemList JSON-LD — 이름·이미지·utongstart URL 만(공급가 절대 제외).
  //   기본(검색/필터 없는) 카탈로그에서만 노출 → 정규 도매 인덱스 시그널. 상위 24개로 제한.
  const catalogJsonLd = useMemo(() => {
    const base: Record<string, unknown>[] = [wholesaleStoreJsonLd]
    if (items.length > 0) {
      base.push(itemListJsonLd(
        items.slice(0, 24).map((p, i) => ({
          position: i + 1,
          name: p.name,
          url: `https://utongstart.com/wholesale/product/${p.id}`,
          ...(p.image_url ? { image: p.image_url } : {}),
        })),
      ))
    }
    return base
  }, [items])

  // 카테고리 칩/카운트 = 홈 endpoint 의 전체 카테고리 분포(서버 카테고리 필터와 무관하게 안정).
  //   홈 데이터 없으면(비로그인 등) 현재 로드된 아이템에서 파생 — 기존 동작 보존.
  const catCounts = useMemo(() => {
    const m: Record<string, number> = {}
    if (home?.categories?.length) {
      let total = 0
      for (const c2 of home.categories) { m[c2.key] = c2.count; total += c2.count }
      m.all = total
    } else {
      m.all = allItems.length
      for (const p of allItems) if (p.category) m[p.category] = (m[p.category] || 0) + 1
    }
    return m
  }, [home?.categories, allItems])

  // 카테고리 칩/사이드바 = 실제 상품에 존재하는 카테고리만(데이터 기반). 알려진 id 는 한글 라벨,
  // 모르는 값은 원본 문자열 그대로 — 공급자가 자유 입력해도 필터가 항상 동작.
  const cats = useMemo<CatOpt[]>(() => {
    const present = new Set<string>()
    if (home?.categories?.length) { for (const c2 of home.categories) if (c2.key) present.add(c2.key) }
    else { for (const p of allItems) if (p.category) present.add(p.category) }
    const labelOf = new Map(WHOLESALE_CATEGORIES.map(c => [c.id, c.label]))
    const known = WHOLESALE_CATEGORIES
      .filter(c => c.id !== 'all' && present.has(c.id))
      .map(c => ({ id: c.id, label: c.label }))
    const knownIds = new Set(known.map(k => k.id))
    const unknown = [...present]
      .filter(id => !knownIds.has(id))
      .sort((a, b) => (catCounts[b] || 0) - (catCounts[a] || 0))
      .map(id => ({ id, label: labelOf.get(id) || id }))
    return [{ id: 'all', label: '전체' }, ...known, ...unknown]
  }, [home?.categories, allItems, catCounts])

  const recentQ = useWholesaleRecentItems({ enabled: deferredReady })
  const recent = (recentQ.data ?? []) as ReorderItem[]
  const cart = useWholesaleCart()
  const loggedIn = !!token
  // 로그인한 유통사의 /me 실패(네트워크 오류 등) — 조용히 C등급 표시하지 않도록 에러 구분.
  const meLoadFailed = !!(loggedIn && meQ.isFetched && meQ.isError && !me)
  useEffect(() => {
    if (meLoadFailed) toast.error('등급 정보를 가져오지 못했어요 — 새로고침해 주세요', { duration: 5000 })
  }, [meLoadFailed])
  // 🏭 2026-06-04 도매몰 허브 — 제조사(공급사=브랜드사) / 셀러 본인 대시보드로 가는 진입.
  //   제조사는 supplier_token, 셀러는 seller_token(단, 순수 유통사 is_distributor 는 제외).
  const supplierToken = typeof window !== 'undefined' ? getSupplierToken() : null
  // 🏭 2026-06-04 카카오 통합: 카카오 유저로 로그인됐지만 아직 유통회원(seller_token)이 아닌 상태.
  //   사업자 정보 + 관리자 승인 필요라 1탭 X → 입점 폼(/wholesale/join)으로 유도.
  const userSession = !loggedIn && typeof window !== 'undefined' && !!localStorage.getItem('user_id')
  // 🏭 2026-06-06 (B2 fix): 카카오로 도매 로그인 → /wholesale 에 user_id 세션만 가지고 도착.
  //   이미 유통회원(이메일 연결된 승인 셀러)이면 자동으로 seller_token 발급받아야 "로그인 안 됨"처럼
  //   보이는 UX 가 사라짐. become-distributor 를 빈 body 로 시도 — 기존 승인 회원만 토큰 발급(신규는
  //   사업자정보 400 → 무시하고 신청 배너 유지). SupplierLoginPage 의 /become 자동시도와 대칭.
  const [becoming, setBecoming] = useState(false)
  useEffect(() => {
    if (!userSession || becoming) return
    let cancelled = false
    setBecoming(true)
    api.post('/api/wholesale/become-distributor', {})
      .then((r) => {
        if (cancelled) return
        const d = r.data
        if (d?.success && d?.status === 'approved' && d?.data?.accessToken) {
          const s = d.data.seller || {}
          localStorage.setItem('seller_token', d.data.accessToken)
          localStorage.setItem('access_token', d.data.accessToken)
          localStorage.setItem('seller_refresh_token', d.data.refreshToken || '')
          localStorage.setItem('user_type', 'seller')
          localStorage.setItem('active_role', 'seller')
          localStorage.setItem('seller_id', String(s.id ?? ''))
          localStorage.setItem('seller_name', s.name || '')
          localStorage.setItem('seller_email', s.email || '')
          localStorage.setItem('seller_username', s.username || '')
          localStorage.setItem('seller_type', s.seller_type || 'influencer')
          localStorage.setItem('is_distributor', '1')
          toast.success('유통회원으로 로그인되었어요')
          window.location.assign('/wholesale')
        }
        // status==='pending' 또는 신규(400)면 그대로 신청 배너 유지 — 추가 toast 없음(조용).
      })
      .catch(() => { /* 신규 유저(사업자정보 필요) 등 — 배너로 유도, 조용히 무시 */ })
      .finally(() => { if (!cancelled) setBecoming(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSession])
  const goLogin = () => navigate('/wholesale/login')
  const logout = () => {
    // 🏭 2026-06-08: 도매몰 로그아웃 — 유통사(seller) + 제조사(supplier) 세션 모두 정리(유저/어드민 세션 보존).
    //   둘 중 어느 역할로 들어왔든 한 버튼으로 로그아웃. full reload 로 토큰/RQ 캐시 깨끗이.
    clearAuthData('seller')
    try { localStorage.removeItem('is_distributor') } catch { /* noop */ }
    try { clearSupplierSession() } catch { /* noop */ }
    toast.success('로그아웃되었어요')
    if (typeof window !== 'undefined') window.location.assign('/wholesale')
  }
  // 🏭 NOTI-1 (2026-06-08): 품절 상품 재입고 알림 구독 — 내 구독 product_id 집합 + 토글 핸들러.
  const [restockSubs, setRestockSubs] = useState<Set<number>>(new Set())
  const [restockBusyId, setRestockBusyId] = useState<number | null>(null)
  useEffect(() => {
    if (!token) { setRestockSubs(new Set()); return }
    let cancelled = false
    api.get('/api/wholesale/restock/subscriptions', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (cancelled) return
        const subs = (r.data?.subscriptions ?? []) as { product_id: number }[]
        setRestockSubs(new Set(subs.map((s) => Number(s.product_id))))
      })
      .catch(() => { /* 조용히 무시 */ })
    return () => { cancelled = true }
  }, [token])

  async function toggleRestock(p: CatalogItem) {
    if (restockBusyId != null) return
    if (!loggedIn) { toast.info('로그인하면 재입고 알림을 받을 수 있어요'); goLogin(); return }
    const subbed = restockSubs.has(p.id)
    setRestockBusyId(p.id)
    try {
      if (subbed) {
        await api.delete(`/api/wholesale/restock/subscribe/${p.id}`, { headers: { Authorization: `Bearer ${token}` } })
        setRestockSubs((prev) => { const n = new Set(prev); n.delete(p.id); return n })
        toast.success('재입고 알림을 해제했어요')
      } else {
        const r = await api.post('/api/wholesale/restock/subscribe', { product_id: p.id }, { headers: { Authorization: `Bearer ${token}` } })
        if (r.data?.success) { setRestockSubs((prev) => new Set(prev).add(p.id)); toast.success('재입고되면 알림으로 알려드릴게요') }
        else toast.error(r.data?.error || '재입고 알림 신청에 실패했어요')
      }
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '재입고 알림 처리 중 오류가 발생했어요')
    } finally { setRestockBusyId(null) }
  }

  // 🏭 perf: 상세 prefetch — useWholesaleProduct 와 동일 키/fetch(GET /catalog/:id). 카드 hover/focus/touch/viewport 진입 시 1회.
  //   이미 캐시(fresh)면 RQ 가 재요청 안 함 → 익명 트래픽 최소. detail 라우트 청크는 App.tsx idle prefetch 와 별개로 캐시 워밍.
  const qc = useQueryClient()
  const prefetchProduct = useCallback((id: number) => {
    if (!id) return
    qc.prefetchQuery({
      queryKey: queryKeys.wholesale('product', String(id)),
      queryFn: () => {
        const tk = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
        return api
          .get(`/api/wholesale/catalog/${id}`, { headers: tk ? { Authorization: `Bearer ${tk}` } : {} })
          .then((r) => (r.data?.success ? { item: r.data.item, grade: r.data.grade } : { item: null, grade: '' }))
          .catch(() => ({ item: null, grade: '' }))
      },
      staleTime: 60 * 1000,
    })
  }, [qc])

  const openDetail = (p: CatalogItem) => navigate(`/wholesale/product/${p.id}`)
  const addToCart = (p: CatalogItem) => {
    if (!loggedIn || p.distributor_price == null) {
      toast.info('로그인하면 등급 공급가로 담을 수 있어요')
      goLogin()
      return
    }
    const moq = Math.max(1, p.moq || 1)
    // 🏭 BIZ-8: 초기 담기 수량 = MOQ 를 만족하는 최소 order_multiple 배수(서버 검증과 일치).
    const om = Math.max(1, p.order_multiple || 1)
    const initQty = om > 1 ? Math.ceil(moq / om) * om : moq
    cart.add({ id: p.id, qty: initQty, name: p.name, image_url: p.image_url, price: p.distributor_price, moq })
    toast.success(initQty > 1 ? `장바구니에 ${comma(initQty)}개 담았어요` : '장바구니에 담았어요')
  }
  const reorder = (r: ReorderItem) => {
    const moq = Math.max(1, (r as ReorderItem & { moq?: number }).moq || 1)
    cart.add({ id: r.id, qty: Math.max(moq, r.last_qty), name: r.name, image_url: r.image_url, price: r.distributor_price, moq })
    toast.success(`장바구니에 ${comma(Math.max(moq, r.last_qty))}개 담았어요`)
  }

  const monthSpend = stmtQ.data?.summary?.total_paid ?? 0
  const orderCount = stmtQ.data?.summary?.count ?? 0
  const grade = me?.grade || home?.grade || 'C'

  return (
    // 🏬 --ud-brand: 몰 브랜드 색(기본 몰 → #FF0033 → 현 디자인과 동일). 주요 브랜드 요소가 var() 로 참조.
    <div className="min-h-screen" style={{ background: '#fff', color: WT.ink, ['--ud-brand' as string]: mallBrand }}>
      <SEO
        domain="wholesale"
        title={collectionMode && mode ? `${COLLECTION_TITLE[mode]} — 유통스타트 도매몰` : '유통스타트 도매몰 — 제조사 직거래 도매가 사입 B2B 도매사이트'}
        description="검증된 제조사 상품을 도매가로 사입하는 B2B 도매사이트. 식품·생활·뷰티 등 카테고리별 도매 상품, 무재고 위탁판매·대량 사입·OEM/ODM까지 유통스타트에서."
        url={collectionMode && mode ? `/wholesale/${mode}` : '/wholesale'}
        jsonLd={catalogJsonLd}
      />

      {/* 🏭 Wave 2 헤더 — Sellpie형: 유틸바 + (로고·중앙검색·3아이콘) + 카테고리 네비. */}
      <CatalogHeader
        loggedIn={loggedIn}
        supplierToken={supplierToken}
        token={token}
        cartCount={cart.count}
        mallName={mallName}
        mallLogo={mallLogo}
        depositBalance={Number(depositQ.data?.balance) || 0}
        grade={grade}
        search={search}
        setSearch={setSearch}
        setCommittedSearch={setCommittedSearch}
        megaOpen={megaOpen}
        setMegaOpen={setMegaOpen}
        brandView={brandView}
        setBrandView={setBrandView}
        premiumView={premiumView}
        setPremiumView={setPremiumView}
        setSelectedBrand={setSelectedBrand}
        sort={sort}
        setSort={setSort}
        cat={cat}
        setCat={setCat}
        cats={cats}
        catCounts={catCounts}
        setProposalOpen={setProposalOpen}
        goLogin={goLogin}
        logout={logout}
      />

      <main className="ur-content-wide px-5 lg:px-8">
        {/* 🏬 컬렉션 모드: 전용 페이지 타이틀 (홈은 배너/히어로/레일 노출). */}
        {collectionMode ? (
          <div className="pt-5 pb-1 flex items-center gap-2.5">
            <button onClick={() => navigate('/wholesale')} aria-label="도매몰 홈" className="inline-flex items-center gap-1 rounded-full px-3 h-9 text-[13px] font-bold" style={{ background: WT.fill, color: WT.ink2 }}>
              <ChevronRight className="w-4 h-4 rotate-180" /> 홈
            </button>
            <h1 className="text-[19px] lg:text-[22px] font-extrabold" style={{ color: WT.ink }}>{mode ? COLLECTION_TITLE[mode] : ''}</h1>
          </div>
        ) : (<>
          {/* 🏭 Wave 2: 메인 배너 캐러셀 (어드민 관리, 배너 없으면 자동 숨김) */}
          <div className="pt-4">
            <WholesaleBannerCarousel />
          </div>

          {/* 히어로 + 대시보드 + OEM */}
          <HeroSection
            loggedIn={loggedIn}
            userSession={userSession}
            grade={grade}
            me={me}
            monthSpend={monthSpend}
            orderCount={orderCount}
            depositBalance={Number(depositQ.data?.balance) || 0}
            setGradeOpen={setGradeOpen}
            featured={featured}
          />

          {/* 🏭 2026-06-15 시안: 신뢰 신호 바 (사업자인증/에스크로/세금계산서/무재고) */}
          <div className="pt-1 pb-1">
            <TrustBar />
          </div>

          {/* 빠른 재주문 / 전용 공급 / 베스트 / 신규 입고 레일 */}
          <HomeRails
            recent={recent}
            home={home}
            reorder={reorder}
            openDetail={openDetail}
            addToCart={addToCart}
            prefetchProduct={prefetchProduct}
            loggedIn={loggedIn}
          />
        </>)}

        {/* 🏭 Wave 2: 프리미엄 전용관 헤더 + 🏷️ 브랜드 전시관 그리드 */}
        <ShowcaseBanners
          premiumView={premiumView}
          setPremiumView={setPremiumView}
          brandView={brandView}
          setBrandView={setBrandView}
          selectedBrand={selectedBrand}
          setSelectedBrand={setSelectedBrand}
          brands={(brandsQ.data ?? []) as BrandEntry[]}
          brandsLoading={brandsQ.isLoading}
        />

        {/* BEST PRODUCT / 전체 상품 — 브랜드 그리드 모드(브랜드 미선택)에서는 숨김 */}
        {!(brandView && !selectedBrand) && (
        <section className="pt-6 pb-10">
          {/* 🏷️ 특정 브랜드 선택 시 브랜드 헤더(뒤로 = 브랜드 그리드) */}
          {selectedBrand && (
            <div className="mb-4 flex items-center gap-2.5">
              <button onClick={() => setSelectedBrand('')} aria-label={t('wholesale.brand.back', { defaultValue: '브랜드 목록' })}
                className="inline-flex items-center gap-1 rounded-full px-3 h-9 text-[13px] font-bold" style={{ background: WT.fill, color: WT.ink2 }}>
                <ChevronRight className="w-4 h-4 rotate-180" /> {t('wholesale.brand.back', { defaultValue: '브랜드 목록' })}
              </button>
              <span className="text-[16px] font-extrabold" style={{ color: WT.ink }}>{selectedBrand}</span>
            </div>
          )}
          <SectionHead
            title={selectedBrand ? t('wholesale.brand.heading', { defaultValue: '브랜드 상품' }) : (premiumView ? t('wholesale.premium.heading', { defaultValue: '프리미엄 상품' }) : (cat === 'all' ? t('wholesale.allProducts', { defaultValue: '전체 상품' }) : (cats.find(c => c.id === cat)?.label || '상품')))}
            sub={comma(items.length) + '개'}
          />
          <div className="lg:hidden mb-3"><CatChips cat={cat} setCat={setCat} cats={cats} /></div>
          {/* ── BIZ-4 정렬/필터 컨트롤바 (서버사이드 /catalog 파라미터에 위임) ── */}
          <FilterControls
            sort={sort}
            setSort={setSort}
            loggedIn={loggedIn}
            inStock={inStock}
            setInStock={setInStock}
            priceBand={priceBand}
            setPriceBand={setPriceBand}
            cat={cat}
            setCat={setCat}
            committedSearch={committedSearch}
            setSearch={setSearch}
            setCommittedSearch={setCommittedSearch}
          />
          {loggedIn && (
            <div className="mb-4">
              <button
                onClick={() => setBulkOpen(v => !v)}
                aria-expanded={bulkOpen}
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 h-9 text-[13px] font-bold transition-colors"
                style={bulkOpen ? { background: WT.ink, color: '#fff' } : { background: WT.fill, color: WT.ink2 }}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                {t('wholesale.bulk.toggle', { defaultValue: '대량주문 (엑셀)' })}
                <ChevronRight className={'w-3.5 h-3.5 transition-transform ' + (bulkOpen ? 'rotate-90' : '')} />
              </button>
              {bulkOpen && <div className="mt-3"><BulkOrderPanel token={token} /></div>}
            </div>
          )}

          <div className="lg:flex lg:gap-7">
            <Sidebar cat={cat} setCat={setCat} counts={catCounts} cats={cats} />
            <div className="flex-1">
              {loading ? (
                // 🏭 perf: 풀스크린 스피너 대신 카드 스켈레톤 그리드(빈 화면/긴 스피너 X — 체감 로딩 ↓).
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-7">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex flex-col rounded-2xl overflow-hidden" style={{ background: WT.fill2 }}>
                      <div className="w-full aspect-square animate-pulse" style={{ background: WT.fill }} />
                      <div className="px-2.5 pt-2 pb-2.5 space-y-1.5">
                        <div className="h-3.5 w-5/6 rounded animate-pulse" style={{ background: WT.fill }} />
                        <div className="h-3 w-1/3 rounded animate-pulse" style={{ background: WT.fill }} />
                        <div className="h-4 w-1/2 rounded animate-pulse mt-1" style={{ background: WT.fill }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : items.length === 0 ? (
                <p className="text-center py-20 text-[14px]" style={{ color: WT.ink4 }}>해당 조건의 도매 상품이 없어요.</p>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-7">
                  {items.map((p, idx) => <ProductCard key={p.id} p={p} onOpen={openDetail} onAdd={addToCart} subbed={restockSubs.has(p.id)} onRestock={toggleRestock} restockBusy={restockBusyId === p.id} onPrefetch={prefetchProduct} wished={wishedIds.has(p.id)} onWish={toggleWish} aboveFold={idx < 4} priceLoading={catalogQ.isPlaceholderData} />)}
                </div>
              )}
            </div>
          </div>
        </section>
        )}
        {/* 🏭 2026-06-15 시안: 제조사 입점 CTA 배너 (비로그인 마케팅 면) */}
        {!collectionMode && !loggedIn && (
          <div className="pt-2 pb-6">
            <SupplierCTA onApply={() => navigate('/supplier/register')} />
          </div>
        )}

        {/* 🏭 2026-06-13 (사용자 요청): 서비스 정체성 히어로 — 회사정보(푸터) 바로 위에 배치(홈만). */}
        {/* 🧹 2026-06-15 (사용자 요청 — 홈 정리): 마케팅 카피는 비로그인 방문자 전환용에만. 로그인 사입자에겐 숨김(반복 노출 제거). */}
        {!collectionMode && !loggedIn && (
          <div className="pt-2 pb-8">
            <BrandHero loggedIn={loggedIn} />
          </div>
        )}
      </main>

      <WholesaleFooter />

      {/* 🏭 Wave 4b: 로그인 유통사에게만 채팅 floating 버튼 — lazy chunk(비로그인은 청크 fetch 안 함). */}
      {loggedIn && (
        <Suspense fallback={null}>
          <WholesaleChatButton />
        </Suspense>
      )}

      {gradeOpen && <GradeSheet current={grade} onClose={() => setGradeOpen(false)} />}
      {proposalOpen && (
        <Suspense fallback={null}>
          <WholesaleProposalModal onClose={() => setProposalOpen(false)} />
        </Suspense>
      )}
    </div>
  )
}
