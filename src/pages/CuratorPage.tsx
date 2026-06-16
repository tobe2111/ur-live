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
import { formatWon, formatNumber } from '@/utils/format'
import { cfImage, cfSrcSet } from '@/utils/cf-image'
import { cardGradient } from '@/utils/card-gradient'
import { extractDominantColor, reportDominantColor } from '@/utils/dominant-color'
import { Search, X } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import CuratorHeader from './curator-page/CuratorHeader'
import CuratorTabs, { type CuratorTab } from './curator-page/CuratorTabs'
import LinkshopOnboardModal from './curator-page/LinkshopOnboardModal'

// 🛡️ 2026-05-25 (C 옵션 URL 통합): linked seller 있으면 같은 페이지에서 SellerPublicPage 직접 render.
//   redirect 없음 — URL 그대로 (/u/:handle 유지). lazy chunk — 일반 user 진입 시 chunk fetch 안 함.
const SellerPublicPage = lazy(() => import('./SellerPublicPage'))

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
  // 🎨 2026-06-16 링크샵 시안: 본인 핀 관리(드래그 정렬) 모드 토글.
  const [manageMode, setManageMode] = useState(false)
  // 🎨 2026-06-16 링크샵 시안: '방문자 미리보기' — 본인이 남이 보는 화면 그대로 확인.
  const [previewAsVisitor, setPreviewAsVisitor] = useState(false)
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
    return <PinGrid pins={f} handle={curator.handle} isOwner={ownerView} onPinDeleted={onPinDeleted} curatorName={curator.name} curatorAvatar={curator.profile_image} />
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
        {/* 🎨 2026-06-16 시안: 방문자 미리보기 모드 배너 (본인 → 남이 보는 화면 그대로 확인) */}
        {isOwner && previewAsVisitor && (
          <div className="sticky top-0 z-40 bg-[#141A2E] text-white px-4 py-2 text-[12.5px] font-bold flex items-center justify-between gap-2">
            <span>👀 방문자 미리보기 — 다른 사람에게 보이는 화면이에요</span>
            <button onClick={() => setPreviewAsVisitor(false)} className="shrink-0 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[11.5px] whitespace-nowrap">편집으로 돌아가기</button>
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
        {/* 🛠️ 2026-06-16: 핀이 있을 때만 적립 strip — 갓 가입(온보딩)·빈 링크샵엔 0/0/0 노이즈 숨김. */}
        {ownerView && pins.length > 0 && <OwnerEarningsStrip />}
        {/* 🎨 2026-06-16 시안: 방문자 미리보기 카드 — '남이 볼 땐 이렇게 보여요' + 전체 미리보기 진입 */}
        {ownerView && pins.length > 0 && (
          <div className="max-w-3xl mx-auto px-4 pt-3">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] px-4 py-3">
              <div className="min-w-0">
                <p className="text-[13.5px] font-extrabold text-gray-900 dark:text-white">방문자에게 이렇게 보여요</p>
                <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">편집은 나만 보이고, 남에겐 깔끔한 공개 화면만 보여요.</p>
              </div>
              <button
                onClick={() => { setManageMode(false); setPreviewAsVisitor(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                className="shrink-0 h-9 px-3.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-[#020202] text-[12.5px] font-bold"
              >
                전체 미리보기 →
              </button>
            </div>
          </div>
        )}
        {/* 🎨 2026-06-16 링크샵 시안: 본인 핀 정렬·관리 토글 */}
        {ownerView && pins.length > 0 && (
          <div className="max-w-3xl mx-auto px-4 pt-3 flex justify-end">
            <button
              onClick={() => setManageMode(m => !m)}
              className="text-[12.5px] font-bold px-3.5 py-2 rounded-xl bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-200 active:opacity-80"
            >
              {manageMode ? '✓ 완료' : '⇅ 핀 정렬·관리'}
            </button>
          </div>
        )}
        {ownerView && manageMode ? (
          <PinManageList
            pins={pins}
            onReorder={(next) => setData(prev => prev ? { ...prev, pins: next } : prev)}
            onDeleted={onPinDeleted}
          />
        ) : (
          <>
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
        {/* 🛡️ 2026-06-11 (사용자): '정보' 탭 제거 — 핸들 변경 기능만 오너 전용 슬림 행으로 보존 */}
        {ownerView && (
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between text-sm border-t border-gray-100 dark:border-[#1A1A1A] mt-6">
            <span className="text-gray-400">링크샵 주소</span>
            <HandleEditor handle={curator.handle} />
          </div>
        )}

        {/* 🧭 2026-06-10 (UI 100점 패스 — 방문자 전환): 비소유자 성장 루프 CTA.
            링크트리식 — 방문자가 1탭으로 자기 링크샵 시작(적립 루프 신규 큐레이터 유입). */}
        {!ownerView && (
          <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-4 inset-x-0 z-30 pointer-events-none">
            <div className="max-w-3xl mx-auto px-4">
              <Link
                to="/u/me"
                className="pointer-events-auto flex items-center justify-center gap-2 h-12 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-[#020202] text-[14px] font-bold shadow-lg active:scale-[0.98] transition-transform"
              >
                ✨ {t('curator.makeMine', { defaultValue: '나도 내 링크샵 만들기 — 추천하면 적립' })}
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// 🏁 2026-06-16 (링크샵 개선안 — 정직한 적립 표시): 본인 뷰 상단 적립 strip.
//   ⚠️ T+7 hold(2026-06-15) 도입으로 적립은 보류→확정 단계가 있음 — 시안의 "이번 주 적립" 단일 숫자를
//   그대로 쓰면 크리에이터가 즉시 현금을 기대 → 혼란. 확정(출금가능) + 예정(보류) 을 명확히 분리 표기.
function OwnerEarningsStrip() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    let alive = true
    curatorApi.getDashboard()
      .then((r) => { if (alive && r?.success) setStats(r.stats) })
      .catch(() => { /* 조용히 — strip 은 보조 정보, 실패해도 핀 그리드 우선 */ })
      .finally(() => { if (alive) setLoaded(true) })
    return () => { alive = false }
  }, [])
  // 로딩/실패 시 strip 숨김 (레이아웃 점프 없이 핀이 먼저). 적립 0 이어도 표시 — 시작 동기 부여.
  if (!loaded || !stats) return null
  const confirmed = stats.month_earnings ?? 0
  const pending = stats.pending_earnings ?? 0
  const clicks = stats.unique_clicks_30d ?? stats.clicks_30d ?? 0
  const purchases = stats.purchases_30d ?? 0
  const conv = stats.conversion_rate_30d ?? 0

  return (
    <div className="max-w-3xl mx-auto px-4 pt-3">
      {/* 다크 네이비 strip (시안 톤) — 라이트/다크 공통 고정색 카드(컬러 배경 위 흰 글씨). theme-dual */}
      <div className="rounded-2xl p-4 text-white" style={{ background: 'linear-gradient(120deg,#141A2E,#2A3658)' }}>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-white/60">{t('curator.earn30dConfirmed', { defaultValue: '최근 30일 확정 적립' })}</span>
          <Link to="/creator" className="text-[11px] font-bold text-white/70 hover:text-white">{t('curator.consoleLink', { defaultValue: '콘솔' })} →</Link>
        </div>
        <div className="mt-1 flex items-baseline gap-2 flex-wrap">
          <span className="text-[26px] font-extrabold leading-none">{formatWon(confirmed)}</span>
          {pending > 0 && (
            <span className="text-[12px] font-bold text-[#FFB59E]">+ {formatWon(pending)} {t('curator.pendingEarn', { defaultValue: '적립 예정' })}</span>
          )}
        </div>
        <div className="mt-3 flex gap-4 text-[11.5px] text-white/70">
          <span>{t('curator.statClicks', { defaultValue: '순클릭' })} <b className="text-white">{formatNumber(clicks)}</b></span>
          <span>{t('curator.statPurchases', { defaultValue: '구매' })} <b className="text-white">{formatNumber(purchases)}</b></span>
          <span>{t('curator.statConv', { defaultValue: '전환율' })} <b className="text-[#37D399]">{conv}%</b></span>
        </div>
        {pending > 0 && (
          <div className="mt-2 text-[10.5px] text-white/45">{t('curator.holdNote', { defaultValue: '적립 예정은 구매 확정(약 7일) 후 출금 가능액으로 전환돼요' })}</div>
        )}
      </div>
    </div>
  )
}

function PinGrid({ pins, handle, isOwner, onPinDeleted, curatorName, curatorAvatar }: { pins: CuratorPin[]; handle: string; isOwner: boolean; onPinDeleted: (id: number) => void; curatorName?: string; curatorAvatar?: string | null }) {
  return (
    <div className="max-w-3xl mx-auto p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
      {pins.map((pin, idx) => (
        <PinCard key={pin.id} pin={pin} index={idx} handle={handle} isOwner={isOwner} aboveFold={idx < 4} hero={idx === 0} onDeleted={onPinDeleted} curatorName={curatorName} curatorAvatar={curatorAvatar} />
      ))}
      {/* 🏁 2026-06-16 링크샵 개선안: 본인이 핀 채워진 화면에서도 항상 추가 동선 — 그리드 끝 점선 카드. */}
      {isOwner && (
        <Link
          to="/browse"
          className="col-span-2 sm:col-span-3 flex items-center justify-center gap-2 h-[52px] rounded-xl border-[1.5px] border-dashed border-[#FFB59E] bg-[#FFF6F3] dark:bg-[#1A1410] text-[#FF5634] text-sm font-bold active:scale-[0.99] transition-transform"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          핀 추가하기
        </Link>
      )}
    </div>
  )
}

function PinCard({ pin, index, handle, isOwner, aboveFold, hero, onDeleted, curatorName, curatorAvatar }: { pin: CuratorPin; index: number; handle: string; isOwner: boolean; aboveFold: boolean; hero?: boolean; onDeleted: (id: number) => void; curatorName?: string; curatorAvatar?: string | null }) {
  const { t } = useTranslation()
  const productImg = pin.thumbnail || pin.image_url || ''
  // 🛡️ 2026-05-27 (404 fix — 사용자 보고): SPA route 는 /u/:handle/p/:productId (no /redirect suffix).
  //   /redirect suffix 는 worker /api/curator/... endpoint 용. SPA fallback 은 CuratorPinClientRedirect 가 자동 호출.
  const redirectUrl = `/u/${handle}/p/${pin.product_id}`
  const [deleting, setDeleting] = useState(false)
  // 🏭 2026-06-05 (사용자 요청 — 링크샵 그라데이션 통일): 쇼핑/동네딜 카드와 동일한 대표색 번짐.
  const [cardColor, setCardColor] = useState<string | null>(pin.dominant_color || null)
  const [imgError, setImgError] = useState(false)
  const grad = cardGradient(cardColor)

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (deleting) return
    const ok = await confirmDialog({ message: '내 링크샵에서 이 핀을 삭제할까요?', danger: true })
    if (!ok) return
    setDeleting(true)
    try {
      const res = await curatorApi.removePin(pin.id)
      if (res?.success) {
        onDeleted(pin.id)
        toast.success('핀 삭제됨')
      } else {
        toast.error('삭제 실패')
      }
    } catch {
      toast.error('삭제 실패')
    } finally {
      setDeleting(false)
    }
  }

  // 🏁 2026-06-16 (링크샵 개선안 — 에디토리얼 카드): 할인%·절약액은 기존 데이터(original_price/price)로 계산.
  const hasDeal = !!pin.original_price && pin.original_price > pin.price
  const discountPct = hasDeal ? Math.round((1 - pin.price / (pin.original_price as number)) * 100) : 0
  const savings = hasDeal ? (pin.original_price as number) - pin.price : 0
  // 🎨 2026-06-16 시안 히어로: 카테고리 라벨 (동네딜=voucher/deal_only, 그 외 상품)
  const heroCatLabel = ((pin as { deal_only?: number }).deal_only === 1 || /voucher/i.test((pin as { category?: string }).category || '')) ? '동네딜' : '상품'

  return (
    <div className={`relative group ${hero ? 'col-span-2 sm:col-span-3' : ''}`}>
      {/* 🎨 2026-06-16 링크샵 개선안: 흰 에디토리얼 카드(AI 그라데이션 제거) — 번호 코너플래그 + 다크 가격칩 + 절약 초록 + coral-rule 인용. #1 은 풀폭 히어로. */}
      <a href={redirectUrl} className="block rounded-xl overflow-hidden border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] active:scale-[0.98] transition-transform">
        <div className={`relative ${hero ? 'aspect-[16/9]' : 'aspect-[3/2]'}`} style={{ backgroundColor: grad.base }}>
          {/* 큐레이션 순번 = 좌상단 코너 플래그 (sort order) */}
          <span className={`absolute top-0 left-0 z-10 px-1.5 bg-[#FF5634] text-white font-extrabold flex items-center justify-center rounded-br-[11px] ${hero ? 'min-w-[2rem] h-8 text-[17px]' : 'min-w-[1.5rem] h-6 text-[13px]'}`}>
            {index + 1}
          </span>
          {productImg && !imgError ? (
            <img
              src={cfImage(productImg, { width: hero ? 640 : 200, format: 'auto' }) || productImg}
              srcSet={cfSrcSet(productImg, hero ? 640 : 200) || undefined}
              sizes={hero ? '(max-width: 768px) 100vw, 720px' : '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px'}
              alt={pin.product_name}
              loading={aboveFold ? 'eager' : 'lazy'}
              fetchPriority={aboveFold ? 'high' : 'auto'}
              decoding="async"
              onLoad={(e) => {
                const color = extractDominantColor(e.currentTarget as HTMLImageElement)
                if (color) {
                  if (!cardColor) setCardColor(color)
                  if (!pin.dominant_color) reportDominantColor(pin.product_id, color)
                }
              }}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: grad.sub }}>no image</div>
          )}
          {/* 딜 가치 칩: hero=할인%+정가취소선+판매가 통합(시안), 일반=할인%만 */}
          {hero ? (
            <div className="absolute bottom-2.5 left-2.5 z-10 flex items-baseline gap-1.5 px-2.5 py-1 rounded-[10px] bg-[#141A2E]/92 backdrop-blur">
              {discountPct > 0 && <span className="text-[17px] font-extrabold text-[#FF7A5C]">{discountPct}%</span>}
              {hasDeal && <span className="text-[11px] line-through text-white/50">{(pin.original_price as number).toLocaleString('ko-KR')}</span>}
              <span className="text-[14px] font-extrabold text-white">{pin.price.toLocaleString('ko-KR')}원</span>
            </div>
          ) : (
            discountPct > 0 && (
              <span className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded-md bg-[#141A2E]/90 text-[#FF7A5C] text-[12px] font-extrabold backdrop-blur">
                {discountPct}%
              </span>
            )
          )}
        </div>
        {hero ? (
          /* 🎨 시안 히어로 본문: 카테고리 줄 + 제목/절약 + note(인용+큐레이터 얼굴/이름) — 가격은 이미지 칩에 통합. */
          <div className="p-3.5">
            <span className="text-[11px] font-extrabold tracking-[0.14em] text-[#FF5634]">강력 추천 · {heroCatLabel}</span>
            <div className="mt-1.5 flex items-start justify-between gap-2.5">
              <p className="text-[16px] font-bold leading-snug text-[#141A2E] dark:text-white line-clamp-2">{pin.product_name}</p>
              {savings > 0 && (
                <span className="shrink-0 mt-0.5 text-[12px] font-extrabold text-[#0E9F6E]">{formatWon(savings)}<span className="font-semibold opacity-70"> 절약</span></span>
              )}
            </div>
            {pin.note && (
              <div className="mt-3 pl-3 border-l-[2.5px] border-[#FF5634]">
                <p className="text-[13px] leading-relaxed text-gray-700 dark:text-gray-300">“{pin.note}”</p>
                {(curatorName || curatorAvatar) && (
                  <div className="mt-2 flex items-center gap-1.5">
                    {curatorAvatar
                      ? <img src={cfImage(curatorAvatar, { width: 40, format: 'auto' }) || curatorAvatar} alt="" className="w-5 h-5 rounded-full object-cover" loading="lazy" decoding="async" />
                      : <div className="w-5 h-5 rounded-full bg-gradient-to-br from-gray-300 to-gray-400" />}
                    {curatorName && <span className="text-[11.5px] font-semibold text-gray-500 dark:text-gray-400">{curatorName}</span>}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-2.5">
            <p className="text-[13px] font-bold leading-tight line-clamp-2 text-[#141A2E] dark:text-white">{pin.product_name}</p>
            <div className="mt-1.5 flex items-baseline gap-1.5 flex-wrap">
              {hasDeal && (
                <span className="text-[11px] line-through text-gray-400 dark:text-gray-500">{formatWon(pin.original_price as number)}</span>
              )}
              <span className="text-[15px] font-extrabold text-[#141A2E] dark:text-white">{formatWon(pin.price)}</span>
              {savings > 0 && (
                <span className="ml-auto text-[11px] font-extrabold text-[#0E9F6E]">{formatWon(savings)}<span className="font-semibold opacity-70"> 절약</span></span>
              )}
            </div>
            {/* 추천 이유(note): 좌측 coral rule + 인용 */}
            {pin.note && (
              <div className="mt-2 pl-2 border-l-2 border-[#FF5634]">
                <p className="text-[11.5px] leading-snug line-clamp-2 text-gray-700 dark:text-gray-300">{pin.note}</p>
              </div>
            )}
          </div>
        )}
      </a>
      {/* 🛡️ 2026-05-27 (사용자 요청): 본인 view 에서 핀 삭제 버튼. */}
      {isOwner && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          aria-label="핀 삭제"
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 hover:bg-red-500 text-white flex items-center justify-center transition-colors text-sm font-bold opacity-0 group-hover:opacity-100 disabled:opacity-50"
        >
          ✕
        </button>
      )}
    </div>
  )
}

// 🏭 2026-06-05 (사용자 요청 — @user2 같은 핸들 변경): 핸들 편집기(소유자). 저장 시 /u/{새핸들} 로 URL 변경.
//   백엔드는 이미 존재(PATCH /api/curator/me/handle + checkHandle) — UI 만 없었음.
function HandleEditor({ handle }: { handle: string }) {
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(handle)
  const [status, setStatus] = useState<'idle' | 'checking' | 'ok' | 'bad' | 'saving'>('idle')
  const [msg, setMsg] = useState('')
  useEffect(() => {
    if (!editing) return
    const h = val.trim().toLowerCase()
    if (h === handle) { setStatus('idle'); setMsg(''); return }
    if (!/^[a-z0-9_]{3,30}$/.test(h)) { setStatus('bad'); setMsg('영문 소문자/숫자/_ 3~30자'); return }
    setStatus('checking'); setMsg('확인 중…')
    const tm = setTimeout(async () => {
      try {
        const r = await curatorApi.checkHandle(h)
        if (r.available) { setStatus('ok'); setMsg('사용 가능합니다') }
        else { setStatus('bad'); setMsg(r.message || '이미 사용 중입니다') }
      } catch { setStatus('idle'); setMsg('') }
    }, 400)
    return () => clearTimeout(tm)
  }, [val, editing, handle])
  const save = async () => {
    const h = val.trim().toLowerCase()
    if (h === handle) { setEditing(false); return }
    if (status !== 'ok') return
    setStatus('saving')
    try {
      const r = await curatorApi.updateHandle(h)
      if (r.success && r.handle) { navigate(`/u/${r.handle}`, { replace: true }); setEditing(false) }
      else { setStatus('bad'); setMsg(r.error || '변경에 실패했습니다') }
    } catch { setStatus('bad'); setMsg('변경에 실패했습니다') }
  }
  if (!editing) {
    return (
      <dd className="text-white font-mono flex items-center gap-2">
        @{handle}
        <button onClick={() => { setEditing(true); setVal(handle); setStatus('idle'); setMsg('') }} className="text-[11px] text-gray-900 dark:text-white font-bold font-sans">변경</button>
      </dd>
    )
  }
  return (
    <dd className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <span className="text-white/50 font-mono text-sm">@</span>
        <input value={val} onChange={e => setVal(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())} maxLength={30}
          className="w-28 bg-transparent border-b border-gray-500 text-white font-mono text-sm focus:outline-none focus:border-gray-900 dark:border-white" autoFocus />
        <button onClick={save} disabled={status !== 'ok'} className="text-[12px] text-gray-900 dark:text-white font-bold disabled:opacity-40">{status === 'saving' ? '저장 중' : '저장'}</button>
        <button onClick={() => { setEditing(false); setVal(handle); setStatus('idle') }} className="text-[12px] text-gray-500">취소</button>
      </div>
      {msg && <span className={`text-[10px] ${status === 'ok' ? 'text-emerald-400' : status === 'checking' ? 'text-gray-400' : 'text-red-400'}`}>{msg}</span>}
    </dd>
  )
}

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
              className={`flex items-center gap-3 rounded-2xl border p-2.5 bg-white dark:bg-[#121212] ${dragging ? 'border-[#FF5634] shadow-lg' : 'border-gray-200 dark:border-[#2A2A2A]'}`}
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
                  {idx === 0 && <span className="shrink-0 text-[9.5px] font-extrabold text-[#FF5634] bg-[#FFEDE8] dark:bg-[#2a1812] px-1.5 py-0.5 rounded">강추</span>}
                </div>
                {pin.note
                  ? <div className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-1">조회 {fmtK(pin.click_count || 0)}{est > 0 ? ` · 적립 ₩${est.toLocaleString('ko-KR')}/건` : ''}</div>
                  : <div className="text-[11.5px] font-semibold text-[#C2491F] dark:text-[#FF9576] mt-1">추천 코멘트 없음 · 추가하면 전환 ↑</div>}
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
      <div className="mb-3 rounded-2xl border border-[#FFE0D6] dark:border-[#3a2218] bg-[#FFF6F3] dark:bg-[#1A1410] px-4 py-3.5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-extrabold text-[#B4422A] dark:text-[#FF9576]">링크샵 완성까지 {3 - doneCount}단계</span>
          <span className="text-[12px] font-bold text-[#B4422A] dark:text-[#FF9576]">{doneCount}/3</span>
        </div>
        <div className="mt-2.5 h-[7px] rounded-full bg-[#FFE0D6] dark:bg-[#3a2218] overflow-hidden">
          <div className="h-full rounded-full bg-[#FF5634] transition-all" style={{ width: `${Math.round((doneCount / 3) * 100)}%` }} />
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
                <span className="absolute top-0 left-0 min-w-[1.5rem] h-6 px-1.5 bg-[#FF5634] text-white text-[13px] font-extrabold flex items-center justify-center rounded-br-[11px]">{n}</span>
              </div>
              <div className="p-2.5">
                <div className="h-3 w-4/5 rounded bg-gray-200 dark:bg-[#1A1A1A]" />
                <div className="h-3.5 w-1/2 rounded bg-gray-200 dark:bg-[#1A1A1A] mt-2" />
                <div className="mt-2 pl-2 border-l-2 border-[#FF5634]"><div className="h-2.5 w-11/12 rounded bg-gray-100 dark:bg-[#161616]" /></div>
              </div>
            </div>
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center text-center px-6 pb-1">
          <div className="w-14 h-14 rounded-2xl bg-[#FF5634] flex items-center justify-center text-white" style={{ boxShadow: '0 10px 24px -8px rgba(255,86,52,.6)' }}>
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
