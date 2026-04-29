import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bookmark } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface Product {
  id: number
  name: string
  price: number
  current_price: number
  original_price?: number
  discount_rate: number
  image_url: string
  sold_count?: number
  stock: number
  category?: string
  seller_name?: string
  is_new?: boolean
  is_popular?: boolean
}

interface BrowseProductCardProps {
  product: Product
}

export default function BrowseProductCard({ product }: BrowseProductCardProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  // 위시리스트 상태 확인
  useEffect(() => {
    const checkWishlist = async () => {
      try {
        const userId = localStorage.getItem('userId')
        if (!userId) return
        
        const response = await api.get(`/api/wishlists/check/${userId}/${product.id}`)
        if (response.data.success) {
          setSaved(response.data.data.isWishlisted || response.data.data.isSaved)
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('위시리스트 확인 실패:', err)
      }
    }
    checkWishlist()
  }, [product.id])

  const handleCardClick = () => {
    navigate(`/product/${product.id}`)
  }

  const handleSaveClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    
    const userId = localStorage.getItem('userId')
    if (!userId) {
      toast.error(t('common.loginRequired'))
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      setTimeout(() => navigate('/login'), 600)
      return
    }
    
    if (loading) return
    setLoading(true)
    
    try {
      if (saved) {
        // 위시리스트에서 제거
        await api.delete(`/api/wishlists/product/${product.id}`)
        setSaved(false)
      } else {
        // 위시리스트에 추가
        await api.post('/api/wishlists', {
          productId: product.id
        })
        setSaved(true)
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error('위시리스트 처리 실패:', err)
      toast.error('저장 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  const getTag = () => {
    if (product.is_new) return 'New'
    if (product.is_popular) return 'Popular'
    return null
  }

  const tag = getTag()
  const discountRate = product.discount_rate || (product.original_price ? Math.round((1 - product.price / product.original_price) * 100) : 0)

  return (
    <div
      className="group cursor-pointer"
      role="button"
      tabIndex={0}
      aria-label={`${product.name} 상세 보기`}
      onClick={handleCardClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick() } }}
    >
      <div className="relative aspect-square overflow-hidden bg-gray-100 rounded-sm">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
            <span className="text-gray-400 text-xs">No Image</span>
          </div>
        )}
        {tag && (
          <span className="absolute top-2 left-2 bg-gray-900 text-white text-[10px] font-bold uppercase px-2 py-0.5 tracking-wide">
            {tag}
          </span>
        )}
        {discountRate > 0 && (
          <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">
            -{discountRate}%
          </span>
        )}
        <button
          onClick={handleSaveClick}
          aria-label={saved ? 'Remove from saved' : 'Save item'}
          className="absolute bottom-2 right-2 p-1.5 bg-white/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Bookmark
            className={`h-4 w-4 ${saved ? 'fill-gray-900 text-gray-900' : 'text-gray-900'}`}
            strokeWidth={1.5}
          />
        </button>
      </div>
      <div className="mt-2.5 px-0.5">
        <p className="text-xs font-bold text-foreground uppercase tracking-wide">
          {product.seller_name || 'Brand'}
        </p>
        <p className="mt-0.5 text-xs text-gray-600 leading-relaxed line-clamp-2">
          {product.name}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <p className="text-sm font-bold text-foreground">
            ₩{product.price.toLocaleString()}
          </p>
          {product.original_price && product.original_price > product.price && (
            <p className="text-xs text-gray-400 line-through">
              ₩{product.original_price.toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
