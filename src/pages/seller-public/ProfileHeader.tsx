/**
 * 🛡️ 2026-05-07: TD-018 분할 — SellerPublicPage 의 커버/프로필/CTA 헤더.
 * state 는 부모(SellerPublicPage) 에 보존, 핸들러는 props 로 받음.
 * 🎨 2026-06-18 (대표 "내 쇼핑몰" 통일): 큐레이터 링크샵(CuratorHeader)과 동일한 풀블리드 배너 히어로
 *   재도입 — banner_url(없으면 brand_color/그라데이션 폴백) + 하단 페이드 + 중앙 정렬 이름/소개/SNS.
 *   아바타는 배너 위 오버랩(프로필 사진 업로드 보존). 이름/소개 인라인 편집·팔로우·단골·SNS·CTA 전부 보존.
 */
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { snsUrl } from '@/utils/sns-url'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Share2, Camera, Pencil, Check, X, MapPin, MessageCircle, Heart, Settings, ImagePlus } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import api from '@/lib/api'
import { cfImage } from '@/utils/cf-image'
import { compressForUpload } from '@/lib/image-compress'
import FollowButton from './FollowButton'
import RegularBadge from './RegularBadge'
import ExternalLivePlatforms from './ExternalLivePlatforms'
import { LIVE_COMMERCE_SUSPENDED } from '@/shared/feature-flags'
import type { Seller, LiveStream, Product } from './types'
import type { ThemeTokens } from './theme'

