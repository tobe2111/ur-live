/**
 * 🛡️ 2026-05-20: 홈 공구 피드 카드 (당근 2열 + 공구 진행 overlay).
 *
 * 정사각형 이미지 + 좌하단 진행/카테고리 배지 overlay → 당근의 깔끔함 유지하면서
 * 공구 핵심 정보 (현재/목표 인원 + 마감 시간) 한눈에.
 */

import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatNumber } from '@/utils/format'
import { safeDate } from '@/utils/safe-date'
import DealCardMedia from '@/components/deal/DealCardMedia'
import WishlistHeart from '@/components/deal/WishlistHeart'
import { extractDominantColor, reportDominantColor } from '@/utils/dominant-color'
import { usePrefetchGroupBuyProduct } from '@/hooks/queries'
import { canonicalDetailPath } from '@/shared/product-flow'
import FcfsBadge from '@/features/group-buy/FcfsBadge'
import { stripStorePrefix } from '@/utils/deal-title'
import StarRating from '@/components/deal/StarRating'
import { Star } from 'lucide-react'
import { dealCategoryMeta } from '@/shared/deal-category-icon'
import type { FcfsInfo } from '@/features/group-buy/useFcfs'
import type { Product } from './types'

/**
 * 🖼️ 사진 없는 카드의 자리표시 (2026-08-30 — 이모지 → 선 아이콘)
 *
 *   이전엔 `🍽️ 💇 🏨 🎯 💪 🐶 🎉` 이모지를 `text-3xl` 로 띄웠다. 두 가지가 문제였다 —
 *   ① **OS 마다 완전히 다른 그림이 나온다**(애플 컬러 이모지 / 노토 / Segoe). 우리가 고른
 *      색·형태가 아니라 남의 그림이 우리 카드 한복판에 뜬다.
 *   ② 이모지는 화면 어디서든 "임시로 채워 둔 것" 으로 읽힌다 — 실제로 임시가 아닌데도.
 *
 *   같은 굵기(전역 1.75)의 단색 선 아이콘으로 바꾸면 대표색 배경 위에서 조용히 가라앉고
 *   OS 와 무관하게 같은 화면이 된다. **개념이 일반적인 것들**(식사·숙소·반려…)이므로
 *   lucide 를 그대로 쓴다 — 직접 그리는 것은 유어샵·동네딜처럼 *유어딜에만 있는 개념*에만.
 */

interface FeedCardProduct extends Product {
  /* 🏷️ 2026-07-19 (대표 UI v2 P2): 제목 매장명 프리픽스 제거용 — 리스트 API 가 이미 내려줌 */
  restaurant_name?: string
  group_buy_current?: number
  group_buy_target?: number
  group_buy_status?: string
  expires_at?: string | null
  seller_name?: string
  seller_avatar?: string
  category?: string
  business_address?: string
  // restaurant_address 는 base Product(string|undefined) 상속 — 재선언 금지(TS2430).
  restaurant_lat?: number | null
  restaurant_lng?: number | null
  discount_rate?: number
  current_price?: number
  original_price?: number
  avg_rating?: number
  review_count?: number
  sold_count?: number
  // 🛡️ 2026-05-21: /api/group-buy/products 의 LEFT JOIN gift_catalog 응답 alias.
  brand_name?: string | null
  brand_icon_url?: string | null
  gc_brand_name?: string | null
  gc_brand_icon_url?: string | null
  gc_goods_type_detail?: string | null
  // 🏪 2026-07-05: 온누리상품권 가맹 매장 (seller_meta enrich — B2G 표시)
  onnuri_merchant?: boolean
  /** 🖼️ 2026-08-19: 카드 hover 캐러셀용 갤러리(서버가 3장으로 잘라 배열로 내려줌). */
  images?: string[] | string | null
}

// 🛡️ 2026-05-21: 구매 수 사람 친화 포맷 (4 자리 이상 → 만 단위).
function formatSoldCount(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}만`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}천`
  return String(n)
}

function timeRemaining(expiresAt: string | null | undefined): string | null {
  if (!expiresAt) return null
  // 🛡️ 2026-06-26 (소비자 감사): safeDate — 사파리가 D1 datetime 을 NaN 으로 파싱하면 'NaN분' 표시. 파싱 보정.
  const t = safeDate(expiresAt)?.getTime()
  if (t == null) return null
  const ms = t - Date.now()
  if (ms <= 0) return '마감'
  const hours = Math.floor(ms / 3_600_000)
  const days = Math.floor(hours / 24)
  if (days >= 2) return `마감 ${days}일`
  if (hours >= 1) return `마감 ${hours}시간`
  const mins = Math.max(1, Math.floor(ms / 60_000))
  return `마감 ${mins}분`
}

