/**
 * 🛡️ 2026-05-07: TD-018 분할 — SellerPublicPage 의 커버/프로필/CTA 헤더.
 * state 는 부모(SellerPublicPage) 에 보존, 핸들러는 props 로 받음.
 */
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Share2, Camera, Pencil, Check, X, MapPin, Star, MessageCircle, Heart } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import FollowButton from './FollowButton'
import type { Seller, LiveStream, Product } from './types'
import type { ThemeTokens } from './theme'

interface Props {
  seller: Seller
  sellerId: string
  isOwner: boolean
  isDark: boolean
  T: ThemeTokens
  liveNow: LiveStream | undefined
  products: Product[]
  streams: LiveStream[]
  // 인라인 편집
  editingField: string | null
  setEditingField: (v: string | null) => void
  editName: string
  setEditName: (v: string) => void
  editBio: string
  setEditBio: (v: string) => void
  saving: boolean
  startEdit: (field: string) => void
  saveEdit: (field: string, value: string) => void
  // 프로필 이미지 업로드
  fileInputRef: React.RefObject<HTMLInputElement>
  handleProfileImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export default function ProfileHeader({
  seller, sellerId, isOwner, isDark, T, liveNow, products, streams,
  editingField, setEditingField, editName, setEditName, editBio, setEditBio,
  saving, startEdit, saveEdit, fileInputRef, handleProfileImageUpload,
}: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <>
      {/* 커버 + 프로필 */}
      <div className="relative">
        <div className={`h-44 bg-gradient-to-br ${T.cover}`} />

        {/* 상단 네비 */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 pt-safe pb-2 z-10">
          <button type="button" onClick={() => navigate(-1)} aria-label={t('notifications.back')} className="rounded-full flex items-center justify-center w-[34px] h-[34px] bg-white/[0.08] backdrop-blur-md">
            <ArrowLeft className="w-4 h-4 text-white" aria-hidden="true" />
          </button>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => {
                const url = window.location.href
                if (navigator.share) navigator.share({ title: seller.name, url })
                else { navigator.clipboard?.writeText(url); toast.success(t('seller.linkCopiedToast')) }
              }}
              aria-label="공유"
              className="rounded-full flex items-center justify-center w-[34px] h-[34px] bg-white/[0.08] backdrop-blur-md"
            >
              <Share2 className="w-4 h-4 text-white" aria-hidden="true" />
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
                <img src={seller.profile_image} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
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
              {isOwner && <Pencil className="w-3 h-3 text-gray-300 inline ml-1.5 opacity-60 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity" />}
            </h1>
          )}
        </div>
        {seller.business_name && (
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className={`w-3 h-3 ${T.textMuted}`} />
            <span className={`text-xs ${T.textMuted}`}>{seller.business_name}</span>
          </div>
        )}
        {editingField === 'bio' ? (
          <div className="mt-2">
            <textarea
              autoFocus
              value={editBio}
              onChange={e => setEditBio(e.target.value)}
              rows={3}
              className={`w-full text-sm ${T.input} border border-pink-500 rounded-lg p-2 focus:outline-none focus:border-pink-500 resize-none`}
            />
            <div className="flex gap-2 mt-1">
              <button onClick={() => saveEdit('bio', editBio)} disabled={saving} className="px-3 py-1 bg-pink-500 text-white text-xs font-bold rounded-lg">{t('common.save')}</button>
              <button onClick={() => setEditingField(null)} className={`px-3 py-1 ${T.cardAlt} ${T.textMuted} text-xs rounded-lg`}>{t('common.cancel')}</button>
            </div>
          </div>
        ) : (
          <div className="group mt-2" onClick={() => startEdit('bio')}>
            <p className={`text-sm ${T.textSub} leading-relaxed line-clamp-2`}>
              {seller.bio || (isOwner ? t('seller.publicPage.enterBio') : '')}
            </p>
            {isOwner && <Pencil className={`w-3 h-3 ${T.textMuted} inline opacity-60 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity`} />}
          </div>
        )}

        {/* 통계 */}
        <div className="grid grid-cols-3 gap-2 mt-4 mb-2">
          <div className={`rounded-2xl px-3 py-2.5 ${isDark ? 'bg-white/[0.04]' : 'bg-gray-100'}`}>
            <p className={`text-[10px] ${T.textMuted}`}>{t('seller.tabProducts')}</p>
            <p className={`text-[15px] font-extrabold ${T.text} mt-0.5`} style={{ letterSpacing: '-0.02em' }}>{products.length}</p>
          </div>
          <div className={`rounded-2xl px-3 py-2.5 ${isDark ? 'bg-white/[0.04]' : 'bg-gray-100'}`}>
            <p className={`text-[10px] ${T.textMuted}`}>{t('seller.tabLive')}</p>
            <p className={`text-[15px] font-extrabold ${T.text} mt-0.5`} style={{ letterSpacing: '-0.02em' }}>{streams.length}</p>
          </div>
          <div className={`rounded-2xl px-3 py-2.5 ${isDark ? 'bg-white/[0.04]' : 'bg-gray-100'}`}>
            <p className={`text-[10px] ${T.textMuted}`}>{t('seller.rating')}</p>
            <p className={`text-[15px] font-extrabold ${T.text} mt-0.5 flex items-center gap-0.5`} style={{ letterSpacing: '-0.02em' }}>
              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" aria-hidden="true" />
              {(seller as any)?.average_rating != null
                ? Number((seller as any).average_rating).toFixed(1)
                : <span className={`${T.textMuted} text-[11px] font-semibold`}>{t('common.new')}</span>}
            </p>
          </div>
        </div>

        {/* CTA */}
        {isOwner ? (
          <button
            type="button"
            onClick={() => navigate('/seller/profile')}
            className={`w-full mt-2 py-3 rounded-2xl ${isDark ? 'bg-white/[0.08] text-white' : 'bg-gray-100 text-gray-900'} active:opacity-80 transition-all text-[14px] font-bold flex items-center justify-center gap-2`}
          >
            <Pencil className="w-4 h-4" aria-hidden="true" />
            {t('seller.publicPage.editProfile', { defaultValue: '프로필 수정' })}
          </button>
        ) : (
          <>
            <FollowButton sellerId={sellerId} />
            <div className="flex gap-2 mt-2">
              {seller.kakao_chat_link && (
                <a href={seller.kakao_chat_link} target="_blank" rel="noopener" className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl ${isDark ? 'bg-white/[0.04] active:bg-white/[0.08] text-white' : 'bg-gray-100 active:bg-gray-200 text-gray-900'} transition-colors text-[12px] font-medium`}>
                  <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" /> {t('seller.oneOnOneInquiry')}
                </a>
              )}
              <button
                type="button"
                onClick={() => liveNow ? navigate(`/live/${liveNow.id}`) : toast.info(t('seller.noLiveNow'))}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl ${isDark ? 'bg-white/[0.04] active:bg-white/[0.08] text-white' : 'bg-gray-100 active:bg-gray-200 text-gray-900'} transition-colors text-[12px] font-medium`}
              >
                <Heart className="w-3.5 h-3.5" aria-hidden="true" /> {t('seller.donateButton')}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
