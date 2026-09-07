import { DEAL_GRID_GAP } from '@/shared/deal-card-grid'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { isLoggedInSync, getUserIdSync } from '@/utils/auth'
import { ArrowLeft, Heart } from 'lucide-react'
import { LargeTitle, WalletPageWrapper } from '@/components/wallet/WalletAtoms'
import { walletTokens } from '@/components/wallet/walletTokens'
import { useTheme } from '@/shared/stores/useTheme'
import { useWishlist, type WishlistItem } from '@/hooks/queries/useWishlist'
import { WishlistSortChips, WishlistFlag, WishlistSummaryRail } from './wishlist/WishlistParts'
import { priceDrop, summarize, sortWishlist, type WishlistSort } from './wishlist/wishlist-signals'
import BrandLoader from '@/components/brand/BrandLoader'
import GroupBuyFeedCard from './main-home/GroupBuyFeedCard'
import { useMediaQuery } from '@/hooks/useMediaQuery'
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
      <WalletPageWrapper theme={theme} className="flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4" style={{ color: tk.danger }}>{error}</p>
          <button
            onClick={() => refetch()}
            className="px-6 py-2 rounded-xl active:opacity-90"
            style={{ background: tk.accentGradient, color: tk.onAccent }}
          >
            {t('wishlist.retry')}
          </button>
        </div>
      </WalletPageWrapper>
    )
  }

  return (
    <WalletPageWrapper theme={theme}>
      <SEO title={t('wishlist.seoTitle', { defaultValue: '위시리스트 - 유어딜' })} description={t('wishlist.seoDesc', { defaultValue: '관심 상품을 모아보세요' })} url="/wishlist" noindex />

      {/* 상단 chrome — 뒤로가기.
          🖥️ 2026-09-03 (대표 "위시리스트 PC 도 봐야겠는데"): `lg:hidden`. PC 는 상단 네비가 이미
          있어서 이 원형 뒤로가기 하나 때문에 줄 하나가 통째로 흰 띠로 낭비됐다(실측 60px). */}
      <div className="lg:hidden sticky top-0 md:top-14 z-30 px-2 pt-3 pb-2 flex items-center"
        style={{ background: tk.chrome, borderBottom: `0.5px solid ${tk.separator}` }}>
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-full"
          style={{ background: tk.fillSoft, color: tk.label }}
          aria-label={t('common.back')}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* 🖥️ 제목을 그리드와 **같은 자** 안으로. 밖에 있어서 PC 에서 제목만 화면 왼쪽 끝에 붙고
          카드는 컨테이너 안에서 시작해 두 왼쪽 끝이 어긋나 있었다(실측 24px vs 44px). */}
      <div className="ur-content-wide px-4 lg:px-8 pb-2">
        {/* `LargeTitle` 은 자기 `px-4` 를 갖는다(마이·주문·지갑이 컨테이너 **밖**에서 쓰기 때문).
            여기선 컨테이너 안이라 여백이 겹쳐 제목만 18px 더 들어갔다 → 그 패딩만 끈다.
            공유 부품을 고치면 다른 세 페이지가 밀린다. */}
        <div className="[&>div]:px-0">
          <LargeTitle
            theme={theme}
            title={t('wishlist.title')}
            /* 인하가 없으면 그 말을 아예 안 한다 — "가격 내린 것 0개" 는 알려주는 게 아니라 실망시키는 문장이다. */
            subtitle={
              summary.drops > 0
                ? `${t('wishlist.subtitleCount', { count: wishlists.length })} · ${t('wishlist.dropCount', { count: summary.drops, defaultValue: '가격 내린 것 {{count}}개' })}`
                : t('wishlist.subtitleCount', { count: wishlists.length })
            }
          />
        </div>

        {wishlists.length === 0 ? (
          /* 🎫 2026-09-03: 표면 규칙 ①(카드 테두리 0 · 화이트는 들림 한 값) + ⑥(그라디언트 0).
             종전엔 테두리 카드 + 그라디언트 버튼이었고, p-12·아이콘 64px 이라 빈 화면이 세로로
             과하게 컸다. 주 행동은 브랜드 블루 면 하나. */
          <div className="rounded-2xl px-6 py-10 text-center bg-white dark:bg-[#1D1F29] shadow-lift dark:shadow-none lg:max-w-xl lg:mx-auto lg:mt-4">
            <Heart className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-500" strokeWidth={1.5} aria-hidden />
            <h2 className="text-[17px] font-extrabold text-[#16181C] dark:text-[#F5F3F1]">{t('wishlist.emptyTitle')}</h2>
            <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">{t('wishlist.emptyHint')}</p>
            <button
              onClick={() => navigate('/')}
              className="mt-5 h-11 px-6 rounded-full bg-brand text-white text-[14px] font-bold active:scale-[0.98] transition-transform"
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
            <div className="mb-4">
              <WishlistSortChips value={sort} onChange={setSort} />
            </div>
            {/* 🖥️ PC 만 좌측 요약 레일 — 모바일은 세로가 귀해서 같은 정보를 제목 밑 한 줄이 맡는다. */}
            <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-6 lg:items-start">
              <WishlistSummaryRail s={summary} />
              <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 ${DEAL_GRID_GAP}`}>
                {shown.map((item, i) => (
                  <GroupBuyFeedCard
                    key={item.id}
                    imgWidth={cardImgWidth}
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
                      expires_at: item.expires_at,
                      group_buy_status: item.group_buy_status,
                      dominant_color: item.dominant_color,
                    } as never}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </WalletPageWrapper>
  )
}

export default WishlistPage
