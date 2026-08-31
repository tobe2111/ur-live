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

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import { curatorApi, type CuratorPageResponse, type CuratorPin, type DashboardStats } from '@/features/curator/api/curator-api'
import { fetchCuratorPage, getCuratorCache } from '@/features/curator/curator-page-cache'
import { useAuthStore } from '@/client/stores/auth.store'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { formatWon, formatNumber } from '@/utils/format'
import { cfImage } from '@/utils/cf-image'
// 🏁 2026-08-27 (대표 신고 — 유어샵 이용권 UI 가 예전 디자인): 홈과 한 벌인 카드로.
import GroupBuyFeedCard from './main-home/GroupBuyFeedCard'
import { seededColor } from '@/utils/card-gradient'
import type { Product as BrowseProduct } from './browse/types'
import { Search, X, Trash2, Eye, Pencil, ArrowUpDown, LayoutDashboard, Check } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import CuratorHeader from './curator-page/CuratorHeader'
import LinkshopOnboardModal from './curator-page/LinkshopOnboardModal'
import BrandLoader from '@/components/brand/BrandLoader'
import { storeAffiliateRef } from '@/utils/affiliate-track'
// 🚑 2026-07-10 [UNLOCK_LOADING]: 사업자 유어샵 워터폴 완화 — linked_seller 확인 즉시 셀러 /public 워밍
//   (SellerPublicPage lazy 청크 다운로드와 병렬). 독립 모듈이라 lazy 청크 분리 불변.
import { warmSellerPublic } from './seller-public/seller-public-fetch'
import EmptyUrShop from './curator-page/EmptyUrShop'