// 🛡️ 2026-05-24 (loading P0): aboveFold prop — 첫 화면 카드는 eager + fetchpriority=high.
//   효과: LCP 단축 (첫 진입 시 카드 이미지 우선 로드, lazy 후순위 카드는 nav 중에 로드).
// 🛡️ 2026-05-27 (loading P1): React.memo — 정렬/카테고리 칩 클릭 시 50카드 reconcile 비용 ↓.
//   sorted array 는 같은 element references 유지 → shallow compare 로 충분.
// 🎯 2026-06-23 (대표 신고 — 홈→상세 첫 진입 시 빈 스피너 깜빡임): 데이터뿐 아니라 상세 페이지
//   CHUNK 도 미리 받아둠 → 첫 클릭에도 Suspense 폴백(PageLoader) 없이 즉시 마운트. 1회 dedupe.
//   App.tsx 의 lazy import 와 동일 모듈 → Vite 가 같은 chunk 로 합침. (additive — 기존 데이터 prefetch 불변)
let _detailChunkPrefetched = false
function prefetchDetailChunk() {
  if (_detailChunkPrefetched) return
  _detailChunkPrefetched = true
  import('@/pages/GroupBuyDetailPage').catch(() => { _detailChunkPrefetched = false })
}

/**
 * 🔗 `to` 는 **유어샵 핀 전용 탈출구**다 (2026-08-27).
 *   기본값은 `canonicalDetailPath`(라우팅 SSOT). 그런데 유어샵의 담은 핀은 반드시
 *   `/u/{handle}/p/{id}` 로 가야 한다 — 그 경로가 **클릭을 기록하고 `?aff=` 귀속을 붙인다.**
 *   상세로 직행시키면 화면은 똑같은데 **소개비 귀속이 조용히 사라진다.**
 *   ⚠️ 그래서 이 prop 을 지우거나 호출부에서 빠뜨리면 돈이 새는 쪽으로 조용히 깨진다
 *      (`urshop-card-unify.test.ts` 가 이 배선을 고정한다).
 */
/**
 * 🚩 `flags` — 이 카드가 **그 화면에서만** 갖는 한 줄(2026-09-03, 위시리스트 안 B).
 *   찜 목록의 "↓ 4,200원 내림" · "3일 남음" 이 여기로 들어온다. 홈은 안 넘기므로 출력 불변.
 *   ⚠️ 사진 위가 아니라 **본문 맨 위**다 — 2026-08-31 대표 지시("할인율이 사진 안으로 들어가면
 *      안돼")와 같은 이유로, 사진은 상품을 보여주는 자리이지 배지를 얹는 자리가 아니다.
 */
