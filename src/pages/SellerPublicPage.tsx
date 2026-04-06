import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { ProfileHeader } from '@/components/seller-public/ProfileHeader'
import { UpcomingLive } from '@/components/seller-public/UpcomingLive'
import { ProductGrid } from '@/components/seller-public/ProductGrid'
import { SnsLinks } from '@/components/seller-public/SnsLinks'
import { Loader2, AlertCircle, Share2, ArrowLeft } from 'lucide-react'
import { toast } from '@/hooks/useToast'

interface Seller {
  id: number
  username: string
  name: string
  email: string
  phone?: string
  business_name?: string
  business_number?: string
  profile_image?: string
  bio?: string
  sns_instagram?: string
  sns_youtube?: string
  sns_facebook?: string
  sns_twitter?: string
  website_url?: string
  kakao_chat_link?: string
  is_active: number
  status: string
  created_at: string
}

interface LiveStream {
  id: number
  title: string
  youtube_video_id: string
  status: 'scheduled' | 'live' | 'ended'
  scheduled_at?: string
  viewer_count?: number
}

interface Product {
  id: number
  name: string
  price: number
  original_price: number
  discount_rate: number
  stock: number
  image_url: string | null
}

export default function SellerPublicPage() {
  const { sellerId } = useParams<{ sellerId: string }>()
  const navigate = useNavigate()
  const [seller, setSeller] = useState<Seller | null>(null)
  const [streams, setStreams] = useState<LiveStream[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadSellerData()
  }, [sellerId])

  useEffect(() => {
    if (seller) {
      document.title = `${seller.business_name || seller.name} - 유어딜`
    }
  }, [seller])

  async function loadSellerData() {
    if (!sellerId) return

    try {
      setLoading(true)
      setError('')

      const sellerRes = await api.get(`/api/seller/public/${sellerId}`)

      if (!sellerRes.data.success) {
        setError('판매자를 찾을 수 없습니다.')
        return
      }

      setSeller(sellerRes.data.data)

      const [streamsRes, productsRes] = await Promise.allSettled([
        api.get(`/api/sellers/${sellerId}/streams`),
        api.get(`/api/seller/${sellerId}/products-public`),
      ])

      if (streamsRes.status === 'fulfilled' && streamsRes.value.data.success) {
        setStreams(streamsRes.value.data.data)
      }
      if (productsRes.status === 'fulfilled' && productsRes.value.data.success) {
        setProducts(productsRes.value.data.data)
      }
    } catch {
      setError('판매자 정보를 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  function handleShare() {
    const url = window.location.href
    if (navigator.share) {
      navigator.share({ title: seller?.business_name || seller?.name || '셀러', url })
    } else {
      navigator.clipboard.writeText(url)
      toast.success('링크가 복사되었습니다')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error || !seller) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center px-4">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">{error || '판매자를 찾을 수 없습니다.'}</p>
          <button onClick={() => navigate('/')} className="mt-4 text-sm text-blue-600 hover:underline">
            홈으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  const hasLive = streams.some(s => s.status === 'live')

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-md mx-auto px-4 h-11 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-1 rounded-full hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-sm font-semibold text-gray-900">
            {seller.business_name || seller.name}
          </span>
          <button onClick={handleShare} className="p-1 rounded-full hover:bg-gray-100">
            <Share2 className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto">
        {/* Hero / Profile */}
        <div className="bg-white px-6 pt-8 pb-6">
          <ProfileHeader seller={seller} />

          {/* SNS Quick Icons */}
          <SnsLinks seller={seller} compact />
        </div>

        {/* Live Banner */}
        {hasLive && (
          <div className="mx-4 mt-3 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl p-4 shadow-md">
            <div className="flex items-center gap-2 text-white">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-sm font-bold">라이브 방송 중!</span>
              </span>
            </div>
          </div>
        )}

        {/* Upcoming Live */}
        {streams.filter(s => s.status === 'live' || s.status === 'scheduled').length > 0 && (
          <div className="bg-white mt-3 px-6 py-5">
            <UpcomingLive streams={streams} />
          </div>
        )}

        {/* Products */}
        {products.length > 0 && (
          <div className="bg-white mt-3 px-6 py-5">
            <ProductGrid products={products} />
          </div>
        )}

        {/* Empty State */}
        {products.length === 0 && streams.filter(s => s.status !== 'ended').length === 0 && (
          <div className="bg-white mt-3 px-6 py-12 text-center">
            <p className="text-sm text-gray-400">아직 등록된 상품이나 예정된 방송이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  )
}
