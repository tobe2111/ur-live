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

      {/* 상단 chrome — 뒤로가기 */}
      <div className="sticky top-0 md:top-14 z-30 px-2 pt-3 pb-2 flex items-center"
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

      <LargeTitle theme={theme} title={t('wishlist.title')} subtitle={t('wishlist.subtitleCount', { count: wishlists.length })} />

      <div className="ur-content-wide px-4 lg:px-8 pb-2">
        {wishlists.length === 0 ? (
          <div className="rounded-2xl p-12 text-center" style={{ background: tk.card, border: `0.5px solid ${tk.separator}` }}>
            <Heart className="w-16 h-16 mx-auto mb-4" style={{ color: tk.tertiary }} />
            <h2 style={{ fontSize: 18, fontWeight: 700, color: tk.label, marginBottom: 6 }}>{t('wishlist.emptyTitle')}</h2>
            <p className="mb-6" style={{ fontSize: 13, color: tk.secondary }}>{t('wishlist.emptyHint')}</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 rounded-xl active:opacity-90"
              style={{ background: tk.accentGradient, color: tk.onAccent, fontSize: 14, fontWeight: 700 }}
            >
              {t('wishlist.continueShopping')}
            </button>
          </div>
        ) : (
          /* 💗 2026-08-19 (대표 — "찜한 이용권도 기존 이용권 UI로 해줘야지"):
             자체 그라데이션 카드를 버리고 **홈과 같은 카드**(`GroupBuyFeedCard`)를 쓴다.
             찜 목록만 다른 모양이면 같은 상품이 화면마다 달라 보인다(그루폰 wishlist 도 같은 카드다).
             하트는 카드가 내장하고 있어 여기서 따로 그리지 않는다 — 누르면 목록에서 빠진다. */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 lg:gap-4">
            {wishlists.map((item, i) => (
              <GroupBuyFeedCard
                key={item.id}
                imgWidth={cardImgWidth}
                aboveFold={i < 4}
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
                  dominant_color: item.dominant_color,
                } as never}
              />
            ))}
          </div>
        )}
      </div>
    </WalletPageWrapper>
  )
}

export default WishlistPage