function GroupBuyFeedCard({ p, aboveFold = false, fcfs, imgWidth = 200, userLoc, to, flags, hideWishlist = false, titleNode, overlayExtra, className = '' }: { p: FeedCardProduct; aboveFold?: boolean; fcfs?: FcfsInfo; imgWidth?: number; userLoc?: { lat: number; lng: number } | null; to?: string; flags?: ReactNode; hideWishlist?: boolean; titleNode?: ReactNode; overlayExtra?: ReactNode; className?: string }) {
  // 🛡️ 2026-05-22 Phase 2 (100% 영구): hover / touch 즉시 prefetch → 클릭 시 0ms.
  const prefetch = usePrefetchGroupBuyProduct()

  // 🛡️ 2026-05-27 (loading P0): 모바일 viewport prefetch — touch 보다 1-2초 빠름.
  //   IntersectionObserver 로 카드가 viewport 에 들어오면 자동 prefetch.
  //   효과: 사용자가 스크롤로 카드를 보기만 해도 detail 데이터 미리 받아두기 → 클릭 시 0ms.
  //   aboveFold 카드는 즉시 prefetch (observer 없이) — 메인 페이지 진입 시 즉시.
  const linkRef = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    if (aboveFold) {
      /**
       * ⏳ 2026-08-27 (대표 승인 — 홈 첫 화면 요청 경합): **미루기이지 제거가 아니다.**
       *   맨 위 카드들은 observer 없이 마운트 즉시 prefetch 했는데, 실측상 그게
       *   `/api/sections`·`/api/banners`(=지금 화면에 필요한 것)와 **같은 순간**에 나가
       *   대역을 다퉜다(PC 1440 에서 카드 6장 → XHR 6개 + 상세 청크 4개가 2,488ms 에 동시 발사).
       *   사용자가 카드를 읽고 누르기까지는 최소 1~2초가 걸리므로, 첫 화면을 다 그린 뒤로
       *   미뤄도 **"클릭 시 0ms"** 라는 이 prefetch 의 목적은 그대로 달성된다.
       *   ⚠️ 지우면 안 된다 — 지우는 순간 카드 클릭이 fetch 워터폴이 된다(잠금표가 지키는 성질).
       */
      const run = () => { prefetch(p.id); prefetchDetailChunk() }
      if (typeof requestIdleCallback === 'function') {
        const h = requestIdleCallback(run, { timeout: 2500 })
        return () => cancelIdleCallback?.(h)
      }
      const t = setTimeout(run, 300)
      return () => clearTimeout(t)
    }
    const el = linkRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            prefetch(p.id)
            prefetchDetailChunk()
            obs.disconnect()
            break
          }
        }
      },
      // 🛡️ 2026-05-27 (트래픽 절감): 200px → 100px. 익명/짧은 체류 사용자가 안 본 카드 prefetch 회피.
      //   100px = 모바일 약 화면 1/6, 일반 스크롤 속도에서 충분히 미리 받음.
      { rootMargin: '100px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [aboveFold, p.id, prefetch])

  // 🛡️ 2026-05-21: brand 정보 — gift_catalog (gc_*) 우선 → products → 없음.
  const brandName = p.brand_name || p.gc_brand_name || null
  const brandIcon = p.brand_icon_url || p.gc_brand_icon_url || null
  // 카테고리도 동일 — voucher 면 gc.goods_type_detail 사용.
  const rawCategory = p.category && p.category !== 'voucher' ? p.category : (p.gc_goods_type_detail || p.category || 'etc_voucher')
  const cat = dealCategoryMeta(rawCategory)
  const price = p.current_price ?? p.price ?? 0
  const originalPrice = p.original_price ?? 0
  // 💸 할인율 — 🐛 2026-08-19 (대표 신고 "할인율도 나타나야 할 것 같다"): 이전엔 `p.discount_rate ?? 계산`
  //   이라 서버가 **0 을 내려주면**(컬럼 기본값 0) `??` 가 그 0 을 채택해 계산식에 못 갔다 →
  //   38,000 → 30,100 처럼 명백한 할인에도 pill 이 안 떴다. 둘 중 **큰 값**을 쓴다.
  const declaredDiscount = Number(p.discount_rate) || 0
  const computedDiscount = originalPrice > price && originalPrice > 0
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : 0
  const discount = Math.max(declaredDiscount, computedDiscount)
  const rating = p.avg_rating ?? 0
  const reviewCount = p.review_count ?? 0
  const soldCount = p.sold_count ?? 0
  /**
   * 💰 단위 — 교환권(deal_only=1)은 '딜'. 이전엔 카드가 '원'을 하드코딩해서 같은 교환권이
   *   유어샵 핀에서는 '원', /vouchers 목록에서는 '딜' 로 보였다.
   *   ⚠️ `formatPrice`(@/utils/currency)를 쓰지 않는다 — 그 모듈은 홈이 안 쓰는
   *      `app-utils-deferred` 청크에 있어서, 여기서 정적 import 하면 **홈 첫 화면이
   *      그 청크를 통째로 받는다**(`app-utils-diet.test.ts` 가 CI 에서 잡았다).
   *      KRW 출력은 `formatPrice` 와 글자까지 동일하고, 다국어 통화는 이 카드가 원래 안 했다.
   */
  const unitLabel = Number(p.deal_only) === 1 ? ' 딜' : '원'
  // 📍 2026-07-16 (대표 — PC 카드도 주소·거리, 모바일처럼): 주소 축약(시/구/동) + 현위치 거리(km, userLoc 있을 때).
  const addrShort = (p.restaurant_address || '').trim().split(/\s+/).slice(0, 3).join(' ')
  const distKm = (() => {
    if (!userLoc || p.restaurant_lat == null || p.restaurant_lng == null) return null
    const la = Number(p.restaurant_lat), ln = Number(p.restaurant_lng)
    if (!Number.isFinite(la) || !Number.isFinite(ln)) return null
    const toRad = (d: number) => (d * Math.PI) / 180
    const dLat = toRad(la - userLoc.lat), dLng = toRad(ln - userLoc.lng)
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(userLoc.lat)) * Math.cos(toRad(la)) * Math.sin(dLng / 2) ** 2
    const km = 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
    if (km >= 10) return null // 📍 2026-07-19 (대표 UI v2 P1): 10km+ 는 km 대신 지역명(addrShort) 우선
    return km < 1 ? `${Math.round(km * 10) / 10}` : `${Math.round(km)}`
  })()
  const remaining = timeRemaining(p.expires_at)
  const isUrgent = remaining && (remaining.includes('시간') || remaining.includes('분'))
  // 🎨 대표색은 **사진 자리 플레이스홀더**로만 쓴다(2026-08-27 흰 카드 통일).
  //   ⚠️ 2026-09-03: 여기 남아 있던 `cardGradient(cardColor)` 는 **참조 0인 죽은 계산**이었다
  //      — 흰 카드로 바꾸면서 소비처가 다 사라졌는데 호출만 남아 카드마다 매 렌더 돌고 있었다.
  const [cardColor, setCardColor] = useState<string | null>(p.dominant_color || null)
  /**
   * 🎨 2026-08-27 (대표 지시 — "첫번째 형태의 이용권 ui로 통일돼야 해"): 카드 룩이 **두 벌**이었다.
   *   편성 섹션(`HomeSections`)은 흰 카드(사진 아래 검은 글자), 동네 딜 피드는 모바일에서
   *   **대표색 그라데이션 카드**(사진 위에 글자가 얹히고 카드 배경이 상품 색으로 물듦).
   *   같은 화면 위아래에 다른 카드가 놓이니 한 서비스로 안 보였다.
   *   ⇒ 흰 카드 하나로 고정한다. 이전엔 `pc` 플래그가 이 둘을 갈랐다(그래서 `HomeSections` 가
   *     룩을 얻으려고 `pc` 를 하드코딩으로 넘기고 있었다 — 그 부작용이 이미지 폭 2~3배 과다였다).
   *   ⚠️ 대표색(`grad`)은 **사진 자리 placeholder** 로만 남는다(로딩 중 회색 대신 상품색).
   */
  const cSub = 'text-gray-500 dark:text-gray-400'
  const cText = 'text-gray-900 dark:text-white'
  const cAccent = 'text-brand-text'

  return (
    <Link
      ref={linkRef}
      // 🏨 2026-07-20 (숙소 상세 SSOT): 숙소 카드는 객실·날짜 예약이 있는 /stays/:id 로 —
      //   목적지는 canonicalDetailPath(라우팅 SSOT) 위임(그 외 카테고리는 기존 /group-buy/:id 동일).
      to={to ?? canonicalDetailPath(p) ?? `/group-buy/${p.id}`}
      onMouseEnter={() => { prefetch(p.id); prefetchDetailChunk() }}
      onTouchStart={() => { prefetch(p.id); prefetchDetailChunk() }}
      onFocus={() => { prefetch(p.id); prefetchDetailChunk() }}
      // 🧹 2026-08-19 (대표 신고 — "그루폰처럼 테두리를 없애줘. AI가 만든 티가 나"):
      //   **테두리·카드 배경·박스 그림자**를 걷어낸다. 그루폰 카드는 컨테이너가 아니라
      //   [둥근 사진] + 그 아래 맨 텍스트다 — 흰 패널이 이미 배경을 맡고 있어 박스가 한 겹 더 필요 없다.
      //   (2026-08-27: 모바일만 남아 있던 대표색 카드도 여기로 통일 — 대표 "첫번째 형태로 통일".)
      className={`block group active:scale-[0.98] flex flex-col ${className}`}
    >
      {/* 🖼️ 2026-08-19 (대표 시안 — 그루폰): 이미지 영역을 `DealCardMedia`(SSOT)로 교체 —
          hover 좌우 화살표 캐러셀 + 도트. 홈 섹션 카드도 **같은 컴포넌트**를 써서 두 카드가
          갈리지 않는다. 잠금 계약(aboveFold eager/fetchPriority·fade-in·대표색 추출)은 그대로 승계. */}
      <DealCardMedia
        cover={p.image_url}
        images={p.images}
        alt={p.name || cat.label}
        eager={aboveFold}
        /* 🐘 2026-08-27 (대표 신고 — "메인 로딩 너무 느려, 가까운 동네 딜 특히"): 여기가 `pc ? 400 : 300`
           이었다. `pc` 는 **카드 룩**(그라데이션·글자색) 플래그인데 이미지 해상도까지 겸하고 있었고,
           `HomeSections` 가 룩을 위해 `pc` 를 **하드코딩 true** 로 넘기는 바람에 모바일·태블릿도
           PC용 큰 사진을 받았다. 라이브 실측(표시폭 대비):

             모바일 390  표시 175 × dpr3 = 필요 525  →  받음 800~1200  (1.5~2.3배)
             태블릿 810  표시 175 × dpr2 = 필요 350  →  받음 800       (2.3배)
             PC   1440  표시 322 × dpr1 = 필요 322  →  받음 400       (1.2배, 적정)

           `cfSrcSet` 은 x-디스크립터(1x/2x/3x)라 **base 가 곧 1x CSS 폭**이어야 한다 — base 가
           표시폭보다 크면 그 배수가 3x 에서 그대로 증폭된다(400 → 3x 1200).
           ⇒ 해상도는 **레이아웃 열수**를 아는 부모가 정한다(`imgWidth`). lg+ 4열=322 → 400,
             그 미만(모바일 2열 · 태블릿 4열)=175~190 → 200. 둘 다 필요폭의 1.1~1.2배. */
        width={imgWidth}
        aspectClass="aspect-[4/3]"
        /* 🧹 2026-08-19: 카드 박스가 사라졌으니 **사진 자신이** 모서리를 갖는다(그루폰과 동일). */
        className="rounded-xl bg-gray-100 dark:bg-[#222225]"
        fallback={<cat.Icon className="w-8 h-8 text-gray-400 opacity-60" aria-hidden="true" />}
        /**
         * 🎨 대표색 백필 — **결과가 달라질 때만** 돌린다(2026-08-27 부팅 프로파일).
         *   `extractDominantColor` 는 `drawImage`+`getImageData` 라 GPU→CPU 리드백을 강제한다.
         *   예전엔 서버가 이미 색을 줬어도(=아래 두 분기가 전부 no-op) **일단 뽑고 나서** 버렸다.
         *   그리고 그 리드백이 사진 `onLoad` 안, 즉 **첫 화면 그리는 한복판**에서 동기로 돌았다.
         *   ⇒ ① 쓸 데가 없으면 아예 안 뽑고 ② 뽑아야 할 때도 한가할 때로 미룬다.
         *      기능은 그대로다 — 색은 여전히 뽑히고 서버에도 보고된다(느려질 뿐 안 사라진다).
         */
        onCoverLoad={(el) => {
          if (cardColor && p.dominant_color) return // 둘 다 이미 있음 → 뽑아도 버릴 값
          const run = () => {
            const color = extractDominantColor(el)
            if (!color) return
            if (!cardColor) setCardColor(color)
            if (!p.dominant_color) reportDominantColor(p.id, color)
          }
          if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 2000 })
          else setTimeout(run, 0)
        }}
        overlay={
          <>
            {/* 마감 임박 배지 (시간/분 단위면 좌상단 빨강) */}
            {isUrgent && (
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-brand text-[10px] font-extrabold text-white shadow-sm z-[2]">
                {remaining}
              </span>
            )}
            {/* 🎯 추첨 응모 배지 — 💗 2026-08-19 우상단을 찜 하트에 내주고 **좌상단**으로 이동
                (마감임박 배지가 있으면 그 아래). 겹치면 둘 다 못 읽는다. */}
            {fcfs && <FcfsBadge info={fcfs} variant="overlay" className={`absolute ${isUrgent ? 'top-9' : 'top-2'} left-2 z-[2]`} />}
            {/* 💗 찜 — 그루폰 카드 우상단 하트. hover 시 나타나고(찜된 건 항상 보임) 누르면 통 튄다. */}
            {/* 🧷 `hideWishlist` — 핀 고르기 화면은 이 자리에 '추가' 버튼이 온다(둘이 겹치면 하트가 묻힌다).
                기본값 false 라 홈·찜·유어샵은 출력 불변. */}
            {!hideWishlist && <WishlistHeart productId={p.id} className="absolute top-2 right-2 z-[3]" />}
            {overlayExtra}
          </>
        }
      />

      {/* 🛍️ 2026-08-19 (대표 시안 — 그루폰 카드): 정보 위계를 그루폰과 같게 재배열.
          [머천트(작은 회색)] → [제목 2줄] → [주소 · 거리] → [★평점 (구매수)] → [정가취소선 · 판매가 · 할인 pill]
          이전엔 정가가 제목 **위**에 떠 있고 가격이 중간에 있어, 카드마다 눈이 가는 자리가 달랐다. */}
      {/* 🧹 PC 는 카드 박스가 없으므로 좌우 패딩도 0 — 사진 왼쪽 끝과 글자가 딱 맞아야 그루폰처럼 보인다. */}
      <div className="pt-2">
        {flags}
        {/* [시안 B] 08-19 그루폰 5줄 위계 유지 — 배지만 사진 위로 */}
        {(p.restaurant_name || brandName || p.onnuri_merchant) && (
          <p className={`flex items-center gap-1 text-[11px] leading-none mb-0.5 ${cSub}`}>
            <span className="truncate">{p.restaurant_name || brandName}</span>
            {/* 🏪 온누리 가맹 — B2G 상권 사업의 약속("온누리 사용 가능 표시").
                2026-07-05 에 이 필드가 생겼는데 **상권관(`/local/:code`)의 자체 카드에만** 그려졌다.
                같은 딜이 홈·검색·유어샵에 뜰 땐 표시가 사라졌다 — 카드가 한 벌이 아니어서 생긴 누락.
                이제 카드 SSOT 가 그리므로 그 딜이 어디에 뜨든 따라간다. */}
            {p.onnuri_merchant && (
              <span className="shrink-0 px-1 py-[1px] rounded bg-brand-tint text-brand-text text-[9px] font-bold">온누리</span>
            )}
          </p>
        )}
        <p className={`text-[13.5px] font-bold line-clamp-2 leading-tight ${cText}`}>
          {titleNode ?? stripStorePrefix(p.name, p.restaurant_name)}
        </p>
        {(addrShort || distKm != null) && (
          <p className={`flex items-center justify-between gap-2 mt-0.5 text-[11px] min-w-0 ${cSub}`}>
            <span className="truncate">{addrShort}</span>
            {distKm != null && <span className="shrink-0 whitespace-nowrap">{distKm}km</span>}
          </p>
        )}
        {rating > 0 && (
          <p className={`flex items-center gap-1.5 mt-0.5 text-[11px] ${cSub}`}>
            <StarRating value={rating} />
            <span className={`font-bold ${cText}`}>{rating.toFixed(1)}</span>
            {reviewCount > 0 && <span>({formatNumber(reviewCount)})</span>}
          </p>
        )}

        {/* 💰 가격 — 쿠팡식 2줄. [할인율(강조) 정가취소선] / [판매가]
            ① 할인율을 사진 위에 올리지 않는다(사진을 가린다).
            ② 할인율은 커머스에서 가장 강한 신호이므로 **로즈 굵게**로 세운다.
            ③ 정가와 판매가를 줄로 나누면 6자리 가격(119,000원)에서도 줄이 안 깨진다. */}
        <div className="mt-1">
          {(discount > 0 || (originalPrice > price && originalPrice > 0)) && (
            <p className="flex items-baseline gap-1 leading-none">
              {discount > 0 && <span className="text-[12.5px] font-extrabold text-brand">{discount}%</span>}
              {originalPrice > price && originalPrice > 0 && (
                <span className={`text-[11.5px] line-through ${cSub}`}>{formatNumber(originalPrice)}{unitLabel}</span>
              )}
            </p>
          )}
          <p className="flex items-baseline gap-1 mt-0.5 leading-none">
            <span className={`text-[17px] font-extrabold tracking-tight ${cText}`}>{formatNumber(price)}{unitLabel}</span>
            {p.category === 'stay_voucher' && price > 0 && (
              <span className={`text-[11px] font-semibold ${cSub}`}>/1박~</span>
            )}
          </p>
        </div>
      </div>
    </Link>
  )
}

export default memo(GroupBuyFeedCard)
