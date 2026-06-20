import React, { useState, useEffect, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { isLoggedInSync, getUserIdSync } from '@/utils/auth'
import WishlistButton from '../components/WishlistButton'
import { ArrowLeft, Heart } from 'lucide-react'
import { LargeTitle, WalletPageWrapper } from '@/components/wallet/WalletAtoms'
import { walletTokens } from '@/components/wallet/walletTokens'
import { useTheme } from '@/shared/stores/useTheme'
import { formatNumber } from '@/utils/format'
import { useWishlist, type WishlistItem } from '@/hooks/queries/useWishlist'
import { cfImage } from '@/utils/cf-image'
import { cardGradient } from '@/utils/card-gradient'
import { extractDominantColor, reportDominantColor } from '@/utils/dominant-color'

// 🎨 2026-06-10 (사용자 요청): 쇼핑(BrowseProductCard)과 동일한 대표색 그라데이션 카드.
//   사진 하단이 카드색으로 번져 텍스트 블록과 경계 없이 이어짐 + 글자색 밝기 자동대비.
//   React.memo — 토글/refetch 시 전체 카드 reconcile 방지 (기존 피드 카드 패턴).
const WishlistCard = memo(function WishlistCard({
  item, userId, onOpen, onAddToCart, onToggle, t,
}: {
  item: WishlistItem
  userId: number | null
  onOpen: (productId: number) => void
  onAddToCart: (item: WishlistItem, e: React.MouseEvent) => void
  onToggle: (productId: number, isWishlisted: boolean) => void
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  const [cardColor, setCardColor] = useState<string | null>(item.dominant_color || null)
  const grad = cardGradient(cardColor)
  const unit = Number(item.deal_only) === 1 ? ' 딜' : '원'
  return (
    <div
      onClick={() => onOpen(item.product_id)}
      className="rounded-2xl overflow-hidden cursor-pointer group transition-all active:scale-[0.99] flex flex-col"
      style={{ background: grad.base }}
    >
      <div className="relative aspect-square" style={{ background: grad.base }}>
        <img
          src={cfImage(item.image_url, { width: 300, format: 'auto' }) || item.image_url || '/placeholder.png'}
          alt={item.product_name}
          width={300}
          height={300}
          loading="lazy" decoding="async"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onLoad={(e) => {
            const color = extractDominantColor(e.currentTarget as HTMLImageElement)
            if (color) {
              if (!cardColor) setCardColor(color)
              if (!item.dominant_color) reportDominantColor(item.product_id, color)
            }
          }}
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23F2F2F7" width="200" height="200"/%3E%3Ctext fill="%23C7C7CC" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3ENo Image%3C/text%3E%3C/svg%3E'
          }}
        />
        {/* 사진 하단 → 같은 카드색으로 번짐 (경계 제거) */}
        <div className="absolute inset-x-0 bottom-0 h-[42%] pointer-events-none" style={{ background: grad.imageFade }} />

        <div className="absolute top-2 right-2 z-10">
          <WishlistButton
            productId={item.product_id}
            userId={userId}
            initialWishlisted={true}
            size="md"
            className="rounded-full p-2 backdrop-blur-sm shadow-sm bg-black/55"
            onToggle={(isWishlisted) => onToggle(item.product_id, isWishlisted)}
          />
        </div>

        {item.stock === 0 && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
            <span className="px-4 py-2 rounded-full font-semibold text-sm bg-white text-gray-900">{t('product.outOfStock')}</span>
          </div>
        )}

        {item.discount_rate > 0 && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md"
            style={{ background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 800 }}>
            -{item.discount_rate}%
          </div>
        )}
      </div>

      <div className="px-3 pt-1 pb-3 flex flex-col flex-1" style={{ color: grad.text }}>
        <p style={{ fontSize: 10, color: grad.sub }} className="mb-1">@{item.seller_name}</p>
        <h3 className="line-clamp-2 leading-tight" style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
          {item.product_name}
        </h3>

        <div className="mb-3">
          {item.discount_rate > 0 ? (
            <>
              <p style={{ fontSize: 10, color: grad.sub, textDecoration: 'line-through' }}>
                {formatNumber(item.original_price)}{unit}
              </p>
              <div className="flex items-baseline gap-1">
                <span style={{ fontSize: 13, fontWeight: 800, color: grad.accent }}>{item.discount_rate}%</span>
                <span style={{ fontSize: 13, fontWeight: 800 }}>{formatNumber(item.price)}{unit}</span>
              </div>
            </>
          ) : (
            <p style={{ fontSize: 13, fontWeight: 800 }}>
              {formatNumber(item.price)}{unit}
            </p>
          )}
        </div>

        <button
          onClick={(e) => onAddToCart(item, e)}
          disabled={item.stock === 0}
          className="w-full mt-auto py-2 rounded-xl text-sm font-medium transition-colors disabled:cursor-not-allowed"
          style={{
            background: item.stock === 0 ? 'rgba(127,127,127,0.25)' : (grad.isLight ? '#1a1a1a' : '#ffffff'),
            color: item.stock === 0 ? grad.sub : (grad.isLight ? '#ffffff' : '#1a1a1a'),
          }}
        >
          {item.stock === 0 ? t('product.outOfStock') : t('wishlist.addToCart')}
        </button>
      </div>
    </div>
  )
})

const WishlistPage: React.FC = () => {
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

  const handleAddToCart = async (item: WishlistItem, e: React.MouseEvent) => {
    e.stopPropagation()

    if (item.stock === 0) {
      toast.info(t('common.outOfStock'))
      return
    }

    try {
      // ✅ UX C3 FIX: snake_case + userId 미포함 (서버 미들웨어가 세션에서 추출)
      const response = await api.post('/api/cart', {
        product_id: item.product_id,
        quantity: 1,
        price_snapshot: item.price,
      })

      if (response.data.success) {
        toast.success(t('cart.itemAdded'))
      }
    } catch (error: unknown) {
      const error_ = error as { response?: { data?: { error?: string; message?: string }; status?: number } };
      if (import.meta.env.DEV) console.error('[Wishlist] Add to cart error:', error)
      toast.error(error_.response?.data?.error || t('wishlist.addCartError'))
    }
  }

  const handleWishlistToggle = (_productId: number, isWishlisted: boolean) => {
    if (!isWishlisted) refetch()
  }

  const { applied } = useTheme()
  const theme = applied === 'dark' ? 'dark' : 'light'
  const tk = walletTokens[theme]

  if (loading) {
    return (
      <WalletPageWrapper theme={theme} className="flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: tk.accent }} />
          <p style={{ color: tk.secondary }}>{t('wishlist.loading')}</p>
        </div>
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
          <div className="rounded-2xl p-12 text-center" style={{ background: tk.card }}>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {wishlists.map((item) => (
              <WishlistCard
                key={item.id}
                item={item}
                userId={userId}
                onOpen={handleProductClick}
                onAddToCart={handleAddToCart}
                onToggle={handleWishlistToggle}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </WalletPageWrapper>
  )
}

export default WishlistPage
