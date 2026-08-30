import { useEffect, useState } from 'react'
// 🏁 2026-06-26 (대표 결정 — "추천템은 사업자 유어샵에선 숨김"): 사업자 = 본인 상품이 주인공.
//   추천 핀(CuratorPinsSection) 섹션 제거 → 추천 적립 동선은 소개 콘솔(/creator)에서 유지.
//   (일반 유저 유어샵(CuratorPage)은 추천템이 메인이라 그대로.)
// 🏁 2026-06-26 (대표 — "상품·이용권 모두 전체 등록 페이지로"): 얄팍한 빠른등록 모달(QuickProductModal) 제거 →
//   등록은 정식 풀페이지(/seller/products/new · /seller/meal-voucher/new)로. (lazy/Suspense 도 미사용→제거)
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { useTheme } from '@/shared/stores/useTheme'
import { Search, X } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import SEO from '@/components/SEO'
// 🗑️ 2026-07-07 라이브커머스 제거: StreamCard/VideosTab import 제거.
import VouchersTab from './seller-public/VouchersTab'
// 🏁 2026-06-25 (대표 "통일"): 사업자 유어샵 헤더를 canonical CuratorHeader 로 — ProfileHeader 폐기(헤더 1개).
import CuratorHeader from './curator-page/CuratorHeader'
import type { CuratorProfile } from '@/features/curator/api/curator-api'
// 🏁 2026-06-25 (대표 "카드 1종"): 내 상품도 표준 BrowseProductCard(★평점·판매수 내장) — EditorialProductCard 폐기.
import BrowseProductCard from '@/pages/browse/BrowseProductCard'
import type { Product as BrowseProduct } from '@/pages/browse/types'
import { seededColor } from '@/utils/card-gradient'
import InfoTab from './seller-public/InfoTab'
import FeaturedCard from './seller-public/FeaturedCard'
import { getThemeTokens } from './seller-public/theme'
import BrandLoader from '@/components/brand/BrandLoader'
import type { Seller, Product } from './seller-public/types'
import { fetchSellerPublicShared } from './seller-public/seller-public-fetch'

// 🛡️ 2026-05-02: TD-018 분할 — types / FollowButton / StreamCard 를
//   ./seller-public/ 디렉토리로 추출.
// 🛡️ 2026-05-07: TD-018 추가 분할 — ProfileHeader / InfoTab / theme 추출 (632→<350 lines).

interface SellerPublicPageProps {
  /** 🛡️ 2026-05-25 (C 옵션 URL 통합): 외부 호출 시 sellerId 직접 전달 가능.
   *  CuratorPage 가 /u/:handle 진입 후 linked_seller 매칭되면 본 페이지를 직접 render
   *  (redirect 없이) → URL 통합. 미지정 시 useParams 사용 (legacy /profile/:sellerId 호환). */
  sellerIdOverride?: string
  /** 🏁 2026-06-25 (대표 "통일"): CuratorPage(/u/{handle})가 내려주는 큐레이터 정체성.
   *  사업자 유어샵도 canonical CuratorHeader 를 렌더 → 헤더 컴포넌트 1개로 통일(ProfileHeader 폐기).
   *  배너/이름 등은 curator 우선·seller 폴백으로 병합(저장 위치 분산 흡수). 비-/u/ 진입은 undefined. */
  curator?: CuratorProfile | null
  /** 🏁 2026-06-26 [UNLOCK_LOADING] (대표 — 로딩 워터폴 제거): CuratorPage 가 가진 linked_seller.id(숫자).
   *  넘기면 셀러 /public 응답을 기다리지 않고 상품 fetch 를 병렬로 시작(RTT 1개 절감). */
  sellerNumericId?: number
  /** 🔑 2026-07-07 (대표 — "복잡하게 꼬여있다"): 유어샵 소유권 단일화. `/u/{handle}` 의 주인은 **로그인 유저**
   *  (user_id === curator.id)이며 CuratorPage 가 이미 그걸 안다. 그 신호를 내려주면, 별도 seller_token 이
   *  없어도 소유자에게 편집 뷰를 보인다(프로필 편집은 헤더가 소비자 API `/api/curator/me/profile` 로 처리).
   *  seller_token 은 이제 셀러 대시보드(/seller/*) 접근용일 뿐, 유어샵 뷰를 가르지 않는다. */
  ownerOverride?: boolean
  /** 🚀 2026-07-11 (1-RTT): CuratorPage 가 서버 동봉(linked_seller_public)으로 받은 셀러 공개 페이로드.
   *  일치 검증 후 동기 소비 → 셀러 /public fetch 자체를 생략(구캐시/미동봉이면 기존 fetch 폴백). */
  sellerSeed?: Record<string, unknown> | null
}

