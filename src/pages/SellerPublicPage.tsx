import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '@/lib/api'
import { ProfileHeader } from '@/components/seller-public/ProfileHeader'
import { UpcomingLive } from '@/components/seller-public/UpcomingLive'
import { ProductGrid } from '@/components/seller-public/ProductGrid'
import { SnsLinks } from '@/components/seller-public/SnsLinks'
import { SectionDivider } from '@/components/seller-public/SectionDivider'
import { Loader2, AlertCircle } from 'lucide-react'

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
  const [seller, setSeller] = useState<Seller | null>(null)
  const [streams, setStreams] = useState<LiveStream[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadSellerData()
  }, [sellerId])

  async function loadSellerData() {
    if (!sellerId) return

    try {
      setLoading(true)
      setError('')

      // Load seller profile
      const sellerRes = await api.get(`/api/seller/public/${sellerId}`)
      
      if (!sellerRes.data.success) {
        setError('판매자를 찾을 수 없습니다.')
        return
      }

      setSeller(sellerRes.data.data)

      // Load seller's live streams
      const streamsRes = await api.get(`/api/sellers/${sellerId}/streams`)
      if (streamsRes.data.success) {
        setStreams(streamsRes.data.data)
      }

      // Load seller's products
      const productsRes = await api.get(`/api/seller/${sellerId}/products-public`)
      if (productsRes.data.success) {
        setProducts(productsRes.data.data)
      }

    } catch (err: any) {
      console.error('Failed to load seller data:', err)
      setError('판매자 정보를 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-3" />
          <p className="text-xs text-gray-500 tracking-wide">Loading...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !seller) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center px-4">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600 tracking-wide">
            {error || '판매자를 찾을 수 없습니다.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-md mx-auto px-6 py-10 space-y-8">
        {/* Profile Header */}
        <ProfileHeader seller={seller} />

        <SectionDivider />

        {/* Upcoming Live */}
        <UpcomingLive streams={streams} />

        <SectionDivider />

        {/* Product Grid */}
        <ProductGrid products={products} />

        <SectionDivider />

        {/* SNS Links */}
        <SnsLinks seller={seller} />

        {/* Bottom Spacing */}
        <div className="h-8" />
      </div>
    </main>
  )
}
