/**
 * 🛡️ 2026-05-25 (migration 0278 + C 옵션): 큐레이터 공개 페이지 (/u/:handle).
 *
 * 모든 유저가 본인 공개 페이지 보유. 다크 테마 고정.
 *
 * 구조:
 *   - linked_seller 있으면 → /profile/{username} 으로 navigate (셀러 페이지 활용)
 *   - 일반 user → 풍부한 헤더 + 탭 (핀 / 정보)
 *
 * Phase 1+ 사용자 결정 C 옵션: URL 통합 (셀러 권한 시 자동 redirect).
 */

import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import type { CuratorPageResponse, CuratorPin } from '@/features/curator/api/curator-api'
import { fetchCuratorPage, getCuratorCache } from '@/features/curator/curator-page-cache'
import { useAuthStore } from '@/client/stores/auth.store'
// 🎫 2026-09-28 (대표 확정 s3 밀도형): 2열 격자 → 줄. 줄 카드는 `components/deal/DealRow` SSOT 를 쓴다.
import PinRow from './curator-page/PinRow'
import { SortMenu } from '@/components/ui/sort-menu'
import { usePrefetchGroupBuyProduct } from '@/hooks/queries'
import { Search, X } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import CuratorHeader from './curator-page/CuratorHeader'
import LinkshopOnboardModal from './curator-page/LinkshopOnboardModal'
import BrandLoader from '@/components/brand/BrandLoader'
import { storeAffiliateRef } from '@/utils/affiliate-track'
// 🚑 2026-07-10 [UNLOCK_LOADING]: 사업자 유어샵 워터폴 완화 — linked_seller 확인 즉시 셀러 /public 워밍
//   (SellerPublicPage lazy 청크 다운로드와 병렬). 독립 모듈이라 lazy 청크 분리 불변.
import { warmSellerPublic } from './seller-public/seller-public-fetch'
import EmptyUrShop from './curator-page/EmptyUrShop'
// 🔧 2026-09-28 (e3): OwnerEarningsStrip · PinManageList 는 `/u/me/manage`(UShopManagePage) 로 옮겨 갔다.
// 🎫 2026-09-02 (대표 확정 — 유어샵 안3 + PC 안P1): 카테고리 칩(지도 B안과 같은 그림) + PC 좌측 열 QR.
import PinCategoryChips, { pinCategory, type PinCategory } from './curator-page/PinCategoryChips'
import UShopQrCard from './curator-page/UShopQrCard'
import ShopInquiryLinks from './curator-page/ShopInquiryLinks'

// 🛡️ 2026-05-25 (C 옵션 URL 통합): linked seller 있으면 같은 페이지에서 SellerPublicPage 직접 render.
//   redirect 없음 — URL 그대로 (/u/:handle 유지). lazy chunk — 일반 user 진입 시 chunk fetch 안 함.
const SellerPublicPage = lazy(() => import('./SellerPublicPage'))
// 🔧 2026-09-28 (e3): 판매 진입 CTA · 수익 사다리도 `/u/me/manage` 로 옮겨 갔다(여기 lazy import 0).

// 🔍 2026-08-31 (대표 "유어샵 나머지"): 검색창은 **눈으로 못 훑을 때만** 낸다.
//   라이브 실측(2026-08-31 product_pins): 진열대 3곳 · 최다 4개 · 8개 이상 0곳.
//   즉 지금 뜨는 검색창은 전부 2~4개짜리 선반 위에 얹힌 furniture 다(높이 44px + 테두리).
//   진열대는 훑는 곳이지 질의하는 곳이 아니다 — 2열 그리드로 여섯 줄(=12개)을 넘어
//   한 화면에 안 들어오기 시작할 때부터 낸다. 늘면 자동으로 다시 뜬다.
const SEARCH_MIN_PINS = 12

// 🎫 2026-09-28 (s3): 정렬은 **보기 순서만** 바꾼다 — 주인이 드래그로 정한 `position` 을 덮지 않는다
//   (그 순서는 관리 화면에서만 바뀐다). 기본값 '추천순' = 주인 순서 그대로.
type PinSort = 'curated' | 'discount' | 'price_low'
const SORT_OPTIONS = [
  { key: 'curated' as const, label: '추천순' },
  { key: 'discount' as const, label: '할인율순' },
  { key: 'price_low' as const, label: '낮은 가격순' },
]

