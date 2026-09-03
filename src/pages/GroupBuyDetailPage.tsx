import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import DetailGallery from './group-buy/DetailGallery'
import DetailTitleHeader from './group-buy/DetailTitleHeader'
import DetailBreadcrumb, { voucherCrumbs } from '@/components/deal/DetailBreadcrumb'
import { readCachedLoc, distanceKm, daysLeft } from './group-buy/detail-derived'
import DetailFloatingHeader from '@/components/deal/DetailFloatingHeader'
import { derivePricing } from './group-buy/pricing'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MapPin, Phone, Clock, Sparkles, CheckCircle2, AlertCircle, Instagram, Youtube, Facebook, Music2, RefreshCcw } from 'lucide-react'
import { resolveTossFlow } from '@/lib/toss-key-type'
import { TOPUP_DISABLED } from '@/shared/feature-flags'
import { resolveProductFlow } from '@/shared/product-flow'
import api from '@/lib/api'
import { storeAffiliateRef, fireAffiliateTrack } from '@/utils/affiliate-track'
import { GB_ENGINE_ENABLED } from '@/shared/feature-flags'
import SEO from '@/components/SEO'
import BrandLoader from '@/components/brand/BrandLoader'
import KakaoShareButton from '@/components/KakaoShareButton'
import { dealCategoryMeta } from '@/shared/deal-category-icon'
// 🛡️ 2026-06-12 (감사 1단계 — 핀 표면): 공유 버튼 옆 핀 버튼 (additive — 잠금 항목 무변경).
import PinButton from '@/components/curator/PinButton'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { safeDate, safeTime } from '@/utils/safe-date'
import { publicSellerHandle } from '@/shared/seller-handle'
import { cfImage } from '@/utils/cf-image'
import { reportFunnel } from '@/lib/web-vitals-report'
import { recordRecentlyViewed } from '@/components/group-buy/RecentlyViewedStrip'
import { useInvalidateMyVouchers } from '@/hooks/queries'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/hooks/queries/queryKeys'
import { readCache } from '@/hooks/queries/localCache'
import { pickSeedDetail } from './group-buy/seed-detail'
import FcfsApplyBlock from '@/features/group-buy/FcfsApplyBlock'
// 🖥️ 2026-07-19 (대표 승인 — 그루폰식 상세): PC 우측 sticky 구매 박스 + 섹션 추출(파일크기 래칫).
import { isDemoSlug } from '@/shared/constants/demo-products'
import DealPurchaseBox from './group-buy/DealPurchaseBox'
import DealMenuList, { type DealMenuItem } from './group-buy/DealMenuList'
import OtherDealsRow from './group-buy/OtherDealsRow'
import ShareRewardBanner from './group-buy/ShareRewardBanner'
import DeferUntilVisible from './group-buy/DeferUntilVisible'
import DealPayButton, { useCanPayWithDeal } from './group-buy/DealPayButton'
import { handleDealJoinError } from './group-buy/deal-join-error'
import { useProductViewBeacon } from '@/hooks/useProductViewBeacon'

// 🛡️ 2026-05-27 (loading P1): below-fold 컴포넌트 lazy — 초기 chunk 30-50KB ↓.
//   - Confetti: 100% 달성 시만 표시 (대부분 사용자 안 봄)
//   - RestaurantMiniMap: 매장 정보 아래 (fold 직후, Kakao Maps SDK 포함)
// 🎨 2026-06-16 리디자인: Confetti(공구 연출) 제거 — 정직한 즉시구매. RestaurantMiniMap 만 lazy 유지.
const RestaurantMiniMap = lazy(() => import('@/components/RestaurantMiniMap'))
// 🎨 2026-06-17 (공구상세 후속 — 디자이너 제안 "후기·평점이 가장 큰 신뢰 레버"): 기존 ProductReviews 재사용(lazy, below-fold).
const ProductReviews = lazy(() => import('./product-detail/ProductReviews'))
// 🎟️ 2026-07-06 (§2-B B1): 인플루언서 공구 제안 모달 (게이트 OFF, lazy)
const GbProposeModal = lazy(() => import('./group-buy/GbProposeModal'))

// 🛡️ 2026-05-15: 전용 공구 상세 페이지 (`/group-buy/:id`)
//   - 카운트다운 ring + 티어 진행 바 + 참여자 아바타 + 마감 timer + share CTA
//   - 일반 ProductDetailPage 와 분리: 공구 특화 UX (참여 후 voucher 발급 강조)

interface GroupBuyDetail {
  id: number
  name: string
  description?: string
  image_url?: string
  price: number
  original_price?: number
  category: string
  restaurant_name?: string
  restaurant_address?: string
  restaurant_phone?: string
  restaurant_lat?: number
  restaurant_lng?: number
  voucher_expiry?: string
  voucher_terms?: string
  group_buy_target: number
  group_buy_current: number
  group_buy_deadline?: string
  group_buy_status: 'active' | 'achieved' | 'expired' | 'cancelled' | string
  // 🛡️ 2026-05-27: 서버가 array 로 미리 parse 해서 보냄. 구 응답 (stale edge cache) 은 string — 둘 다 handle.
  group_buy_tiers?: string | Array<{ min: number; discount_pct: number }> | null
  current_discount_pct: number
  /** 🎯 1인당 최대 구매 수량 (셀러 설정, 없으면 무제한). */
  max_per_person?: number
  min_review_level?: number
  /** 🏷️ 오픈 예정형 데모 — 구매 대신 사전 응모 CTA */
  prelaunch?: boolean
  /** 🎯 카카오 장소 페이지 URL (등록 시 캡처, 있으면 매장 페이지 직접 연결). */
  kakao_place_url?: string
  /** ⭐ 2026-08-19 (상세 1안): 제목 헤더의 별점 — 서버가 리스트/상세 공통으로 준다. */
  avg_rating?: number; review_count?: number
  seller_id?: number
  seller_name?: string
  seller_username?: string
  // 🔗 2026-06-21 (대표 제안): 셀러의 유저 유어샵 handle. 있으면 /u/{handle}(통합 유어샵)로, 없으면 /profile 폴백.
  seller_handle?: string
  seller_avatar?: string
  // 🛡️ 2026-05-27: 셀러 SNS 버튼 — 채팅/매너온도 X, SNS 만.
  seller_instagram?: string | null
  seller_youtube?: string | null
  seller_tiktok?: string | null
  seller_facebook?: string | null
}

/**
 * 🖼️ 사진이 없을 때의 히어로 폴백 (2026-08-31 — 이모지 → 선 아이콘)
 *
 * 이전엔 `🍽️ 💇 🏨 …` 이모지를 **검정 배경 위에 크게** 그렸다. 세 가지가 문제였다 —
 *   ⓐ 이모지는 기기마다 다른 그림으로 렌더돼 **우리가 그 화면을 통제하지 못한다**
 *   ⓑ 화면 최상단을 차지하는데 "아직 안 만든 자리"로 읽힌다(대표: "AI가 만든 티")
 *   ⓒ 같은 상황에서 **홈 카드는 선 아이콘**을 쓰고 있었다 — 한 상품이 화면마다 다른 그림이었다.
 * ⇒ 홈 카드와 **같은 표**(`deal-category-icon` SSOT)를 읽는다. 두 벌로 두면 반드시 갈린다.
 */
function CategoryFallbackIcon({ cat }: { cat: string }) {
  const { Icon } = dealCategoryMeta(cat)
  return <Icon className="w-12 h-12 text-gray-400 opacity-60" aria-hidden="true" />
}

// 🎨 2026-06-16 리디자인: CountdownRing(공구 마감 연출) 제거 — 정직한 즉시 할인 구매로 전환 (사용자 design 결정).