// 🚑 2026-07-10 [UNLOCK_LOADING] (로딩 전수조사): SSR 시드(__SSR_INITIAL_SELLER__)를 동기(useState 초기값)
//   소비용 헬퍼로 추출 + **정체성(id/username) 일치 검증 추가** — 기존 effect 소비는 검증 없이 setSeller 라
//   SPA 로 다른 셀러 페이지 이동 시 이전 하드로드 시드를 오소비할 수 있었음(잘못된 셀러 잔상 + 메인 fetch skip).
//   일치할 때만 시드 → 로더 프레임 0, 불일치/부재면 기존 fetch fallback.
function readSellerSeed(sellerId: string | undefined): Seller | null {
  if (!sellerId || typeof document === 'undefined') return null
  try {
    const el = document.getElementById('__SSR_INITIAL_SELLER__')
    if (!el?.textContent) return null
    const parsed = JSON.parse(el.textContent)
    const d = parsed?.success ? parsed.data : null
    if (!d?.id) return null
    const key = String(sellerId).toLowerCase().replace(/^@/, '')
    const ok = String(d.id) === String(sellerId) || (d.username && String(d.username).toLowerCase() === key)
    return ok ? (d as Seller) : null
  } catch { return null }
}

// 🚀 2026-07-11 (1-RTT): 서버 동봉 시드(prop)도 동일한 정체성 검증 후 채택 — curator 응답이 준
//   linked_seller.username 과 같은 응답에서 온 페이로드라 사실상 항상 일치하나, 방어적으로 검증.
function matchSellerSeedProp(seed: Record<string, unknown> | null | undefined, sellerId: string | undefined): Seller | null {
  if (!seed || !sellerId) return null
  const d = seed as { id?: number | string; username?: string }
  if (!d.id) return null
  const key = String(sellerId).toLowerCase().replace(/^@/, '')
  const ok = String(d.id) === String(sellerId) || (d.username && String(d.username).toLowerCase() === key)
  return ok ? (seed as unknown as Seller) : null
}

