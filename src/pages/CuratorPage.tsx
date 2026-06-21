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
import { useAuthStore } from '@/client/stores/auth.store'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { formatWon, formatNumber } from '@/utils/format'
import { cfImage } from '@/utils/cf-image'
import BrowseProductCard from './browse/BrowseProductCard'
import { seededColor } from '@/utils/card-gradient'
import type { Product as BrowseProduct } from './browse/types'
import { Search, X, Trash2 } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import CuratorHeader from './curator-page/CuratorHeader'
import CuratorTabs, { type CuratorTab } from './curator-page/CuratorTabs'
import LinkshopOnboardModal from './curator-page/LinkshopOnboardModal'

// 🛡️ 2026-05-25 (C 옵션 URL 통합): linked seller 있으면 같은 페이지에서 SellerPublicPage 직접 render.
//   redirect 없음 — URL 그대로 (/u/:handle 유지). lazy chunk — 일반 user 진입 시 chunk fetch 안 함.
const SellerPublicPage = lazy(() => import('./SellerPublicPage'))
// 🏁 2026-06-18 (사용자 결정 — 사업자 진입 "상태별 직접 노출"): 링크샵 오너뷰에 판매 진입 CTA.
//   owner-only 렌더라 lazy — 방문자/익명 첫 paint 청크 불변.
const SellOwnProductsCTA = lazy(() => import('./curator-page/SellOwnProductsCTA'))

// 🧭 2026-06-10 [LOADING_ADDITIVE] (사용자 신고 — 링크샵 로딩 김): 모듈 메모리 캐시 + 진입 전 워밍.
//   SPA 탭 진입은 SSR 미주입 → 매 마운트 cold fetch. 동네딜(warmGroupBuyList)과 동일 패턴:
//   재진입 0ms 페인트(+60s 초과는 백그라운드 갱신), 하단바 pointerdown 이 데이터 선요청.
const CURATOR_CACHE_TTL = 60_000
const _curatorCache = new Map<string, { data: CuratorPageResponse; at: number }>()
const _curatorInflight = new Map<string, Promise<CuratorPageResponse | null>>()

function fetchCuratorPage(handle: string): Promise<CuratorPageResponse | null> {
  const inflight = _curatorInflight.get(handle)
  if (inflight) return inflight
  const p = curatorApi.getPage(handle)
    .then((res) => {
      if (res?.success) { _curatorCache.set(handle, { data: res, at: Date.now() }); return res }
      return res ?? null
    })
    .catch(() => null)
    .finally(() => { _curatorInflight.delete(handle) })
  _curatorInflight.set(handle, p)
  return p
}

