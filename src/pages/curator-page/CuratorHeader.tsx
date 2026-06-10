/**
 * 🛡️ 2026-05-25 (C 옵션 통합): 큐레이터 공개페이지 헤더.
 * 🛡️ 2026-05-27 (옵션 C — 사용자 결정): 셀러 ProfileHeader 와 같은 수준 풍부화.
 *   - banner / cover (gradient)
 *   - 큰 아바타 + 인라인 편집 (name / bio / profile_image)
 *   - 통계 grid-3 (추천 / 클릭 / 적립)
 *   - 본인 CTA grid-2 (프로필 수정 / 수익 대시보드)
 *   - 다른 사용자 CTA: 공유 / 좋아요
 *
 * 셀러 권한 있는 user 는 CuratorPage 가 SellerPublicPage inline render (URL /u/:handle 유지).
 * 본 헤더는 일반 user 용 (셀러 권한 없음).
 */

import { useRef, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Share2, Heart, Pencil, Check, X, Camera, Settings } from 'lucide-react'
import KakaoShareButton from '@/components/KakaoShareButton'
import { cfImage } from '@/utils/cf-image'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

// 🏭 2026-06-05 (사용자 요청 — 링크샵 그라데이션 선택): 배경 그라데이션 프리셋.
//   banner_url 에 'gradient:<id>' 토큰으로 저장 (백엔드 curator.routes 가 허용).
const GRADIENT_PRESETS: Record<string, string> = {
  berry: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
  sunset: 'linear-gradient(135deg, #ff6a88 0%, #ff99ac 50%, #fcb69f 100%)',
  ocean: 'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)',
  grape: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  mint: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  gold: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
  night: 'linear-gradient(135deg, #232526 0%, #414345 100%)',
  flamingo: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
}
const DEFAULT_GRADIENT = 'linear-gradient(135deg, #fb7185 0%, #f43f5e 50%, #a855f7 100%)'
function gradientFor(banner: string | null | undefined): string | null {
  if (banner && banner.startsWith('gradient:')) return GRADIENT_PRESETS[banner.slice(9)] || DEFAULT_GRADIENT
  return null
}

interface CuratorHeaderProps {
  curator: {
    id: number
    handle: string
    name: string
    bio: string | null
    profile_image: string | null
    banner_url?: string | null
  }
  pinCount: number
  isOwner: boolean
  onCopyLink: () => void
  onCuratorUpdate?: (next: Partial<CuratorHeaderProps['curator']>) => void
}

