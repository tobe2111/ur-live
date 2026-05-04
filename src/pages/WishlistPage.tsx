import React, { useState, useEffect } from 'react'
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

interface WishlistItem {
  id: number
  user_id: number
  product_id: number
  created_at: string
  product_name: string
  price: number
  original_price: number
  discount_rate: number
  image_url: string
  stock: number
  category: string
  is_active: number
  seller_name: string
  seller_id: number
}

const WishlistPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [wishlists, setWishlists] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<number | null>(null)

  useEffect(() => {
    if (!isLoggedInSync()) {
      toast.info(t('common.loginRequired'))
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      navigate('/login')
      return
    }

    const uid = getUserIdSync()
    if (uid) {
      setUserId(parseInt(uid))
      loadWishlists(parseInt(uid))
    }
  }, [navigate])

  const loadWishlists = async (_uid: number) => {
    try {
      setLoading(true)
      // ✅ UX C3 FIX: auth-implicit endpoint (IDOR 방지, URL에 userId 노출 금지)
      // 🛡️ 2026-04-22 배치 137: axios → api (auth interceptor 적용되어야 requireAuth 통과)
      const response = await api.get('/api/wishlists')

      if (response.data.success) {
        setWishlists(response.data.data.items)
      } else {
        throw new Error(response.data.error)
      }
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string; message?: string }; status?: number } };
      if (import.meta.env.DEV) console.error('[Wishlist] Load error:', err)
      setError(err_.response?.data?.error || t('wishlist.loadError'))
    } finally {
      setLoading(false)
    }
  }

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

  const handleWishlistToggle = (productId: number, isWishlisted: boolean) => {
    if (!isWishlisted) {
      if (userId) {
        loadWishlists(userId)
      }
    }
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
            onClick={() => userId && loadWishlists(userId)}
            className="px-6 py-2 rounded-xl text-white active:opacity-90"
            style={{ background: tk.accentGradient }}
          >
            {t('wishlist.retry')}
          </button>
        </div>
      </WalletPageWrapper>
    )
  }

  return (
    <WalletPageWrapper theme={theme}>
      <SEO title="위시리스트 - 유어딜" description="관심 상품을 모아보세요" url="/wishlist" noindex />

      {/* 상단 chrome — 뒤로가기 */}
      <div className="sticky top-0 z-30 px-2 pt-3 pb-2 flex items-center"
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
              className="px-6 py-3 rounded-xl text-white active:opacity-90"
              style={{ background: tk.accentGradient, fontSize: 14, fontWeight: 700 }}
            >
              {t('wishlist.continueShopping')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {wishlists.map((item) => (
              <div
                key={item.id}
                onClick={() => handleProductClick(item.product_id)}
                className="rounded-2xl overflow-hidden cursor-pointer group transition-all active:scale-[0.99]"
                style={{ background: tk.card }}
              >
                <div className="relative aspect-square" style={{ background: tk.cardSub }}>
                  <img
                    src={item.image_url || '/placeholder.png'}
                    alt={item.product_name}
                    loading="lazy" decoding="async"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23F2F2F7" width="200" height="200"/%3E%3Ctext fill="%23C7C7CC" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3ENo Image%3C/text%3E%3C/svg%3E'
                    }}
                  />

                  <div className="absolute top-2 right-2 z-10">
                    <WishlistButton
                      productId={item.product_id}
                      userId={userId}
                      initialWishlisted={true}
                      size="md"
                      className="rounded-full p-2 backdrop-blur-sm shadow-sm bg-black/55"
                      onToggle={(isWishlisted) => handleWishlistToggle(item.product_id, isWishlisted)}
                    />
                  </div>

                  {item.stock === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
                      <span className="px-4 py-2 rounded-full font-semibold text-sm" style={{ background: tk.label, color: tk.bg }}>{t('product.outOfStock')}</span>
                    </div>
                  )}

                  {item.discount_rate > 0 && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md"
                      style={{ background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 800 }}>
                      -{item.discount_rate}%
                    </div>
                  )}
                </div>

                <div className="p-3">
                  <p style={{ fontSize: 10, color: tk.tertiary }} className="mb-1">@{item.seller_name}</p>
                  <h3 className="line-clamp-2 leading-tight"
                    style={{ fontSize: 12, fontWeight: 500, color: tk.label, marginBottom: 6, minHeight: '2.5rem' }}>
                    {item.product_name}
                  </h3>

                  <div className="mb-3">
                    {item.discount_rate > 0 ? (
                      <>
                        <p style={{ fontSize: 10, color: tk.tertiary, textDecoration: 'line-through' }}>
                          {formatNumber(item.original_price)}원
                        </p>
                        <div className="flex items-baseline gap-1">
                          <span style={{ fontSize: 13, fontWeight: 800, color: '#EF4444' }}>{item.discount_rate}%</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: tk.label }}>{formatNumber(item.price)}원</span>
                        </div>
                      </>
                    ) : (
                      <p style={{ fontSize: 13, fontWeight: 800, color: tk.label }}>
                        {formatNumber(item.price)}원
                      </p>
                    )}
                  </div>

                  <button
                    onClick={(e) => handleAddToCart(item, e)}
                    disabled={item.stock === 0}
                    className="w-full py-2 rounded-xl text-sm font-medium transition-colors disabled:cursor-not-allowed"
                    style={{
                      background: item.stock === 0 ? tk.fillSoft : tk.label,
                      color: item.stock === 0 ? tk.tertiary : tk.bg,
                    }}
                  >
                    {item.stock === 0 ? t('product.outOfStock') : t('wishlist.addToCart')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </WalletPageWrapper>
  )
}

export default WishlistPage