/** 하단바 pointerdown 워밍 — 누르는 순간 데이터 선요청 (신선하면 no-op). */
export function warmCurator(handle: string): void {
  if (!handle || handle === 'me') return
  const hit = _curatorCache.get(handle)
  if (hit && Date.now() - hit.at < CURATOR_CACHE_TTL) return
  void fetchCuratorPage(handle)
}

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
    const hit = _curatorCache.get(handle)
    if (hit) return hit.data
    return null
  })
  const [loading, setLoading] = useState(!data)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<CuratorTab>('home')
  // 🔍 2026-06-16 링크샵 시안: 검색 — 상품명 + 추천 코멘트(note) 라이브 필터.
  const [query, setQuery] = useState('')
  // 🎨 2026-06-16 링크샵 시안: '방문자 미리보기' — 본인이 남이 보는 화면 그대로 확인.
  // 🎨 2026-06-19 (대표 — "주인도 처음엔 방문자 화면으로 보이고 편집하기 버튼"): 기본 true(깔끔한 방문자뷰).
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
          setError(res?.error || t('curator.notFound', { defaultValue: '큐레이터를 찾을 수 없어요' }))
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

  // 🛡️ 2026-05-27 (셀러 페이지 통일): 핀을 상품/식사권 분류 (deal_only / voucher 카테고리).
  const { shopPins, voucherPins } = useMemo(() => {
    if (!data?.pins) return { shopPins: [] as CuratorPin[], voucherPins: [] as CuratorPin[] }
    const isVoucher = (p: CuratorPin) => {
      const cat = (p as { category?: string }).category || ''
      const dealOnly = (p as { deal_only?: number }).deal_only === 1
      return dealOnly || /voucher/i.test(cat)
    }
    return {
      shopPins: data.pins.filter(p => !isVoucher(p)),
      voucherPins: data.pins.filter(p => isVoucher(p)),
    }
  }, [data])

  // 🧭 2026-06-10 (동네딜 집중 재정향): 홈 탭 = 교환권/공구 핀 우선 노출 (그룹 내 기존 순서 유지).
  const homePins = useMemo(() => [...voucherPins, ...shopPins], [voucherPins, shopPins])

  // 🏁 2026-06-14 (사용자 요청): 신규 가입자 링크샵 첫 진입 닉네임 설정 권유.
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
      toast.success('링크가 복사되었어요')
    } catch { /* ignore */ }
  }

  if (loading) {
    // 🧭 2026-06-10 (사용자 신고 — 링크샵 로딩 김): 빈 화면+텍스트 → 레이아웃 스켈레톤 (체감 즉시 개선).
    return (
      <div className="min-h-screen bg-white dark:bg-[#020202]">
        <div className="h-[220px] bg-gray-100 dark:bg-[#121212] animate-pulse" />
        <div className="max-w-3xl mx-auto px-4 -mt-12">
          <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-[#1A1A1A] animate-pulse border-4 border-white dark:border-[#020202]" />
          <div className="h-5 w-40 mt-3 rounded bg-gray-200 dark:bg-[#1A1A1A] animate-pulse" />
          <div className="h-3.5 w-24 mt-2 rounded bg-gray-100 dark:bg-[#121212] animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-square rounded-2xl bg-gray-100 dark:bg-[#121212] animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#020202] text-gray-900 dark:text-white flex flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-bold mb-2">{t('curator.notFoundTitle', { defaultValue: '😢 링크샵을 찾을 수 없어요' })}</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">@{handle}</p>
        <Link to="/" className="px-6 py-3 bg-gray-900 dark:bg-white rounded-xl text-white dark:text-[#020202] font-bold">{t('curator.goHome', { defaultValue: '홈으로' })}</Link>
      </div>
    )
  }

  const { curator, pins, linked_seller } = data

  // 🛡️ 2026-05-25 (C 옵션 URL 통합): linked seller 매칭 시 SellerPublicPage 컴포넌트 inline render.
  //   URL 변경 X (/u/:handle 그대로). 일반 user 는 핀 그리드.
  if (linked_seller?.username) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-white dark:bg-[#020202] text-gray-900 dark:text-white flex items-center justify-center">
          <div className="text-gray-500 dark:text-gray-400">{t('common.loading')}</div>
        </div>
      }>
        <SellerPublicPage sellerIdOverride={linked_seller.username} />
      </Suspense>
    )
  }

  // 🔍 2026-06-16 링크샵 시안: 탭 공통 — 검색 필터(상품명+note) + 빈/무결과 처리.
  const applyQ = (arr: CuratorPin[]) => {
    const q = query.trim().toLowerCase()
    return q ? arr.filter(p => (`${p.product_name} ${p.note || ''}`).toLowerCase().includes(q)) : arr
  }
  const onPinDeleted = (pinId: number) => setData(prev => prev ? { ...prev, pins: prev.pins.filter(p => p.id !== pinId) } : prev)
  // 🎨 2026-06-16 시안: 본인이 '전체 미리보기' 누르면 방문자 화면 그대로(편집/관리 숨김) 렌더. 실제 소유권(isOwner)은 보존.
  const ownerView = isOwner && !previewAsVisitor
  const renderPinTab = (arr: CuratorPin[], emptyType?: 'shop' | 'voucher') => {
    if (arr.length === 0) return <EmptyLinkshop handle={curator.handle} isOwner={ownerView} emptyType={emptyType} curatorName={curator.name} />
    const f = applyQ(arr)
    if (f.length === 0) return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-sm font-bold text-gray-900 dark:text-white">검색 결과가 없어요</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">다른 키워드로 찾아보세요.</p>
      </div>
    )
    return <PinGrid pins={f} handle={curator.handle} isOwner={ownerView} onPinDeleted={onPinDeleted} />
  }

  return (
    <>
      <SEO
        title={`${curator.name} (@${curator.handle}) 의 링크샵`}
        description={curator.bio || `${curator.name} 님이 추천하는 ${pins.length}개의 상품`}
        url={`/u/${curator.handle}`}
        image={`https://live.ur-team.com/api/og/curator/${curator.handle}`}
      />
      <div className="min-h-screen bg-white dark:bg-[#020202] text-gray-900 dark:text-white pb-28">
        {/* 🎨 2026-06-19 (대표 — 기본은 방문자 화면, 편집은 버튼으로): 주인 기본 뷰 상단의 슬림 편집 진입 바.
            방문자에겐 안 보임(isOwner). 편집 chrome(툴바·삭제·CTA)은 '편집하기' 누른 뒤에만 노출. */}
        {isOwner && previewAsVisitor && (
          <div className="sticky top-0 z-40 bg-white/85 dark:bg-[#0A0A0A]/85 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A] px-4 py-2 flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">👁 내 링크샵 · 방문자에게 보이는 화면</span>
            <button
              onClick={() => { setPreviewAsVisitor(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-[#020202] text-[12px] font-bold active:scale-95 transition-transform"
            >
              ✎ 편집하기
            </button>
          </div>
        )}
        {ownerView && showOnboard && (
          <LinkshopOnboardModal
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
          pinCount={pins.length}
          isOwner={ownerView}
          onCopyLink={copyLink}
          onCuratorUpdate={(next) => setData(prev => prev ? { ...prev, curator: { ...prev.curator, ...next } } : prev)}
        />
        {/* 🎨 2026-06-17 (C — 편집 모드 정리): 네이비 편집배너 + 미리보기 카드 + 순서바꾸기 버튼(3블록)을
            한 줄 슬림 툴바로 통합. 오너 기본 화면을 방문자 공개뷰(헤더+핀)에 가깝게 — 관리 chrome 최소화.
            기능(미리보기/순서/인라인 편집)은 전부 보존. design: docs/design/linkshop-edit-declutter.md */}
        {ownerView && pins.length > 0 && !reorderMode && (
          <div className="max-w-3xl mx-auto px-4 pt-3">
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-[#1F1F1F] bg-gray-50 dark:bg-[#0E0E0E] px-2.5 py-1.5">
              <span className="flex items-center gap-1.5 mr-auto pl-1 text-[12px] font-bold text-gray-500 dark:text-gray-400">
                <span className="text-[#6b7280] text-[13px] leading-none">✎</span>
                편집 모드
                <span className="hidden sm:inline font-medium text-gray-400 dark:text-gray-500">· 눌러서 바로 수정</span>
              </span>
              {pins.length > 1 && (
                <button
                  onClick={() => setReorderMode(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-transparent bg-white dark:bg-white/[0.06] px-2.5 py-1.5 text-[12px] font-bold text-gray-700 dark:text-gray-200 active:opacity-70"
                >⇅ 순서</button>
              )}
              {/* 🎨 2026-06-17 (사용자 — 버튼 통합): 헤더의 '수익 대시보드' 버튼을 이 툴바로 합침 (헤더 2버튼 그리드 제거) */}
              <button
                onClick={() => navigate('/u/me/earnings')}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-transparent bg-white dark:bg-white/[0.06] px-2.5 py-1.5 text-[12px] font-bold text-gray-700 dark:text-gray-200 active:opacity-70"
              >⚙ 대시보드</button>
              <button
                onClick={() => { setPreviewAsVisitor(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                className="inline-flex items-center gap-1 rounded-lg bg-gray-900 dark:bg-white px-2.5 py-1.5 text-[12px] font-bold text-white dark:text-[#020202] active:opacity-80"
              >✓ 완료</button>
            </div>
          </div>
        )}
        {/* 🛠️ 2026-06-16: 핀이 있을 때만 적립 — 갓 가입(온보딩)·빈 링크샵엔 0/0/0 노이즈 숨김.
            2026-06-17 (C): 큰 네이비 카드 → 한 줄 compact (상세는 콘솔). */}
        {ownerView && pins.length > 0 && !reorderMode && <OwnerEarningsStrip />}
        {/* 🏁 2026-06-18 (사용자 결정 — 사업자 진입 "상태별 직접 노출"): 오너 화면에 판매 진입 CTA
            (미등록=사업자 등록 / 승인=빠른 상품등록+셀러 대시보드 / 심사·반려=상태). reorder 중엔 숨김. */}
        {ownerView && !reorderMode && (
          <div className="max-w-3xl mx-auto px-4 pt-3">
            <Suspense fallback={null}><SellOwnProductsCTA /></Suspense>
          </div>
        )}
        {/* 🎨 2026-06-17 (사용자 요청 — 오너 화면 불일치 해소): 오너도 방문자와 동일한 그라데이션 카드 그리드를
            기본으로 보고, 카드마다 삭제(✕) + '순서 바꾸기'(드래그 모드)만 추가. 빈 링크샵은 온보딩 빈 상태. */}
        {ownerView && pins.length === 0 ? (
          <EmptyLinkshop handle={curator.handle} isOwner curatorName={curator.name} />
        ) : ownerView && reorderMode ? (
          <div className="max-w-3xl mx-auto px-4 pt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[14px] font-extrabold text-gray-900 dark:text-white">핀 순서 바꾸기</span>
              <button onClick={() => setReorderMode(false)} className="px-3.5 py-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-[#020202] text-[12.5px] font-bold active:opacity-80">완료</button>
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
            {/* 🔍 2026-06-16 링크샵 시안: 검색창 — 상품명 + 추천 코멘트 라이브 필터. */}
            {pins.length > 0 && (
              <div className="max-w-3xl mx-auto px-4 pt-3 pb-1">
                <div className="flex items-center gap-2 h-11 px-3.5 rounded-xl border border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#121212]">
                  <Search className="w-4 h-4 text-gray-400 shrink-0" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="상품·딜 이름으로 검색"
                    className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-gray-900 dark:text-white placeholder:text-gray-400"
                  />
                  {query && (
                    <button onClick={() => setQuery('')} aria-label="지우기" className="shrink-0 w-5 h-5 rounded-full bg-gray-300 dark:bg-[#3A3A3A] text-white flex items-center justify-center">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}
            <CuratorTabs
              tab={tab}
              onChange={setTab}
              pinCount={pins.length}
              shopCount={shopPins.length}
              voucherCount={voucherPins.length}
            />

            {tab === 'home' && renderPinTab(homePins)}
            {tab === 'shop' && renderPinTab(shopPins, 'shop')}
            {tab === 'vouchers' && renderPinTab(voucherPins, 'voucher')}
          </>
        )}
        {/* 🔗 2026-06-17 (사용자 요청): 링크샵 주소 변경 + 공유는 헤더의 '내 링크샵 주소' 카드로 통합 이동
            (CuratorHeader). 맨 아래 외딴 행 제거 — 보는 곳=고치는 곳=공유하는 곳 한 곳에. */}

        {/* 🎨 2026-06-19 (대표 — "나도 내 링크샵 만들기 버튼 별로"): 하단 고정 방문자 전환 CTA 제거.
            (조잡함 정리 + 주인 기본 뷰=방문자 미리보기라 주인에게도 떴을 것 → 제거가 맞음.) */}
      </div>
    </>
  )
}

// 🏁 2026-06-16 (링크샵 개선안 — 정직한 적립 표시): 본인 뷰 상단 적립 strip.
//   ⚠️ T+7 hold(2026-06-15) 도입으로 적립은 보류→확정 단계가 있음 — 시안의 "이번 주 적립" 단일 숫자를
//   그대로 쓰면 크리에이터가 즉시 현금을 기대 → 혼란. 확정(출금가능) + 예정(보류) 을 명확히 분리 표기.
function OwnerEarningsStrip() {
  const { t } = useTranslation()
  // 🏎️ 2026-06-17 (링크샵 감사): 무거운 9쿼리 /me/dashboard 를 수익 콘솔(CuratorEarningsPage)과
  //   동일 RQ 키로 공유 — 링크샵 strip → 콘솔 진입 시 재요청 없이 캐시 재사용(staleTime 60s). D1 부하 절감.
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
        style={{ background: 'linear-gradient(120deg,#141A2E,#2A3658)' }}
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

function PinGrid({ pins, handle, isOwner, onPinDeleted }: { pins: CuratorPin[]; handle: string; isOwner: boolean; onPinDeleted: (id: number) => void }) {
  return (
    <div className="max-w-3xl mx-auto p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
      {pins.map((pin, idx) => (
        <PinCard key={pin.id} pin={pin} handle={handle} isOwner={isOwner} aboveFold={idx < 4} index={idx} onDeleted={onPinDeleted} />
      ))}
      {/* 🏁 2026-06-16 링크샵 개선안: 본인이 핀 채워진 화면에서도 항상 추가 동선 — 그리드 끝 점선 카드. */}
      {isOwner && (
        <Link
          to="/browse"
          className="col-span-2 sm:col-span-3 flex items-center justify-center gap-2 h-[52px] rounded-xl border-[1.5px] border-dashed border-[#FFB59E] bg-[#f9fafb] dark:bg-[#1A1410] text-[#6b7280] text-sm font-bold active:scale-[0.99] transition-transform"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          핀 추가하기
        </Link>
      )}
    </div>
  )
}

// 🧭 2026-06-17 (사용자 요청 — "링크샵도 홈/동네딜/쇼핑과 똑같은 그라데이션 상품 카드를 그대로 써라.
//   커스텀 카드(EditorialProductCard) 그만 만들고 영구 고정"): 표준 카드 BrowseProductCard 를 그대로 재사용
//   → 쇼핑 카드 디자인과 영구 동기화(2개씩/그라데이션). 클릭만 핀 redirect(/u/:handle/p/:id, to override)로
//   보내 클릭집계+추천적립 루프 유지(잠금 불변).
function PinCard({ pin, handle, isOwner, aboveFold, index, onDeleted }: { pin: CuratorPin; handle: string; isOwner: boolean; aboveFold: boolean; index: number; onDeleted: (id: number) => void }) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (deleting) return
    const ok = await confirmDialog({ message: '내 링크샵에서 이 핀을 삭제할까요?', danger: true })
    if (!ok) return
    setDeleting(true)
    try {
      const res = await curatorApi.removePin(pin.id)
      if (res?.success) { onDeleted(pin.id); toast.success('핀 삭제됨') }
      else { toast.error('삭제 실패') }
    } catch {
      toast.error('삭제 실패')
    } finally {
      setDeleting(false)
    }
  }

  const product: BrowseProduct = {
    id: pin.product_id,
    name: pin.product_name,
    price: pin.price,
    current_price: pin.price,
    original_price: pin.original_price ?? undefined,
    discount_rate: 0, // BrowseProductCard 가 original_price 로 자동 계산
    image_url: pin.thumbnail || pin.image_url || '',
    stock: 0,
    dominant_color: pin.dominant_color,
    deal_only: pin.deal_only,
  }

  // 🎨 2026-06-18 (사용자 신고 — 방문자 모바일 핀 카드 그라데이션 없음): 핀 상품은 외부호스트(교환권 등)
  //   이미지가 많아 dominant_color null + canvas 추출이 CORS taint 로 실패 → 회색 단색으로 보이던 것.
  //   카테고리/상품 시드 폴백색을 줘 항상 컬러 그라데이션 (추출 성공 시 실제 대표색이 덮어씀).
  const fallbackColor = seededColor(pin.category || pin.product_id)

  return (
    <div className="relative group">
      <BrowseProductCard product={product} aboveFold={aboveFold} to={`/u/${handle}/p/${pin.product_id}`} fallbackColor={fallbackColor} />
      {/* 🔢 2026-06-18 (사용자 요청 — 링크샵에서만 카드 번호): 핀 순서 번호 배지. 다른 곳(홈/쇼핑) 미적용
          — PinCard(링크샵 전용)에만 오버레이라 BrowseProductCard 공용 동작 불변.
          🎨 2026-06-19 (세련화): 프로스트 글래스 원형 배지. */}
      <span className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full bg-black/45 backdrop-blur-md ring-1 ring-white/25 text-white text-[11px] font-bold flex items-center justify-center shadow-sm pointer-events-none">
        {index + 1}
      </span>
      {isOwner && (
        // 🎨 2026-06-19 (사용자 요청 — ✕ 대신 삭제 버튼 + 세련화): 휴지통 + '삭제' 글래스 pill, 누르면 빨강.
        <button
          onClick={handleDelete}
          disabled={deleting}
          aria-label="핀 삭제"
          className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 h-7 pl-2 pr-2.5 rounded-full bg-black/45 backdrop-blur-md ring-1 ring-white/25 text-white text-[11px] font-semibold shadow-sm hover:bg-red-500 hover:ring-red-400/40 active:bg-red-500 transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-3 h-3" aria-hidden="true" />
          삭제
        </button>
      )}
    </div>
  )
}

// 🔗 2026-06-17 (사용자 요청): 핸들 편집기(HandleEditor)는 헤더의 '내 링크샵 주소' 카드(CuratorHeader)로
//   공유(복사/카카오)와 함께 통합 이동 — 여기서 제거.

// 🎨 2026-06-16 링크샵 시안: 본인 핀 관리 리스트 — 드래그(터치+마우스) 정렬 + 핀별 통계 + 코멘트 넛지 + 삭제.
//   드래그 라이브러리 없이 pointer 이벤트로 구현 (window 리스너 + ref, 모바일 스크롤 방지 touch-action:none).
function PinManageList({ pins, onReorder, onDeleted }: { pins: CuratorPin[]; onReorder: (next: CuratorPin[]) => void; onDeleted: (id: number) => void }) {
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
    const ok = await confirmDialog({ message: '이 핀을 삭제할까요?', danger: true })
    if (!ok) return
    try {
      const r = await curatorApi.removePin(id)
      if (r?.success) { setItems(prev => prev.filter(p => p.id !== id)); onDeleted(id); toast.success('핀 삭제됨') }
      else toast.error('삭제 실패')
    } catch { toast.error('삭제 실패') }
  }

  const fmtK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

  return (
    <div className="max-w-3xl mx-auto px-4 pt-3 pb-6">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[14px] font-extrabold text-gray-900 dark:text-white">내 핀 {items.length}개</span>
        <span className="text-[12px] text-gray-400 dark:text-gray-500">⇅ 끌어서 정렬</span>
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
              className={`flex items-center gap-3 rounded-2xl border p-2.5 bg-white dark:bg-[#121212] ${dragging ? 'border-[#6b7280] shadow-lg' : 'border-gray-200 dark:border-[#2A2A2A]'}`}
              style={{ opacity: dragging ? 0.92 : 1 }}
            >
              <span
                onPointerDown={(e) => { e.preventDefault(); dragIdxRef.current = idx; setDraggingId(pin.id) }}
                style={{ touchAction: 'none', cursor: 'grab' }}
                className="text-gray-300 dark:text-gray-600 text-lg px-1 select-none leading-none"
                aria-label="끌어서 정렬"
              >⋮⋮</span>
              {img
                ? <img src={cfImage(img, { width: 100, format: 'auto' }) || img} alt="" className="w-[52px] h-[52px] rounded-xl object-cover shrink-0" loading="lazy" decoding="async" />
                : <div className="w-[52px] h-[52px] rounded-xl bg-gray-100 dark:bg-[#1A1A1A] shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-bold text-gray-900 dark:text-white truncate">{pin.product_name}</span>
                  {idx === 0 && <span className="shrink-0 text-[9.5px] font-extrabold text-[#6b7280] bg-[#FFEDE8] dark:bg-[#2a1812] px-1.5 py-0.5 rounded">강추</span>}
                </div>
                {pin.note
                  ? <div className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-1">조회 {fmtK(pin.click_count || 0)}{est > 0 ? ` · 적립 ₩${est.toLocaleString('ko-KR')}/건` : ''}</div>
                  : <div className="text-[11.5px] font-semibold text-[#C2491F] dark:text-[#9ca3af] mt-1">추천 코멘트 없음 · 추가하면 전환 ↑</div>}
              </div>
              <button onClick={() => del(pin.id)} aria-label="삭제" className="shrink-0 w-[30px] h-[30px] rounded-lg bg-gray-100 dark:bg-[#1A1A1A] text-gray-500 dark:text-gray-400 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors text-sm font-bold">✕</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EmptyLinkshop({ handle, isOwner, emptyType, curatorName }: { handle: string; isOwner: boolean; emptyType?: 'shop' | 'voucher'; curatorName?: string }) {
  const { t } = useTranslation()
  const browseLink = emptyType === 'voucher' ? '/vouchers' : '/browse'
  const browseLabel = emptyType === 'voucher'
    ? t('curator.browseVouchers', { defaultValue: '교환권 둘러보기' })
    : t('curator.browseProducts', { defaultValue: '상품 둘러보기' })
  // 방문자: 심플 메시지 (ghost 는 소유자 동기부여용).
  if (!isOwner) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">{t('curator.emptyTitle', { defaultValue: '아직 추천이 없어요' })}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('curator.emptyOther', { defaultValue: `@${handle} 의 첫 추천을 기다리는 중`, handle })}</p>
      </div>
    )
  }
  // 🎨 2026-06-16 링크샵 시안: 온보딩 진행 카드 — 이름/주소/첫핀 3단계. 빈 상태(핀 0)라 첫핀은 항상 미완.
  const nameDone = !!curatorName && !/^user\d+$/i.test(curatorName.trim())
  const handleDone = !/^user\d+$/i.test(handle)
  const doneCount = (nameDone ? 1 : 0) + (handleDone ? 1 : 0)
  // 🎨 2026-06-16 링크샵 시안(A안): 흐릿한 샘플 ghost 핀(mask gradient 로 아래로 페이드, 비활성) + 떠있는 CTA.
  //   외부 이미지 핫링크 대신 스켈레톤 블록(프로덕션 안전) — "카드가 이렇게 채워진다" 미리보기.
  return (
    <div className="max-w-3xl mx-auto px-4 pt-4">
      {/* 온보딩 진행 카드 (시안) */}
      <div className="mb-3 rounded-2xl border border-[#FFE0D6] dark:border-[#3a2218] bg-[#f9fafb] dark:bg-[#1A1410] px-4 py-3.5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-extrabold text-[#B4422A] dark:text-[#9ca3af]">링크샵 완성까지 {3 - doneCount}단계</span>
          <span className="text-[12px] font-bold text-[#B4422A] dark:text-[#9ca3af]">{doneCount}/3</span>
        </div>
        <div className="mt-2.5 h-[7px] rounded-full bg-[#FFE0D6] dark:bg-[#3a2218] overflow-hidden">
          <div className="h-full rounded-full bg-[#6b7280] transition-all" style={{ width: `${Math.round((doneCount / 3) * 100)}%` }} />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[#7A4232] dark:text-[#c79a87]">
          <span className={nameDone ? '' : 'font-bold text-[#141A2E] dark:text-white'}>{nameDone ? '✓' : '○'} 이름 설정</span>
          <span className={handleDone ? '' : 'font-bold text-[#141A2E] dark:text-white'}>{handleDone ? '✓' : '○'} 주소 설정</span>
          <span className="font-bold text-[#141A2E] dark:text-white">○ 첫 핀 추가</span>
        </div>
      </div>
      <div className="relative overflow-hidden" style={{ height: 230 }}>
        <div
          className="grid grid-cols-2 gap-3 pointer-events-none select-none"
          style={{ filter: 'blur(3px) saturate(.9)', opacity: 0.55, WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,.85) 0%, rgba(0,0,0,.35) 45%, transparent 80%)', maskImage: 'linear-gradient(180deg, rgba(0,0,0,.85) 0%, rgba(0,0,0,.35) 45%, transparent 80%)' }}
          aria-hidden="true"
        >
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="rounded-xl overflow-hidden border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212]">
              <div className="aspect-[3/2] relative bg-gray-200 dark:bg-[#1A1A1A]">
                <span className="absolute top-0 left-0 min-w-[1.5rem] h-6 px-1.5 bg-[#6b7280] text-white text-[13px] font-extrabold flex items-center justify-center rounded-br-[11px]">{n}</span>
              </div>
              <div className="p-2.5">
                <div className="h-3 w-4/5 rounded bg-gray-200 dark:bg-[#1A1A1A]" />
                <div className="h-3.5 w-1/2 rounded bg-gray-200 dark:bg-[#1A1A1A] mt-2" />
                <div className="mt-2 pl-2 border-l-2 border-[#6b7280]"><div className="h-2.5 w-11/12 rounded bg-gray-100 dark:bg-[#161616]" /></div>
              </div>
            </div>
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center text-center px-6 pb-1">
          <div className="w-14 h-14 rounded-2xl bg-[#6b7280] flex items-center justify-center text-white" style={{ boxShadow: '0 10px 24px -8px rgba(255,86,52,.6)' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h12v16l-6-4-6 4V4Z" /></svg>
          </div>
          <h2 className="text-[17px] font-extrabold text-gray-900 dark:text-white mt-3">{t('curator.emptyOwnerTitle', { defaultValue: '첫 핀을 추가해 보세요' })}</h2>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1.5 max-w-[270px] leading-snug">{t('curator.emptyOwnerDesc', { defaultValue: '마음에 든 딜·상품을 핀하면 이렇게 나만의 스토어가 채워져요.' })}</p>
          <Link to={browseLink} className="mt-4 w-full max-w-xs py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-[#020202] text-[14px] font-bold">{browseLabel}</Link>
        </div>
      </div>
    </div>
  )
}