// 🔗 2026-06-17 (#6 링크샵 통일): snsUrl → @/utils/sns-url 공유 (큐레이터 CuratorHeader 와 dedup)

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
  seller, sellerId, isOwner, isDark, T, liveNow,
  editingField, setEditingField, editName, setEditName, editBio, setEditBio,
  saving, startEdit, saveEdit, fileInputRef, handleProfileImageUpload,
}: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  // 🎨 2026-06-18 배너 히어로 — banner_url(소유자 업로드) + brand_color/그라데이션 폴백.
  const [bannerUrl, setBannerUrl] = useState(seller.banner_url || '')
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const normBanner = bannerUrl.startsWith('r2://') ? `/api/media/${bannerUrl.slice(5)}` : bannerUrl
  const showBanner = !!(bannerPreview || normBanner)
  const bannerBg = seller.brand_color
    ? `linear-gradient(160deg, ${seller.brand_color}, #111)`
    : 'linear-gradient(135deg, #FF6A00 0%, #FF8A3D 42%, #1A1A1A 130%)'
  const pageBg = isDark ? '#020202' : '#ffffff'

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || uploadingBanner) return
    setUploadingBanner(true)
    try {
      setBannerPreview(URL.createObjectURL(file))
      const compressed = await compressForUpload(file, { maxSizeMB: 0.4, maxWidthOrHeight: 1440 }).catch(() => file)
      const fd = new FormData()
      fd.append('image', compressed)
      const res = await api.post('/api/seller/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const url = res.data?.url
      if (res.data?.success && url) {
        await api.patch('/api/seller/profile', { banner_url: url })
        setBannerUrl(url)
        toast.success(t('seller.bannerUpdated', { defaultValue: '배너 변경됨' }))
      } else {
        setBannerPreview(null)
        toast.error(t('seller.uploadFailedGeneric', { defaultValue: '업로드 실패' }))
      }
    } catch {
      setBannerPreview(null)
      toast.error(t('seller.uploadFailedGeneric', { defaultValue: '업로드 실패' }))
    } finally {
      setUploadingBanner(false)
    }
  }

  const overlayBtn = `rounded-full flex items-center justify-center w-[34px] h-[34px] bg-black/35 backdrop-blur text-white active:scale-90 transition-transform`

  return (
    <div className={`border-b ${isDark ? 'border-[#1A1A1A]' : 'border-gray-100'}`}>
      {/* ① 풀블리드 배너 히어로 */}
      <div
        className={`relative w-full aspect-[16/9] overflow-hidden ${isOwner ? 'cursor-pointer' : ''}`}
        style={showBanner ? undefined : { background: bannerBg }}
        onClick={() => isOwner && bannerInputRef.current?.click()}
      >
        {showBanner && (
          <img
            src={bannerPreview || cfImage(normBanner, { width: 1280, format: 'auto' }) || normBanner}
            alt=""
            className="w-full h-full object-cover"
            loading="eager"
            decoding="async"
          />
        )}
        {/* 하단 페이드 — 페이지 배경으로 melt */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24" style={{ background: `linear-gradient(to bottom, transparent, ${pageBg})` }} />
        {/* 상단 오버레이: 뒤로 / 공유 */}
        <button type="button" onClick={(e) => { e.stopPropagation(); navigate(-1) }} aria-label={t('notifications.back')} className={`absolute top-3 left-3 z-10 ${overlayBtn}`}>
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            const url = window.location.href
            if (navigator.share) navigator.share({ title: `${seller.name || seller.username || ''} 의 링크샵`.trim(), url })
            else { navigator.clipboard?.writeText(url); toast.success(t('seller.linkCopiedToast')) }
          }}
          aria-label="공유"
          className={`absolute top-3 right-3 z-10 ${overlayBtn}`}
        >
          <Share2 className="w-4 h-4" aria-hidden="true" />
        </button>
        {/* 소유자: 배너 변경 */}
        {isOwner && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); bannerInputRef.current?.click() }}
            className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-full bg-black/45 backdrop-blur text-white text-[11.5px] font-bold active:scale-95"
          >
            {uploadingBanner ? <Camera className="w-3.5 h-3.5 animate-pulse" /> : <ImagePlus className="w-3.5 h-3.5" />}
            {uploadingBanner ? t('seller.uploading', { defaultValue: '업로드 중…' }) : (showBanner ? t('seller.changeBanner', { defaultValue: '배너 변경' }) : t('seller.addBanner', { defaultValue: '배너 추가' }))}
          </button>
        )}
        {isOwner && <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />}
      </div>

      <div className="px-5 pb-4">
        {/* ② 아바타 (배너 위 오버랩, 중앙) + 프로필 업로드 + LIVE */}
        <div className="flex flex-col items-center -mt-10 relative z-10">
          <div className="relative">
            <div
              className={`w-[80px] h-[80px] rounded-full ring-4 overflow-hidden bg-gray-700 shadow-md ${isDark ? 'ring-[#020202]' : 'ring-white'} ${isOwner ? 'cursor-pointer' : ''}`}
              onClick={() => isOwner && fileInputRef.current?.click()}
            >
              {seller.profile_image ? (
                <img src={cfImage(seller.profile_image, { width: 160, format: 'auto' }) || seller.profile_image} alt="" className="w-full h-full object-cover" loading="eager" decoding="async" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">{(seller.name || '?').charAt(0)}</span>
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

          {/* ③ 이름 / 매장 / 소개 — 중앙 정렬 */}
          <div className="w-full mt-3 text-center">
            {editingField === 'name' ? (
              <div className="flex items-center justify-center gap-2">
                <input
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className={`text-[20px] font-extrabold ${T.text} bg-transparent border-b-2 border-pink-500 focus:outline-none text-center max-w-[240px]`}
                  onKeyDown={e => e.key === 'Enter' && saveEdit('name', editName)}
                />
                <button onClick={() => saveEdit('name', editName)} disabled={saving} className="p-1.5 bg-pink-500 rounded-full text-white shrink-0"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={() => setEditingField(null)} aria-label={t('common.cancelEdit')} className="p-1.5 bg-gray-200 rounded-full text-gray-500 shrink-0"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <h1 className={`text-[20px] font-extrabold ${T.text} leading-tight ${isOwner ? 'cursor-pointer' : ''}`} onClick={() => startEdit('name')}>
                {(() => {
                  const PLACEHOLDERS = ['메인 판매자', '셀러', '인플루언서', '매장']
                  if (seller.name && !PLACEHOLDERS.includes(seller.name)) return seller.name
                  if (isOwner) return seller.name || t('seller.publicPage.noName')
                  return seller.username || t('seller.publicPage.noName')
                })()}
                {isOwner && <Pencil className="w-3 h-3 text-pink-400 inline ml-1.5" />}
              </h1>
            )}
            {seller.business_name && (
              <div className="flex items-center justify-center gap-1 mt-1">
                <MapPin className={`w-3 h-3 ${T.textMuted}`} />
                <span className={`text-[11.5px] ${T.textMuted}`}>{seller.business_name}</span>
              </div>
            )}
            {editingField === 'bio' ? (
              <div className="mt-2 max-w-md mx-auto">
                <textarea
                  autoFocus
                  value={editBio}
                  onChange={e => setEditBio(e.target.value)}
                  rows={2}
                  className={`w-full text-[13px] ${T.input} border border-pink-500 rounded-lg p-2 focus:outline-none resize-none text-center`}
                />
                <div className="flex gap-2 mt-1 justify-center">
                  <button onClick={() => saveEdit('bio', editBio)} disabled={saving} className="px-3 py-1 bg-pink-500 text-white text-xs font-bold rounded-lg">{t('common.save')}</button>
                  <button onClick={() => setEditingField(null)} className={`px-3 py-1 ${T.cardAlt} ${T.textMuted} text-xs rounded-lg`}>{t('common.cancel')}</button>
                </div>
              </div>
            ) : (
              (seller.bio || isOwner) && (
                <p
                  className={`text-[13px] ${T.textSub} mt-2 leading-relaxed whitespace-pre-line max-w-md mx-auto ${isOwner ? 'cursor-pointer' : ''}`}
                  onClick={() => startEdit('bio')}
                >
                  {seller.bio || (isOwner ? `${t('seller.publicPage.enterBio')} ✎` : '')}
                </p>
              )
            )}

            {/* SNS 버튼 — 중앙 */}
            {(seller.sns_youtube || seller.sns_instagram || seller.external_live_tiktok) && (
              <div className="flex justify-center gap-2 mt-3">
                {seller.sns_youtube && (
                  <a href={snsUrl('youtube', seller.sns_youtube)} target="_blank" rel="noopener noreferrer" aria-label="YouTube"
                    className="w-[34px] h-[34px] rounded-[10px] bg-[#FF0000] flex items-center justify-center">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="#fff"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z" /></svg>
                  </a>
                )}
                {seller.sns_instagram && (
                  <a href={snsUrl('instagram', seller.sns_instagram)} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                    className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center" style={{ background: 'linear-gradient(45deg,#F9CE34,#EE2A7B,#6228D7)' }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="3.7" /><circle cx="17.3" cy="6.7" r="1.1" fill="#fff" stroke="none" /></svg>
                  </a>
                )}
                {seller.external_live_tiktok && (
                  <a href={snsUrl('tiktok', seller.external_live_tiktok)} target="_blank" rel="noopener noreferrer" aria-label="TikTok"
                    className="w-[34px] h-[34px] rounded-[10px] bg-[#141A2E] flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M16.5 3c.3 2.2 1.6 3.9 3.8 4.1v2.6c-1.3.1-2.5-.3-3.8-1v5.7c0 4.4-3.4 6.9-6.9 5.8-3.2-1-4.1-5-1.7-7.2 1-.9 2.4-1.3 3.8-1.1v2.7c-.4-.1-.8-.1-1.2 0-1.2.3-1.7 1.4-1.3 2.5.4 1.1 1.8 1.5 2.7.7.5-.4.7-1 .7-1.7V3h3.9Z" /></svg>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        {isOwner ? (
          <div className="grid grid-cols-2 gap-2 mt-4 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => navigate('/seller/profile')}
              className={`py-3 rounded-2xl ${isDark ? 'bg-white/[0.08] text-white' : 'bg-gray-100 text-gray-900'} active:opacity-80 transition-all text-[14px] font-bold flex items-center justify-center gap-2`}
            >
              <Pencil className="w-4 h-4" aria-hidden="true" />
              {t('seller.publicPage.editProfile', { defaultValue: '프로필 수정' })}
            </button>
            <button
              type="button"
              onClick={() => navigate('/seller')}
              className="py-3 rounded-2xl bg-blue-600 text-white active:opacity-80 transition-all text-[14px] font-bold flex items-center justify-center gap-2"
            >
              <Settings className="w-4 h-4" aria-hidden="true" />
              {t('seller.dashboard', { defaultValue: '대시보드' })}
            </button>
          </div>
        ) : (
          <div className="mt-4 max-w-md mx-auto">
            {/* 🛡️ 2026-05-15: liveNow 일 때 외부 플랫폼 (TikTok/Instagram) 라이브 배지 */}
            {liveNow && (seller.external_live_tiktok || seller.external_live_instagram || seller.external_live_facebook) && (
              <ExternalLivePlatforms externalLiveUrls={{
                tiktok: seller.external_live_tiktok,
                instagram: seller.external_live_instagram,
                facebook: seller.external_live_facebook,
              }} />
            )}
            <FollowButton sellerId={sellerId} />
            {/* 🛡️ 2026-05-15 (PRISM 따라잡기): 단골 등록 (알림 opt-in) */}
            <div className="mt-2">
              <RegularBadge sellerId={Number(sellerId)} variant="full" />
            </div>
            <div className="flex gap-2 mt-2">
              {seller.kakao_chat_link && (
                <a href={seller.kakao_chat_link} target="_blank" rel="noopener" className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl ${isDark ? 'bg-white/[0.04] active:bg-white/[0.08] text-white' : 'bg-gray-100 active:bg-gray-200 text-gray-900'} transition-colors text-[12px] font-medium`}>
                  <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" /> {t('seller.oneOnOneInquiry')}
                </a>
              )}
              {/* 🏁 2026-06-17 (#5): 후원 버튼은 라이브 후원 기반 → 라이브 영구중단으로 게이트 */}
              {!LIVE_COMMERCE_SUSPENDED && (
                <button
                  type="button"
                  onClick={() => liveNow ? navigate(`/live/${liveNow.id}`) : toast.info(t('seller.noLiveNow'))}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl ${isDark ? 'bg-white/[0.04] active:bg-white/[0.08] text-white' : 'bg-gray-100 active:bg-gray-200 text-gray-900'} transition-colors text-[12px] font-medium`}
                >
                  <Heart className="w-3.5 h-3.5" aria-hidden="true" /> {t('seller.donateButton')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