// 🧭 2026-06-10 [LOADING_ADDITIVE] (사용자 신고 — 유어샵 로딩 김): 모듈 메모리 캐시 + 진입 전 워밍.
//   SPA 탭 진입은 SSR 미주입 → 매 마운트 cold fetch. 재진입 0ms 페인트(+60s 초과는 백그라운드 갱신).
//   🧭 2026-06-22: 캐시 구현은 curator-page-cache 로 추출(picker 등이 무거운 이 청크 없이 무효화만 import).
//   warmCurator 는 BottomNav 가 `import('@/pages/CuratorPage').then(m => m.warmCurator)` 로 쓰므로 re-export 유지.
export { warmCurator } from '@/features/curator/curator-page-cache'

export default function CuratorPage() {
  const { handle = '' } = useParams<{ handle: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [data, setData] = useState<CuratorPageResponse | null>(() => {
    // 🛡️ 2026-05-27 (로딩 영구 fix): worker HTMLRewriter __SSR_INITIAL_CURATOR__ 즉시 사용.
    //   첫 paint 부터 표시 (axios fetch waterfall 200-500ms 제거).
    try {
      if (typeof document !== 'undefined') {
        const el = document.getElementById('__SSR_INITIAL_CURATOR__')
        if (el?.textContent) {
          const parsed = JSON.parse(el.textContent)
          if (parsed?.success && parsed?.curator?.handle === handle) return parsed
        }
      }
    } catch { /* SSR 누락 — fallback */ }
    // 메모리 캐시(워밍/재진입) — 신선하면 즉시 페인트, stale 이어도 화면 먼저 + 백그라운드 갱신
    return getCuratorCache(handle)
  })
  const [loading, setLoading] = useState(!data)
  const [error, setError] = useState<string | null>(null)
  // 🔍 2026-06-16 유어샵 시안: 검색 — 상품명 + 추천 코멘트(note) 라이브 필터.
  const [query, setQuery] = useState('')
  // 🎫 2026-09-02 안3: 카테고리 칩. 2026-09-28 s3 부터 개수 게이트 없음(핀이 있으면 그린다).
  const [cat, setCat] = useState<PinCategory>('all')
  // 🎫 2026-09-28 (s3): 정렬 드롭다운. 보기 순서만 바꾼다(위 SORT_OPTIONS 주석 참조).
  const [sort, setSort] = useState<PinSort>('curated')
  // 🔧 2026-09-28 (대표 확정 **e3**): '방문자 미리보기' 토글과 '순서 바꾸기' 모드가 **여기서 사라졌다**.
  //   유어샵은 이제 **손님 화면 하나뿐**이고(주인이 봐도 똑같다), 고치는 일은 전부 `/u/me/manage` 다.
  //   종전 구조(ownerView = isOwner && !previewAsVisitor)는 손님 화면 위에 관리 chrome 을 덧칠해
  //   주인/손님 화면이 갈리는 원인이었다.
  const currentUser = useAuthStore((s: any) => s.user)
  // 🛡️ 2026-05-27 (편집 UI 영구 fix): useAuthStore.user 가 sync 안 된 카카오 user 도 isOwner 인정.
  //   localStorage user_id fallback — RouteGuards / lib/api 의 토큰 검사 패턴과 일관.
  const isOwner = (() => {
    if (!data?.curator) return false
    if (currentUser && Number(currentUser.id) === data.curator.id) return true
    try {
      const localUserId = localStorage.getItem('user_id')
      if (localUserId && Number(localUserId) === data.curator.id) return true
    } catch { /* localStorage unavailable */ }
    return false
  })()

  // 💸 2026-07-07 (대표 결정 — "유어샵에 들어왔다면 수익이 생기게" · 진입=세션 귀속): 유어샵에 들어온 순간
  //   주인(user_id)을 24h affiliate_ref 로 심는다 → 이후 방문자가 이 유어샵을 통해 뭘 사든(핀·이용권·쇼핑)
  //   결제 시 referrer_id 로 전송돼 주인에게 커미션 귀속. 기존엔 '핀 클릭'만 귀속돼 유어샵 진입 자체는 무귀속이던
  //   갭을 메움. storeAffiliateRef 가 본인(my user_id===ref)이면 자동 skip(자기 유어샵 진입은 무귀속) +
  //   숫자 user_id 검증. 자기 상품 구매는 서버 self-seller 가드로 판매수익만(추천수수료 이중지급 방지).
  useEffect(() => {
    const cid = data?.curator?.id
    if (!cid || isOwner) return
    storeAffiliateRef(String(cid))
  }, [data?.curator?.id, isOwner])

  useEffect(() => {
    if (!handle) return
    let alive = true
    // 🛡️ 2026-05-31: SSR 초기 데이터(__SSR_INITIAL_CURATOR__)가 현재 handle 과 일치하면 로더 생략 →
    //   SSR 즉시 paint 유지(깜빡임 방지, 잠긴 GroupBuyDetail 패턴). 다른 handle 로 이동 시에만 로딩.
    if (data?.curator?.handle !== handle) setLoading(true)
    setError(null)
    fetchCuratorPage(handle)
      .then((res) => {
        if (!alive) return
        // 🏁 2026-06-17 (핸들 변경 리다이렉트): 옛 핸들이면 서버가 new_handle 반환 → /u/{현재핸들} 자동 이동.
        const moved = (res as { new_handle?: string } | null)?.new_handle
        if (moved) { navigate(`/u/${moved}`, { replace: true }); return }
        if (!res || !res.success) {
          setError(res?.error || t('curator.notFound', { defaultValue: '유어샵을 찾을 수 없어요' }))
          return
        }
        // 🛡️ 2026-05-25 (C 옵션 URL 통합): linked seller 있어도 redirect X.
        //   대신 본 페이지에서 SellerPublicPage 컴포넌트 직접 render (URL 그대로 유지).
        //   아래 if 분기 — data 만 set, render 시 SellerPublicPage 사용.
        setData(res)
      })
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [handle, t])

  // 🚑 2026-07-10 [UNLOCK_LOADING]: linked_seller 확인 즉시(SSR 시드 포함) 셀러 /public 페치 시작 —
  //   SellerPublicPage 는 마운트 후 같은 in-flight 를 이어받음(seller-public-fetch 공유 모듈).
  //   기존엔 [curator 응답 → lazy 청크 로드/마운트 → 그제서야 seller fetch] 완전 직렬 워터폴.
  // 🚀 2026-07-11 (1-RTT): 서버가 linked_seller_public 을 동봉하면 fetch 자체가 불필요 → warm 스킵.
  //   구캐시(필드 없는 edge 응답 최대 900s)/동봉 실패 시에만 기존 warm 폴백(점진 롤아웃 호환).
  useEffect(() => {
    const u = data?.linked_seller?.username
    if (u && !data?.linked_seller_public) warmSellerPublic(u)
  }, [data?.linked_seller?.username, data?.linked_seller_public])

  // 🛡️ 2026-05-27 (셀러 페이지 통일): 핀을 상품/이용권 분류 (deal_only / voucher 카테고리).
  // 🤝 2026-08-27 (대표 — "직접 매장과 매칭이 되어진 이용권이 위에 노출, 그냥 담아온거면 밑에"):
  //   딜이 있는 핀을 **맨 위 별도 섹션**으로 올린다. 딜 있음 = 팔리면 소개비가 붙는 곳이고,
  //   없으면 0원이다(어필리에이트 종료 2026-08-22) — 돈이 되는 것을 위에 두는 게 맞다.
  //
  //   ⚠️ **순서는 주인 것이다.** 자동 정렬로 `position` 을 덮지 않는다 — 드래그로 맞춰 놓은 순서가
  //     사라지면 재정렬 기능이 무의미해진다. 덩어리만 가르고 **각 덩어리 안은 원래 순서 그대로**
  //     (filter 는 순서를 보존한다).
  const { dealPins, shopPins, voucherPins } = useMemo(() => {
    const empty = { dealPins: [] as CuratorPin[], shopPins: [] as CuratorPin[], voucherPins: [] as CuratorPin[] }
    if (!data?.pins) return empty
    const isVoucher = (p: CuratorPin) => {
      const cat = (p as { category?: string }).category || ''
      const dealOnly = (p as { deal_only?: number }).deal_only === 1
      return dealOnly || /voucher/i.test(cat)
    }
    const hasDeal = (p: CuratorPin) => Number(p.deal_pct) > 0
    const rest = data.pins.filter(p => !hasDeal(p))
    return {
      dealPins: data.pins.filter(hasDeal),
      shopPins: rest.filter(p => !isVoucher(p)),
      voucherPins: rest.filter(p => isVoucher(p)),
    }
  }, [data])

  // 🧭 2026-06-10 (동네딜 집중 재정향): 홈 탭 = 교환권/공구 핀 우선 노출 (그룹 내 기존 순서 유지).
  const homePins = useMemo(() => [...dealPins, ...voucherPins, ...shopPins], [dealPins, voucherPins, shopPins])

  // 🔢 순번 배지의 **주소** — 주인 순서(딜 → 교환권 → 상품) 기준 고정 인덱스.
  //   정렬·필터로 화면 순서가 바뀌어도 이 숫자는 안 움직인다. SNS 의 "3번 이용권" 이 가리키는 것이
  //   화면마다 달라지면 소개비가 엉뚱한 상품으로 샌다.
  const orderOf = useMemo(() => new Map(homePins.map((p, i) => [p.id, i])), [homePins])
  const prefetchGb = usePrefetchGroupBuyProduct()
  const prefetchPin = (productId: number) => { try { prefetchGb(String(productId)) } catch { /* prefetch 실패는 무해 */ } }

  // 🏁 2026-06-14 (사용자 요청): 신규 가입자 유어샵 첫 진입 닉네임 설정 권유.
  //   owner + handle 이 자동생성형(user{숫자}) + 아직 설정 안 함 → 1회 모달.
  const [showOnboard, setShowOnboard] = useState(false)
  useEffect(() => {
    const cur = data?.curator
    if (!isOwner || !cur) return
    const isDefaultHandle = /^user\d+$/i.test(cur.handle || '')
    if (!isDefaultHandle) return
    try {
      if (localStorage.getItem(`linkshop_nickname_set_${cur.id}`)) return
    } catch { /* */ }
    const tmo = setTimeout(() => setShowOnboard(true), 800)
    return () => clearTimeout(tmo)
  }, [isOwner, data?.curator])

  // 🔗 2026-09-28 (대표 확정 c2 — "링크를 적지 말고 그냥 공유하기 버튼 하나로"): 헤더에서 주소 텍스트를
  //   뺐으므로 이 버튼이 주소를 **보내는** 유일한 자리다. 네이티브 공유 시트가 있으면 그걸(카톡이 거기 뜬다),
  //   없으면 종전대로 클립보드 복사 + 토스트.
  async function shareShop() {
    const fullUrl = `${window.location.origin}/u/${handle}`
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> }
    if (typeof nav.share === 'function') {
      try { await nav.share({ title: data?.curator?.name || '유어샵', url: fullUrl }); return }
      catch { /* 사용자가 취소했거나 미지원 — 복사로 폴백 */ }
    }
    try {
      await navigator.clipboard.writeText(fullUrl)
      toast.success(t('curator.linkCopied', { defaultValue: '링크가 복사되었어요' }))
    } catch { /* ignore */ }
  }

  if (loading) {
    // 🖼️ 2026-07-01 (대표 지시 — "콜드 로딩은 풀로, 2~3가지 로딩화면 절대 금지"): 유어샵 콜드 로딩은
    //   단일 URDEAL 브랜드 로더(다른 페이지 라우트 전환과 동일)로 통일. 기존엔 [CuratorPage 스켈레톤
    //   → Suspense 스켈레톤 → SellerPublicPage 스켈레톤]으로 모양이 다른 로더가 2~3번 튀었음.
    //   worker #root 첫페인트 + 이 로딩 + Suspense fallback + SellerPublicPage 로딩 전부 BrandLoader 로 일치.
    return <BrandLoader fullScreen />
  }

  if (error || !data) {
    return (
      <div className="min-h-[100dvh] bg-warm dark:bg-[#11141C] text-gray-900 dark:text-white flex flex-col items-center justify-center px-4 text-center">
        <h1 className="text-[24px] font-bold mb-2">{t('curator.notFoundTitle', { defaultValue: '유어샵을 찾을 수 없어요' })}</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">@{handle}</p>
        <Link to="/" className="px-6 py-3 bg-brand rounded-xl text-white font-bold">{t('curator.goHome', { defaultValue: '홈으로' })}</Link>
      </div>
    )
  }

  const { curator, pins, linked_seller } = data

  // 🛡️ 2026-05-25 (C 옵션 URL 통합): linked seller 매칭 시 SellerPublicPage 컴포넌트 inline render.
  //   URL 변경 X (/u/:handle 그대로). 일반 user 는 핀 그리드.
  if (linked_seller?.username) {
    return (
      <Suspense fallback={
        // 🖼️ 2026-07-01 (대표 지시 — 단일 풀 로더): SellerPublicPage 청크 다운로드 동안에도 동일 BrandLoader.
        //   (기존 헤더+스켈레톤 fallback → SellerPublicPage 자체 로딩과 로더가 두 번 튀어 "2~3가지 로딩화면" 유발.)
        <BrandLoader fullScreen />
      }>
        {/* 🏁 2026-06-25 (대표 "통일") — 사업자 유어샵도 canonical CuratorHeader 형태로. curator 객체 전달.
            ✨ 2026-07-04 유어샵 1단계(linkshop-role-model §5, 대표 "다 해줘"): pins 전달 재개 —
            SellerPublicPage 가 curator.linkshop_show_recommend(opt-in, 기본 off)일 때만 하단
            "추천" 섹션을 렌더. 2026-06-26 "추천템 숨김"의 막다른 골목(담아도 안 보임)을 opt-in 으로 해소.
            🏁 2026-06-26 [UNLOCK_LOADING] — linked_seller.id 전달 → 상품 fetch 를 셀러 fetch 와 병렬로(워터폴 제거). */}
        {/* 🚀 2026-07-11 (1-RTT): 서버 동봉 셀러 페이로드를 시드로 전달 — SellerPublicPage 가 동기 소비해
            셀러 fetch 생략(없으면 기존 fetch 폴백). */}
        <SellerPublicPage sellerIdOverride={linked_seller.username} curator={curator} sellerNumericId={linked_seller.id} ownerOverride={isOwner} sellerSeed={data.linked_seller_public ?? null} productsSeed={data.linked_seller_products ?? null} />
      </Suspense>
    )
  }

  // 🔍 2026-06-16 유어샵 시안: 탭 공통 — 검색 필터(상품명+note) + 빈/무결과 처리.
  // 🎫 2026-09-28 (s3): 칩 필터 → 검색 → 정렬을 **한 자리**에서. 종전엔 섹션 3개가 각자 applyQ 를
  //   불러 같은 필터를 세 번 돌렸다(그리고 정렬이 들어갈 자리가 없었다).
  const visiblePins = (() => {
    const q = query.trim().toLowerCase()
    const byCat = cat === 'all' ? homePins : homePins.filter(p => pinCategory(p) === cat)
    const list = q ? byCat.filter(p => (`${p.product_name} ${p.note || ''}`).toLowerCase().includes(q)) : byCat
    if (sort === 'curated') return list  // 주인 순서 — 복사조차 하지 않는다(그게 기본값이다)
    const copy = [...list]
    if (sort === 'discount') copy.sort((a, b) => (Number(b.discount_rate) || 0) - (Number(a.discount_rate) || 0))
    else copy.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0))
    return copy
  })()
  return (
    <>
      <SEO
        title={`${curator.name} (@${curator.handle})의 유어샵`}
        description={curator.bio || `${curator.name} 님이 추천하는 ${pins.length}개의 상품`}
        url={`/u/${curator.handle}`}
        image={`https://urdeal.kr/api/og/curator/${curator.handle}`}
      />
      {/* 🎨 2026-08-30: bg-white → bg-warm. 흰 카드가 웜 바탕 위에 떠오르게 해
          카드마다 붙어 있던 실선 테두리를 불필요하게 만든다(seller-public/theme.ts 와 동일 결정). */}
      <div className="min-h-[100dvh] bg-warm dark:bg-[#11141C] text-gray-900 dark:text-white pb-28">
        {/* 🗑️ 2026-09-02 (대표 — "편집하기 UI 가 번잡하다"): 주인 상단 안내 띠("내 유어샵 · 방문자에게 보이는 화면")
            삭제. 편집 진입은 헤더의 [유어샵 편집] 블루 버튼 하나(안3). 방문자는 그 버튼이 없을 뿐, 팔로우 등 대체
            버튼을 두지 않는다(대표: "그냥 방문자는 안보이면 되잖아"). */}
        {/* 🩸 2026-08-26: `ownerView` 게이트라 **한 번도 뜬 적 없었다**(previewAsVisitor 초기값 true) → isOwner. */}
        {isOwner && showOnboard && (
          <LinkshopOnboardModal
            onPickSeller={() => navigate('/store/new?from=urshop')}
            curatorId={curator.id}
            currentHandle={curator.handle}
            currentName={curator.name}
            onClose={() => setShowOnboard(false)}
            onDone={(next) => {
              setShowOnboard(false)
              if (next.handle && next.handle !== curator.handle) {
                // 핸들이 바뀌면 URL 도 새 핸들로 (히스토리 교체)
                setData(prev => prev ? { ...prev, curator: { ...prev.curator, ...next } } : prev)
                navigate(`/u/${next.handle}`, { replace: true })
              } else {
                setData(prev => prev ? { ...prev, curator: { ...prev.curator, ...next } } : prev)
              }
            }}
          />
        )}
        {/* 🖥️ 2026-09-02 안P1: lg+ 는 [좌 300px 프로필 열(sticky) + 우 진열대] 2단(index.css `.ur-ushop-pc`),
            모바일은 같은 DOM 이 세로로 흐른다. 액자 해제는 `shared/pc-fullbleed.ts`(한 세그먼트만). */}
        <div className="ur-ushop-pc">
        <div className="ur-ushop-side">
        {/* 🩸 2026-09-28 렌더 실측: 여기에 `counts={{ pins }}` 를 주면 헤더가 `담은 이용권 6` 이라 적고
            90px 아래 칩이 `전체 6` 이라 또 적는다 — **같은 수를 두 번 말하는 것**이고, 그 중복은
            이번 단계가 칩 게이트를 열면서 **내가 만든 것**이다(그 전엔 칩이 뜨질 않았다).
            칩 쪽이 기능(분류별 개수 + 필터)이라 헤더에서 뺀다.
            ⚠️ 사업자 유어샵(`SellerPublicPage`)은 본문에 칩이 없어 **거기선 그대로 넘긴다.** */}
        <CuratorHeader
          curator={curator}
          canEdit={isOwner}
          onCopyLink={shareShop}
        />
        <UShopQrCard />
        </div>
        <div className="ur-ushop-main">
        {/* 🔧 2026-09-28 (대표 확정 **e3**): 여기 있던 주인 전용 다섯 덩어리가 전부 `/u/me/manage` 로 나갔다
            (편집 툴바, 적립 한 줄, 돈 버는 길 3단계, 판매 진입 CTA, 순서 바꾸기).
            남은 것은 **손님이 보는 화면 하나**뿐이다. 되돌리려면 그 페이지에서 이리로 옮기면 된다. */}
            {/* 🔍 2026-06-16 유어샵 시안: 검색창 — 상품명 + 추천 코멘트 라이브 필터(SEARCH_MIN_PINS 이상일 때만). */}
            {pins.length >= SEARCH_MIN_PINS && (
              <div className="max-w-3xl mx-auto px-4 pt-3 pb-1">
                <div className="flex items-center gap-2 h-11 px-4 rounded-xl border border-line bg-gray-50 dark:bg-[#1D1F29]">
                  <Search className="w-4 h-4 text-gray-400 shrink-0" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('curator.searchPlaceholder', { defaultValue: '상품·딜 이름으로 검색' })}
                    className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-gray-900 dark:text-white placeholder:text-gray-400"
                  />
                  {query && (
                    <button onClick={() => setQuery('')} aria-label={t('curator.clearSearch', { defaultValue: '지우기' })} className="shrink-0 w-5 h-5 rounded-full bg-gray-300 dark:bg-[#3A3A3A] text-white flex items-center justify-center">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}
            {/* 🎫 2026-09-28 (대표 확정 **s3 밀도형**): 섹션 3개(계약 매장·추천템·교환권) + 2열 격자 →
                **칩 + 정렬 + 한 줄 목록**. 섹션 제목이 하던 분류는 칩이 대신하고, "딜 있는 것 위" 라는
                2026-08-27 대표 확정 순서는 `homePins`(딜 → 교환권 → 상품)가 그대로 지킨다.
                ⚠️ 정렬을 바꿔도 **순번 배지는 주인 순서 그대로**다 — 그 숫자는 SNS 에서 부르는 주소다. */}
            {pins.length === 0 ? (
              // 🩸 2026-08-26: `ownerView` 기준이라 **주인이 자기 빈 샵에서 방문자 문구**를 봤다(할 일 0개) → isOwner.
              <EmptyUrShop handle={curator.handle} isOwner={isOwner} curatorName={curator.name} curatorId={curator.id} />
            ) : (
              <>
                {/* 🩸 2026-09-28 렌더 실측: 여기 개수를 상시 적었더니 160px 안에서 "6" 을 **세 번** 말했다
                    (헤더 `담은 이용권 6`, 칩 `전체 6`, 그리고 이 줄의 `6개`). 칩이 분류별 개수를 이미 들고 있어
                    이 줄의 숫자는 **검색으로 더 걸러졌을 때만** 새 정보다 — 그때만 적는다.
                    (2026-09-01 지갑에서 "같은 숫자를 두 번 말하던 것" 을 고친 것과 같은 자리다.) */}
                {/* 🔧 2026-09-28 (대표 확정 **상단 1안**) — 칩과 정렬이 **줄 하나를 나눠 쓴다.**
                    종전엔 칩 줄(48px) 아래에 정렬만 든 줄(32px)이 따로 있어서, 버튼 하나를 위해
                    줄 하나를 쓰고 있었다(라이브 실측: 상품 전 chrome 287px = 첫 화면의 34%).
                    ⚠️ 칩은 **스스로 null 을 반환할 수 있다**(핀 0 · 카테고리 1종). 그때 이 줄엔
                       정렬만 남아 오른쪽에 붙는다 — 그래서 개수 게이트를 여기 두지 않는다.
                       둘 다 없으면 `empty:hidden` 이 빈 줄의 여백까지 접는다. */}
                <div className="max-w-3xl mx-auto px-4 pt-3 pb-2 flex items-center gap-2 empty:hidden">
                  <PinCategoryChips pins={pins} value={cat} onChange={setCat} />
                  {query.trim() && (
                    <span className="shrink-0 text-[12px] text-gray-500 dark:text-gray-400">
                      <b className="text-gray-900 dark:text-white tabular-nums">{visiblePins.length}{t('curator.countUnit', { defaultValue: '개' })}</b>
                    </span>
                  )}
                  <div className="ml-auto shrink-0">
                    <SortMenu value={sort} options={SORT_OPTIONS} onChange={setSort} />
                  </div>
                </div>
                {visiblePins.length === 0 ? (
                  <div className="max-w-3xl mx-auto px-4 py-16 text-center">
                    <p className="text-[15px] font-bold text-gray-900 dark:text-white">{t('curator.noSearchResults', { defaultValue: '검색 결과가 없어요' })}</p>
                    <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">{t('curator.tryOtherKeyword', { defaultValue: '다른 키워드로 찾아보세요.' })}</p>
                  </div>
                ) : (
                  <div className="max-w-3xl mx-auto px-4 pb-4 space-y-2">
                    {visiblePins.map((pin) => (
                      <PinRow
                        key={pin.id}
                        pin={pin}
                        handle={curator.handle}
                        order={(orderOf.get(pin.id) ?? 0) + 1}
                        prefetch={() => prefetchPin(pin.product_id)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
        </div>
        </div>
        {/* 🔗 2026-06-17 (사용자 요청): 유어샵 주소 변경 + 공유는 헤더의 '내 유어샵 주소' 카드로 통합 이동
            (CuratorHeader). 맨 아래 외딴 행 제거 — 보는 곳=고치는 곳=공유하는 곳 한 곳에. */}

        {/* 🎨 2026-06-19 (대표 — "나도 내 유어샵 만들기 버튼 별로"): 하단 고정 방문자 전환 CTA 제거.
            (조잡함 정리 + 주인 기본 뷰=방문자 미리보기라 주인에게도 떴을 것 → 제거가 맞음.) */}

        {/* 🧾 2026-09-28 (대표 확정 **B안** — *"B가 낫겠는데?"*): 맨 아래 유입 링크 세 줄.
            ⚠️ 위 2026-06-19 결정과 **모순이 아니다.** 그때 문제였던 둘을 피한다 —
              ① 따라다니는 고정 CTA 가 아니라 **목록이 끝난 뒤**의 조용한 링크(상품을 안 민다)
              ② **주인에겐 안 그린다**(그때는 주인에게도 떴다 — 대표가 `AskUserQuestion` 에서
                 "손님에게만 (주인은 숨김)" 을 골랐다).
            🔴 판정은 **호출부에서** 한다 — 부품이 소유권을 스스로 캐면
               `check-linkshop-ownership` ③(순수 뷰 자식은 prop 구동)을 어긴다. */}
        {!isOwner && <ShopInquiryLinks />}
      </div>
    </>
  )
}
