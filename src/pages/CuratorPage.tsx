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
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import { curatorApi, type CuratorPageResponse, type CuratorPin } from '@/features/curator/api/curator-api'
import { useAuthStore } from '@/client/stores/auth.store'
import { formatWon, formatNumber } from '@/utils/format'
import { toast } from '@/hooks/useToast'
import CuratorHeader from './curator-page/CuratorHeader'
import CuratorTabs, { type CuratorTab } from './curator-page/CuratorTabs'

// 🛡️ 2026-05-25 (C 옵션 URL 통합): linked seller 있으면 같은 페이지에서 SellerPublicPage 직접 render.
//   redirect 없음 — URL 그대로 (/u/:handle 유지). lazy chunk — 일반 user 진입 시 chunk fetch 안 함.
const SellerPublicPage = lazy(() => import('./SellerPublicPage'))

export default function CuratorPage() {
  const { handle = '' } = useParams<{ handle: string }>()
  const { t } = useTranslation()
  const [data, setData] = useState<CuratorPageResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<CuratorTab>('pins')
  const currentUser = useAuthStore((s: any) => s.user)
  const isOwner = Boolean(currentUser && data?.curator && Number(currentUser.id) === data.curator.id)

  useEffect(() => {
    if (!handle) return
    let alive = true
    setLoading(true)
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

  async function copyLink() {
    const fullUrl = `${window.location.origin}/u/${handle}`
    try {
      await navigator.clipboard.writeText(fullUrl)
      toast.success('링크가 복사되었어요')
    } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020202] text-white flex items-center justify-center">
        <div className="text-gray-400">{t('common.loading')}</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#020202] text-white flex flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-bold mb-2">{t('curator.notFoundTitle', { defaultValue: '😢 링크샵을 찾을 수 없어요' })}</h1>
        <p className="text-gray-400 mb-6">@{handle}</p>
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
        <div className="min-h-screen bg-[#020202] text-white flex items-center justify-center">
          <div className="text-gray-400">{t('common.loading')}</div>
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
      <div className="min-h-screen bg-[#020202] text-white pb-24">
        <CuratorHeader
          curator={curator}
          pinCount={pins.length}
          totalClicks={totalClicks}
          isOwner={isOwner}
          onCopyLink={copyLink}
        />
        <CuratorTabs tab={tab} onChange={setTab} pinCount={pins.length} />

        {tab === 'pins' && (
          pins.length === 0
            ? <EmptyLinkshop handle={curator.handle} isOwner={isOwner} />
            : <PinGrid pins={pins} handle={curator.handle} isOwner={isOwner} />
        )}
        {tab === 'info' && <InfoTab curator={curator} pinCount={pins.length} totalClicks={totalClicks} />}
      </div>
    </>
  )
}

function PinGrid({ pins, handle, isOwner }: { pins: CuratorPin[]; handle: string; isOwner: boolean }) {
  return (
    <div className="max-w-3xl mx-auto p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
      {pins.map((pin) => (
        <PinCard key={pin.id} pin={pin} handle={handle} isOwner={isOwner} />
      ))}
    </div>
  )
}

function PinCard({ pin, handle, isOwner }: { pin: CuratorPin; handle: string; isOwner: boolean }) {
  const { t } = useTranslation()
  const productImg = pin.thumbnail || pin.image_url || ''
  const redirectUrl = `/u/${handle}/p/${pin.product_id}/redirect`

  return (
    <a href={redirectUrl} className="block bg-[#0A0A0A] rounded-xl overflow-hidden border border-[#1A1A1A] hover:border-pink-500/50 transition-colors">
      <div className="aspect-square bg-[#121212] relative">
        {productImg ? (
          <img src={productImg} alt={pin.product_name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">no image</div>
        )}
      </div>
      <div className="p-2.5">
        <p className="text-xs text-white line-clamp-2 leading-tight">{pin.product_name}</p>
        <p className="text-sm font-bold text-pink-400 mt-1">{formatWon(pin.price)}</p>
        {pin.note && <p className="text-[10px] text-gray-400 mt-1 line-clamp-1">💬 {pin.note}</p>}
        {isOwner && (
          <p className="text-[10px] text-gray-500 mt-1">
            👆 {pin.click_count.toLocaleString()} {t('curator.clicks', { defaultValue: '클릭' })}
          </p>
        )}
      </div>
    </a>
  )
}

function InfoTab({ curator, pinCount, totalClicks }: { curator: CuratorPageResponse['curator']; pinCount: number; totalClicks: number }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <section className="bg-[#0A0A0A] rounded-xl p-5 border border-[#1A1A1A]">
        <h3 className="text-sm font-bold text-white mb-3">📋 활동 정보</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-400">핸들</dt>
            <dd className="text-white font-mono">@{curator.handle}</dd>
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
        <section className="bg-[#0A0A0A] rounded-xl p-5 border border-[#1A1A1A]">
          <h3 className="text-sm font-bold text-white mb-3">💬 한 줄 소개</h3>
          <p className="text-sm text-gray-300 leading-relaxed">{curator.bio}</p>
        </section>
      )}

      <section className="bg-gradient-to-br from-pink-500/10 to-purple-500/10 rounded-xl p-5 border border-pink-500/30">
        <h3 className="text-sm font-bold text-white mb-2">🔗 친구에게 추천</h3>
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

function EmptyLinkshop({ handle, isOwner }: { handle: string; isOwner: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <p className="text-5xl mb-4">📌</p>
      <h2 className="text-lg font-bold mb-2">{t('curator.emptyTitle', { defaultValue: '아직 핀이 없어요' })}</h2>
      <p className="text-sm text-gray-400 mb-6">
        {isOwner
          ? t('curator.emptyOwner', { defaultValue: '상품을 둘러보고 + 버튼으로 첫 핀을 추가해보세요' })
          : t('curator.emptyOther', { defaultValue: `@${handle} 의 첫 추천을 기다리는 중`, handle })}
      </p>
      <Link
        to="/browse"
        className="inline-block px-6 py-3 bg-pink-500 hover:bg-pink-600 rounded-xl font-bold transition-colors"
      >
        {isOwner ? t('curator.startBrowse', { defaultValue: '상품 둘러보기' }) : t('curator.exploreShop', { defaultValue: '쇼핑 둘러보기' })}
      </Link>
    </div>
  )
}
