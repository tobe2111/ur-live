import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '@/lib/api'
import { ProfileHeader } from '@/components/seller-public/ProfileHeader'
import { UpcomingLive } from '@/components/seller-public/UpcomingLive'
import { ProductGrid } from '@/components/seller-public/ProductGrid'
import { SnsLinks } from '@/components/seller-public/SnsLinks'
import {
  Loader2, AlertCircle, Share2, ArrowLeft, Pencil, Save, X,
  Camera, Plus, Instagram, Youtube, Globe, MessageCircle, Settings
} from 'lucide-react'
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
  kakao_chat_url?: string
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

  // Inline edit state
  const [isOwner, setIsOwner] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    profile_image: '',
    bio: '',
    sns_instagram: '',
    sns_youtube: '',
    sns_facebook: '',
    sns_twitter: '',
    website_url: '',
    kakao_chat_link: '',
  })

  useEffect(() => {
    loadSellerData()
  }, [sellerId])

  useEffect(() => {
    if (seller) {
      document.title = `${seller.business_name || seller.name} - 유어딜`
    }
  }, [seller])

  // Check if current user is this seller
  useEffect(() => {
    const userType = localStorage.getItem('user_type')
    const myId = localStorage.getItem('seller_id')
    if (userType === 'seller' && myId && sellerId && myId === sellerId) {
      setIsOwner(true)
    }
  }, [sellerId])

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

      const sellerData = sellerRes.data.data
      setSeller(sellerData)
      setEditForm({
        profile_image: sellerData.profile_image || '',
        bio: sellerData.bio || '',
        sns_instagram: sellerData.sns_instagram || '',
        sns_youtube: sellerData.sns_youtube || '',
        sns_facebook: sellerData.sns_facebook || '',
        sns_twitter: sellerData.sns_twitter || '',
        website_url: sellerData.website_url || '',
        kakao_chat_link: sellerData.kakao_chat_link || sellerData.kakao_chat_url || '',
      })

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

  function startEditing() {
    if (!seller) return
    setEditForm({
      profile_image: seller.profile_image || '',
      bio: seller.bio || '',
      sns_instagram: seller.sns_instagram || '',
      sns_youtube: seller.sns_youtube || '',
      sns_facebook: seller.sns_facebook || '',
      sns_twitter: seller.sns_twitter || '',
      website_url: seller.website_url || '',
      kakao_chat_link: seller.kakao_chat_link || seller.kakao_chat_url || '',
    })
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const token = localStorage.getItem('seller_token')
      await api.patch('/api/seller/profile', {
        profile_image: editForm.profile_image || null,
        bio: editForm.bio || null,
        sns_instagram: editForm.sns_instagram || null,
        sns_youtube: editForm.sns_youtube || null,
        sns_facebook: editForm.sns_facebook || null,
        sns_twitter: editForm.sns_twitter || null,
        website_url: editForm.website_url || null,
        kakao_chat_link: editForm.kakao_chat_link || null,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })

      // Update local state
      setSeller(prev => prev ? {
        ...prev,
        profile_image: editForm.profile_image || undefined,
        bio: editForm.bio || undefined,
        sns_instagram: editForm.sns_instagram || undefined,
        sns_youtube: editForm.sns_youtube || undefined,
        sns_facebook: editForm.sns_facebook || undefined,
        sns_twitter: editForm.sns_twitter || undefined,
        website_url: editForm.website_url || undefined,
        kakao_chat_link: editForm.kakao_chat_link || undefined,
      } : null)

      setEditing(false)
      toast.success('프로필이 저장되었습니다')
    } catch {
      toast.error('저장에 실패했습니다')
    } finally {
      setSaving(false)
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
          <div className="flex items-center gap-1">
            {isOwner && !editing && (
              <button onClick={startEditing} className="p-1 rounded-full hover:bg-gray-100">
                <Pencil className="w-4.5 h-4.5 text-blue-600" />
              </button>
            )}
            {editing && (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="p-1 rounded-full hover:bg-gray-100"
                >
                  <X className="w-4.5 h-4.5 text-gray-500" />
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="p-1 rounded-full hover:bg-blue-50"
                >
                  {saving
                    ? <Loader2 className="w-4.5 h-4.5 text-blue-600 animate-spin" />
                    : <Save className="w-4.5 h-4.5 text-blue-600" />
                  }
                </button>
              </>
            )}
            <button onClick={handleShare} className="p-1 rounded-full hover:bg-gray-100">
              <Share2 className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto">
        {/* Hero / Profile */}
        <div className="bg-white px-6 pt-8 pb-6">
          {editing ? (
            /* ── Edit Mode ── */
            <div className="space-y-5">
              {/* Profile Image */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  {editForm.profile_image ? (
                    <img src={editForm.profile_image} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-gray-200" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">
                        {(seller.business_name || seller.name || '?').charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center border-2 border-white">
                    <Camera className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>
                <input
                  type="text"
                  value={editForm.profile_image}
                  onChange={e => setEditForm(f => ({ ...f, profile_image: e.target.value }))}
                  placeholder="프로필 이미지 URL"
                  className="mt-3 w-full text-center text-xs border border-gray-200 rounded-lg px-3 py-2 focus:border-blue-400 focus:outline-none"
                />
              </div>

              {/* Bio */}
              <div>
                <label className="text-[11px] font-medium text-gray-500 mb-1 block">소개글</label>
                <textarea
                  value={editForm.bio}
                  onChange={e => setEditForm(f => ({ ...f, bio: e.target.value }))}
                  placeholder="셀러 소개를 입력하세요"
                  maxLength={500}
                  rows={3}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:border-blue-400 focus:outline-none resize-none"
                />
                <p className="text-right text-[10px] text-gray-400 mt-0.5">{editForm.bio.length}/500</p>
              </div>

              {/* SNS Links */}
              <div className="space-y-2.5">
                <label className="text-[11px] font-medium text-gray-500 block">SNS 링크</label>
                {[
                  { key: 'sns_instagram' as const, icon: Instagram, placeholder: 'https://instagram.com/...', label: 'Instagram' },
                  { key: 'sns_youtube' as const, icon: Youtube, placeholder: 'https://youtube.com/...', label: 'YouTube' },
                  { key: 'website_url' as const, icon: Globe, placeholder: 'https://...', label: '웹사이트' },
                  { key: 'kakao_chat_link' as const, icon: MessageCircle, placeholder: 'https://pf.kakao.com/...', label: '카카오톡' },
                ].map(({ key, icon: Icon, placeholder, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-gray-500" />
                    </div>
                    <input
                      type="text"
                      value={editForm[key]}
                      onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              {/* Quick links */}
              <div className="flex gap-2 pt-2">
                <Link
                  to="/seller/products"
                  className="flex-1 text-center text-xs font-medium text-blue-600 bg-blue-50 rounded-lg py-2.5"
                >
                  상품 관리 →
                </Link>
                <Link
                  to="/seller/live"
                  className="flex-1 text-center text-xs font-medium text-red-600 bg-red-50 rounded-lg py-2.5"
                >
                  방송 관리 →
                </Link>
              </div>
            </div>
          ) : (
            /* ── View Mode ── */
            <>
              <ProfileHeader seller={seller} />
              <SnsLinks seller={seller} compact />
            </>
          )}
        </div>

        {/* Owner quick actions bar (view mode only) */}
        {isOwner && !editing && (
          <div className="mx-4 mt-3 bg-blue-50 rounded-xl p-3 flex items-center justify-between">
            <span className="text-[12px] text-blue-700 font-medium">내 공개 페이지</span>
            <div className="flex items-center gap-2">
              <button
                onClick={startEditing}
                className="text-[11px] font-bold text-blue-600 bg-white px-3 py-1.5 rounded-lg shadow-sm"
              >
                프로필 수정
              </button>
              <Link
                to="/seller"
                className="text-[11px] font-bold text-gray-600 bg-white px-3 py-1.5 rounded-lg shadow-sm"
              >
                대시보드
              </Link>
            </div>
          </div>
        )}

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
            {isOwner && (
              <div className="flex gap-2 justify-center mt-4">
                <Link to="/seller/products" className="text-sm text-blue-600 font-medium hover:underline">
                  상품 등록하기
                </Link>
                <span className="text-gray-300">·</span>
                <Link to="/seller/live" className="text-sm text-red-600 font-medium hover:underline">
                  방송 등록하기
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