// 🛡️ 2026-05-25 (C 옵션 URL 통합): linked seller 있으면 같은 페이지에서 SellerPublicPage 직접 render.
//   redirect 없음 — URL 그대로 (/u/:handle 유지). lazy chunk — 일반 user 진입 시 chunk fetch 안 함.
const SellerPublicPage = lazy(() => import('./SellerPublicPage'))
// 🏁 2026-06-18 (사용자 결정 — 사업자 진입 "상태별 직접 노출"): 유어샵 오너뷰에 판매 진입 CTA.
//   owner-only 렌더라 lazy — 방문자/익명 첫 paint 청크 불변.
const SellOwnProductsCTA = lazy(() => import('./curator-page/SellOwnProductsCTA'))
// 🪜 2026-08-27: 유어샵 수익 사다리(오너 전용) — 방문자 번들에 안 실리게 lazy.
const EarnLadder = lazy(() => import('./curator-page/EarnLadder'))

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
  // 🎨 2026-06-16 유어샵 시안: '방문자 미리보기' — 본인이 남이 보는 화면 그대로 확인.
  // 🎨 2026-06-19 (대표 "주인도 처음엔 방문자 화면 + 편집하기 버튼"): 기본 true(깔끔한 방문자뷰),
  //   '편집하기' 누르면 false → 편집 모드(툴바·삭제·적립·판매 CTA). 매 진입 깔끔 뷰로 시작.
  const [previewAsVisitor, setPreviewAsVisitor] = useState(true)
  // 🎨 2026-06-17 (사용자 요청): 오너 기본 화면 = 방문자와 같은 카드 그리드. 순서 바꾸기는 드래그 모드 토글로.
  const [reorderMode, setReorderMode] = useState(false)
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

  async function copyLink() {
    const fullUrl = `${window.location.origin}/u/${handle}`
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
      <div className="min-h-[100dvh] bg-warm dark:bg-[#0D0F12] text-gray-900 dark:text-white flex flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-bold mb-2">{t('curator.notFoundTitle', { defaultValue: '유어샵을 찾을 수 없어요' })}</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">@{handle}</p>
        <Link to="/" className="px-6 py-3 bg-gray-900 dark:bg-white rounded-xl text-white dark:text-[#0D0F12] font-bold">{t('curator.goHome', { defaultValue: '홈으로' })}</Link>
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
        <SellerPublicPage sellerIdOverride={linked_seller.username} curator={curator} sellerNumericId={linked_seller.id} ownerOverride={isOwner} sellerSeed={data.linked_seller_public ?? null} />
      </Suspense>
    )
  }

  // 🔍 2026-06-16 유어샵 시안: 탭 공통 — 검색 필터(상품명+note) + 빈/무결과 처리.
  const applyQ = (arr: CuratorPin[]) => {
    const q = query.trim().toLowerCase()
    return q ? arr.filter(p => (`${p.product_name} ${p.note || ''}`).toLowerCase().includes(q)) : arr
  }
  const onPinDeleted = (pinId: number) => setData(prev => prev ? { ...prev, pins: prev.pins.filter(p => p.id !== pinId) } : prev)
  // 🎨 2026-06-16 시안: 본인이 '전체 미리보기' 누르면 방문자 화면 그대로(편집/관리 숨김) 렌더. 실제 소유권(isOwner)은 보존.
  const ownerView = isOwner && !previewAsVisitor
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
      <div className="min-h-[100dvh] bg-warm dark:bg-[#0D0F12] text-gray-900 dark:text-white pb-28">
        {/* 🎨 2026-06-19 (대표 — 기본은 방문자 화면, 편집은 버튼으로): 주인 기본 뷰 상단의 슬림 편집 진입 바.
            방문자에겐 안 보임(isOwner). 편집 chrome(툴바·삭제·CTA)은 '편집하기' 누른 뒤에만 노출. */}
        {isOwner && previewAsVisitor && (
          <div className="sticky top-0 z-40 bg-white/85 dark:bg-[#0D0F12]/85 backdrop-blur border-b border-gray-100 dark:border-[#2C2F35] px-4 py-2 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-gray-500 dark:text-gray-400"><Eye className="w-3.5 h-3.5" aria-hidden="true" />{t('curator.ownerViewBar', { defaultValue: '내 유어샵 · 방문자에게 보이는 화면' })}</span>
            <button
              onClick={() => { setPreviewAsVisitor(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-[#0D0F12] text-[12px] font-bold active:scale-95 transition-transform"
            >
              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />{t('curator.editButton', { defaultValue: '편집하기' })}
            </button>
          </div>
        )}
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
        <CuratorHeader
          curator={curator}
          isOwner={ownerView}
          accountType="user"
          onCopyLink={copyLink}
          onCuratorUpdate={(next) => setData(prev => prev ? { ...prev, curator: { ...prev.curator, ...next } } : prev)}
        />
        {/* 🎨 2026-06-17 (C — 편집 모드 정리): 네이비 편집배너 + 미리보기 카드 + 순서바꾸기 버튼(3블록)을
            한 줄 슬림 툴바로 통합. 오너 기본 화면을 방문자 공개뷰(헤더+핀)에 가깝게 — 관리 chrome 최소화.
            기능(미리보기/순서/인라인 편집)은 전부 보존. design: docs/design/linkshop-edit-declutter.md */}
        {ownerView && pins.length > 0 && !reorderMode && (
          <div className="max-w-3xl mx-auto px-4 pt-3">
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-[#2C2F35] bg-gray-50 dark:bg-[#0E0E0E] px-2.5 py-1.5">
              <span className="flex items-center gap-1.5 mr-auto pl-1 text-[12px] font-bold text-gray-500 dark:text-gray-400">
                <Pencil className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
                {t('curator.editMode', { defaultValue: '편집 모드' })}
                <span className="hidden sm:inline font-medium text-gray-400 dark:text-gray-500">· {t('curator.tapToEdit', { defaultValue: '눌러서 바로 수정' })}</span>
              </span>
              {pins.length > 1 && (
                <button
                  onClick={() => setReorderMode(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-transparent bg-white dark:bg-white/[0.06] px-2.5 py-1.5 text-[12px] font-bold text-gray-700 dark:text-gray-200 active:opacity-70"
                ><ArrowUpDown className="w-3.5 h-3.5" aria-hidden="true" />{t('curator.reorder', { defaultValue: '순서' })}</button>
              )}
              {/* 🎨 2026-06-17 (사용자 — 버튼 통합): 헤더의 '수익 대시보드' 버튼을 이 툴바로 합침 (헤더 2버튼 그리드 제거) */}
              <button
                onClick={() => navigate('/u/me/earnings')}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-transparent bg-white dark:bg-white/[0.06] px-2.5 py-1.5 text-[12px] font-bold text-gray-700 dark:text-gray-200 active:opacity-70"
              ><LayoutDashboard className="w-3.5 h-3.5" aria-hidden="true" />{t('curator.dashboardBtn', { defaultValue: '대시보드' })}</button>
              <button
                onClick={() => { setPreviewAsVisitor(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                className="inline-flex items-center gap-1 rounded-lg bg-gray-900 dark:bg-white px-2.5 py-1.5 text-[12px] font-bold text-white dark:text-[#0D0F12] active:opacity-80"
              ><Check className="w-3.5 h-3.5" aria-hidden="true" />{t('curator.done', { defaultValue: '완료' })}</button>
            </div>
          </div>
        )}
        {/* 🛠️ 2026-06-16: 핀이 있을 때만 적립 — 갓 가입(온보딩)·빈 유어샵엔 0/0/0 노이즈 숨김.
            2026-06-17 (C): 큰 네이비 카드 → 한 줄 compact (상세는 콘솔). */}
        {ownerView && pins.length > 0 && !reorderMode && <OwnerEarningsStrip />}
        {/* 🪜 2026-08-27 (대표 확정): 돈 버는 길 3개를 순서대로. `pins.length` 로 막지 않는다 —
            **빈 유어샵일수록** 뭘 해야 하는지가 필요하고, 그때 보이는 건 "적립 ₩0" 뿐이었다. */}
        {ownerView && !reorderMode && (
          <Suspense fallback={null}>
            <EarnLadder curatorId={curator.id} dealCount={dealPins.length} pinCount={pins.length} />
          </Suspense>
        )}
        {/* 🏁 2026-06-18 (사용자 결정 — 사업자 진입 "상태별 직접 노출"): 오너 화면에 판매 진입 CTA
            (미등록=사업자 등록 / 승인=빠른 상품등록+셀러 대시보드 / 심사·반려=상태). reorder 중엔 숨김. */}
        {ownerView && !reorderMode && (
          <div className="max-w-3xl mx-auto px-4 pt-3">
            <Suspense fallback={null}><SellOwnProductsCTA /></Suspense>
          </div>
        )}
        {/* 🎨 2026-06-17 (사용자 요청 — 오너 화면 불일치 해소): 오너도 방문자와 동일한 그라데이션 카드 그리드를
            기본으로 보고, 카드마다 삭제(✕) + '순서 바꾸기'(드래그 모드)만 추가. 빈 유어샵은 온보딩 빈 상태. */}
        {ownerView && pins.length === 0 ? (
          <EmptyUrShop handle={curator.handle} isOwner curatorName={curator.name} curatorId={curator.id} />
        ) : ownerView && reorderMode ? (
          <div className="max-w-3xl mx-auto px-4 pt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[14px] font-extrabold text-gray-900 dark:text-white">{t('curator.reorderTitle', { defaultValue: '핀 순서 바꾸기' })}</span>
              <button onClick={() => setReorderMode(false)} className="px-3.5 py-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-[#0D0F12] text-[12.5px] font-bold active:opacity-80">{t('curator.done', { defaultValue: '완료' })}</button>
            </div>
            <PinManageList
              pins={pins}
              onReorder={(next) => setData(prev => prev ? { ...prev, pins: next } : prev)}
              onDeleted={onPinDeleted}
            />
          </div>
        ) : (
          <>
            {/* 🎨 2026-06-17 (C): '순서 바꾸기' 진입 버튼은 상단 슬림 툴바로 이동(중복 행 제거). */}
            {/* 🔍 2026-06-16 유어샵 시안: 검색창 — 상품명 + 추천 코멘트 라이브 필터. */}
            {pins.length > 0 && (
              <div className="max-w-3xl mx-auto px-4 pt-3 pb-1">
                <div className="flex items-center gap-2 h-11 px-3.5 rounded-xl border border-gray-200 dark:border-[#2C2F35] bg-gray-50 dark:bg-[#1A1C21]">
                  <Search className="w-4 h-4 text-gray-400 shrink-0" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('curator.searchPlaceholder', { defaultValue: '상품·딜 이름으로 검색' })}
                    className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-gray-900 dark:text-white placeholder:text-gray-400"
                  />
                  {query && (
                    <button onClick={() => setQuery('')} aria-label={t('curator.clearSearch', { defaultValue: '지우기' })} className="shrink-0 w-5 h-5 rounded-full bg-gray-300 dark:bg-[#3A3A3A] text-white flex items-center justify-center">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}
            {/* 🏁 2026-06-25 (대표 "한 페이지·능력별 섹션"): 탭 제거 → 추천템/교환권 한 스크롤 섹션. 빈 섹션 숨김.
                (사업자 SellerPublicPage 와 동일 구조 — 두 유어샵이 더는 갈리지 않음) */}
            {pins.length === 0 ? (
              // 🩸 2026-08-26: `ownerView` 기준이라 **주인이 자기 빈 샵에서 방문자 문구**를 봤다(할 일 0개) → isOwner.
              <EmptyUrShop handle={curator.handle} isOwner={isOwner} curatorName={curator.name} curatorId={curator.id} />
            ) : (applyQ(dealPins).length === 0 && applyQ(shopPins).length === 0 && applyQ(voucherPins).length === 0) ? (
              <div className="max-w-3xl mx-auto px-4 py-16 text-center">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{t('curator.noSearchResults', { defaultValue: '검색 결과가 없어요' })}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('curator.tryOtherKeyword', { defaultValue: '다른 키워드로 찾아보세요.' })}</p>
              </div>
            ) : (
              <>
                {applyQ(dealPins).length > 0 && (
                  <>
                    <div className="max-w-3xl mx-auto px-4 pt-4 pb-1">
                      <h3 className="text-[16px] font-extrabold text-gray-900 dark:text-white">
                        {t('curator.dealPinsTitle', { defaultValue: '내 계약 매장' })} {dealPins.length}
                      </h3>
                      <p className="mt-0.5 text-[11.5px] text-gray-500 dark:text-gray-400">
                        {t('curator.dealPinsSub', { defaultValue: '팔리면 소개비가 붙는 곳이에요.' })}
                      </p>
                    </div>
                    <PinGrid pins={applyQ(dealPins)} handle={curator.handle} isOwner={ownerView} onPinDeleted={onPinDeleted} kind="voucher" />
                  </>
                )}
                {applyQ(shopPins).length > 0 && (
                  <>
                    <div className="max-w-3xl mx-auto px-4 pt-4 pb-1"><h3 className="text-[16px] font-extrabold text-gray-900 dark:text-white">{t('curator.shopPinsTitle', { defaultValue: '추천템' })} {shopPins.length}</h3></div>
                    <PinGrid pins={applyQ(shopPins)} handle={curator.handle} isOwner={ownerView} onPinDeleted={onPinDeleted} kind="shop" />
                  </>
                )}
                {applyQ(voucherPins).length > 0 && (
                  <>
                    <div className="max-w-3xl mx-auto px-4 pt-7 pb-1"><h3 className="text-[16px] font-extrabold text-gray-900 dark:text-white">{t('curator.voucherPinsTitle', { defaultValue: '교환권 · 동네딜' })} {voucherPins.length}</h3></div>
                    <PinGrid pins={applyQ(voucherPins)} handle={curator.handle} isOwner={ownerView} onPinDeleted={onPinDeleted} kind="voucher" />
                  </>
                )}
              </>
            )}
          </>
        )}
        {/* 🔗 2026-06-17 (사용자 요청): 유어샵 주소 변경 + 공유는 헤더의 '내 유어샵 주소' 카드로 통합 이동
            (CuratorHeader). 맨 아래 외딴 행 제거 — 보는 곳=고치는 곳=공유하는 곳 한 곳에. */}

        {/* 🎨 2026-06-19 (대표 — "나도 내 유어샵 만들기 버튼 별로"): 하단 고정 방문자 전환 CTA 제거.
            (조잡함 정리 + 주인 기본 뷰=방문자 미리보기라 주인에게도 떴을 것 → 제거가 맞음.) */}
      </div>
    </>
  )
}

// 🏁 2026-06-16 (유어샵 개선안 — 정직한 적립 표시): 본인 뷰 상단 적립 strip.
//   ⚠️ T+7 hold(2026-06-15) 도입으로 적립은 보류→확정 단계가 있음 — 시안의 "이번 주 적립" 단일 숫자를
//   그대로 쓰면 크리에이터가 즉시 현금을 기대 → 혼란. 확정(출금가능) + 예정(보류) 을 명확히 분리 표기.
function OwnerEarningsStrip() {
  const { t } = useTranslation()
  // 🏎️ 2026-06-17 (유어샵 감사): 무거운 9쿼리 /me/dashboard 를 수익 콘솔(CuratorEarningsPage)과
  //   동일 RQ 키로 공유 — 유어샵 strip → 콘솔 진입 시 재요청 없이 캐시 재사용(staleTime 60s). D1 부하 절감.
  const dashQ = useApiQuery<DashboardStats | null>(
    ['curator', 'dashboard'],
    '/api/curator/me/dashboard',
    { select: (raw) => ((raw as { success?: boolean; stats?: DashboardStats })?.success ? ((raw as { stats: DashboardStats }).stats) : null) },
  )
  const stats = dashQ.data ?? null
  // 로딩/실패 시 숨김 (레이아웃 점프 없이 핀이 먼저). 적립 0 이어도 표시 — 시작 동기 부여.
  if (!stats) return null
  const confirmed = stats.month_earnings ?? 0
  const pending = stats.pending_earnings ?? 0
  const clicks = stats.unique_clicks_30d ?? stats.clicks_30d ?? 0
  const conv = stats.conversion_rate_30d ?? 0

  // 🎨 2026-06-17 (C — 편집 모드 정리): 큰 멀티라인 네이비 카드 → 한 줄 탭 가능 바.
  //   상세(구매수/보류 설명)는 콘솔(/creator)에서. 공개뷰에 가깝게 시각 무게만 축소(데이터/링크 동일). theme-dual
  return (
    <div className="max-w-3xl mx-auto px-4 pt-2">
      <Link
        to="/creator"
        className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-2 text-white active:opacity-90"
        style={{ background: 'linear-gradient(120deg,#1A1C21,#3A3D44)' }}
      >
        <span className="flex items-baseline gap-1.5 min-w-0">
          <span className="shrink-0 text-[11px] text-white/55">{t('curator.earn30dConfirmed', { defaultValue: '최근 30일 적립' })}</span>
          <b className="text-[15px] font-extrabold leading-none">{formatWon(confirmed)}</b>
          {pending > 0 && <span className="truncate text-[11px] font-bold text-[#FFB59E]">+{formatWon(pending)} {t('curator.pendingEarn', { defaultValue: '예정' })}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2.5 text-[11px] text-white/70">
          <span className="hidden xs:inline">{t('curator.statClicks', { defaultValue: '클릭' })} <b className="text-white">{formatNumber(clicks)}</b></span>
          <span>{t('curator.statConv', { defaultValue: '전환' })} <b className="text-[#37D399]">{conv}%</b></span>
          <span className="font-bold text-white/85">{t('curator.consoleLink', { defaultValue: '콘솔' })} →</span>
        </span>
      </Link>
    </div>
  )
}

function PinGrid({ pins, handle, isOwner, onPinDeleted, kind }: { pins: CuratorPin[]; handle: string; isOwner: boolean; onPinDeleted: (id: number) => void; kind?: 'shop' | 'voucher' }) {
  const { t } = useTranslation()
  // 🏷️ 2026-06-19 (대표 — "핀" 내부용어 대신 상품/동네딜): 탭에 맞춘 추가 라벨.
  // 🏁 2026-06-22 (대표 — "상품/이용권 모두 선택하는 전용 페이지"): /browse·/group-buy 로 흩어지던 동선을
  //   전용 picker(/u/me/add)로 통합. 탭(상품/이용권)은 ?tab= 으로 초기 선택.
  const addTo = kind === 'voucher' ? '/u/me/add?tab=voucher' : kind === 'shop' ? '/u/me/add?tab=shop' : '/u/me/add'
  const addLabel = kind === 'voucher' ? t('curator.addVoucherPin', { defaultValue: '동네딜 추가하기' })
    : kind === 'shop' ? t('curator.addShopPin', { defaultValue: '상품 추가하기' })
    : t('curator.addAnyPin', { defaultValue: '상품·동네딜 추가하기' })
  return (
    // 🛍️ 2026-06-21 (대표 — "상품 2개씩"): 유어샵 핀은 항상 2열. `grid-cols-2 sm:grid-cols-3` 는 PC 액자
    //   1열 전역 오버라이드(index.css app-framed)에 걸려 1열이 됐음 → 단순 `grid-cols-2` 로 그 매칭을 피해
    //   모바일·PC 프레임 모두 2열 유지(타 페이지 1열 전역 결정엔 영향 없음).
    <div className="max-w-3xl mx-auto p-4 grid grid-cols-2 gap-3">
      {pins.map((pin, idx) => (
        <PinCard key={pin.id} pin={pin} handle={handle} isOwner={isOwner} aboveFold={idx < 4} index={idx} onDeleted={onPinDeleted} />
      ))}
      {/* 🏁 2026-06-16 유어샵 개선안: 본인이 핀 채워진 화면에서도 항상 추가 동선 — 그리드 끝 점선 카드. */}
      {isOwner && (
        <Link
          to={addTo}
          className="col-span-2 flex items-center justify-center gap-2 h-[52px] rounded-xl border-[1.5px] border-dashed border-[#FFB59E] bg-[#f9fafb] dark:bg-[#1A1410] text-[#6b7280] text-sm font-bold active:scale-[0.99] transition-transform"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          {addLabel}
        </Link>
      )}
    </div>
  )
}

// 🧭 2026-06-17 (사용자 요청 — "유어샵도 홈/동네딜/쇼핑과 똑같은 그라데이션 상품 카드를 그대로 써라.
//   커스텀 카드(EditorialProductCard) 그만 만들고 영구 고정"): 표준 카드 BrowseProductCard 를 그대로 재사용
//   → 쇼핑 카드 디자인과 영구 동기화(2개씩/그라데이션). 클릭만 핀 redirect(/u/:handle/p/:id, to override)로
//   보내 클릭집계+추천적립 루프 유지(잠금 불변).
function PinCard({ pin, handle, isOwner, aboveFold, index, onDeleted }: { pin: CuratorPin; handle: string; isOwner: boolean; aboveFold: boolean; index: number; onDeleted: (id: number) => void }) {
  const { t } = useTranslation()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (deleting) return
    const ok = await confirmDialog({ message: t('curator.confirmDeletePinMine', { defaultValue: '내 유어샵에서 이 핀을 삭제할까요?' }), danger: true })
    if (!ok) return
    setDeleting(true)
    try {
      const res = await curatorApi.removePin(pin.id)
      if (res?.success) { onDeleted(pin.id); toast.success(t('curator.pinDeleted', { defaultValue: '핀 삭제됨' })) }
      else { toast.error(t('curator.deleteFailed', { defaultValue: '삭제 실패' })) }
    } catch {
      toast.error(t('curator.deleteFailed', { defaultValue: '삭제 실패' }))
    } finally {
      setDeleting(false)
    }
  }

  // 🏁 2026-06-26 (대표 — 유어샵 카드를 쇼핑 카드와 동일하게): 할인/평점/구매수까지 전달.
  //   2026-08-27: 카드가 `GroupBuyFeedCard`(홈과 동일)로 바뀌면서 `category` 도 넘긴다 —
  //   카드가 카테고리 배지와 `canonicalDetailPath` 판정에 쓴다.
  const product = {
    id: pin.product_id,
    name: pin.product_name,
    price: pin.price,
    current_price: pin.price,
    original_price: pin.original_price ?? undefined,
    discount_rate: pin.discount_rate ?? 0,
    image_url: pin.thumbnail || pin.image_url || '',
    stock: 0,
    dominant_color: pin.dominant_color,
    deal_only: pin.deal_only,
    avg_rating: pin.avg_rating ?? undefined,
    review_count: pin.review_count ?? undefined,
    sold_count: pin.sold_count ?? undefined,
    category: pin.category ?? undefined,
  }

  return (
    <div className="relative group">
      {/* 🔗 목적지는 반드시 /u/:handle/p/:productId — 그 경로가 **클릭을 기록하고 `?aff=` 귀속을 붙인다.**
          상세로 직행시키면 화면은 똑같은데 소개비 귀속이 조용히 사라진다(돈이 새는 쪽으로 깨진다). */}
      <GroupBuyFeedCard p={product} aboveFold={aboveFold} to={`/u/${handle}/p/${pin.product_id}`} />
      {/* 🔢 2026-06-18 (사용자 요청 — 유어샵에서만 카드 번호): 핀 순서 번호 배지. 다른 곳(홈/쇼핑) 미적용
          — PinCard(유어샵 전용)에만 오버레이라 BrowseProductCard 공용 동작 불변.
          🎨 2026-06-19 (세련화): 프로스트 글래스 원형 배지. */}
      <span className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full bg-black/45 backdrop-blur-md ring-1 ring-white/25 text-white text-[11px] font-bold flex items-center justify-center shadow-sm pointer-events-none">
        {index + 1}
      </span>
      {isOwner && (
        // 🎨 2026-06-19 (사용자 요청 — ✕ 대신 삭제 버튼 + 세련화): 휴지통 + '삭제' 글래스 pill, 누르면 빨강.
        <button
          onClick={handleDelete}
          disabled={deleting}
          aria-label={t('curator.deletePin', { defaultValue: '핀 삭제' })}
          className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 h-7 pl-2 pr-2.5 rounded-full bg-black/45 backdrop-blur-md ring-1 ring-white/25 text-white text-[11px] font-semibold shadow-sm hover:bg-red-500 hover:ring-red-400/40 active:bg-red-500 transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-3 h-3" aria-hidden="true" />
          {t('curator.delete', { defaultValue: '삭제' })}
        </button>
      )}
    </div>
  )
}

// 🔗 2026-06-17 (사용자 요청): 핸들 편집기(HandleEditor)는 헤더의 '내 유어샵 주소' 카드(CuratorHeader)로
//   공유(복사/카카오)와 함께 통합 이동 — 여기서 제거.

// 🎨 2026-06-16 유어샵 시안: 본인 핀 관리 리스트 — 드래그(터치+마우스) 정렬 + 핀별 통계 + 코멘트 넛지 + 삭제.
//   드래그 라이브러리 없이 pointer 이벤트로 구현 (window 리스너 + ref, 모바일 스크롤 방지 touch-action:none).
function PinManageList({ pins, onReorder, onDeleted }: { pins: CuratorPin[]; onReorder: (next: CuratorPin[]) => void; onDeleted: (id: number) => void }) {
  const { t } = useTranslation()
  const [items, setItems] = useState<CuratorPin[]>(pins)
  const itemsRef = useRef(items)
  itemsRef.current = items
  useEffect(() => { setItems(pins) }, [pins])
  const dragIdxRef = useRef<number | null>(null)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  function reorderTo(clientY: number) {
    const container = listRef.current
    const from = dragIdxRef.current
    if (!container || from == null) return
    const rows = Array.from(container.querySelectorAll('[data-pinrow]')) as HTMLElement[]
    let target = rows.length - 1
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect()
      if (clientY < r.top + r.height / 2) { target = i; break }
    }
    if (target !== from) {
      setItems(prev => {
        const next = [...prev]
        const [m] = next.splice(from, 1)
        next.splice(target, 0, m)
        return next
      })
      dragIdxRef.current = target
    }
  }
  useEffect(() => {
    function onMove(e: PointerEvent) { if (dragIdxRef.current != null) { e.preventDefault(); reorderTo(e.clientY) } }
    function onUp() {
      if (dragIdxRef.current == null) return
      dragIdxRef.current = null
      setDraggingId(null)
      const finalItems = itemsRef.current
      onReorder(finalItems)
      curatorApi.reorderPins(finalItems.map(p => p.id)).catch(() => { /* best-effort */ })
    }
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
  }, [onReorder])

  async function del(id: number) {
    const ok = await confirmDialog({ message: t('curator.confirmDeletePin', { defaultValue: '이 핀을 삭제할까요?' }), danger: true })
    if (!ok) return
    try {
      const r = await curatorApi.removePin(id)
      if (r?.success) { setItems(prev => prev.filter(p => p.id !== id)); onDeleted(id); toast.success(t('curator.pinDeleted', { defaultValue: '핀 삭제됨' })) }
      else toast.error(t('curator.deleteFailed', { defaultValue: '삭제 실패' }))
    } catch { toast.error(t('curator.deleteFailed', { defaultValue: '삭제 실패' })) }
  }

  const fmtK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

  return (
    <div className="max-w-3xl mx-auto px-4 pt-3 pb-6">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[14px] font-extrabold text-gray-900 dark:text-white">{t('curator.myPinsCount', { defaultValue: '내 핀 {{count}}개', count: items.length })}</span>
        <span className="text-[12px] text-gray-400 dark:text-gray-500">⇅ {t('curator.dragToReorder', { defaultValue: '끌어서 정렬' })}</span>
      </div>
      <div ref={listRef} className="flex flex-col gap-2.5">
        {items.map((pin, idx) => {
          const img = pin.thumbnail || pin.image_url || ''
          const est = pin.commission_rate > 0 ? Math.round(pin.price * pin.commission_rate / 100) : 0
          const dragging = draggingId === pin.id
          return (
            <div
              key={pin.id}
              data-pinrow
              className={`flex items-center gap-3 rounded-2xl border p-2.5 bg-white dark:bg-[#1A1C21] ${dragging ? 'border-[#6b7280] shadow-lg' : 'border-gray-200 dark:border-[#2C2F35]'}`}
              style={{ opacity: dragging ? 0.92 : 1 }}
            >
              <span
                onPointerDown={(e) => { e.preventDefault(); dragIdxRef.current = idx; setDraggingId(pin.id) }}
                style={{ touchAction: 'none', cursor: 'grab' }}
                className="text-gray-300 dark:text-gray-600 text-lg px-1 select-none leading-none"
                aria-label={t('curator.dragToReorder', { defaultValue: '끌어서 정렬' })}
              >⋮⋮</span>
              {img
                ? <img src={cfImage(img, { width: 100, format: 'auto' }) || img} alt="" className="w-[52px] h-[52px] rounded-xl object-cover shrink-0" loading="lazy" decoding="async" />
                : <div className="w-[52px] h-[52px] rounded-xl bg-gray-100 dark:bg-[#1A1C21] shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-bold text-gray-900 dark:text-white truncate">{pin.product_name}</span>
                  {idx === 0 && <span className="shrink-0 text-[9.5px] font-extrabold text-[#6b7280] bg-[#FFEDE8] dark:bg-[#2a1812] px-1.5 py-0.5 rounded">{t('curator.topPick', { defaultValue: '강추' })}</span>}
                </div>
                {pin.note
                  ? <div className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-1">{t('curator.viewsCount', { defaultValue: '조회 {{n}}', n: fmtK(pin.click_count || 0) })}{est > 0 ? t('curator.earnPerSaleAmt', { defaultValue: ' · 적립 ₩{{amt}}/건', amt: est.toLocaleString('ko-KR') }) : ''}</div>
                  : <div className="text-[11.5px] font-semibold text-[#C2491F] dark:text-[#9ca3af] mt-1">{t('curator.noCommentNudge', { defaultValue: '추천 코멘트 없음 · 추가하면 전환 ↑' })}</div>}
              </div>
              <button onClick={() => del(pin.id)} aria-label={t('curator.delete', { defaultValue: '삭제' })} className="shrink-0 w-[30px] h-[30px] rounded-lg bg-gray-100 dark:bg-[#1A1C21] text-gray-500 dark:text-gray-400 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors text-sm font-bold">✕</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

