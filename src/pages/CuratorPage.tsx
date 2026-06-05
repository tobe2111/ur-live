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
import { curatorApi, type CuratorPageResponse, type CuratorPin } from '@/features/curator/api/curator-api'
import { useAuthStore } from '@/client/stores/auth.store'
import { formatWon, formatNumber } from '@/utils/format'
import { cfImage, cfSrcSet } from '@/utils/cf-image'
import { toast } from '@/hooks/useToast'
import CuratorHeader from './curator-page/CuratorHeader'
import CuratorTabs, { type CuratorTab } from './curator-page/CuratorTabs'

// 🛡️ 2026-05-25 (C 옵션 URL 통합): linked seller 있으면 같은 페이지에서 SellerPublicPage 직접 render.
//   redirect 없음 — URL 그대로 (/u/:handle 유지). lazy chunk — 일반 user 진입 시 chunk fetch 안 함.
const SellerPublicPage = lazy(() => import('./SellerPublicPage'))

export default function CuratorPage() {
  const { handle = '' } = useParams<{ handle: string }>()
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
    return null
  })
  const [loading, setLoading] = useState(!data)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<CuratorTab>('home')
  const [monthEarnings, setMonthEarnings] = useState(0)
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

  // 🛡️ 2026-05-27 (옵션 C): 본인 view 에서만 dashboard 추가 fetch — 30일 적립 노출.
  useEffect(() => {
    if (!isOwner) return
    curatorApi.getDashboard()
      .then((r: any) => setMonthEarnings(r?.stats?.month_earnings ?? 0))
      .catch(() => { /* graceful */ })
  }, [isOwner])

  useEffect(() => {
    if (!handle) return
    let alive = true
    // 🛡️ 2026-05-31: SSR 초기 데이터(__SSR_INITIAL_CURATOR__)가 현재 handle 과 일치하면 로더 생략 →
    //   SSR 즉시 paint 유지(깜빡임 방지, 잠긴 GroupBuyDetail 패턴). 다른 handle 로 이동 시에만 로딩.
    if (data?.curator?.handle !== handle) setLoading(true)
    setError(null)
    curatorApi
      .getPage(handle)
      .then((res) => {
        if (!alive) return
        if (!res.success) {
          setError(res.error || t('curator.notFound', { defaultValue: '큐레이터를 찾을 수 없어요' }))
          return
        }
        // 🛡️ 2026-05-25 (C 옵션 URL 통합): linked seller 있어도 redirect X.
        //   대신 본 페이지에서 SellerPublicPage 컴포넌트 직접 render (URL 그대로 유지).
        //   아래 if 분기 — data 만 set, render 시 SellerPublicPage 사용.
        setData(res)
      })
      .catch(() => alive && setError(t('curator.fetchError', { defaultValue: '불러오기 실패' })))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [handle, t])

  const totalClicks = useMemo(() => {
    if (!data?.pins) return 0
    return data.pins.reduce((sum, p) => sum + (p.click_count || 0), 0)
  }, [data])

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

  async function copyLink() {
    const fullUrl = `${window.location.origin}/u/${handle}`
    try {
      await navigator.clipboard.writeText(fullUrl)
      toast.success('링크가 복사되었어요')
    } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#020202] text-gray-900 dark:text-white flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">{t('common.loading')}</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#020202] text-gray-900 dark:text-white flex flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-bold mb-2">{t('curator.notFoundTitle', { defaultValue: '😢 링크샵을 찾을 수 없어요' })}</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">@{handle}</p>
        <Link to="/" className="px-6 py-3 bg-pink-500 rounded-xl text-white font-bold">{t('curator.goHome', { defaultValue: '홈으로' })}</Link>
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
          <div className="sticky top-0 z-30 bg-pink-500 text-white px-4 py-2 text-xs font-bold flex items-center justify-between gap-2">
            <span>✏️ 내 링크샵 — 이름/소개/이미지/배경 클릭해 바로 편집</span>
            <Link
              to="/u/me/earnings"
              className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-[10px] font-bold whitespace-nowrap"
            >
              수익 보기
            </Link>
          </div>
        )}
        <CuratorHeader
          curator={curator}
          pinCount={pins.length}
          totalClicks={totalClicks}
          monthEarnings={monthEarnings}
          isOwner={isOwner}
          onCopyLink={copyLink}
          onCuratorUpdate={(next) => setData(prev => prev ? { ...prev, curator: { ...prev.curator, ...next } } : prev)}
        />
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
                pins={pins}
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
        {tab === 'info' && <InfoTab curator={curator} pinCount={pins.length} totalClicks={totalClicks} isOwner={isOwner} />}
      </div>
    </>
  )
}