export default function CuratorHeader({
  curator,
  pinCount,
  isOwner,
  onCopyLink,
  onCuratorUpdate,
}: CuratorHeaderProps) {
  const { t } = useTranslation()
  const [editingField, setEditingField] = useState<'name' | 'bio' | null>(null)
  const [editName, setEditName] = useState(curator.name)
  const [editBio, setEditBio] = useState(curator.bio || '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  async function saveField(field: 'name' | 'bio', value: string) {
    if (saving) return
    setSaving(true)
    try {
      const payload = field === 'name' ? { name: value.trim() } : { bio: value.trim() }
      const res = await api.patch('/api/curator/me/profile', payload)
      if (res.data?.success) {
        onCuratorUpdate?.({ [field]: value.trim() })
        toast.success('저장됐어요')
        setEditingField(null)
      } else {
        toast.error(res.data?.error || '저장 실패')
      }
    } catch {
      toast.error('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  async function uploadProfileImage(file: File) {
    if (uploading) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post('/api/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      // 🏭 2026-06-05: 업로드 응답은 { success, data: { url } } — 중첩 data.url 을 읽어야 함(ImageUpload 와 동일).
      const url = res.data?.data?.url
      if (res.data?.success && url) {
        await api.patch('/api/curator/me/profile', { profile_image: url })
        onCuratorUpdate?.({ profile_image: url })
        toast.success('프로필 사진 변경됨')
      } else {
        toast.error('업로드 실패')
      }
    } catch {
      toast.error('업로드 실패')
    } finally {
      setUploading(false)
    }
  }

  // 🛡️ 2026-05-27 (사용자 요청): 큐레이터 배경 사진 업로드.
  async function uploadBannerImage(file: File) {
    if (uploadingBanner) return
    setUploadingBanner(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      // 즉시 미리보기 — 업로드/저장과 무관하게 방금 고른 사진이 바로 보임
      const preview = URL.createObjectURL(file)
      setLocalPreview(preview)
      const res = await api.post('/api/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const url = res.data?.data?.url
      if (res.data?.success && url) {
        await api.patch('/api/curator/me/profile', { banner_url: url })
        onCuratorUpdate?.({ banner_url: url })
        toast.success('배경 사진 변경됨')
      } else {
        toast.error('업로드 실패')
      }
    } catch {
      setLocalPreview(null)
      toast.error('업로드 실패')
    } finally {
      setUploadingBanner(false)
    }
  }

  // 🏭 2026-06-05 (사용자 요청 — UI 영역 그라데이션): 헤더 배경.
  // 🛡️ 2026-06-10 (사용자 신고 — 배경 변경 후 깨진 아이콘):
  //   ① 레거시 'r2://key'(2026-06-05 이전 버그 저장분) → '/api/media/key' 정규화
  //   ② 프록시+원본 모두 실패 시 깨진 아이콘 대신 그라데이션 폴백(bannerBroken)
  //   ③ 업로드 직후엔 방금 고른 파일의 objectURL 로 즉시 표시(네트워크 무관 — 항상 보임)
  const normalizedBanner = curator.banner_url?.startsWith('r2://')
    ? `/api/media/${curator.banner_url.slice(5)}`
    : curator.banner_url
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [bannerBroken, setBannerBroken] = useState(false)
  useEffect(() => { setBannerBroken(false) }, [normalizedBanner])
  const gradientCss = gradientFor(curator.banner_url) || DEFAULT_GRADIENT
  const hasPhoto = !bannerBroken && !!(localPreview || (normalizedBanner && !gradientFor(curator.banner_url)))

  return (
    <header className="relative">
      {/* 🏭 2026-06-05 (사용자 요청 — UI 영역 그라데이션): 상단 영역 전체를 덮는 그라데이션 백드롭.
          하드 엣지 배너 박스가 아니라, 아바타/이름 영역 뒤까지 흐른 뒤 페이지 배경으로 부드럽게 페이드. */}
      <div className="absolute inset-x-0 top-0 h-[220px] overflow-hidden pointer-events-none">
        {hasPhoto ? (
          <img
            src={localPreview || cfImage(normalizedBanner!, { width: 1280, format: 'auto' }) || normalizedBanner!}
            alt=""
            className="w-full h-full object-cover"
            loading="eager"
            fetchPriority="high"
            decoding="async"
            onError={(e) => {
              // 프록시 실패 → R2 원본 1회 폴백 → 그래도 실패면 그라데이션(깨진 아이콘 절대 금지).
              const img = e.currentTarget
              if (img.dataset.fb !== '1' && normalizedBanner && !localPreview) { img.dataset.fb = '1'; img.src = normalizedBanner }
              else setBannerBroken(true)
            }}
          />
        ) : (
          <div className="w-full h-full" style={{ background: gradientCss }} />
        )}
        {/* 페이지 배경으로 페이드 — 하드 엣지 제거, 영역으로 자연스럽게 이어짐 (라이트=white / 다크=#020202) */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white dark:to-[#020202]" />
      </div>

      {/* 🏭 2026-06-05 (사용자 요청 — 그라데이션 버튼 제거): 배경은 사진 업로드만. 미설정 시 기본 그라데이션 자동. */}
      {isOwner && (
        <>
          <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
            <button onClick={() => bannerInputRef.current?.click()} className="inline-flex items-center gap-1 bg-black/55 hover:bg-black/70 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-full backdrop-blur">
              <Camera className="w-3.5 h-3.5" /> 배경 사진
            </button>
          </div>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) uploadBannerImage(f)
            }}
          />
          {uploadingBanner && (
            <div className="absolute inset-x-0 top-0 h-[220px] bg-black/50 flex items-center justify-center text-white text-xs font-bold z-20">
              ⏳ 업로드 중...
            </div>
          )}
        </>
      )}

      <div className="relative z-10 max-w-3xl mx-auto px-4 pt-[148px] pb-4">
        {/* 큰 아바타 (셀러 페이지 동일) */}
        <div className="flex items-end gap-3">
          <div className="relative shrink-0">
            <div
              className={`w-20 h-20 rounded-full border-4 border-white dark:border-[#020202] bg-gray-100 dark:bg-[#121212] overflow-hidden shadow-lg ${isOwner ? 'cursor-pointer' : ''}`}
              onClick={() => isOwner && fileInputRef.current?.click()}
            >
              {curator.profile_image ? (
                <img
                  src={cfImage(curator.profile_image, { width: 160, format: 'auto' }) || curator.profile_image}
                  alt={curator.name}
                  className="w-full h-full object-cover"
                  loading="eager"
                  decoding="async"
                  onError={(e) => {
                    // 🏭 2026-06-07 (사용자 신고 — 프로필 업로드 표시 실패): resize 프록시 깨진 응답 시
                    //   same-origin R2 원본으로 1회 폴백.
                    const img = e.currentTarget
                    if (img.dataset.fb !== '1' && curator.profile_image) { img.dataset.fb = '1'; img.src = curator.profile_image }
                  }}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-2xl font-bold text-white">
                  {(curator.name || '?').slice(0, 1)}
                </div>
              )}
              {isOwner && (
                <div className={`absolute inset-0 bg-black/30 flex items-center justify-center transition-opacity ${uploading ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}>
                  <Camera className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
            {/* 🏭 2026-06-05 (사용자 요청 — 프로필 사진 변경 노출): 항상 보이는 카메라 뱃지(모바일은 hover 없음). */}
            {isOwner && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="프로필 사진 변경"
                className="absolute -bottom-0.5 -right-0.5 z-10 w-7 h-7 rounded-full bg-pink-500 border-2 border-white dark:border-[#020202] flex items-center justify-center shadow-md active:scale-90 transition-transform"
              >
                <Camera className="w-3.5 h-3.5 text-white" />
              </button>
            )}
            {isOwner && (
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) uploadProfileImage(f)
                }}
              />
            )}
          </div>
        </div>

        {/* 이름 + handle + bio — 인라인 편집 */}
        <div className="mt-3">
          {editingField === 'name' ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-xl font-extrabold text-gray-900 dark:text-white bg-transparent border-b-2 border-pink-500 focus:outline-none flex-1"
                onKeyDown={(e) => e.key === 'Enter' && saveField('name', editName)}
                maxLength={40}
              />
              {/* 🛡️ 2026-05-31: 터치 타깃 확대 (p-1.5/w-3.5 ~24px → p-2.5/w-5 ~44px) — 너무 작다는 사용자 보고. */}
              <button onClick={() => saveField('name', editName)} disabled={saving} aria-label="저장" className="p-2.5 bg-pink-500 rounded-full text-white shrink-0 active:scale-95 transition-transform disabled:opacity-50"><Check className="w-5 h-5" /></button>
              <button onClick={() => setEditingField(null)} aria-label="취소" className="p-2.5 bg-gray-200 dark:bg-[#2A2A2A] rounded-full text-gray-600 dark:text-gray-300 shrink-0 active:scale-95 transition-transform"><X className="w-5 h-5" /></button>
            </div>
          ) : (
            <h1
              className={`text-xl font-extrabold text-gray-900 dark:text-white group ${isOwner ? 'cursor-pointer' : ''}`}
              onClick={() => isOwner && setEditingField('name')}
            >
              {curator.name}
              {isOwner && <Pencil className="w-3.5 h-3.5 text-pink-400 inline ml-2 opacity-100" />}
            </h1>
          )}
          <p className="text-sm text-pink-400 mt-0.5">@{curator.handle}</p>
        </div>

        {/* bio 인라인 편집 */}
        {editingField === 'bio' ? (
          <div className="mt-2">
            <textarea
              autoFocus
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              rows={3}
              maxLength={200}
              className="w-full text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-[#0A0A0A] border border-pink-500 rounded-lg p-2 focus:outline-none resize-none"
            />
            <div className="flex gap-2 mt-1">
              <button onClick={() => saveField('bio', editBio)} disabled={saving} className="px-3 py-1 bg-pink-500 text-white text-xs font-bold rounded-lg">저장</button>
              <button onClick={() => setEditingField(null)} className="px-3 py-1 bg-gray-100 dark:bg-[#1A1A1A] text-gray-500 dark:text-gray-400 text-xs rounded-lg">취소</button>
            </div>
          </div>
        ) : (curator.bio || isOwner) && (
          <div
            className={`group mt-2 ${isOwner ? 'cursor-pointer rounded-lg px-2 py-1 -mx-2 hover:bg-pink-500/10 transition-colors' : ''}`}
            onClick={() => isOwner && setEditingField('bio')}
          >
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-3">
              {curator.bio || (isOwner ? '한 줄 소개를 입력해주세요' : '')}
            </p>
            {isOwner && !curator.bio && (
              <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-pink-400">
                <Pencil className="w-3 h-3" /> 클릭하여 편집
              </span>
            )}
          </div>
        )}

        {/* 🏭 2026-06-05 (사용자 요청): 추천 핀 / 누적 클릭 / 30일 적립 통계 제거 — 영역 그라데이션 중심으로 단순화. */}

        {/* CTA grid-2 (본인) / 공유 + 좋아요 (다른) */}
        {isOwner ? (
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button
              type="button"
              onClick={() => setEditingField('name')}
              className="py-3 rounded-2xl bg-gray-100 dark:bg-white/[0.08] text-gray-900 dark:text-white active:opacity-80 transition-all text-[14px] font-bold flex items-center justify-center gap-2"
            >
              <Pencil className="w-4 h-4" />
              프로필 수정
            </button>
            <Link
              to="/u/me/earnings"
              className="py-3 rounded-2xl bg-pink-500 text-white active:opacity-80 transition-all text-[14px] font-bold flex items-center justify-center gap-2"
            >
              <Settings className="w-4 h-4" />
              수익 대시보드
            </Link>
          </div>
        ) : (
          <div className="flex gap-2 mt-3">
            <div className="flex-1">
              <KakaoShareButton
                title={`${curator.name} 의 링크샵`}
                description={curator.bio || `${pinCount}개 상품 추천 중`}
                imageUrl={`https://live.ur-team.com/api/og/curator/${curator.handle}`}
                link={`/u/${curator.handle}`}
                className="w-full py-2.5 bg-[#FEE500] hover:bg-[#FDD835] text-[#3C1E1E] rounded-xl text-sm font-bold transition-colors"
                buttonText="링크샵 둘러보기"
              />
            </div>
            <button
              onClick={onCopyLink}
              className="px-4 py-2.5 bg-gray-100 dark:bg-[#121212] hover:bg-gray-200 dark:hover:bg-[#1A1A1A] rounded-xl text-sm font-bold text-gray-900 dark:text-white transition-colors"
              aria-label={t('curator.copyLink', { defaultValue: '링크 복사' })}
              title="링크 복사"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              className="px-4 py-2.5 bg-gray-100 dark:bg-[#121212] hover:bg-gray-200 dark:hover:bg-[#1A1A1A] rounded-xl text-sm font-bold text-gray-900 dark:text-white transition-colors"
              aria-label="좋아요"
              title="좋아요"
            >
              <Heart className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
