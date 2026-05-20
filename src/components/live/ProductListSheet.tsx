import { ShoppingBag, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { Product, Stream } from './LiveTypes'
import { formatNumber } from '@/utils/format'

export function ProductListSheet({
  products,
  currentProductId,
  onClose,
  onSelectProduct,
  loading,
  stream: sheetStream,
}: {
  products: Product[]
  currentProductId: number | null
  onClose: () => void
  onSelectProduct: (product: Product) => void
  loading: boolean
  stream?: Stream
}) {
  const { t } = useTranslation()
  const safeProducts = products || []

  // 🛡️ 2026-04-29: a11y — ESC 닫기 + Tab focus trap
  useEscapeKey(onClose)
  const sheetRef = useFocusTrap<HTMLDivElement>(true)

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm animate-overlay-in"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-list-sheet-title"
        className="fixed inset-x-0 bottom-0 z-[70] max-h-[60dvh] overflow-y-auto rounded-t-3xl bg-white backdrop-blur-xl border-t border-gray-200 dark:border-[#2A2A2A] animate-sheet-up no-scrollbar shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-center py-3 bg-white/90 backdrop-blur-md border-b border-gray-100 dark:border-[#1A1A1A]">
          <div className="h-1 w-10 rounded-full bg-gray-300" aria-hidden="true" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            aria-label={t('common.close', { defaultValue: '닫기' })}
          >
            <X className="h-4 w-4 text-gray-800" aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 pt-4 pb-3 border-b border-gray-100 dark:border-[#1A1A1A]">
          <h3 id="product-list-sheet-title" className="text-lg font-bold text-gray-900">{t('live.productSheet.title', { defaultValue: '라이브 상품 ({{count}}개)', count: safeProducts.length })}</h3>
          <p className="text-sm text-gray-500 mt-1">{t('live.productSheet.subtitle', { defaultValue: '상품을 선택해서 구매하세요' })}</p>
        </div>

        <div className="px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 border-3 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
            </div>
          ) : safeProducts.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="h-12 w-12 mx-auto text-gray-700 dark:text-gray-300 mb-3" />
              <p className="text-gray-500">{t('live.productSheet.empty', { defaultValue: '등록된 상품이 없습니다' })}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">{safeProducts.map((product) => {
                const isCurrentProduct = product.id === currentProductId
                const isOutOfStock = product.stock !== undefined && product.stock === 0
                const discount = product.original_price && product.original_price > product.price
                  ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
                  : 0

                return (
                  <button
                    key={product.id}
                    onClick={() => !isOutOfStock && onSelectProduct(product)}
                    disabled={isOutOfStock}
                    className={`relative flex items-center gap-4 bg-white rounded-2xl overflow-hidden p-4 transition-all duration-200 ${
                      isOutOfStock
                        ? 'opacity-60 cursor-not-allowed'
                        : isCurrentProduct
                        ? 'ring-4 ring-red-500 shadow-xl shadow-red-500/30 active:scale-[0.98]'
                        : 'hover:shadow-lg border border-gray-200 active:scale-[0.98]'
                    }`}
                  >
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-black/40 z-20 flex items-center justify-center">
                        <div className="bg-gray-900 text-white px-4 py-2 rounded-lg font-bold text-sm">
                          {t('live.product.soldOut', { defaultValue: '품절' })}
                        </div>
                      </div>
                    )}

                    {isCurrentProduct && !isOutOfStock && (
                      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-red-600 px-2.5 py-1 rounded-full shadow-lg">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                        <span className="text-gray-900 dark:text-white font-bold text-[10px] tracking-wider">LIVE</span>
                      </div>
                    )}

                    <div className="relative h-20 w-20 shrink-0 rounded-xl bg-gray-100 overflow-hidden">
                      <img
                        src={product.image_url || product.image || sheetStream?.thumbnail_url || (sheetStream?.youtube_video_id ? `https://img.youtube.com/vi/${sheetStream.youtube_video_id}/hqdefault.jpg` : '')}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          // 80x80 썸네일이라 hqdefault(480x360) 면 충분 — 추가 fallback 만 처리
                          const img = e.target as HTMLImageElement
                          if (sheetStream?.thumbnail_url && img.src !== sheetStream.thumbnail_url) {
                            img.src = sheetStream.thumbnail_url
                          }
                        }}
                      />
                      {discount > 0 && (
                        <div className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-md">
                          -{discount}%
                        </div>
                      )}
                    </div>

                    <div className="flex-1 text-left">
                      <h4 className="text-base font-bold text-gray-900 line-clamp-2 mb-2">
                        {product.name}
                      </h4>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-extrabold text-gray-900">
                          ₩{formatNumber(product.price || 0)}
                        </span>
                        {product.original_price && product.original_price > product.price && (
                          <span className="text-sm text-gray-500 dark:text-gray-400 line-through">
                            ₩{formatNumber(product.original_price)}
                          </span>
                        )}
                      </div>
                      {product.stock !== undefined && (
                        <p className="text-sm text-gray-500 mt-1">
                          {t('live.product.stockLeft', { defaultValue: '재고: {{count}}개', count: product.stock })}
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