function PinGrid({ pins, handle, isOwner, onPinDeleted }: { pins: CuratorPin[]; handle: string; isOwner: boolean; onPinDeleted: (id: number) => void }) {
  return (
    <div className="max-w-3xl mx-auto p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
      {pins.map((pin, idx) => (
        <PinCard key={pin.id} pin={pin} index={idx} handle={handle} isOwner={isOwner} aboveFold={idx < 4} onDeleted={onPinDeleted} />
      ))}
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

  return (
    <div className="relative group">
      <a href={redirectUrl} className="block bg-white dark:bg-[#0A0A0A] rounded-xl overflow-hidden border border-gray-200 dark:border-[#1A1A1A] hover:border-pink-500/50 transition-colors">
        {/* 🏭 2026-06-04 (카드 로딩 체감): dominant_color placeholder + fade-in — 그레이→이미지 대신 색→이미지. */}
        <div className="aspect-square bg-gray-100 dark:bg-[#121212] relative" style={pin.dominant_color ? { backgroundColor: pin.dominant_color } : undefined}>
          {/* 🛡️ 2026-05-28: 링크샵 카드 순번 뱃지 (position 순) */}
          <span className="absolute top-1.5 left-1.5 z-10 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-black/70 text-white text-[11px] font-bold flex items-center justify-center backdrop-blur">
            {index + 1}
          </span>
          {productImg ? (
            <img
              src={cfImage(productImg, { width: 200, format: 'auto' }) || productImg}
              srcSet={cfSrcSet(productImg, 200) || undefined}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
              alt={pin.product_name}
              loading={aboveFold ? 'eager' : 'lazy'}
              fetchPriority={aboveFold ? 'high' : 'auto'}
              decoding="async"
              onLoad={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '1' }}
              style={{ opacity: aboveFold ? 1 : 0, transition: 'opacity 200ms ease-out' }}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">no image</div>
          )}
        </div>
        <div className="p-2.5">
          <p className="text-xs text-gray-900 dark:text-white line-clamp-2 leading-tight">{pin.product_name}</p>
          <p className="text-sm font-bold text-pink-400 mt-1">{formatWon(pin.price)}</p>
          {pin.note && <p className="text-[10px] text-gray-400 mt-1 line-clamp-1">💬 {pin.note}</p>}
          {isOwner && (
            <p className="text-[10px] text-gray-500 mt-1">
              👆 {pin.click_count.toLocaleString()} {t('curator.clicks', { defaultValue: '클릭' })}
            </p>
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
        <button onClick={() => { setEditing(true); setVal(handle); setStatus('idle'); setMsg('') }} className="text-[11px] text-pink-400 font-bold font-sans">변경</button>
      </dd>
    )
  }
  return (
    <dd className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <span className="text-white/50 font-mono text-sm">@</span>
        <input value={val} onChange={e => setVal(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())} maxLength={30}
          className="w-28 bg-transparent border-b border-gray-500 text-white font-mono text-sm focus:outline-none focus:border-pink-400" autoFocus />
        <button onClick={save} disabled={status !== 'ok'} className="text-[12px] text-pink-400 font-bold disabled:opacity-40">{status === 'saving' ? '저장 중' : '저장'}</button>
        <button onClick={() => { setEditing(false); setVal(handle); setStatus('idle') }} className="text-[12px] text-gray-500">취소</button>
      </div>
      {msg && <span className={`text-[10px] ${status === 'ok' ? 'text-emerald-400' : status === 'checking' ? 'text-gray-400' : 'text-red-400'}`}>{msg}</span>}
    </dd>
  )
}

function InfoTab({ curator, pinCount, totalClicks, isOwner }: { curator: CuratorPageResponse['curator']; pinCount: number; totalClicks: number; isOwner: boolean }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <section className="bg-white dark:bg-[#0A0A0A] rounded-xl p-5 border border-gray-200 dark:border-[#1A1A1A]">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">📋 활동 정보</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <dt className="text-gray-400">핸들</dt>
            {isOwner ? <HandleEditor handle={curator.handle} /> : <dd className="text-white font-mono">@{curator.handle}</dd>}
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-400">추천 상품</dt>
            <dd className="text-white">{formatNumber(pinCount)}개</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-400">누적 클릭</dt>
            <dd className="text-white">{formatNumber(totalClicks)}회</dd>
          </div>
        </dl>
      </section>

      {curator.bio && (
        <section className="bg-white dark:bg-[#0A0A0A] rounded-xl p-5 border border-gray-200 dark:border-[#1A1A1A]">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">💬 한 줄 소개</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{curator.bio}</p>
        </section>
      )}

      <section className="bg-gradient-to-br from-pink-500/10 to-purple-500/10 rounded-xl p-5 border border-pink-500/30">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">🔗 친구에게 추천</h3>
        <p className="text-xs text-gray-300 mb-3">
          이 페이지에서 친구가 상품을 구매하면 큐레이터에게 적립이 돌아갑니다.
        </p>
        <Link
          to="/host/new"
          className="block text-center py-2 bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold rounded-lg"
        >
          나도 링크샵 만들기
        </Link>
      </section>
    </div>
  )
}

function EmptyLinkshop({ handle, isOwner, emptyType }: { handle: string; isOwner: boolean; emptyType?: 'shop' | 'voucher' }) {
  const { t } = useTranslation()
  const browseLink = emptyType === 'voucher' ? '/vouchers' : '/browse'
  const browseLabel = emptyType === 'voucher' ? '교환권 둘러보기' : '상품 둘러보기'
  const emoji = emptyType === 'voucher' ? '🎁' : '📌'
  const emptyMessage = emptyType === 'shop' ? '아직 담은 상품이 없어요'
    : emptyType === 'voucher' ? '아직 담은 교환권이 없어요'
    : t('curator.emptyTitle', { defaultValue: '아직 핀이 없어요' })
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <p className="text-5xl mb-4">{emoji}</p>
      <h2 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">{emptyMessage}</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        {isOwner
          ? t('curator.emptyOwner', { defaultValue: '상품을 둘러보고 추천 링크 복사하면 자동 담아져요' })
          : t('curator.emptyOther', { defaultValue: `@${handle} 의 첫 추천을 기다리는 중`, handle })}
      </p>
      <Link
        to={browseLink}
        className="inline-block px-6 py-3 bg-pink-500 hover:bg-pink-600 rounded-xl font-bold text-white transition-colors"
      >
        {isOwner ? browseLabel : t('curator.exploreShop', { defaultValue: '쇼핑 둘러보기' })}
      </Link>
    </div>
  )
}
