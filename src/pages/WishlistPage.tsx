import { DEAL_GRID_GAP } from '@/shared/deal-card-grid'
import Udal from '@/components/mascot/Udal'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '@/lib/i18n-lite'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { isLoggedInSync, getUserIdSync } from '@/utils/auth'
import { WalletPageWrapper } from '@/components/wallet/WalletAtoms'
import SubPageHeader from '@/components/ui/sub-page-header'
import { walletTokens } from '@/components/wallet/walletTokens'
import { useTheme } from '@/shared/stores/useTheme'
import { useWishlist, type WishlistItem } from '@/hooks/queries/useWishlist'
import { WishlistSortChips, WishlistFlag, WishlistSummaryRail } from './wishlist/WishlistParts'
import { priceDrop, summarize, sortWishlist, type WishlistSort } from './wishlist/wishlist-signals'
import BrandLoader from '@/components/brand/BrandLoader'
import GroupBuyFeedCard from './main-home/GroupBuyFeedCard'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { readCachedLoc } from '@/shared/utils/cached-loc'
import WishlistRecommend from './wishlist/WishlistRecommend'
import { WishlistSummaryCard, WishlistRows } from './wishlist/WishlistMobile'
// 🖼️ 폭·중단점은 워커의 카드 preload 와 같은 값이어야 한다(`shared/home-card-image` SSOT).
import { HOME_CARD_IMG_WIDTH_LG, HOME_CARD_IMG_WIDTH_BASE, HOME_CARD_LG_QUERY } from '@/shared/home-card-image'

// 💗 2026-08-19: 자체 그라데이션 카드(WishlistCard)를 제거했다 — 찜 목록도 홈과 **같은 카드**를 쓴다
//   (대표 "기존 이용권 UI로 해줘야지"). 카드가 한 벌이어야 화면마다 같은 상품이 다르게 안 보인다.