export default function GroupBuyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const invalidateVouchers = useInvalidateMyVouchers()
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  // 🛡️ 2026-05-21 Phase D: 셀러 트래킹 (?seller=ID) sessionStorage 저장.
  useEffect(() => {
    import('@/lib/seller-tracking').then(m => m.captureTrackingFromUrl())
  }, [])
  // 🛡️ 2026-05-15: 인플루언서 link 진입 (?ref=) — 단독 랜딩 모드
  const refUserId = searchParams.get('ref')
  // 🧭 2026-06-10 (유어샵 적립): 핀 리다이렉트 ?aff=(유저 큐레이터) — 인플 ?ref= 와 별도 레일
  // 🧭 2026-07-11 (감사 §R2): ?ref=(인플 share_url) 도 커미션 레일에 저장 — 기존엔 랜딩 배너
  //   플래그(refUserId)로만 쓰고 미저장 → share_url 진입 구매가 무적립. aff 우선(명시적 공구 파라미터).
  useEffect(() => { storeAffiliateRef(searchParams.get('aff') || searchParams.get('ref')) }, [searchParams])

  // 🛡️ 2026-06-11 (플로우 감사 갭#5): 토스 실패 복귀(?fail=1) 무안내였음 — failUrl 만 만들고
  //   읽는 코드가 없어 유저가 결제 성패를 모름. 1회 toast + URL 정리(새로고침 중복 방지).
  useEffect(() => {
    if (searchParams.get('fail') !== '1') return
    const rawMsg = searchParams.get('message') || ''
    const code = searchParams.get('code') || ''
    const safeMsg = rawMsg.slice(0, 120)
    toast.error(safeMsg
      ? `결제가 완료되지 않았어요 — ${safeMsg}${code ? ` (${code})` : ''}`
      : '결제가 완료되지 않았어요. 다시 시도해주세요.')
    try {
      const u = new URL(window.location.href)
      ;['fail', 'code', 'message', 'orderId'].forEach(k => u.searchParams.delete(k))
      window.history.replaceState({}, '', u.pathname + (u.search || ''))
    } catch { /* */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const isInfluencerLanding = !!refUserId
  const qc = useQueryClient()
  // 🧭 2026-06-22 (전수조사): 첫 paint 시드 — 홈 카드 prefetch(RQ) / SSR inject / localCache 를 즉시 소비.
  //   시드가 있으면 skeleton 을 건너뛰고 바로 content (axios fetch 는 freshness 보정으로 background 수행).
  //   없으면 seedDetail=null → 기존 skeleton + fetch fallback (안전).
  const seedDetail = useMemo<GroupBuyDetail | null>(() => pickSeedDetail<GroupBuyDetail>(Number(id), {
    rqCached: qc.getQueryData(queryKeys.groupBuyProduct(Number(id))),
    ssrText: typeof document !== 'undefined' ? document.getElementById('__SSR_INITIAL_DETAIL__')?.textContent : null,
    localCached: readCache<GroupBuyDetail | null>(`gb:${Number(id)}`, null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [id, qc])
  const [detail, setDetail] = useState<GroupBuyDetail | null>(seedDetail)
  const [loading, setLoading] = useState<boolean>(seedDetail == null)
  const [joining, setJoining] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [showPropose, setShowPropose] = useState(false)
  // 🎨 2026-06-16 리디자인: 스와이프 갤러리 활성 인덱스 + 이 셀러의 다른 공구
  const [otherDeals, setOtherDeals] = useState<Array<{ id: number; name: string; price: number; original_price?: number | null; image_url?: string | null; discount_pct?: number | null }>>([])
  // 🏭 2026-06-07 (당근 스타일 hero 재설계): 스크롤-aware 헤더 — hero 를 지나치면 solid 로 전환.
  //   🔘 2026-08-31: 그 스크롤 상태를 **상단바 컴포넌트 안으로 옮겼다**. 페이지가 각자 들고 있으면
  //      새 상세를 만들 때 그 배선을 빠뜨리기 쉽고, 실제로 숙소 상세가 그렇게 갈렸다.
  //      여기선 히어로 높이를 재라고 ref 만 넘긴다.
  const heroRef = useRef<HTMLDivElement | null>(null)

  const productId = Number(id)
  // 👁️ 홈 인기순의 클릭 신호 — 세션당 1회(훅이 가드).
  useProductViewBeacon(productId)
  const isLoggedIn = !!localStorage.getItem('user_id') || !!localStorage.getItem('uid')
  // 🛡️ 2026-05-15: 본인 product 인 경우 "공구 관리" CTA 표시 (셀러 대시보드 진입점)
  const sellerId = localStorage.getItem('seller_id')
  const isOwnProduct = !!sellerId && detail?.seller_id != null && Number(detail.seller_id) === Number(sellerId)
  // 🛡️ 2026-05-15: 본인 추천 링크 (친구 초대 시 양쪽 1% 보너스 딜)
  const myUserId = localStorage.getItem('user_id') || localStorage.getItem('uid') || ''
  const shareLink = myUserId
    ? `/group-buy/${productId}?ref=${myUserId}`
    : `/group-buy/${productId}`

  useEffect(() => {
    if (!Number.isFinite(productId) || productId <= 0) {
      toast.error('잘못된 ID')
      navigate('/map') // 🧹 2026-07-20: /group-buy 는 홈 리다이렉트(죽은 경로) → 동네딜 지도로
      return
    }
    let cancelled = false

    // 🧭 2026-06-22 (전수조사): 첫 paint SSR/prefetch 시드는 위 seedDetail(useState 초기값)이 담당.
    //   여기서는 freshness 보정 fetch 만 — 시드가 있으면 skeleton 없이 background 갱신, 없으면 로더 후 채움.
    // 🎯 2026-07-01 (대표 "로딩 2번 + 느림" — 근본): raw axios → RQ fetchQuery 로 **in-flight prefetch dedupe**.
    //   홈 카드 touchstart prefetch(~0.6s) 진행 중에 탭하면, 기존엔 페이지가 같은 요청을 처음부터 다시
    //   시작(중복 네트워크 + 로더 노출 2배) → fetchQuery 는 같은 키의 진행 중 요청을 그대로 이어받고,
    //   방금 끝난 prefetch(≤60s fresh)는 네트워크 0회로 즉시 반환. 캐시 write-back 도 RQ 가 자동.
    const detailPromise = qc.fetchQuery({
      queryKey: queryKeys.groupBuyProduct(productId),
      queryFn: async () => {
        const r = await api.get(`/api/group-buy/products/${productId}`)
        if (!r.data?.success) throw new Error(r.data?.error || '상품을 찾을 수 없습니다')
        // 🛡️ 2026-05-23 revert 유지: 받은 상품 그대로 렌더(카테고리 redirect 금지 — 과거 사고).
        return r.data.data as GroupBuyDetail
      },
      staleTime: 60_000,
    })
    // 🗑️ 2026-07-07 (로딩 낭비 감사): participants fetch 제거 — 리디자인 후 어디서도 렌더 안 되던
    //   죽은 요청(상세 진입마다 무의미한 왕복 1개). 상세 payload 만 로드.
    detailPromise.then((detailData) => {
      if (cancelled) return
      if (detailData) {
        setDetail(detailData)
        reportFunnel('view', productId)  // funnel: page view
        // 🛡️ 2026-05-15: 최근 본 공구 기록 (localStorage 12개 제한)
        try {
          recordRecentlyViewed({
            id: detailData.id,
            name: detailData.name,
            image_url: detailData.image_url,
            restaurant_name: detailData.restaurant_name,
            price: detailData.price,
          })
        } catch { /* silent */ }
      }
    }).catch((e) => toast.error((e as Error)?.message || '네트워크 오류'))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [productId, navigate, qc])

  // 🎨 2026-06-16 리디자인: 이 셀러의 다른 공구 — active 목록에서 같은 seller 필터(현재 상품 제외).
  // 🗑️ 2026-07-07 [UNLOCK_LOADING] (로딩 낭비 감사): 이 섹션은 폴드 아래(페이지 최하단 가로 스크롤)라
  //   마운트 즉시 전체 active 목록을 받던 것을 IntersectionObserver 로 게이팅 — 사용자가 그 근처까지
  //   스크롤할 때만 1회 fetch. HomeProductsRail 과 동일 패턴(600px rootMargin). SSR seed·폴링·below-fold
  //   lazy 전부 불변(additive — 관찰 게이트 1개 추가). 대다수(빠른 이탈/구매) 뷰에서 요청 자체가 사라짐.
  const [otherDealsInView, setOtherDealsInView] = useState(false)
  const otherDealsSentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = otherDealsSentinelRef.current
    if (!el || otherDealsInView) return
    if (typeof IntersectionObserver === 'undefined') { setOtherDealsInView(true); return }
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) { setOtherDealsInView(true); io.disconnect() }
    }, { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [otherDealsInView, detail?.seller_id])

  useEffect(() => {
    const sid = detail?.seller_id
    if (!sid || !otherDealsInView) return
    let cancelled = false
    api.get('/api/group-buy/products?status=active')
      .then(r => {
        if (cancelled) return
        const list = (r.data?.data || r.data || []) as Array<{ id: number; name: string; price: number; original_price?: number | null; image_url?: string | null; seller_id?: number; discount_rate?: number | null; current_price?: number | null }>
        const mine = (Array.isArray(list) ? list : [])
          .filter(p => Number(p.seller_id) === Number(sid) && Number(p.id) !== productId)
          .slice(0, 8)
          .map(p => ({ id: p.id, name: p.name, price: Number(p.current_price ?? p.price), original_price: p.original_price, image_url: p.image_url, discount_pct: p.discount_rate ?? null }))
        setOtherDeals(mine)
      })
      .catch(() => { /* silent */ })
    return () => { cancelled = true }
  }, [detail?.seller_id, productId, otherDealsInView])

  // 🛡️ 2026-05-15: 실시간 polling — 5초±2초 jitter. 페이지 hidden 시 일시정지 (배터리 보호 + D1 thundering herd 방어).
  //   active 공구만 polling. participant 카운터 + 신규 참여자 등장 → toast.
  useEffect(() => {
    if (!detail || (detail.group_buy_status !== 'active' && detail.group_buy_status !== 'achieved')) return
    let timer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    // 🎨 2026-06-16 리디자인(정직한 즉시구매): 참여수 toast·confetti 연출 제거 — 상태/가격 freshness 만 silent 갱신.
    const poll = async () => {
      if (document.hidden) return
      try {
        const d = await api.get(`/api/group-buy/products/${productId}`)
        if (d.data?.success) {
          setDetail(d.data.data)
          qc.setQueryData(queryKeys.groupBuyProduct(productId), d.data.data)
        }
      } catch { /* silent */ }
    }
    // 🛡️ 2026-05-15 (TD-G07): jitter — 동시 사용자 많을 때 D1 thundering herd 방어
    //   2026-05-27: 마감까지 거리 기반 adaptive — 멀면 길게, 가까우면 짧게 (서버 부하 ↓, UX 유지).
    const jitter = () => {
      const deadlineMs = detail.group_buy_deadline ? safeTime(detail.group_buy_deadline) - Date.now() : Infinity
      const base = deadlineMs > 86400000 ? 20000 : deadlineMs > 3600000 ? 10000 : 5000
      return base + Math.floor((Math.random() - 0.5) * base * 0.4)
    }
    const scheduleNext = () => {
      if (cancelled) return
      timer = setTimeout(async () => {
        await poll()
        scheduleNext()
      }, jitter())
    }
    scheduleNext()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [detail?.group_buy_status, productId, qc])

  // 🛡️ 2026-05-30: 즉시판매 단일가 모델 — 단계별 tier 사다리 UI 제거 (design/groupbuy-instant-sale.md).
  //   공구가는 인원 무관 고정(최대 할인 적용)이라 group_buy_tiers 렌더링 불필요.

  // 🧭 2026-06-17: 즉시판매 단일가 모델 — 진행률 바/티어 사다리 제거 후 미사용이던 progress 변수 정리.
  // 💰 가격 파생값은 SSOT(`group-buy/pricing.ts`)에서 — 카드와 상세가 다른 할인율을 보이던 것을 막는다.
  const { unitPrice, refPrice, unitSaving, displayDiscountPct } = derivePricing(detail)
  // 🧮 파생값은 순수 모듈에서 — 셋 다 "데이터 없으면 그 자리를 비운다"는 같은 규칙이다.
  const userLoc = readCachedLoc()
  const distKm = distanceKm(userLoc, detail?.restaurant_lat, detail?.restaurant_lng)
  const dDay = daysLeft(detail?.group_buy_deadline, (x) => safeDate(x))
  const total = unitPrice * quantity
  const totalSaving = unitSaving * quantity
  // 🎯 2026-07-01 (대표 "1인당 결제 최대 한도"): 셀러 설정값으로 스텝퍼 상한. 미설정=기존 10.
  const maxQty = detail?.max_per_person && detail.max_per_person > 0 ? detail.max_per_person : 10
  const isJoinable = detail?.group_buy_status === 'active' || detail?.group_buy_status === 'achieved'
  // 🏷️ 2026-07-05 (대표 "옵션으로 선택"): 오픈 예정형은 구매 불가 — 사전 응모(FcfsApplyBlock)로 유도.
  const isPrelaunch = !!detail?.prelaunch
  // 🎭 2026-08-08 데모=추첨이라 '구매하기'가 거짓 — 판정은 SSOT(isDemoSlug) 하나만. 사유: 동명 테스트 파일.
  const isDemoDeal = isDemoSlug((detail as { slug?: string | null } | null)?.slug ?? null)
  const buyable = isJoinable && !isPrelaunch

  // 🎨 2026-06-16 리디자인: 스와이프 갤러리 이미지 — image_url + images/detail_images/image_urls(JSON) 병합·중복제거.
  //   🖼️ 2026-07-20: products.images(PRODUCT_DETAIL_FIELDS 기포함 — 데모 시드 3~5장) 병합 추가.
  const galleryImages: string[] = (() => {
    if (!detail) return []
    const out: string[] = []
    if (detail.image_url) out.push(detail.image_url)
    const extra = detail as { detail_images?: string | null; image_urls?: string | null; images?: string | null }
    for (const raw of [extra.images, extra.image_urls, extra.detail_images]) {
      if (!raw) continue
      try { const arr = JSON.parse(raw); if (Array.isArray(arr)) for (const u of arr) if (typeof u === 'string' && u) out.push(u) } catch { /* not json */ }
    }
    return Array.from(new Set(out)).slice(0, 8)
  })()

  // 🎨 2026-06-16 리디자인: 할인코드(promo) 입력 UI 제거 — checkPromo/clearPromo 삭제.

  // 💰 이용권 딜 결제(2026-08-31) — 노출 조건·버튼·이중 게이트 설명은 `./group-buy/DealPayButton`.
  const { canPayWithDeal, dealBalance } = useCanPayWithDeal({ isLoggedIn, detail, total })

  async function handleJoin(payWithDeal = false) {
    if (!detail) return
    if (!isLoggedIn) {
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      navigate('/login')
      return
    }

    // 🛡️ 2026-05-23 / 정정 2026-08-03: 결제수단은 **카테고리가 아니라 `deal_only`** 로 갈린다.
    //   - `deal_only=1` (교환권 — 기프티콘·KT)            → 딜 결제
    //   - `group_buy_status='active'` (**이용권 포함**)   → 토스 카드
    //   - 그 외                                          → 토스 카드
    //   ⚠️ 옛 주석은 교환권을 voucher 카테고리와 같은 말로 썼고, 그게 2026-08-03 에
    //     **"식당 이용권은 카드로 못 산다"는 오판**을 낳았다. `meal_voucher` 는 명칭 SSOT 상
    //     **이용권**이고 카드로 판다(예: 김밥천국 할인권 = 공구, Toss). 카테고리로 판정하지 말 것.
    //   정책 (CLAUDE.md): "교환권을 딜로 거래하는 것 외에는 토스페이먼츠 결제"
    // 🛡️ 2026-05-23 v3: getProductFlow SSOT (src/shared/product-flow.ts) —
    //   voucher_deal vs group_buy_toss 단일 helper. legacy 카테고리 graceful + 미래 분류 1곳 수정.
    const { flow } = resolveProductFlow(detail)

    // 💰 2026-08-31: 이용권도 딜로 살 수 있다(대표 방향 — 상품 마진 대신 현금 출구에 마진).
    //   `deal_only=1` 교환권은 원래 딜 전용이고, 이용권은 **사용자가 딜을 고른 경우에만** 이 경로.
    //   기본은 여전히 카드다 — 대다수 소비자는 딜 잔액이 없다.
    if (flow === 'voucher_deal' || payWithDeal) {
      // 딜 결제 흐름 (교환권 전용 → 2026-08-31 이후 이용권도 선택 시)
      setJoining(true)
      reportFunnel('click', productId)
      try {
        // 🛡️ 2026-06-11 (플로우 감사 갭#3/#3b): 서버가 이미 지원하는 안전장치 2개를 드디어 전송 —
        //   idempotency_key(이중탭/재시도 중복발급·이중차감 영구 차단, VoucherDetailPage:115 동일 패턴)
        //   + ref(?ref= 배너가 약속하는 양쪽 0.5% 보너스의 실제 지급 경로 — 미전송이면 무적립이었음).
        const { getTrackedSellerId } = await import('@/lib/seller-tracking')
        const ref = getTrackedSellerId() || undefined
        const idempotency_key = `gb_${productId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
        const res = await api.post(`/api/group-buy/join/${productId}`, {
          quantity, payment_method: 'deal', ref, idempotency_key,
        })
        if (res.data?.success) {
          toast.success(flow === 'voucher_deal' ? '🎁 교환권 발급 완료' : '🎫 이용권 발급 완료')
          fireAffiliateTrack(res?.data?.data?.order_id ?? null, Number(id), detail?.name) // 큐레이터 적립 (fail-soft)
          invalidateVouchers()
          navigate('/my-gifticons')  // 🎟️ 2026-08-31 지갑 분리 — 교환권(voucher_deal)은 교환권 보관함으로
        } else {
          toast.error(res.data?.error || '교환 실패')
        }
      } catch (err: unknown) {
        // 💰 실패 안내 3갈래(게이트 꺼짐 / 딜 부족 / 그 외)는 `./group-buy/deal-join-error`.
        await handleDealJoinError(err, { confirmDialog, navigate })
      } finally {
        setJoining(false)
      }
      return
    }

    // 일반 공구 상품 (non-voucher) — 토스 결제 흐름
    setJoining(true)
    reportFunnel('click', productId)
    try {
      // 🛡️ 2026-06-11 (갭#3b): 토스 경로도 ref 전송 — init 응답 metadata 에 실려 confirm 까지 전파.
      const { getTrackedSellerId: getRef } = await import('@/lib/seller-tracking')
      const initRes = await api.post(`/api/group-buy/join/${productId}`, {
        quantity, payment_method: 'toss', ref: getRef() || undefined,
      })
      if (!initRes.data?.success) {
        toast.error(initRes.data?.error || '공구 결제 시작 실패')
        return
      }
      const { orderId, amount, orderName, clientKey: serverClientKey, flow: serverFlow } = initRes.data.data as { orderId: string; amount: number; orderName: string; clientKey?: string; flow?: 'redirect' | 'widget' | 'invalid' }
      if (!serverClientKey) {
        toast.error('결제 시스템이 설정되지 않았습니다. 관리자에게 문의해주세요.')
        return
      }
      // 🛡️ 2026-05-23 belt-and-suspenders: 클라이언트도 키 형식 직접 감지 →
      //   server flow 가 캐시/오감지로 widget 키에 'redirect' 반환해도 강제로 widget 으로 보정.
      //   SDK 의 "결제위젯 연동 키는 지원하지 않습니다" 에러 영구 차단.
      const flow = resolveTossFlow(serverFlow, serverClientKey)
      if (flow === 'invalid') {
        toast.error('결제 시스템이 설정되지 않았습니다. 관리자에게 문의해주세요.')
        return
      }

      // 🛡️ 2026-06-11 (갭#3b): ref 를 success URL 로 전파 → confirm 페이지가 confirm-toss body 에 전달
      //   (서버 :1009 는 이미 body.ref 검증·적립 지원 — 전달만 끊겨 있었음).
      const _ref = getRef() || ''
      const successQs = new URLSearchParams({ productId: String(productId), qty: String(quantity), ...(_ref ? { ref: _ref } : {}) }).toString()
      const failQs = new URLSearchParams({ productId: String(productId) }).toString()
      const successPath = `/group-buy/confirm-payment?${successQs}`
      const failPath = `/group-buy/${productId}?fail=1&${failQs}`

      // 🛡️ 2026-05-23 v7: 모든 키 widgets() API 경로 (payment V2 폐기 — 사용자 환경에서 작동 안 함).
      const params = new URLSearchParams({
        orderId,
        amount: String(amount),
        orderName,
        clientKey: serverClientKey,
        successUrl: successPath,
        failUrl: failPath,
      })
      navigate(`/pay/widget?${params.toString()}`)
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { error?: string; code?: string } }; code?: string; message?: string }
      if (e?.code === 'USER_CANCEL') return  // 사용자 명시 취소
      if (e?.response?.status === 429) {
        toast.error('잠시 후 다시 시도해주세요.')
        return
      }
      const msg = e?.response?.data?.error || e?.message || '참여 실패'
      toast.error(msg)
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    // 🎨 2026-07-01 (대표 "로더 전면 통일"): 소비자 로딩을 유어딜 BrandLoader(SSOT)로 통일.
    //   ⚠️ SSR seed(`__SSR_INITIAL_DETAIL__`) 있으면 loading=false 라 이 로더는 seed-miss/콜드 SPA 이동에만 노출.
    return <BrandLoader fullScreen />
  }
  if (!detail) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-[#11141C] text-gray-900 dark:text-white">
        <p className="font-bold mb-3">상품을 찾을 수 없습니다</p>
        <button onClick={() => navigate('/map')} className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-bold">공구 목록으로</button>
      </div>
    )
  }

  return (
    <div className="gbd" style={{ background: 'var(--gbd-card)', color: 'var(--gbd-ink)', minHeight: '100dvh' }}>
      {/* 🛡️ 2026-05-15: SEO 풀 적용 — JSON-LD Product/Offer schema + 동적 OG image */}
      <SEO
        title={`${detail.name} 공동구매 - ${detail.restaurant_name || '유어딜'}`}
        description={
          displayDiscountPct > 0
            ? `🎉 ${displayDiscountPct}% 할인! ${detail.restaurant_name || ''} ${detail.name} 공동구매 — ${detail.group_buy_current}명 함께 구매 중, ${formatNumber(unitPrice)}원`
            : `${detail.restaurant_name || ''} ${detail.name} 공동구매 — ${detail.group_buy_current}명 함께 구매 중, ${formatNumber(detail.price)}원`
        }
        url={`/group-buy/${productId}`}
        image={detail.image_url || `https://urdeal.kr/api/og/group-buy/${productId}.png`}
        type="product"
        jsonLd={[{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: detail.name,
          description: detail.description || `${detail.restaurant_name || ''} ${detail.name} 공동구매`,
          image: detail.image_url ? [detail.image_url] : undefined,
          brand: detail.restaurant_name ? { '@type': 'Brand', name: detail.restaurant_name } : undefined,
          offers: {
            '@type': 'Offer',
            url: `https://urdeal.kr/group-buy/${productId}`,
            priceCurrency: 'KRW',
            price: unitPrice,
            availability: detail.group_buy_status === 'active' || detail.group_buy_status === 'achieved'
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
            priceValidUntil: detail.group_buy_deadline,
            seller: detail.seller_name ? { '@type': 'Organization', name: detail.seller_name } : undefined,
          },
          ...(detail.restaurant_lat && detail.restaurant_lng ? {
            address: detail.restaurant_address ? {
              '@type': 'PostalAddress',
              streetAddress: detail.restaurant_address,
              addressCountry: 'KR',
            } : undefined,
            geo: {
              '@type': 'GeoCoordinates',
              latitude: detail.restaurant_lat,
              longitude: detail.restaurant_lng,
            },
          } : {}),
        }, {
          // Breadcrumb
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: '홈', item: 'https://urdeal.kr/' },
            { '@type': 'ListItem', position: 2, name: '공동구매', item: 'https://urdeal.kr/group-buy' },
            { '@type': 'ListItem', position: 3, name: detail.name, item: `https://urdeal.kr/group-buy/${productId}` },
          ],
        }]}
      />

      {/* WCAG AA: skip-link */}
      <a href="#gb-main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-gray-900 focus:text-white focus:px-3 focus:py-2 focus:rounded-lg focus:text-sm focus:font-bold">
        본문으로 건너뛰기
      </a>

      <DetailFloatingHeader
        productId={detail.id}
        title={detail.name}
        shareDescription={`${detail.restaurant_name ? detail.restaurant_name + ' · ' : ''}${detail.group_buy_current}명 함께 구매 중 · ${displayDiscountPct > 0 ? `${displayDiscountPct}% 할인` : '공동구매 특가'}${myUserId ? ' · 친구 초대 시 양쪽 0.5% 보너스 (첫 1회)' : ''}`}
        shareImageUrl={`https://urdeal.kr/api/og/group-buy/${productId}`}
        shareLink={shareLink}
        myUserId={myUserId}
        price={Number((detail as { deal_only?: number }).deal_only) === 1 ? undefined : detail.price}
        discountPct={displayDiscountPct}
        heroRef={heroRef}
        onBack={() => navigate(-1)}
      />

      {/* 🖥️ 2026-07-19 (대표 승인 — 그루폰식 상세): lg+ = [좌 넓은 콘텐츠(갤러리+본문)] + [우 360px sticky 구매박스].
          이전 2단(좌 sticky 갤러리 | 우 본문)에서 그루폰 딜 상세 구조로 전환. 모바일(<lg)은 세로 1열 +
          하단 고정 구매바 그대로(불변). */}
      {/* 🏷️ 2026-08-19 (대표 확정 — 상세 1안 "그루폰 정석"): PC 는 제목·별점·주소가 사진 **위**. 모바일은 그대로. */}
      {/* 🧭 2026-08-30 (대표 — 그루폰식 카테고리바): 사진 **위** 한 줄. 이 페이지는 헤더가 뜬다 → overlayHeader */}
      <DetailBreadcrumb items={voucherCrumbs(detail.category)} overlayHeader />
      <DetailTitleHeader name={detail.name} storeName={detail.restaurant_name} address={detail.restaurant_address}
        phone={detail.restaurant_phone} rating={detail.avg_rating} reviewCount={detail.review_count}
        onnuri={(detail as { onnuri_merchant?: boolean }).onnuri_merchant} />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10 lg:max-w-[1200px] lg:mx-auto lg:items-start lg:pt-1">
      <div className="lg:min-w-0">{/* 좌측 콘텐츠 컬럼 */}
      {/* 🎨 2026-06-16 리디자인: 이미지 갤러리 (fixed 헤더가 위에 floating)
          🖼️ 2026-08-19 (대표 시안 — 그루폰 상세): 사진이 여러 장이면 PC 에서 [좌 대형 + 우 썸네일]로
          펴고, 마지막 썸네일의 `+N` 으로 전체 사진 모달을 연다. 모바일은 스와이프 그대로.
          레이아웃/상태는 `DetailGallery`(SSOT)로 추출 — 이 파일은 배지만 넘긴다. */}
      <div ref={heroRef} className="relative lg:rounded-2xl lg:overflow-hidden lg:border lg:border-gray-100 dark:lg:border-[#2C2F35]" style={{ background: 'var(--gbd-card)' }}>
        <DetailGallery
          images={galleryImages}
          alt={detail.name}
          fallback={<CategoryFallbackIcon cat={detail.category} />}
          badges={
            <>
              <div style={{ position: 'absolute', inset: '0 0 auto 0', height: 110, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(0,0,0,.4), transparent)' }} />
              <div style={{ position: 'absolute', inset: 'auto 0 0 0', height: 120, pointerEvents: 'none', background: 'linear-gradient(0deg, rgba(0,0,0,.32), transparent)' }} />
              <div style={{ position: 'absolute', left: 16, bottom: 17, display: 'flex', alignItems: 'center', gap: 6 }}>
                {/* 🧭 2026-08-30: 사진 위 카테고리 칩을 뺐다. 바로 위 빵부스러기가 같은 말을 하고 있어
                    중복이었고, 게다가 이 칩은 **자체 라벨 맵**을 들고 있어 명칭 SSOT 와 어긋났다
                    ('뷰티'/'숙박'/'액티비티' — SSOT 는 미용/숙소/기타). 사진 위엔 할인율만 남긴다. */}
                {detail.group_buy_status === 'expired' && <span style={{ padding: '5px 9px', borderRadius: 6, background: 'rgba(55,55,55,.78)', color: '#fff', fontSize: 12, fontWeight: 700 }}>마감</span>}
                {detail.group_buy_status === 'cancelled' && <span style={{ padding: '5px 9px', borderRadius: 6, background: 'var(--gbd-danger)', color: '#fff', fontSize: 12, fontWeight: 700 }}>취소</span>}
              </div>
            </>
          }
        />
      </div>

      <main id="gb-main" role="main">
        {/* 🖥️ 2026-07-19 그루폰식 섹션 탭 — PC 전용(클릭 → 해당 섹션 스크롤). 모바일은 세로 스택이라 불필요. */}
        <nav className="hidden lg:flex items-center gap-1 border-b mt-4" style={{ borderColor: 'var(--gbd-line2)' }} aria-label="상세 섹션">
          {[
            { id: 'gb-sec-info', label: '이용권 정보' },
            ...((detail.restaurant_address || (detail.restaurant_lat && detail.restaurant_lng)) ? [{ id: 'gb-sec-location', label: '매장 위치' }] : []),
            { id: 'gb-sec-reviews', label: '리뷰' },
          ].map((tab) => (
            <button key={tab.id} onClick={() => document.getElementById(tab.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              style={{ padding: '11px 15px', fontSize: 14, fontWeight: 800, color: 'var(--gbd-ink2)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
              {tab.label}
            </button>
          ))}
          {/* 핀/공유 — 모바일 플로팅 헤더가 lg:hidden 이라 PC 는 여기서 제공 */}
          <span className="ml-auto flex items-center gap-1 pb-1">
            <PinButton productId={detail.id} price={detail.price} variant="detail-floating" className="!w-9 !h-9 shrink-0" />
            <KakaoShareButton
              title={`${detail.name} 공구 참여하기`}
              description={`${detail.restaurant_name ? detail.restaurant_name + ' · ' : ''}${detail.group_buy_current}명 함께 구매 중`}
              imageUrl={`https://urdeal.kr/api/og/group-buy/${productId}`}
              link={shareLink}
              buttonText="나도 참여하기"
              {...(Number((detail as { deal_only?: number }).deal_only) === 1 ? {} : {
                salePrice: detail.price,
                discountRate: displayDiscountPct,
                secondaryButtonText: '자세히 보기',
              })}
              compact
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 hover:bg-gray-100 dark:hover:bg-[#1D1F29]"
            />
          </span>
        </nav>
        {/* 추천 진입 배너 (?ref=) — 어트리뷰션 유지 */}
        {isInfluencerLanding && (
          <div style={{ margin: '14px 18px 0', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--gbd-ink)', color: 'var(--gbd-card)' }}>
            <Sparkles style={{ width: 20, height: 20, flex: '0 0 auto' }} />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 11.5, fontWeight: 700, opacity: .9, margin: 0 }}>친구 추천 공구</p>
              <p style={{ fontSize: 13.5, fontWeight: 800, margin: '2px 0 0' }}>참여 시 양쪽 0.5% 보너스 딜</p>
            </div>
          </div>
        )}

        {/* 🎁 2026-08-26: 활성 딜 보유자에게만 뜬다(딜 없으면 null) — 근거는 ShareRewardBanner 헤더 주석. */}
        <div className="px-[18px]"><ShareRewardBanner sellerId={detail.seller_id as number | null} productId={detail.id} /></div>
        {/* 타이틀 — 📱 모바일 전용. PC 는 위 `DetailTitleHeader`(둘 다 그리면 제목이 두 번 나온다). */}
        <div className="lg:hidden" style={{ padding: '14px 18px 0' }}>
          {/* 🎨 색: 2026-08-31 에 나와 main(#1251)이 **각자 같은 판단**을 했다 — 로즈였던 이 줄을
              둘 다 `--gbd-ink2` 로 내렸다. main 쪽은 거기에 중복 라벨("· 정식 등록 매장")까지
              걷어냈으므로 그쪽을 그대로 취한다(상위집합). */}
          {detail.restaurant_name && (
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gbd-ink2)', letterSpacing: '.01em' }}>
              {detail.restaurant_name}
              {/* 🏪 2026-07-05 온누리 가맹 뱃지 (B2G — "온누리 사용 가능 표시" 약속) */}
              {(detail as { onnuri_merchant?: boolean }).onnuri_merchant && (
                <span className="ml-1.5 px-1.5 py-[1px] rounded bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold align-middle">온누리 사용 가능</span>
              )}
            </div>
          )}
          {isPrelaunch && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, padding: '4px 10px', borderRadius: 999, background: 'var(--gbd-ink)', color: 'var(--gbd-card)', fontSize: 11, fontWeight: 800 }}>오픈 예정 · 사전 응모 받는 중</span>
          )}
          <h1 style={{ margin: '4px 0 0', fontSize: 21, lineHeight: 1.3, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--gbd-ink)' }}>{detail.name}</h1>
          {(detail.restaurant_address || detail.restaurant_phone) && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 8 }}>
              <MapPin style={{ width: 17, height: 17, marginTop: 2, flex: '0 0 auto', color: 'var(--gbd-sub)' }} />
              <div style={{ fontSize: 13.5, color: 'var(--gbd-sub)', lineHeight: 1.5 }}>
                {detail.restaurant_address || ''}
                {distKm != null && <> · <b style={{ fontWeight: 700, color: 'var(--gbd-ink2)' }}>{distKm}km</b></>}
                {detail.group_buy_current > 0 && <> · <b style={{ fontWeight: 700, color: 'var(--gbd-ink2)' }}>{formatNumber(detail.group_buy_current)}명 구매</b></>}
                {detail.restaurant_phone && <> · <a href={`tel:${detail.restaurant_phone}`} style={{ color: 'var(--gbd-ink2)', textDecoration: 'none', fontWeight: 600, borderBottom: '1px solid var(--gbd-line2)' }}>{detail.restaurant_phone}</a></>}
              </div>
            </div>
          )}
        </div>

        {/* 가격 — 📱 모바일 전용. PC 는 우측 구매 패널 헤드라인이 담당(두 곳에 두면 최종가가 흐려진다). */}
        <div className="lg:hidden" style={{ padding: '12px 18px 16px' }}>
          {/* 💰 정가·할인율·판매가를 **한 줄**로. 예전엔 취소선이 자기 줄을 통째로 쓰고 있었다. */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            {displayDiscountPct > 0 && <span style={{ fontSize: 25, fontWeight: 800, color: 'var(--gbd-danger)', letterSpacing: '-.03em' }}>{displayDiscountPct}%</span>}
            <span style={{ fontSize: 28, fontWeight: 900, color: 'var(--gbd-ink)', letterSpacing: '-.035em' }}>{formatNumber(unitPrice)}원</span>
            {unitSaving > 0 && <span style={{ fontSize: 14, color: 'var(--gbd-sub2)', textDecoration: 'line-through', letterSpacing: '-.01em' }}>{formatNumber(refPrice)}원</span>}
          </div>
          {/* 🔀 양쪽을 합친다: main(#1251)의 여백 정리(marginTop 6) + 내 탈-로즈(`--gbd-ink`).
              한쪽만 고르면 여백이나 색 중 하나를 잃는다. */}
          <div style={{ marginTop: 6, fontSize: 13, color: 'var(--gbd-ink2)', fontWeight: 500 }}>{unitSaving > 0 && <>1매당 <b style={{ fontWeight: 800, color: 'var(--gbd-ink)' }}>{formatNumber(unitSaving)}원</b> 저렴 · </>}결제 즉시 교환권 발급</div>
        </div>

        {dDay != null && dDay <= 7 && (
          <div className="lg:hidden" style={{ margin: '0 18px 18px', padding: '11px 14px', borderRadius: 12, background: 'var(--gbd-danger-soft)', color: 'var(--gbd-danger)', fontSize: 13.5, fontWeight: 800 }}>
            {dDay === 0 ? '오늘 마감 — 이 가격은 오늘까지예요' : `마감 D-${dDay} — 이 가격은 ${dDay}일 남았어요`}
          </div>
        )}

        {/* 🎯 추첨 응모 — 이 상품이 추첨 대상일 때만(결제 없음). 아니면 렌더 0. */}
        <div id="fcfs-apply-block"><FcfsApplyBlock productId={Number(id)} /></div>

        <div style={{ height: 8, background: 'var(--gbd-bg)' }} />

        {/* 셀러 (컴팩트) + SNS */}
        {detail.seller_name && (() => {
          const snsLinks = [
            detail.seller_instagram && { icon: Instagram, url: detail.seller_instagram, label: 'Instagram' },
            detail.seller_youtube && { icon: Youtube, url: detail.seller_youtube, label: 'YouTube' },
            detail.seller_tiktok && { icon: Music2, url: detail.seller_tiktok, label: 'TikTok' },
            detail.seller_facebook && { icon: Facebook, url: detail.seller_facebook, label: 'Facebook' },
          ].filter(Boolean) as { icon: typeof Instagram; url: string; label: string }[]
          const normalizeUrl = (u: string) => /^https?:\/\//i.test(u) ? u : `https://${u}`
          return (
            <div style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {detail.seller_avatar
                  ? <div role="img" aria-label={detail.seller_name} style={{ width: 44, height: 44, borderRadius: '50%', flex: '0 0 auto', backgroundColor: 'var(--gbd-chip)', backgroundImage: `url("${cfImage(detail.seller_avatar, { width: 120, format: 'auto' }) || detail.seller_avatar}")`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                  : <div style={{ width: 44, height: 44, borderRadius: '50%', flex: '0 0 auto', background: 'var(--gbd-chip)' }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--gbd-ink)', whiteSpace: 'nowrap' }}>{detail.seller_name}</span>
                    <CheckCircle2 style={{ width: 15, height: 15, color: 'var(--gbd-accent)', flex: '0 0 auto' }} />
                    <span style={{ fontSize: 12, color: 'var(--gbd-sub)', whiteSpace: 'nowrap' }}>검증 셀러</span>
                  </div>
                  {/* 🏷️ 2026-09-03 대표 — 자동 발급 아이디(@store_xxxx)는 손님에게 의미가 없다(SSOT: shared/seller-handle). */}
                  {publicSellerHandle(detail.seller_username) && <div style={{ fontSize: 12.5, color: 'var(--gbd-sub)', marginTop: 2 }}>@{publicSellerHandle(detail.seller_username)}</div>}
                </div>
                <button onClick={() => { if (detail.seller_handle) { navigate(`/u/${detail.seller_handle}`); return } const t = detail.seller_username || detail.seller_id; if (t) navigate(`/profile/${t}`) }} style={{ display: 'inline-flex', alignItems: 'center', gap: 1, padding: '8px 12px', border: '1px solid var(--gbd-line2)', borderRadius: 10, background: 'var(--gbd-card)', color: 'var(--gbd-ink2)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flex: '0 0 auto' }}>
                  프로필<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                </button>
              </div>
              {snsLinks.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                  {snsLinks.map(({ icon: Icon, url, label }) => (
                    <a key={label} href={normalizeUrl(url)} target="_blank" rel="noopener noreferrer" aria-label={label} style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--gbd-chip)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gbd-ink)' }}>
                      <Icon style={{ width: 16, height: 16 }} />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        <div style={{ height: 8, background: 'var(--gbd-bg)' }} />

        {/* 🔴 2026-09-01 (디자인 방향 PR A): 3열 균등 신뢰 스트립(안전결제/정식판매/환불보장) 삭제 —
            CTA 위 한 줄("토스로 3초 안전결제 · 미사용 시 100% 자동환불")이 같은 말을 이미 한다. */}

        {/* 상품 안내 — 🧾 2026-08-30 (대표 "AI 티 안나는 디자인으로"):
            제목이 '무엇을 기대하세요?' 였다. What to expect 를 그대로 옮긴 번역투라
            한국 커머스에선 아무도 그렇게 안 쓴다 — 아래 '이용 안내'와 짝이 되게 '딜 안내'로.
            그 아래 칩도 로즈 점을 박은 라운드 필 3개였다. 세 낱말에 테두리 세 개를 쓰던 꼴이라,
            점·테두리를 걷었다. 2026-09-01: 띄어 쓴 가운뎃점 사슬도 흔적이라 한 줄에 하나 + 로즈 점(테두리 없음)으로. */}
        <div id="gb-sec-info" style={{ padding: '22px 18px', scrollMarginTop: 116 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gbd-ink)', letterSpacing: '-.02em' }}>딜 안내</div>
          {/* 🔴 로즈 마침표: 띄어 쓴 가운뎃점 사슬(a · b · c) 대신 한 줄에 하나, 앞에 점. 테두리 pill 이 아니다. */}
          <div style={{ marginTop: 11, fontSize: 13.5, color: 'var(--gbd-sub)', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {['즉시 교환권 발급', '전 지점 사용', detail.voucher_expiry ? `${safeDate(detail.voucher_expiry)?.toLocaleDateString('ko-KR') ?? ''}까지 사용` : '결제 즉시 사용'].map((line) => (
              <span key={line} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--gbd-accent)', flex: '0 0 auto' }} />{line}</span>
            ))}
          </div>
          {detail.description && <p style={{ margin: '14px 0 0', fontSize: 14.5, lineHeight: 1.72, color: 'var(--gbd-ink2)', whiteSpace: 'pre-line' }}>{detail.description}</p>}
        </div>

        {/* 대표 메뉴 — 백엔드 menu 데이터 있을 때만 (data-gate; docs/design/group-buy-detail.md). 추출: DealMenuList */}
        <DealMenuList menuItems={((detail as { menu?: DealMenuItem[] }).menu) || []} />

        {/* 매장 위치 — RestaurantMiniMap(잠금 lazy) + 주소 카드 + 길찾기 */}
        {(detail.restaurant_address || (detail.restaurant_lat && detail.restaurant_lng)) && (
          <>
            <div style={{ height: 8, background: 'var(--gbd-bg)' }} />
            <div id="gb-sec-location" style={{ padding: '22px 18px', scrollMarginTop: 116 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gbd-ink)', letterSpacing: '-.02em', marginBottom: 13 }}>매장 위치</div>
              <div style={{ borderRadius: '14px 14px 0 0', overflow: 'hidden', border: '1px solid var(--gbd-line2)', borderBottom: 'none' }}>
                <DeferUntilVisible minHeight={172}>
                  <Suspense fallback={<div style={{ height: 172, background: 'var(--gbd-chip)' }} />}>
                    <RestaurantMiniMap name={detail.restaurant_name} address={detail.restaurant_address} lat={detail.restaurant_lat} lng={detail.restaurant_lng} placeUrl={detail.kakao_place_url} />
                  </Suspense>
                </DeferUntilVisible>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px', border: '1px solid var(--gbd-line2)', borderTop: 'none', borderRadius: '0 0 14px 14px' }}>
                {/* 🧾 매장명은 제목 위(머천트 줄)와 지도 핀에 이미 두 번 나온다 — 여기까지 세 번은
                    "채워 넣은" 티다. 주소만 남긴다(길찾기 버튼이 바로 옆이라 주소가 실제로 쓰인다). */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {detail.restaurant_address && <div style={{ fontSize: 13, color: 'var(--gbd-sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail.restaurant_address}</div>}
                </div>
                <a
                  href={`https://map.kakao.com/link/${detail.restaurant_lat && detail.restaurant_lng ? `to/${encodeURIComponent(detail.restaurant_name || '매장')},${detail.restaurant_lat},${detail.restaurant_lng}` : `search/${encodeURIComponent(detail.restaurant_address || detail.restaurant_name || '')}`}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '9px 14px', border: '1px solid var(--gbd-line2)', borderRadius: 11, background: 'var(--gbd-card)', color: 'var(--gbd-ink)', fontSize: 13, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', flex: '0 0 auto' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--gbd-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z" /></svg>
                  길찾기
                </a>
              </div>
            </div>
          </>
        )}

        {/* 본인 product CTA (셀러 대시보드 진입) */}
        {isOwnProduct && (
          <div style={{ margin: '0 18px 14px', display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px', border: '1px solid var(--gbd-line2)', borderRadius: 14 }}>
            <Sparkles style={{ width: 18, height: 18, flex: '0 0 auto', color: 'var(--gbd-ink)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gbd-ink)', margin: 0 }}>내 공구</p>
              <p style={{ fontSize: 11.5, color: 'var(--gbd-sub)', margin: '2px 0 0' }}>대시보드에서 통계 / 정산 확인</p>
            </div>
            <button onClick={() => navigate('/seller/group-buy')} style={{ padding: '8px 12px', background: 'var(--gbd-cta-bg)', color: 'var(--gbd-cta-fg)', border: 'none', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flex: '0 0 auto' }}>공구 관리 →</button>
          </div>
        )}

        <div style={{ height: 8, background: 'var(--gbd-bg)' }} />

        {/* 이용 안내 — 헤어라인 스펙표 + 점불릿 유의사항 */}
        <div style={{ padding: '22px 18px' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gbd-ink)', letterSpacing: '-.02em' }}>이용 안내</div>
          <div style={{ marginTop: 15 }}>
            {[
              { k: '사용기한', v: detail.voucher_expiry ? `${safeDate(detail.voucher_expiry)?.toLocaleDateString('ko-KR') ?? ''} 까지` : '발급 후 사용 기간 적용' },
              { k: '사용처', v: detail.restaurant_name || '전 지점' },
              { k: '사용 방법', v: '매장에서 교환권 제시' },
            ].map((row, i, arr) => (
              <div key={row.k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderTop: '1px solid var(--gbd-line2)', borderBottom: i === arr.length - 1 ? '1px solid var(--gbd-line2)' : 'none' }}>
                <span style={{ fontSize: 13.5, color: 'var(--gbd-sub)', whiteSpace: 'nowrap' }}>{row.k}</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--gbd-ink)' }}>{row.v}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(detail.voucher_terms
              ? detail.voucher_terms.split('\n').map(s => s.trim()).filter(Boolean)
              : ['현장에서 추가 할인이나 다른 쿠폰과 중복 적용되지 않아요.', '잔액은 환불되지 않으니 한 번에 사용하시길 권장해요.']
            ).map((line, i) => (
              <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <span style={{ flex: '0 0 auto', width: 4, height: 4, borderRadius: '50%', background: 'var(--gbd-sub2)', marginTop: 8 }} />
                <span style={{ fontSize: 13, color: 'var(--gbd-sub)', lineHeight: 1.5 }}>{line}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 후기·평점 — 신뢰 레버 (디자이너 후속 제안). 기존 ProductReviews 재사용(lazy, 빈 상태/작성 폼 내장). */}
        <div style={{ height: 8, background: 'var(--gbd-bg)' }} />
        <div id="gb-sec-reviews" style={{ padding: '22px 18px', scrollMarginTop: 116 }}>
          <DeferUntilVisible minHeight={80}>
            <Suspense fallback={<div style={{ height: 80, background: 'var(--gbd-chip)', borderRadius: 12 }} />}>
              <ProductReviews productId={productId} limit={5} />
            </Suspense>
          </DeferUntilVisible>

          {/* 🎟️ 2026-07-06 (§2-B B1): 인플루언서 공구 제안 — GB_ENGINE_ENABLED 게이트(기본 OFF, 미노출) */}
          {GB_ENGINE_ENABLED && detail && !isOwnProduct && (
            <button
              onClick={() => setShowPropose(true)}
              style={{ marginTop: 14, width: '100%', padding: '11px', borderRadius: 12, fontSize: 13, fontWeight: 700 }}
              className="border border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10"
            >
              이 매장에 공구 제안하기
            </button>
          )}
        </div>
        {GB_ENGINE_ENABLED && showPropose && detail && (
          <Suspense fallback={null}>
            <GbProposeModal productId={Number(productId)} listPrice={Number(detail.price)} productName={detail.name} onClose={() => setShowPropose(false)} />
          </Suspense>
        )}

        {/* 🗑️ 2026-07-07 폴드-아래 게이트 센티넬: 이 지점이 뷰포트 600px 안에 들어오면 다른 공구 fetch. */}
        <div ref={otherDealsSentinelRef} aria-hidden style={{ height: 1 }} />
        {/* 이 셀러의 다른 공구 — 가로 스크롤. 추출: OtherDealsRow(fetch/IO 게이팅은 여기 소유 — 불변) */}
        <OtherDealsRow deals={otherDeals} sellerHandle={detail.seller_handle} sellerUsername={detail.seller_username} />

        <div className="lg:hidden" style={{ height: 112 }} />
      </main>
      </div>{/* /좌측 콘텐츠 컬럼 */}

      {/* 🖥️ 우측 sticky 구매 박스 — PC 전용(모바일은 하단 고정 구매바). 상태/핸들러 공유(controlled). */}
      <aside className="hidden lg:block lg:sticky lg:top-[116px] lg:self-start lg:pb-10">
        <DealPurchaseBox
          name={detail.name}
          discountPct={displayDiscountPct}
          unitPrice={unitPrice}
          refPrice={refPrice}
          unitSaving={unitSaving}
          totalSaving={totalSaving}
          total={total}
          quantity={quantity}
          setQuantity={setQuantity}
          maxQty={maxQty}
          maxPerPerson={detail.max_per_person}
          buyable={buyable}
          isJoinable={isJoinable}
          isPrelaunch={isPrelaunch}
          isDemo={isDemoDeal}
          joining={joining}
          onBuy={() => handleJoin()}
          onPrelaunchApply={() => document.getElementById('fcfs-apply-block')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
        />
      </aside>
      </div>{/* /lg 그루폰식 그리드 */}

      {/* 🎨 2026-06-16 리디자인 결제 푸터 — 할인중 + 수량 스테퍼 + 안심 카피 + 잉크블랙 '구매하기'.
            fixed (BottomNav z-9999 위). gbd 자손이라 var() 상속.
            🖥️ 2026-07-19 (그루폰식): PC(lg+)는 우측 sticky DealPurchaseBox 가 담당 → 이 바는 모바일 전용. */}
      <footer
        className="fixed bottom-0 inset-x-0 z-[10002] lg:hidden"
        role="contentinfo" aria-label="결제 영역"
      >
      <div
        style={{ background: 'var(--gbd-card)', borderTop: '1px solid var(--gbd-line2)', padding: '7px 16px calc(8px + env(safe-area-inset-bottom))', boxShadow: '0 -8px 30px -18px rgba(0,0,0,.3)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gbd-ink2)', whiteSpace: 'nowrap' }}>
              {isJoinable && totalSaving > 0 ? (quantity > 1 ? `총 ${formatNumber(totalSaving)}원 할인 중` : `${formatNumber(unitSaving)}원 할인 중`) : ''}
            </span>
            {detail?.max_per_person && detail.max_per_person > 0 ? (
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gbd-sub)', whiteSpace: 'nowrap' }}>1인당 최대 {detail.max_per_person}개</span>
            ) : null}
            {/* 🗺️ 2026-07-02 카카오맵 리뷰 게이미피케이션 — 레벨 전용 이용권 배지 (서버 게이트의 UX 안내) */}
            {detail?.min_review_level && detail.min_review_level > 1 ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gbd-ink)', whiteSpace: 'nowrap' }}>동네 리뷰어 Lv.{detail.min_review_level} 전용</span>
            ) : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--gbd-line2)', borderRadius: 10, overflow: 'hidden' }} role="group" aria-label="수량 조절">
            <button onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={!buyable || quantity <= 1} aria-label="수량 감소" style={{ width: 32, height: 32, border: 'none', background: 'var(--gbd-card)', color: 'var(--gbd-ink)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (!isJoinable || quantity <= 1) ? .4 : 1 }}>−</button>
            <span style={{ minWidth: 30, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--gbd-ink)' }} aria-live="polite" aria-label={`현재 ${quantity}장`}>{quantity}</span>
            <button onClick={() => setQuantity(q => Math.min(maxQty, q + 1))} disabled={!buyable || quantity >= maxQty} aria-label="수량 증가" style={{ width: 32, height: 32, border: 'none', background: 'var(--gbd-card)', color: 'var(--gbd-ink)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (!isJoinable || quantity >= maxQty) ? .4 : 1 }}>+</button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 6 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gbd-sub)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          <span style={{ fontSize: 11.5, color: 'var(--gbd-sub)', fontWeight: 500, whiteSpace: 'nowrap' }}>{isPrelaunch ? '오픈 협의 중 매장 · 응모는 무료, 오픈 시 알림을 드려요' : '토스로 3초 안전결제 · 미사용 시 100% 자동환불'}</span>
        </div>
        <button
          onClick={isPrelaunch ? () => document.getElementById('fcfs-apply-block')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) : () => handleJoin()}
          disabled={(!isJoinable && !isPrelaunch) || joining}
          aria-label={isPrelaunch ? '사전 응모하기' : isJoinable ? `${formatNumber(total)}원 ${isDemoDeal ? '결제하기' : '구매하기'}` : isDemoDeal ? '결제 불가' : '구매 불가'}
          style={{ width: '100%', height: 50, border: 'none', borderRadius: 14, background: (buyable || isPrelaunch) ? 'var(--gbd-cta-bg)' : 'var(--gbd-sub2)', color: 'var(--gbd-cta-fg)', fontSize: 16, fontWeight: 800, letterSpacing: '-.01em', cursor: (buyable || isPrelaunch) ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
        >
          {joining ? '처리 중…' : isPrelaunch ? '사전 응모하기' : !isJoinable ? (isDemoDeal ? '결제 불가' : '구매 불가') : <>{formatNumber(total)}원 {isDemoDeal ? '결제하기' : '구매하기'}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></>}
        </button>
        <DealPayButton show={canPayWithDeal && !isPrelaunch && isJoinable} joining={joining} dealBalance={dealBalance} onPay={() => handleJoin(true)} />
      </div>{/* /bar box */}
      </footer>
    </div>
  )
}
