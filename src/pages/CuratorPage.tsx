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

  return (
    <>
      <SEO
        title={`${curator.name} (@${curator.handle}) 의 링크샵`}
        description={curator.bio || `${curator.name} 님이 추천하는 ${pins.length}개의 상품`}
        url={`/u/${curator.handle}`}
        image={`https://live.ur-team.com/api/og/curator/${curator.handle}`}
      />
      <div className="min-h-screen bg-white dark:bg-[#020202] text-gray-900 dark:text-white pb-28">
        {/* 🛡️ 2026-05-27 (셀러 페이지 통일): owner sticky 안내 배너 — 셀러 페이지와 같은 패턴. */}
        {isOwner && (
          <div className="sticky top-0 z-30 bg-gray-900 dark:bg-white text-white dark:text-[#020202] px-4 py-2 text-xs font-bold flex items-center justify-between gap-2">
            <span>✏️ 내 링크샵 — 이름/소개/이미지/배경 클릭해 바로 편집</span>
            <Link
              to="/creator"
              className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-[10px] font-bold whitespace-nowrap"
            >
              크리에이터 콘솔
            </Link>
          </div>
        )}
        {isOwner && showOnboard && (
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
          isOwner={isOwner}
          onCopyLink={copyLink}
          onCuratorUpdate={(next) => setData(prev => prev ? { ...prev, curator: { ...prev.curator, ...next } } : prev)}
        />
        {isOwner && <OwnerEarningsStrip />}
        <CuratorTabs
          tab={tab}
          onChange={setTab}
          pinCount={pins.length}
          shopCount={shopPins.length}
          voucherCount={voucherPins.length}
        />

        {tab === 'home' && (
          pins.length === 0
            ? <EmptyLinkshop handle={curator.handle} isOwner={isOwner} />
            : <PinGrid
                pins={homePins}
                handle={curator.handle}
                isOwner={isOwner}
                onPinDeleted={(pinId) => setData(prev => prev ? { ...prev, pins: prev.pins.filter(p => p.id !== pinId) } : prev)}
              />
        )}
        {tab === 'shop' && (
          shopPins.length === 0
            ? <EmptyLinkshop handle={curator.handle} isOwner={isOwner} emptyType="shop" />
            : <PinGrid
                pins={shopPins}
                handle={curator.handle}
                isOwner={isOwner}
                onPinDeleted={(pinId) => setData(prev => prev ? { ...prev, pins: prev.pins.filter(p => p.id !== pinId) } : prev)}
              />
        )}
        {tab === 'vouchers' && (
          voucherPins.length === 0
            ? <EmptyLinkshop handle={curator.handle} isOwner={isOwner} emptyType="voucher" />
            : <PinGrid
                pins={voucherPins}
                handle={curator.handle}
                isOwner={isOwner}
                onPinDeleted={(pinId) => setData(prev => prev ? { ...prev, pins: prev.pins.filter(p => p.id !== pinId) } : prev)}
              />
        )}
        {/* 🛡️ 2026-06-11 (사용자): '정보' 탭 제거 — 핸들 변경 기능만 오너 전용 슬림 행으로 보존 */}
        {isOwner && (
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between text-sm border-t border-gray-100 dark:border-[#1A1A1A] mt-6">
            <span className="text-gray-400">링크샵 주소</span>
            <HandleEditor handle={curator.handle} />
          </div>
        )}

        {/* 🧭 2026-06-10 (UI 100점 패스 — 방문자 전환): 비소유자 성장 루프 CTA.
            링크트리식 — 방문자가 1탭으로 자기 링크샵 시작(적립 루프 신규 큐레이터 유입). */}
        {!isOwner && (
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

function PinGrid({ pins, handle, isOwner, onPinDeleted }: { pins: CuratorPin[]; handle: string; isOwner: boolean; onPinDeleted: (id: number) => void }) {
  return (
    <div className="max-w-3xl mx-auto p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
      {pins.map((pin, idx) => (
        <PinCard key={pin.id} pin={pin} index={idx} handle={handle} isOwner={isOwner} aboveFold={idx < 4} onDeleted={onPinDeleted} />
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

function PinCard({ pin, index, handle, isOwner, aboveFold, onDeleted }: { pin: CuratorPin; index: number; handle: string; isOwner: boolean; aboveFold: boolean; onDeleted: (id: number) => void }) {
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

  return (
    <div className="relative group">
      {/* 🎨 2026-06-16 링크샵 개선안: 흰 에디토리얼 카드(AI 그라데이션 제거) — 번호 코너플래그 + 다크 가격칩 + 절약 초록 + coral-rule 인용. */}
      <a href={redirectUrl} className="block rounded-xl overflow-hidden border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] active:scale-[0.98] transition-transform">
        <div className="aspect-[3/2] relative" style={{ backgroundColor: grad.base }}>
          {/* 큐레이션 순번 = 좌상단 코너 플래그 (sort order) */}
          <span className="absolute top-0 left-0 z-10 min-w-[1.5rem] h-6 px-1.5 bg-[#FF5634] text-white text-[13px] font-extrabold flex items-center justify-center rounded-br-[11px]">
            {index + 1}
          </span>
          {productImg && !imgError ? (
            <img
              src={cfImage(productImg, { width: 200, format: 'auto' }) || productImg}
              srcSet={cfSrcSet(productImg, 200) || undefined}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
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
          {/* 딜 가치: 이미지 위 다크 가격칩 (할인율) */}
          {discountPct > 0 && (
            <span className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded-md bg-[#141A2E]/90 text-[#FF7A5C] text-[12px] font-extrabold backdrop-blur">
              {discountPct}%
            </span>
          )}
        </div>
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
          {/* 추천 이유(note): 좌측 coral rule + 인용 (이모지 제거 — "사람이 직접 골랐다" 신뢰) */}
          {pin.note && (
            <div className="mt-2 pl-2 border-l-2 border-[#FF5634]">
              <p className="text-[11.5px] leading-snug line-clamp-2 text-gray-700 dark:text-gray-300">{pin.note}</p>
            </div>
          )}
        </div>
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

function EmptyLinkshop({ handle, isOwner, emptyType }: { handle: string; isOwner: boolean; emptyType?: 'shop' | 'voucher' }) {
  const { t } = useTranslation()
  const browseLink = emptyType === 'voucher' ? '/vouchers' : '/browse'
  const browseLabel = emptyType === 'voucher'
    ? t('curator.browseVouchers', { defaultValue: '교환권 둘러보기' })
    : t('curator.browseProducts', { defaultValue: '상품 둘러보기' })
  const emoji = emptyType === 'voucher' ? '🎁' : '📌'
  const emptyMessage = emptyType === 'shop' ? t('curator.emptyShop', { defaultValue: '아직 담은 상품이 없어요' })
    : emptyType === 'voucher' ? t('curator.emptyVoucher', { defaultValue: '아직 담은 교환권이 없어요' })
    : t('curator.emptyTitle', { defaultValue: '아직 핀이 없어요' })
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <p className="text-5xl mb-4">{emoji}</p>
      <h2 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">{emptyMessage}</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        {isOwner
          // 🛡️ 2026-06-12 (감사 1단계): 실제 동작과 일치 — 링크 복사 자동담기 기능은 없음, 📌 핀 버튼이 실동작.
          ? t('curator.emptyOwner', { defaultValue: '상품을 둘러보고 상세 페이지의 ➕ 핀 버튼으로 담아보세요' })
          : t('curator.emptyOther', { defaultValue: `@${handle} 의 첫 추천을 기다리는 중`, handle })}
      </p>
      <Link
        to={browseLink}
        className="inline-block px-6 py-3 bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-100 rounded-xl font-bold text-white dark:text-[#020202] transition-colors"
      >
        {isOwner ? browseLabel : t('curator.exploreShop', { defaultValue: '쇼핑 둘러보기' })}
      </Link>
    </div>
  )
}
