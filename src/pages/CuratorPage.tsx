/**
 * 🛡️ 2026-05-25 (migration 0278): 큐레이터 공개 페이지 (/u/:handle).
 *
 * 모든 유저가 본인 링크샵 보유. 다크 테마 고정 (라이브와 톤 통일).
 * 본인이면 dashboard mini card + 수익 stats 표시.
 *
 * Phase 1-A 인프라: 핀 grid + 큐레이터 헤더 + 공유 버튼 + SEO + OG.
 * Phase 1-C/D 의 dashboard / 공유 sheet 는 추후 commit 에서 확장.
 */

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import KakaoShareButton from '@/components/KakaoShareButton'
import { curatorApi, type CuratorPageResponse, type CuratorPin } from '@/features/curator/api/curator-api'
import { useAuthStore } from '@/client/stores/auth.store'
import { formatWon } from '@/utils/format'

export default function CuratorPage() {
  const { handle = '' } = useParams<{ handle: string }>()
  const { t } = useTranslation()
  const [data, setData] = useState<CuratorPageResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
        if (!res.success) setError(res.error || t('curator.notFound', { defaultValue: '큐레이터를 찾을 수 없어요' }))
        else setData(res)
      })
      .catch(() => alive && setError(t('curator.fetchError', { defaultValue: '불러오기 실패' })))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [handle, t])

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

  const { curator, pins } = data

  return (
    <>
      <SEO
        title={`${curator.name} (@${curator.handle}) 의 링크샵`}
        description={curator.bio || `${curator.name} 님이 추천하는 ${pins.length}개의 상품`}
        url={`/u/${curator.handle}`}
        image={`https://live.ur-team.com/api/og/curator/${curator.handle}`}
      />
      <div className="min-h-screen bg-[#020202] text-white pb-24">
        <CuratorHeader curator={curator} pinCount={pins.length} isOwner={isOwner} />

        {pins.length === 0 ? (
          <EmptyLinkshop handle={curator.handle} isOwner={isOwner} />
        ) : (
          <PinGrid pins={pins} handle={curator.handle} isOwner={isOwner} />
        )}
      </div>
    </>
  )
}

function CuratorHeader({ curator, pinCount, isOwner }: { curator: CuratorPageResponse['curator']; pinCount: number; isOwner: boolean }) {
  const { t } = useTranslation()
  const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}/u/${curator.handle}` : `/u/${curator.handle}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(fullUrl)
      alert(t('curator.linkCopied', { defaultValue: '링크가 복사되었어요' }))
    } catch { /* ignore */ }
  }

  return (
    <header className="pt-8 pb-6 px-4 border-b border-[#1A1A1A]">
      <div className="max-w-3xl mx-auto flex items-start gap-4">
        {curator.profile_image ? (
          <img src={curator.profile_image} alt={curator.name} className="w-20 h-20 rounded-full object-cover bg-[#121212]" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-[#1A1A1A] flex items-center justify-center text-3xl font-bold text-pink-400">
            {(curator.name || '?').slice(0, 1)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{curator.name}</h1>
          <p className="text-sm text-gray-400">@{curator.handle}</p>
          {curator.bio && <p className="text-sm text-gray-300 mt-2 line-clamp-2">{curator.bio}</p>}
          <p className="text-xs text-gray-500 mt-2">{t('curator.pinCount', { count: pinCount, defaultValue: '{{count}}개 상품 추천 중' })}</p>
        </div>
      </div>
      <div className="max-w-3xl mx-auto flex gap-2 mt-4">
        <div className="flex-1">
          <KakaoShareButton
            title={`${curator.name} 의 링크샵`}
            description={curator.bio || `${pinCount}개 상품 추천 중`}
            imageUrl={`https://live.ur-team.com/api/og/curator/${curator.handle}`}
            link={`/u/${curator.handle}`}
            className="w-full py-2.5 bg-[#FEE500] hover:bg-[#FDD835] text-[#3C1E1E] rounded-xl text-sm font-bold transition-colors"
            buttonText="링크샵 둘러보기"
          />
        </div>
        <button
          onClick={copyLink}
          className="px-4 py-2.5 bg-[#121212] hover:bg-[#1A1A1A] rounded-xl text-sm font-bold transition-colors"
          aria-label={t('curator.copyLink', { defaultValue: '링크 복사' })}
        >
          🔗
        </button>
        {isOwner && (
          <Link
            to="/u/me/earnings"
            className="px-4 py-2.5 bg-pink-500 hover:bg-pink-600 rounded-xl text-sm font-bold text-center transition-colors"
            aria-label={t('curator.viewEarnings', { defaultValue: '내 적립 보기' })}
          >
            💰
          </Link>
        )}
      </div>
    </header>
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
  // 외부 공유 URL — 큐레이터 ref 자동 부여
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