const WishlistPage: React.FC = () => {
  // 🖼️ 사진 해상도 — 홈과 같은 규칙(열 수를 아는 쪽이 정한다). 가드: `home-card-image-width`.
  const isLgViewport = useMediaQuery(HOME_CARD_LG_QUERY)
  const cardImgWidth = isLgViewport ? HOME_CARD_IMG_WIDTH_LG : HOME_CARD_IMG_WIDTH_BASE

  const { t } = useTranslation()
  const navigate = useNavigate()
  const [userId, setUserId] = useState<number | null>(null)
  // 💗 2026-09-03 (대표 확정 — 안 B): 찜은 "구경"이 아니라 **결정**하러 오는 곳이라, 정렬 기준이 곧 화면의 일이다.
  const [sort, setSort] = useState<WishlistSort>('recent')
  // 🛡️ 2026-06-01 Tier2: 수동 페칭 → React Query (목록 캐싱). userId 는 WishlistButton 에 전달용 유지.
  const { data: wishlists = [], isLoading: loading, isError, refetch } = useWishlist()
  const error = isError ? t('wishlist.loadError') : null

  useEffect(() => {
    if (!isLoggedInSync()) {
      toast.info(t('common.loginRequired'))
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      navigate('/login')
      return
    }
    const uid = getUserIdSync()
    if (uid) setUserId(parseInt(uid))
  }, [navigate])

  const handleProductClick = (productId: number) => {
    navigate(`/products/${productId}`)
  }


  const handleWishlistToggle = (_productId: number, isWishlisted: boolean) => {
    if (!isWishlisted) refetch()
  }

  const { applied } = useTheme()
  const theme = applied === 'dark' ? 'dark' : 'light'
  const tk = walletTokens[theme]

  const summary = summarize(wishlists)
  // 📍 2026-10-14 (대표 확정 가안+나안): 카드에 주소·거리. 위치는 마지막 측위 캐시만 읽는다 —
  //    찜 목록을 열었다고 위치 권한을 묻지 않는다(없으면 주소만 뜬다).
  const [userLoc] = useState(() => readCachedLoc())
  const shown = sortWishlist(wishlists, sort)

  // 🚑 2026-07-10 (로딩 전수조사 — 로더 전면 통일): ad-hoc 스피너 → BrandLoader (지갑 테마 표면과 자동 정합).
  if (loading) {
    return (
      <WalletPageWrapper theme={theme}>
        <BrandLoader fullScreen forceLight={theme === 'light'} forceDark={theme === 'dark'} />
      </WalletPageWrapper>
    )
  }

  if (error) {
    return (
      <WalletPageWrapper theme={theme}>
        <SubPageHeader title={t('wishlist.title')} backLabel={t('common.back')} />
        <div className="text-center py-20">
          <p className="mb-4" style={{ color: tk.danger }}>{error}</p>
          {/* 🎫 표면 규칙 ⑥ — 그라디언트 0. 주 행동은 브랜드 블루 면 하나. */}
          <button
            onClick={() => refetch()}
            className="h-11 px-6 rounded-full bg-brand text-white text-[15px] font-medium active:opacity-90"
          >
            {t('wishlist.retry')}
          </button>
        </div>
      </WalletPageWrapper>
    )
  }

  return (
    <WalletPageWrapper theme={theme}>
      <SEO title={t('wishlist.seoTitle', { defaultValue: '찜한 상품 - 유어딜' })} description={t('wishlist.seoDesc', { defaultValue: '관심 상품을 모아보세요' })} url="/wishlist" noindex />

      {/* ← 2026-10-19 (대표 "다 이상적으로 진행해줘 모두"): 마이 하위 화면 머리줄 한 벌(`SubPageHeader`).
          종전엔 회색 원 `←` + 그 아래 34px 큰 제목 + "찜한 상품 0개" 가 같은 말을 두 번 했다. */}
      <SubPageHeader title={t('wishlist.title')} backLabel={t('common.back')} />

      <div className="ur-content-wide px-4 lg:px-8 pb-2">
        {/* 개수·인하는 찜이 있을 때만 말한다 — 빈 화면에서 "0개" 는 제목을 되풀이할 뿐이다. */}
        {wishlists.length > 0 && (
          <p className="px-1 pt-1 pb-3 text-[13px] text-gray-500 dark:text-gray-400">
            {[
              t('wishlist.subtitleCount', { count: wishlists.length }),
              summary.drops > 0 ? t('wishlist.dropCount', { count: summary.drops, defaultValue: '가격 내린 것 {{count}}개' }) : '',
            ].filter(Boolean).join(' · ')}
          </p>
        )}

        {wishlists.length === 0 ? (
          /* 🎫 2026-09-03: 표면 규칙 ①(카드 테두리 0 · 화이트는 들림 한 값) + ⑥(그라디언트 0).
             종전엔 테두리 카드 + 그라디언트 버튼이었고, p-12·아이콘 64px 이라 빈 화면이 세로로
             과하게 컸다. 주 행동은 브랜드 블루 면 하나. */
          <div className="rounded-2xl px-6 py-10 text-center lg:max-w-xl lg:mx-auto lg:mt-4">
            {/* 🦦 2026-10-07 유달이 — 아직 찜한 게 없으면 졸린 얼굴(하트 아이콘 대체). */}
            <Udal mood="empty" size={104} className="mx-auto mb-3" />
            <h2 className="text-[17px] font-bold text-[#16181C] dark:text-[#F8F7FC]">{t('wishlist.emptyTitle')}</h2>
            <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">{t('wishlist.emptyHint')}</p>
            <button
              onClick={() => navigate('/')}
              className="mt-5 h-11 px-6 rounded-full bg-brand text-white text-[15px] font-bold active:scale-[0.98] transition-transform"
            >
              {t('wishlist.continueShopping')}
            </button>
          </div>
        ) : (
          /* 💗 2026-08-19 (대표 — "찜한 이용권도 기존 이용권 UI로 해줘야지"):
             자체 그라데이션 카드를 버리고 **홈과 같은 카드**(`GroupBuyFeedCard`)를 쓴다.
             찜 목록만 다른 모양이면 같은 상품이 화면마다 달라 보인다(그루폰 wishlist 도 같은 카드다).
             하트는 카드가 내장하고 있어 여기서 따로 그리지 않는다 — 누르면 목록에서 빠진다. */
          <>
            {/* 📱 2026-10-14 (대표 확정 — 모바일 나안): 레일 자리가 없는 폰은 맨 위 요약 카드. */}
            <WishlistSummaryCard s={summary} />
            <div className="mb-4">
              <WishlistSortChips value={sort} onChange={setSort} />
            </div>
            {/* 🖥️ PC 만 좌측 요약 레일 — 모바일은 세로가 귀해서 같은 정보를 제목 밑 한 줄이 맡는다. */}
            <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-6 lg:items-start">
              <WishlistSummaryRail s={summary} />
              {/* 📱 폰은 사진 작은 한 줄 목록(`DealRow`), PC 는 홈과 같은 격자 카드. 둘을 동시에 그리지 않는다
                  — 숨긴 쪽 사진까지 받게 된다. */}
              {!isLgViewport ? <WishlistRows items={shown} userLoc={userLoc} /> : (
              <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 ${DEAL_GRID_GAP}`}>
                {shown.map((item, i) => (
                  <GroupBuyFeedCard
                    key={item.id}
                    imgWidth={cardImgWidth}
                    userLoc={userLoc}
                    aboveFold={i < 4}
                    flags={<WishlistFlag drop={priceDrop(item)} />}
                    p={{
                      id: item.product_id,
                      name: item.product_name,
                      price: item.price,
                      original_price: item.original_price,
                      discount_rate: item.discount_rate,
                      image_url: item.image_url,
                      category: item.category,
                      deal_only: item.deal_only,
                      seller_id: item.seller_id,
                      seller_name: item.seller_name,
                      restaurant_name: item.restaurant_name,
                      restaurant_address: item.restaurant_address,
                      restaurant_lat: item.restaurant_lat,
                      restaurant_lng: item.restaurant_lng,
                      expires_at: item.expires_at,
                      group_buy_status: item.group_buy_status,
                      dominant_color: item.dominant_color,
                    } as never}
                  />
                ))}
              </div>
              )}
            </div>
            {/* 💗 2026-10-14 (대표 확정 가안+나안): 찜이 적으면 비던 자리를 비슷한 이용권이 채운다. */}
            <WishlistRecommend wished={wishlists} imgWidth={cardImgWidth} userLoc={userLoc} />
          </>
        )}
      </div>
    </WalletPageWrapper>
  )
}

export default WishlistPage
