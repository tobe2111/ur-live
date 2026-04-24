import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Share2, Star, MessageCircle, Heart, MapPin, Pencil, Camera, Check, X, Sun, Moon } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SEO from '@/components/SEO'
import SellerFollowButton from '@/components/seller/public/SellerFollowButton'
import { Seller, LiveStream, ThemeClasses } from '@/components/seller/public/seller-public-types'

interface SellerPublicHeaderProps {
  seller: Seller
  sellerId: string
  products: { length: number }
  streams: { length: number }
  liveNow: LiveStream | undefined
  isOwner: boolean
  isDark: boolean
  setIsDark: (v: boolean) => void
  T: ThemeClasses
  editingField: string | null
  setEditingField: (f: string | null) => void
  editName: string
  setEditName: (v: string) => void
  editBio: string
  setEditBio: (v: string) => void
  saving: boolean
  startEdit: (field: string) => void
  saveEdit: (field: string, value: string) => Promise<void>
  setSeller: React.Dispatch<React.SetStateAction<Seller | null>>
}

export default function SellerPublicHeader({
  seller, sellerId, products, streams, liveNow, isOwner, isDark, setIsDark, T,
  editingField, setEditingField, editName, setEditName, editBio, setEditBio,
  saving, startEdit, saveEdit, setSeller,
}: SellerPublicHeaderProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const token = localStorage.getItem('seller_token')
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = reader.result as string
      try {
        await api.put('/api/seller/profile', { profile_image: base64 }, { headers: { Authorization: `Bearer ${token}` } })
        setSeller(prev => prev ? { ...prev, profile_image: base64 } : prev)
        toast.success(t('seller.publicPage.profileImageChanged'))
      } catch { toast.error(t('seller.publicPage.imageUploadFailed')) }
    }
    reader.readAsDataURL(file)
  }

  return (
    <>
      <SEO
        title={seller.name || t('product.seller')}
        description={seller.bio || `${seller.name || t('product.seller')} - Ur Deal`}
        image={seller.profile_image}
        url={`/profile/${seller.username || seller.slug || seller.id}`}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: seller.name || seller.username || '셀러',
          description: seller.bio || `${seller.name || '셀러'}의 라이브 커머스 채널`,
          image: seller.profile_image || undefined,
          url: `https://live.ur-team.com/profile/${seller.username || seller.slug || seller.id}`,
          ...((seller as any).follower_count != null && { interactionStatistic: { '@type': 'InteractionCounter', interactionType: 'https://schema.org/FollowAction', userInteractionCount: (seller as any).follower_count } }),
        }}
      />

      {/* 커버 + 프로필 */}
      <div className="relative">
        {/* 커버 이미지 */}
        <div className={`h-44 bg-gradient-to-br ${T.cover}`} />

        {/* 상단 네비 */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-safe pb-2 z-10">
          <button onClick={() => navigate(-1)} className="p-2 bg-black/20 rounded-full backdrop-blur-sm">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setIsDark(!isDark)}
              className="p-2 bg-black/20 rounded-full backdrop-blur-sm"
            >
              {isDark ? <Sun className="w-5 h-5 text-white" /> : <Moon className="w-5 h-5 text-white" />}
            </button>
            <button onClick={() => {
              const url = window.location.href
              if (navigator.share) navigator.share({ title: seller.name, url })
              else { navigator.clipboard?.writeText(url); toast.success(t('seller.linkCopiedToast')) }
            }} className="p-2 bg-black/20 rounded-full backdrop-blur-sm">
              <Share2 className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* 프로필 아바타 */}
        <div className="absolute -bottom-10 left-5">
          <div className="relative">
            <div
              className={`w-20 h-20 rounded-full border-4 ${T.avatarBorder} bg-gray-700 overflow-hidden shadow-lg ${isOwner ? 'cursor-pointer' : ''}`}
              onClick={() => isOwner && fileInputRef.current?.click()}
            >
              {seller.profile_image ? (
                <img src={seller.profile_image} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center">
                  <span className={`text-2xl font-bold ${T.text}`}>{(seller.name || '?').charAt(0)}</span>
                </div>
              )}
              {isOwner && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
            {isOwner && <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleProfileImageUpload} />}
            {liveNow && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">LIVE</span>
            )}
          </div>
        </div>
      </div>

      {/* 셀러 정보 */}
      <div className="pt-14 px-5 pb-4">
        <div className="flex items-center justify-between">
          {editingField === 'name' ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className={`text-xl font-extrabold ${T.text} bg-transparent border-b-2 border-pink-500 focus:outline-none flex-1`}
                onKeyDown={e => e.key === 'Enter' && saveEdit('name', editName)}
              />
              <button onClick={() => saveEdit('name', editName)} disabled={saving} className="p-1.5 bg-pink-500 rounded-full text-white"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => setEditingField(null)} aria-label={t('common.cancelEdit')} className="p-1.5 bg-gray-200 rounded-full text-gray-500"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <h1 className={`text-xl font-extrabold ${T.text} group`} onClick={() => startEdit('name')}>
              {seller.name || t('seller.publicPage.noName')}
              {isOwner && <Pencil className="w-3 h-3 text-gray-300 inline ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />}
            </h1>
          )}
        </div>
        {seller.business_name && (
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-500">{seller.business_name}</span>
          </div>
        )}
        {editingField === 'bio' ? (
          <div className="mt-2">
            <textarea
              autoFocus
              value={editBio}
              onChange={e => setEditBio(e.target.value)}
              rows={3}
              className="w-full text-sm text-gray-400 bg-[#121212] border border-pink-500 rounded-lg p-2 focus:outline-none focus:border-pink-500 resize-none"
            />
            <div className="flex gap-2 mt-1">
              <button onClick={() => saveEdit('bio', editBio)} disabled={saving} className="px-3 py-1 bg-pink-500 text-white text-xs font-bold rounded-lg">{t('common.save')}</button>
              <button onClick={() => setEditingField(null)} className="px-3 py-1 bg-[#1A1A1A] text-gray-500 text-xs rounded-lg">{t('common.cancel')}</button>
            </div>
          </div>
        ) : (
          <div className="group mt-2" onClick={() => startEdit('bio')}>
            <p className="text-sm text-gray-400 leading-relaxed line-clamp-2">
              {seller.bio || (isOwner ? t('seller.publicPage.enterBio') : '')}
            </p>
            {isOwner && <Pencil className="w-3 h-3 text-gray-300 inline opacity-0 group-hover:opacity-100 transition-opacity" />}
          </div>
        )}

        {/* 통계 */}
        <div className="flex items-center gap-6 mt-4 py-3 border-y border-[#1A1A1A]">
          <div className="text-center flex-1">
            <p className="text-xs text-gray-500">{t('seller.tabProducts')}</p>
            <p className={`text-sm font-bold ${T.text}`}>{products.length}</p>
          </div>
          <div className="text-center flex-1">
            <p className="text-xs text-gray-500">{t('seller.tabLive')}</p>
            <p className={`text-sm font-bold ${T.text}`}>{streams.length}</p>
          </div>
          <div className="text-center flex-1">
            <p className="text-xs text-gray-500">{t('seller.rating')}</p>
            <p className={`text-sm font-bold ${T.text} flex items-center justify-center gap-0.5`}>
              <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
              {(seller as any)?.average_rating != null
                ? Number((seller as any).average_rating).toFixed(1)
                : <span className="text-gray-500 text-xs">{t('common.new')}</span>}
            </p>
          </div>
        </div>

        {/* 팔로우 + CTA */}
        <SellerFollowButton sellerId={sellerId} />
        <div className="flex gap-2 mt-2">
          {seller.kakao_chat_link && (
            <a href={seller.kakao_chat_link} target="_blank" rel="noopener" className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-[#2A2A2A] rounded-xl text-sm font-medium text-gray-300">
              <MessageCircle className="w-4 h-4" /> {t('seller.oneOnOneInquiry')}
            </a>
          )}
          <button
            onClick={() => liveNow ? navigate(`/live/${liveNow.id}`) : toast.info(t('seller.noLiveNow'))}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-[#2A2A2A] rounded-xl text-sm font-medium text-gray-300"
          >
            <Heart className="w-4 h-4" /> {t('seller.donateButton')}
          </button>
        </div>
      </div>
    </>
  )
}
