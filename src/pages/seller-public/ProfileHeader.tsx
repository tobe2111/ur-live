/**
 * 🛡️ 2026-05-07: TD-018 분할 — SellerPublicPage 의 커버/프로필/CTA 헤더.
 * state 는 부모(SellerPublicPage) 에 보존, 핸들러는 props 로 받음.
 */
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Share2, Camera, Pencil, Check, X, MapPin, MessageCircle, Heart, Settings } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import FollowButton from './FollowButton'
import RegularBadge from './RegularBadge'
import ExternalLivePlatforms from './ExternalLivePlatforms'
import type { Seller, LiveStream, Product } from './types'
import type { ThemeTokens } from './theme'

// 🎨 2026-06-16 링크샵 시안: SNS 핸들/URL → 절대 URL 정규화 (핸들·@핸들·전체URL 모두 허용).
function snsUrl(platform: 'youtube' | 'instagram' | 'tiktok', v: string): string {
  const s = v.trim()
  if (/^https?:\/\//i.test(s)) return s
  const h = s.replace(/^@/, '')
  if (platform === 'youtube') return `https://youtube.com/@${h}`
  if (platform === 'instagram') return `https://instagram.com/${h}`
  return `https://tiktok.com/@${h}`
}

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

  // 🛡️ 2026-05-15 (PRISM 따라잡기): brand_color 가 있으면 커버 그라디언트 대신 컬러 사용
  return (
    <>
      {/* 🎨 2026-06-16 링크샵 시안(대표 승인 "시안처럼 컴팩트화"): 커버 배너·통계 그리드 제거 +
          아바타 좌 / 이름·매장·소개·SNS 우 가로형. 편집/업로드/팔로우/단골/SNS 로직은 보존. */}
      <div className={`border-b ${isDark ? 'border-[#1A1A1A]' : 'border-gray-100'}`}>
        {/* 상단 바: 뒤로 / 공유 (커버 없으니 페이지 배경 위) */}
        <div className="flex items-center justify-between px-3 pb-1" style={{ paddingTop: 'max(env(safe-area-inset-top), 8px)' }}>
          <button type="button" onClick={() => navigate(-1)} aria-label={t('notifications.back')} className={`rounded-full flex items-center justify-center w-[34px] h-[34px] ${isDark ? 'bg-white/[0.08] text-white' : 'bg-gray-100 text-gray-700'}`}>
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              const url = window.location.href
              if (navigator.share) navigator.share({ title: seller.name, url })
              else { navigator.clipboard?.writeText(url); toast.success(t('seller.linkCopiedToast')) }
            }}
            aria-label="공유"
            className={`rounded-full flex items-center justify-center w-[34px] h-[34px] ${isDark ? 'bg-white/[0.08] text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            <Share2 className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 pb-4">
          <div className="flex items-center gap-3.5">
            {/* 아바타 (62px) 인라인 + 업로드 + LIVE */}
            <div className="relative shrink-0">
              <div
                className={`w-[62px] h-[62px] rounded-full ring-2 ${T.avatarBorder} bg-gray-700 overflow-hidden shadow ${isOwner ? 'cursor-pointer' : ''}`}
                onClick={() => isOwner && fileInputRef.current?.click()}
              >
                {seller.profile_image ? (
                  <img src={seller.profile_image} alt="" className="w-full h-full object-cover" loading="eager" decoding="async" />
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

            {/* 이름 / 매장 / 소개 — 우측 컬럼 */}
            <div className="flex-1 min-w-0">
              {editingField === 'name' ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className={`text-[18px] font-extrabold ${T.text} bg-transparent border-b-2 border-pink-500 focus:outline-none flex-1 min-w-0`}
                    onKeyDown={e => e.key === 'Enter' && saveEdit('name', editName)}
                  />
                  <button onClick={() => saveEdit('name', editName)} disabled={saving} className="p-1.5 bg-pink-500 rounded-full text-white shrink-0"><Check className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setEditingField(null)} aria-label={t('common.cancelEdit')} className="p-1.5 bg-gray-200 rounded-full text-gray-500 shrink-0"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <h1 className={`text-[18px] font-extrabold ${T.text} leading-tight ${isOwner ? 'cursor-pointer' : ''}`} onClick={() => startEdit('name')}>
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
                <div className="flex items-center gap-1 mt-0.5">
                  <MapPin className={`w-3 h-3 ${T.textMuted}`} />
                  <span className={`text-[11px] ${T.textMuted}`}>{seller.business_name}</span>
                </div>
              )}
              {editingField === 'bio' ? (
                <div className="mt-1.5">
                  <textarea
                    autoFocus
                    value={editBio}
                    onChange={e => setEditBio(e.target.value)}
                    rows={2}
                    className={`w-full text-[13px] ${T.input} border border-pink-500 rounded-lg p-2 focus:outline-none resize-none`}
                  />
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => saveEdit('bio', editBio)} disabled={saving} className="px-3 py-1 bg-pink-500 text-white text-xs font-bold rounded-lg">{t('common.save')}</button>
                    <button onClick={() => setEditingField(null)} className={`px-3 py-1 ${T.cardAlt} ${T.textMuted} text-xs rounded-lg`}>{t('common.cancel')}</button>
                  </div>
                </div>
              ) : (
                (seller.bio || isOwner) && (
                  <p
                    className={`text-[12.5px] ${T.textSub} mt-1 leading-snug line-clamp-2 ${isOwner ? 'cursor-pointer' : ''}`}
                    onClick={() => startEdit('bio')}
                  >
                    {seller.bio || (isOwner ? `${t('seller.publicPage.enterBio')} ✎` : '')}
                  </p>
                )
              )}
            </div>
          </div>

          {/* 🎨 2026-06-16 링크샵 시안: SNS 버튼 (유튜브/인스타/틱톡) — 채널로 새 탭 이동. */}
          {(seller.sns_youtube || seller.sns_instagram || seller.external_live_tiktok) && (
            <div className="flex gap-2 mt-3">
              {seller.sns_youtube && (
                <a href={snsUrl('youtube', seller.sns_youtube)} target="_blank" rel="noopener noreferrer" aria-label="YouTube"
                  className="w-[30px] h-[30px] rounded-[9px] bg-[#FF0000] flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z" /></svg>
                </a>
              )}
              {seller.sns_instagram && (
                <a href={snsUrl('instagram', seller.sns_instagram)} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                  className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center" style={{ background: 'linear-gradient(45deg,#F9CE34,#EE2A7B,#6228D7)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="3.7" /><circle cx="17.3" cy="6.7" r="1.1" fill="#fff" stroke="none" /></svg>
                </a>
              )}
              {seller.external_live_tiktok && (
                <a href={snsUrl('tiktok', seller.external_live_tiktok)} target="_blank" rel="noopener noreferrer" aria-label="TikTok"
                  className="w-[30px] h-[30px] rounded-[9px] bg-[#141A2E] flex items-center justify-center">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff"><path d="M16.5 3c.3 2.2 1.6 3.9 3.8 4.1v2.6c-1.3.1-2.5-.3-3.8-1v5.7c0 4.4-3.4 6.9-6.9 5.8-3.2-1-4.1-5-1.7-7.2 1-.9 2.4-1.3 3.8-1.1v2.7c-.4-.1-.8-.1-1.2 0-1.2.3-1.7 1.4-1.3 2.5.4 1.1 1.8 1.5 2.7.7.5-.4.7-1 .7-1.7V3h3.9Z" /></svg>
                </a>
              )}
            </div>
          )}

          {/* CTA */}
          {isOwner ? (
            <div className="grid grid-cols-2 gap-2 mt-3.5">
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
            <div className="mt-3.5">
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
                <button
                  type="button"
                  onClick={() => liveNow ? navigate(`/live/${liveNow.id}`) : toast.info(t('seller.noLiveNow'))}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl ${isDark ? 'bg-white/[0.04] active:bg-white/[0.08] text-white' : 'bg-gray-100 active:bg-gray-200 text-gray-900'} transition-colors text-[12px] font-medium`}
                >
                  <Heart className="w-3.5 h-3.5" aria-hidden="true" /> {t('seller.donateButton')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