export default function SellerPublicPage({ sellerIdOverride, curator, sellerNumericId, ownerOverride, sellerSeed }: SellerPublicPageProps = {}) {
  const { t } = useTranslation()
  const params = useParams<{ sellerId: string }>()
  const rawParam = sellerIdOverride ?? params.sellerId
  const navigate = useNavigate()
  // sellerId는 숫자 ID 또는 slug/username
  const sellerId = rawParam
  // 🚑 2026-07-10 [UNLOCK_LOADING]: SSR 시드 동기 소비(일치 검증 포함) — 시드 있으면 로더 프레임 0.
  // 🚀 2026-07-11: 서버 동봉 시드(prop, /u/ 사업자 경로)도 동기 소비 — 둘 중 있는 쪽으로 즉시 페인트.
  const [seller, setSeller] = useState<Seller | null>(() => readSellerSeed(sellerId) ?? matchSellerSeedProp(sellerSeed, sellerId))
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(seller == null)

  // 🔗 2026-06-21 (대표 승인): 레거시 셀러 공개 URL(/profile·/s) standalone 진입을 연결된 유저 유어샵
  //   (/u/{handle})으로 통일. CuratorPage 임베드(sellerIdOverride)면 이미 /u/ 라 skip, 연결 핸들 없는
  //   셀러-only 계정은 그대로 이 페이지 렌더(폴백). (탭 state 는 2026-06-25 탭→섹션 전환으로 제거)
  const curatorHandle = (seller as { curator_handle?: string | null } | null)?.curator_handle || null
  useEffect(() => {
    if (sellerIdOverride) return                 // CuratorPage 임베드 — 이미 /u/{handle}
    if (!curatorHandle) return                   // 셀러-only(핸들 없음) — 기존 페이지 유지(폴백)
    const h = curatorHandle.toLowerCase()
    if (h === 'me') return
    if (rawParam && rawParam.toLowerCase().replace(/^@/, '') === h) return  // 이미 핸들 = 루프 방지
    navigate(`/u/${encodeURIComponent(curatorHandle)}`, { replace: true })
  }, [curatorHandle, sellerIdOverride, rawParam, navigate])
  // 🔍 2026-06-16 유어샵 시안: 상품 탭 검색 (이름 필터).
  const [shopQuery, setShopQuery] = useState('')
  // 🏁 2026-06-26 (대표 결정 — "상품·이용권 각자 전체 등록 페이지로"): 등록 종류 선택 시트(상품/이용권).
  //   둘 다 정식 등록 풀페이지로 네비게이트(상품=/seller/products/new, 이용권=/seller/meal-voucher/new).
  const [showAddSheet, setShowAddSheet] = useState(false)
  // 🏁 2026-06-25 (대표 "통일"): canonical CuratorHeader 의 인라인 편집 반영(낙관적). curator 우선·seller 폴백.
  const [curatorEdits, setCuratorEdits] = useState<Partial<CuratorProfile>>({})
  // 🧹 2026-07-20 (대표 — "추천템 필요없음"): 사업자 유어샵 = 본인 상품이 주인공(2026-06-18 타겟 포지셔닝).
  //   하단 추천(핀) opt-in 섹션 + 토글 제거. (추천 적립 동선은 소개 콘솔/CuratorEarningsPage 에서 유지.)
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); toast.success(t('seller.linkCopiedToast', { defaultValue: '링크가 복사되었어요' })) } catch { /* ignore */ }
  }

  // 셀러 본인인지 확인 (편집 버튼 표시용) — seller 로드 후 id/username 비교
  // 🛡️ 2026-04-30: 듀얼 세션 (user_type='user' + seller_token 동시 보유) 도 owner 인정.
  // 🛡️ 2026-05-16: storedSellerId 가 username 으로 저장된 경우도 매칭 (id vs username 모두 비교)
  const storedSellerId = localStorage.getItem('seller_id')
  const sellerToken = localStorage.getItem('seller_token')
  // 🔑 2026-07-07 소유권 단일화: seller_token 기반(레거시 /profile·/s standalone 진입 폴백) ∪ 유어샵
  //   소유자 신호(ownerOverride — CuratorPage 의 user_id===curator.id). /u/{handle} 소유자는 seller_token
  //   이 없어도(카카오 소비자 로그인만) 편집 뷰를 본다. seller_token 은 아래 셀러-API 편집에만 별도로 필요.
  const tokenOwner = !!sellerToken && !!seller && (
    String(seller.id) === storedSellerId ||
    String(seller.username || '') === storedSellerId ||
    String(seller.username || '') === rawParam  // 본인이 본인 URL 로 진입한 경우
  )
  const isOwner = !!ownerOverride || tokenOwner
  // 🛡️ 2026-05-16: DEV 디버그 — isOwner 가 false 일 때 콘솔에 이유 표시 (운영자가 진단 용이)
  if (typeof window !== 'undefined' && import.meta.env.DEV && seller && !isOwner) {
    console.log('[SellerPublicPage] isOwner=false:', {
      hasToken: !!sellerToken,
      sellerIdInDb: seller.id,
      sellerUsernameInDb: seller.username,
      storedSellerId,
      rawParam,
    })
  }

  // 🎨 2026-06-17 (#6 유어샵 통일): 큐레이터 유어샵과 동일한 '방문자 미리보기' — 본인이 남이 보는 화면 그대로 확인.
  //   previewAsVisitor=false 기본이라 ownerView===isOwner → 기존 동작 불변(편집 어포던스만 ownerView 로 게이트).
  const [previewAsVisitor, setPreviewAsVisitor] = useState(false)
  const ownerView = isOwner && !previewAsVisitor

  // ── 인라인 편집 상태 ──
  // 🧹 2026-07-20 (대표 — "카카오 채팅 링크 추가 없어도 됨"): InfoTab 카카오 인라인 편집 machinery
  //   (editingField/editKakao/saving state + startEdit/saveEdit)·canSellerEdit 제거. 연락처 편집은
  //   셀러 대시보드 전담 → 유어샵 InfoTab 은 표시 전용. (bio/SNS 는 CuratorHeader 가 이미 편집 전담.)
  // 전역 테마 토글 연동 (useTheme 스토어)
  const { applied } = useTheme()
  const isDark = applied === 'dark'
  const T = getThemeTokens(isDark)

  useEffect(() => {
    if (!sellerId) return
    setLoading(true)

    // 🛡️ 2026-05-27 (loading P0): SSR inject 즉시 사용 + 중복 fetch 제거 (영구).
    //   기존: SSR setSeller 후에도 sellers API axios fetch 재호출 → 중복 RTT 200-500ms
    //   수정: SSR data 있으면 메인 fetch skip, products/streams/shorts 만 background fetch.
    //   효과: 유어샵 페이지 첫 paint + 메인 fetch 0 (SSR hit 시).
    // 🚑 2026-07-10: 소비를 readSellerSeed(정체성 일치 검증)로 — 다른 셀러의 잔존 시드 오소비 차단.
    //   (동기 초기값과 같은 헬퍼 — mount 시엔 이미 시드 반영돼 setLoading(true→false)가 배치로 상쇄됨.)
    // 🚀 2026-07-11: 서버 동봉 시드(prop)도 동급 — 있으면 셀러 /public fetch 자체를 생략(1-RTT 완성).
    const initialSellerData = readSellerSeed(sellerId) ?? matchSellerSeedProp(sellerSeed, sellerId)
    if (initialSellerData) {
      setSeller(initialSellerData)
      setLoading(false)
    }

    // 🛡️ 셀러 상품 background fetch(비차단). 로딩 속도는 prewarm(products)로 해결(cold D1 제거).
    //   🧹 2026-07-20 (유어샵 전수조사): 라이브/쇼츠 fetch 제거 — 영구중단(LIVE_COMMERCE_SUSPENDED)이라
    //   상품만 필요. streams/shorts 배선·30초 폴링·관련 state/타입 통째 제거(도달불가 코드 청소).
    const fetchSubData = (numericId: number) => {
      // 🩸 2026-08-26: limit=20 하드코딩이라 **21개째 이용권부터 아무 표시 없이 사라졌다**.
      //   유어샵은 진열대다 — 진열대에서 물건이 조용히 없어지는 건 빈 화면보다 나쁘다(사장님은
      //   올렸다고 믿는다). 100 으로 올린다. 그 이상은 '더 보기'가 필요하고, 그건 별도 작업.
      api.get(`/api/products?seller_id=${numericId}&limit=100`)
        .then(r => setProducts(r.data.data || []))
        .catch(() => { /* graceful */ })
    }

    if (initialSellerData?.id) {
      // SSR hit → 메인 fetch 스킵, sub-data 만 background
      fetchSubData(initialSellerData.id)
      return
    }

    // 🏁 2026-06-26 [UNLOCK_LOADING] (대표 — 로딩 워터폴 제거): /u/ 사업자는 SSR 이 셀러를 주입 안 해
    //   '셀러 /public → 상품' 2연속 대기였음. linked_seller.id(sellerNumericId)를 알면 상품 fetch 를
    //   셀러 fetch 와 병렬로 시작 → 내 상품 그리드가 셀러 응답을 안 기다림(RTT 1개 절감).
    let subFetched = false
    if (sellerNumericId) { fetchSubData(sellerNumericId); subFetched = true }

    // SSR miss → 메인 fetch (헤더/정보용). sub-data 는 병렬 시작 안 됐을 때만 여기서.
    // 🚑 2026-07-10 [UNLOCK_LOADING]: 공유 in-flight fetch — CuratorPage 가 linked_seller 확인 즉시
    //   warm 해둔 요청을 이어받아 [curator → 청크 → seller] 직렬을 [curator → max(청크, seller)]로 단축.
    fetchSellerPublicShared(sellerId).then(raw => {
      const sellerData = raw as Seller | null
      if (!sellerData) { setSeller(null); setLoading(false); return }
      setSeller(sellerData)
      setLoading(false)
      if (!subFetched) fetchSubData(sellerData.id)
    }).catch(() => { setSeller(null); setLoading(false) })
  }, [sellerId, sellerNumericId])

  // 🧹 2026-07-20 (유어샵 전수조사): 라이브커머스 영구중단으로 '실시간 라이브 감지 30초 폴링' effect 제거
  //   (LIVE_COMMERCE_SUSPENDED 조기반환이라 원래 미실행 — 도달불가 코드 청소).

  // 🏁 2026-06-25 (대표 신고 — 로딩 김): 헤더 정체성(curator 우선·seller 폴백) 객체. seller 로드 전에도
  //   curator 만으로 헤더를 즉시 렌더 → /u/ 사업자 진입 시 콜드 seller fetch 동안 빈 스피너 대신 헤더 표시.
  const headerCurator = {
    id: curator?.id ?? seller?.id ?? 0,
    handle: curator?.handle ?? seller?.username ?? String(seller?.id ?? ''),
    name: (curatorEdits.name ?? curator?.name) || seller?.name || '',
    bio: curatorEdits.bio ?? curator?.bio ?? seller?.bio ?? null,
    profile_image: curatorEdits.profile_image ?? curator?.profile_image ?? seller?.profile_image ?? null,
    banner_url: (curatorEdits.banner_url ?? curator?.banner_url) || seller?.banner_url || null,
    headline: curatorEdits.headline ?? curator?.headline ?? null,
    accent: curatorEdits.accent ?? curator?.accent ?? null,
    youtube_url: curatorEdits.youtube_url ?? curator?.youtube_url ?? seller?.sns_youtube ?? null,
    instagram_url: curatorEdits.instagram_url ?? curator?.instagram_url ?? seller?.sns_instagram ?? null,
    tiktok_url: curatorEdits.tiktok_url ?? curator?.tiktok_url ?? null,
  }

  // 🖼️ 2026-07-01 (대표 지시 — "콜드 로딩은 풀로, 2~3가지 로딩화면 절대 금지"): 유어샵(/u/)·셀러(/profile)
  //   모두 단일 URDEAL 브랜드 로더로 통일. 기존엔 curator 진입 시 헤더+스켈레톤을 그렸다가 본문 로드 후
  //   또 바뀌어, CuratorPage 쪽 로더와 합쳐 "2~3가지 로딩화면"이 튀었음. BrandLoader 하나로 준비될 때까지 유지.
  if (loading) return <BrandLoader fullScreen />

  if (!seller) return (
    <div className={`min-h-[100dvh] ${T.bg} flex flex-col items-center justify-center`}>
      <p className={T.textMuted}>{t('seller.sellerNotFound')}</p>
      <button onClick={() => navigate('/')} className="mt-3 text-sm text-brand-text font-semibold">{t('seller.goToHome')}</button>
    </div>
  )

  const mealVouchers = products.filter(p => p.category === 'meal_voucher')
  // 🛡️ 2026-05-19: '상품' 탭 — 이용권 외 일반 상품 (deal_only 교환권은 셀러가 등록 안 하므로 자동 제외).
  const shopProducts = products.filter(p => p.category !== 'meal_voucher' && Number(p.deal_only) !== 1)
  // 🎨 2026-07-07 리디자인(휑함 해소): 대표 1개를 큰 '이번 주 픽' 히어로로.
  //   featured 는 자기 섹션 그리드에서 제외(중복 방지) → 아이템 적어도 "큐레이션"으로 보이게.
  //
  // 🔄 2026-08-26 (대표 확정 — "유어샵은 사장님의 이용권들이 올라오는 곳"): 우선순위를 **뒤집었다**.
  //   종전엔 `shopProducts[0] || mealVouchers[0]` 라 일반 상품이 히어로를 무조건 선점했다. 그러면
  //   이용권만 파는 매장(대다수)은 자기 주력이 히어로에도 못 오르고 두 번째 섹션으로 밀렸다.
  //   유어샵의 주인공은 이용권이다 — 없을 때만 일반 상품이 그 자리를 대신한다.
  // 📊 2026-08-26 (대표 승인): 헤더 실적 한 줄 — 이 매장 상품들의 **실측** 평점/후기/판매.
  //   당근이 사진으로 만드는 신뢰를 우리는 실적으로 만든다. 값 없으면 헤더가 알아서 안 그린다(0 미표시).
  const headerStats = (() => {
    const rated = products.filter(p => Number(p.avg_rating) > 0)
    const rating = rated.length ? rated.reduce((a, p) => a + Number(p.avg_rating), 0) / rated.length : 0
    const reviews = products.reduce((a, p) => a + (Number(p.review_count) || 0), 0)
    const sold = products.reduce((a, p) => a + (Number(p.sold_count) || 0), 0)
    return { rating, reviews, sold }
  })()
  const featured = mealVouchers[0] || shopProducts[0] || null
  const featuredIsProduct = !mealVouchers[0] && !!shopProducts[0]
  const gridProducts = featuredIsProduct ? shopProducts.slice(1) : shopProducts
  const gridVouchers = (!featuredIsProduct && mealVouchers[0]) ? mealVouchers.slice(1) : mealVouchers

  return (
    <div className={`min-h-[100dvh] ${T.bg} pb-28`}>
      {/* 🎨 2026-06-17 유어샵 개선안(시안) 통일: 큐레이터 유어샵과 동일한 네이비 '✎ 편집 모드' 배너. theme-dual: 의도적 네이비 */}
      {ownerView && (
        <div className="sticky top-0 z-30 bg-[#141A2E] text-white px-3.5 py-2.5 text-[12.5px] font-semibold flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 min-w-0"><span className="text-[#6b7280] text-[14px] leading-none shrink-0">✎</span><span className="truncate">{t('seller.publicPage.ownerModeNotice', { defaultValue: '편집 모드 · 사진·이름·소개를 눌러 바로 수정하세요' })}</span></span>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* 🏁 2026-06-18 (사용자 결정): 유어샵에서 바로 등록 (대시보드 안 나감).
                🏁 2026-06-26 (대표 — "이용권 등록도 추가"): 단일 '+ 등록' → 상품/이용권 선택 시트. */}
            <button
              type="button"
              onClick={() => setShowAddSheet(true)}
              className="px-2.5 py-1 bg-[#6b7280] hover:bg-[#e84a2b] rounded-lg text-[11px] font-bold whitespace-nowrap"
            >
              {t('seller.publicPage.addEntry', { defaultValue: '+ 등록' })}
            </button>
            <button
              type="button"
              onClick={() => setPreviewAsVisitor(true)}
              className="px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-lg text-[11px] font-bold whitespace-nowrap"
            >
              {t('seller.publicPage.previewVisitor', { defaultValue: '👀 미리보기' })}
            </button>
            {/* 🏁 2026-06-26 (대표 결정 — '전체 설정'→'셀러 대시보드'): 라벨/목적지 정정.
                좁은 사업자정보 탭(?tab=business) 대신 대시보드 홈(/seller — 주문·정산·상품·이용권). */}
            <button
              type="button"
              onClick={() => navigate('/seller')}
              className="px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-lg text-[11px] font-bold whitespace-nowrap"
            >
              {t('seller.publicPage.sellerDashboard', { defaultValue: '셀러 대시보드' })}
            </button>
          </div>
        </div>
      )}
      {/* 🏁 2026-06-26 (대표 — "상품·이용권 각자 전체 등록 페이지로"): 등록 종류 선택 시트.
          둘 다 정식 등록 풀페이지로 — 상품=/seller/products/new(이미지·상세·옵션), 이용권=/seller/meal-voucher/new(위치·목표인원).
          (얄팍한 빠른등록 모달은 제거 — 상세이미지/옵션 없어 실제 상품에 부족.) */}
      {ownerView && showAddSheet && (
        <div className="fixed inset-0 z-[10600] flex items-end justify-center bg-black/60" onClick={() => setShowAddSheet(false)} role="presentation">
          <div
            className="w-full max-w-[430px] bg-white dark:bg-[#1A2334] rounded-t-3xl px-5 pt-5 pb-8"
            onClick={(e) => e.stopPropagation()}
            role="dialog" aria-modal="true" aria-label={t('seller.publicPage.addSheetTitle', { defaultValue: '무엇을 등록할까요?' })}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('seller.publicPage.addSheetTitle', { defaultValue: '무엇을 등록할까요?' })}</h2>
              <button onClick={() => setShowAddSheet(false)} aria-label={t('common.close', { defaultValue: '닫기' })} className="p-1 rounded-full text-gray-500 dark:text-gray-400 text-lg leading-none">✕</button>
            </div>
            <div className="space-y-2.5">
              <button
                onClick={() => { setShowAddSheet(false); navigate('/seller/products/new') }}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-gray-200 dark:border-[#2A3446] bg-gray-50 dark:bg-[#1A2334] active:scale-[0.99] transition-transform text-left"
              >
                <span className="w-11 h-11 rounded-xl bg-white dark:bg-[#222] flex items-center justify-center text-xl shrink-0">🛍️</span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-bold text-gray-900 dark:text-white">{t('seller.publicPage.addProduct', { defaultValue: '상품 등록' })}</span>
                  <span className="block text-[12px] text-gray-500 dark:text-gray-400">{t('seller.publicPage.addProductDesc', { defaultValue: '이미지·상세설명·옵션까지 정식 등록' })}</span>
                </span>
              </button>
              <button
                onClick={() => { setShowAddSheet(false); navigate('/seller/meal-voucher/new') }}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-gray-200 dark:border-[#2A3446] bg-gray-50 dark:bg-[#1A2334] active:scale-[0.99] transition-transform text-left"
              >
                <span className="w-11 h-11 rounded-xl bg-white dark:bg-[#222] flex items-center justify-center text-xl shrink-0">🎟️</span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-bold text-gray-900 dark:text-white">{t('seller.publicPage.addVoucher', { defaultValue: '이용권 등록' })}</span>
                  <span className="block text-[12px] text-gray-500 dark:text-gray-400">{t('seller.publicPage.addVoucherDesc', { defaultValue: '동네 공구·교환권 — 위치·목표인원 설정' })}</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 🎨 2026-06-17 (#6 통일): 방문자 미리보기 중 — 큐레이터 유어샵과 동일 패턴. theme-dual: 의도적 네이비 */}
      {isOwner && previewAsVisitor && (
        <div className="sticky top-0 z-40 bg-[#141A2E] text-white px-4 py-2 text-[12.5px] font-bold flex items-center justify-between gap-2">
          <span className="truncate">👀 {t('seller.publicPage.previewBanner', { defaultValue: '방문자 미리보기 — 다른 사람에게 보이는 화면이에요' })}</span>
          <button onClick={() => setPreviewAsVisitor(false)} className="shrink-0 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[11.5px] whitespace-nowrap">{t('seller.publicPage.backToEdit', { defaultValue: '편집으로 돌아가기' })}</button>
        </div>
      )}
      <SEO
        title={`${seller.name || seller.username || t('product.seller')}의 유어샵`}
        description={seller.bio || `${seller.name || seller.username || t('product.seller')} 님의 유어샵`}
        image={seller.profile_image}
        url={`/profile/${seller.username || seller.slug || seller.id}`}
        /* 🛡️ 2026-04-22: Person/Organization JSON-LD 추가 (Google 셀러 카드 노출) */
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Person',
          // 🏷️ 2026-07-01: 폐기어 정정 — "라이브 커머스 채널"(영구중단 기능) → "유어샵" (크롤러 노출 구조화 데이터)
          name: seller.name || seller.username || '유어딜 유어샵',
          description: seller.bio || `${seller.name || seller.username || ''}의 유어샵 — 상품·이용권 모음`,
          image: seller.profile_image || undefined,
          url: `https://urdeal.kr/profile/${seller.username || seller.slug || seller.id}`,
          ...((seller as any).follower_count != null && { interactionStatistic: { '@type': 'InteractionCounter', interactionType: 'https://schema.org/FollowAction', userInteractionCount: (seller as any).follower_count } }),
        }}
      />

      {/* 🏁 2026-06-25 (대표 "통일"): 사업자 유어샵도 canonical CuratorHeader (마퀴+배너 히어로+중앙 이름).
          정체성은 curator(users) 우선 · seller(sellers) 폴백으로 병합 → 어디 저장됐든 배너/이름 복구.
          소유자 인라인 편집은 CuratorHeader 가 /api/curator/me/profile 로 처리(낙관적 반영=curatorEdits). */}
      <CuratorHeader
        curator={headerCurator}
        isOwner={ownerView}
        accountType="business"
        stats={headerStats}
        onCopyLink={copyLink}
        onCuratorUpdate={(next) => setCuratorEdits((s) => ({ ...s, ...next }))}
      />

      {/* 🏁 2026-06-26 (대표 "추천템 숨김"): 사업자 유어샵 = 본인 상품 주인공 → 한 스크롤 섹션.
          순서: 내 상품 → 교환권 → 영상/라이브 → 정보. (추천 핀 섹션 제거 — 일반 유저 유어샵은 유지) */}
      <div className="ur-content-wide px-4 lg:px-8 py-5">
        {/* 🎨 2026-07-07 리디자인 3차: 컬렉션 칩 — 상품·이용권 둘 다 있을 때 섹션 점프(스크롤). */}
        {shopProducts.length > 0 && mealVouchers.length > 0 && (
          <div className="flex gap-2 mb-4 overflow-x-auto -mx-1 px-1 [&::-webkit-scrollbar]:hidden">
            {([
              { label: t('seller.publicPage.chipAll', { defaultValue: '전체' }), to: null as string | null },
              { label: t('seller.publicPage.shop', { defaultValue: '내 상품' }), to: 'ls-shop' },
              { label: t('seller.publicPage.vouchers', { defaultValue: '이용권' }), to: 'ls-vou' },
            ]).map((chip) => (
              <button
                key={chip.label}
                onClick={() => chip.to ? document.getElementById(chip.to)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="shrink-0 h-9 px-4 rounded-full border border-gray-200 dark:border-[#2A3446] bg-white dark:bg-[#1A2334] text-[13px] font-bold text-gray-700 dark:text-gray-200 active:scale-95"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}
        {/* 🎨 2026-07-07 리디자인: '이번 주 픽' 대표 상품 히어로 (상품 우선·없으면 이용권). 아이템 적어도 채워짐. */}
        {featured && (
          <div className="mb-2">
            <FeaturedCard
              product={featured}
              to={`/products/${featured.id}`}
              eyebrow={t('seller.publicPage.featuredPick', { defaultValue: '이번 주 픽' })}
            />
          </div>
        )}
        {/* ① 이용권 — 유어샵의 주인공. featured 로 뽑힌 첫 이용권은 그리드에서 제외(gridVouchers).
            🔄 2026-08-26 (대표 확정): 종전엔 '내 상품' 다음 세 번째 블록이었다. 이용권만 파는 매장이
            대다수인데 주력이 아래로 밀렸다 — 순서를 앞으로 올린다. */}
        {gridVouchers.length > 0 && (
          <section id="ls-vou" className="scroll-mt-4 pt-7">
            <h3 className="text-[16px] font-extrabold text-gray-900 dark:text-white mb-3">{t('seller.publicPage.vouchers', { defaultValue: '이용권' })} {gridVouchers.length}</h3>
            <VouchersTab mealVouchers={gridVouchers} />
          </section>
        )}

        {/* ② 내 상품 — featured 로 뽑힌 첫 상품은 그리드에서 제외(gridProducts).
            🔄 2026-08-26: '상품 0' 초대 카드는 **이용권도 0일 때만** 띄운다. 이용권을 이미 올린
            사장님에게 "첫 상품을 올려 쇼핑몰을 채워보세요"는 사실과 다른 잔소리다. */}
        {(gridProducts.length > 0 || (ownerView && shopProducts.length === 0 && mealVouchers.length === 0)) && (
          shopProducts.length === 0 ? (
            // 🎨 2026-07-07 리디자인: 밋밋한 "상품 0" 행 → "쇼핑몰을 채워보세요" 초대 카드(소유자 동기부여).
            //   내 상품이 유어샵의 주인공이라는 메시지 + 정식 등록 풀페이지로.
            <div className="mt-7 rounded-2xl border border-dashed border-gray-300 dark:border-[#2E2E2E] bg-gray-50 dark:bg-[#101010] px-5 py-7 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-[#0F151D] flex items-center justify-center">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              </div>
              <h3 className="text-[15px] font-extrabold text-gray-900 dark:text-white">{t('seller.publicPage.emptyShopTitle', { defaultValue: '첫 이용권을 올려 유어샵을 채워보세요' })}</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-gray-500 dark:text-gray-400">{t('seller.publicPage.emptyShopDesc', { defaultValue: '내 이용권이 유어샵의 주인공이에요. 등록하면 방문자에게 바로 판매되고 정산까지 이어집니다.' })}</p>
              <button
                onClick={() => navigate('/seller/products/new')}
                className="mt-4 inline-flex items-center gap-1 px-5 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-[#0F151D] text-[13px] font-bold active:scale-95"
              >
                + {t('seller.publicPage.addProduct', { defaultValue: '상품 등록' })}
              </button>
            </div>
          ) : (
            <>
            <h3 id="ls-shop" className="scroll-mt-4 text-[16px] font-extrabold text-gray-900 dark:text-white mt-7 mb-3">{t('seller.publicPage.shop', { defaultValue: '내 상품' })} {shopProducts.length}</h3>
            {/* 🔍 2026-06-16 유어샵 시안: 상품 검색 (이름 필터) — 상품 6개 이상일 때만(적으면 노이즈). */}
            {shopProducts.length >= 6 && (
            <div className="flex items-center gap-2 h-11 px-3.5 mb-4 rounded-xl border border-gray-200 dark:border-[#2A3446] bg-gray-50 dark:bg-[#1A2334]">
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <input value={shopQuery} onChange={(e) => setShopQuery(e.target.value)} placeholder="상품 이름으로 검색" className={`flex-1 min-w-0 bg-transparent outline-none text-[14px] ${T.text} placeholder:text-gray-400`} />
              {shopQuery && <button onClick={() => setShopQuery('')} aria-label="지우기" className="shrink-0 w-5 h-5 rounded-full bg-gray-300 dark:bg-[#3A3A3A] text-white flex items-center justify-center"><X className="w-3 h-3" /></button>}
            </div>
            )}
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 lg:gap-x-4 lg:gap-y-8">
              {gridProducts.filter(p => !shopQuery.trim() || p.name.toLowerCase().includes(shopQuery.trim().toLowerCase())).map(p => (
                // 🏁 2026-06-25 (대표 "카드 1종"): 추천핀과 동일한 표준 BrowseProductCard 로 통일.
                <BrowseProductCard
                  key={p.id}
                  product={{ id: p.id, name: p.name, price: p.price, current_price: p.price, original_price: p.original_price ?? undefined, discount_rate: p.discount_rate ?? 0, image_url: p.image_url || '', stock: 0, dominant_color: p.dominant_color, avg_rating: p.avg_rating, review_count: p.review_count, sold_count: p.sold_count, restaurant_name: p.restaurant_name } as BrowseProduct}
                  aboveFold={false}
                  to={`/products/${p.id}`}
                  fallbackColor={seededColor(p.id)}
                />
              ))}
            </div>
            </>
          )
        )}

        {/* 🗑️ 2026-07-07 라이브커머스 제거: 영상(VideosTab)·라이브(StreamCard) 섹션 제거. */}

        {/* 🧹 2026-07-20 (대표 — "추천템·신뢰배지 다 필요없음"): 하단 추천(핀) opt-in 섹션 + 정적 신뢰배지
            (유어딜 안전결제 / 사업자 인증 완료) 제거. 사업자 유어샵 = 본인 상품이 주인공(정체성 명료화) +
            사업자 인증은 헤더 U 씰이 이미 전담(중복 제거). 결제 안전성은 결제 단계에서 안내. */}

        {/* ⑥ 판매자 정보 — 🧾 2026-07-02 (대표 시안): "정보" 제목 카드 → 유어샵 **맨 밑** 쇼핑몰식 작은 푸터.
            콘텐츠와 넉넉히 떨어뜨려(mt-12) 진짜 페이지 하단 푸터로 읽히게. 얇은 구분선 + "MORE INFO +" 접이식. */}
        <footer className="mt-10 pt-5 border-t border-gray-100 dark:border-[#2A3446]">
          <InfoTab seller={seller} isOwner={ownerView} T={T} />
        </footer>
      </div>

      {/* 🏁 2026-06-17 (#3): 추천 핀 섹션은 홈 탭 상단으로 이동(위) — 맨 아래 매몰 제거. */}

      {/* 🛡️ 2026-05-27: OwnerDashboardFab 제거 — ProfileHeader 의 grid-2 inline 버튼 (프로필 수정 | 대시보드) 으로 통합.
          기존 floating FAB 가 상품 카드 가림 → 인라인으로 변경. */}
    </div>
  )
}
