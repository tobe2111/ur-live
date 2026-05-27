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

import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Share2, Heart, Pencil, Check, X, Camera, Settings } from 'lucide-react'
import KakaoShareButton from '@/components/KakaoShareButton'
import { formatNumber } from '@/utils/format'
import { cfImage } from '@/utils/cf-image'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface CuratorHeaderProps {
  curator: {
    id: number
    handle: string
    name: string
    bio: string | null
    profile_image: string | null
  }
  pinCount: number
  totalClicks: number
  monthEarnings?: number
  isOwner: boolean
  onCopyLink: () => void
  onCuratorUpdate?: (next: Partial<CuratorHeaderProps['curator']>) => void
}

export default function CuratorHeader({
  curator,
  pinCount,
  totalClicks,
  monthEarnings = 0,
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
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      if (res.data?.success && res.data?.url) {
        await api.patch('/api/curator/me/profile', { profile_image: res.data.url })
        onCuratorUpdate?.({ profile_image: res.data.url })
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

  return (
    <header>
      {/* 🛡️ 2026-05-27: banner gradient — 셀러 페이지 h-44 동일. */}
      <div className="h-44 bg-gradient-to-br from-pink-400 via-rose-400 to-purple-400 relative">
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      <div className="max-w-3xl mx-auto px-4 -mt-12 pb-4">
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
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-2xl font-bold text-white">
                  {(curator.name || '?').slice(0, 1)}
                </div>
              )}
              {isOwner && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
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
              <button onClick={() => saveField('name', editName)} disabled={saving} className="p-1.5 bg-pink-500 rounded-full text-white"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => setEditingField(null)} aria-label="취소" className="p-1.5 bg-gray-200 rounded-full text-gray-500"><X className="w-3.5 h-3.5" /></button>
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

        {/* 통계 grid-3 — 셀러 페이지 동일 */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="rounded-2xl px-3 py-2.5 bg-gray-100 dark:bg-white/[0.04]">
            <p className="text-[10px] text-gray-500 dark:text-gray-400">추천 핀</p>
            <p className="text-[15px] font-extrabold text-gray-900 dark:text-white mt-0.5" style={{ letterSpacing: '-0.02em' }}>{formatNumber(pinCount)}</p>
          </div>
          <div className="rounded-2xl px-3 py-2.5 bg-gray-100 dark:bg-white/[0.04]">
            <p className="text-[10px] text-gray-500 dark:text-gray-400">누적 클릭</p>
            <p className="text-[15px] font-extrabold text-gray-900 dark:text-white mt-0.5" style={{ letterSpacing: '-0.02em' }}>{formatNumber(totalClicks)}</p>
          </div>
          <div className="rounded-2xl px-3 py-2.5 bg-gray-100 dark:bg-white/[0.04]">
            <p className="text-[10px] text-gray-500 dark:text-gray-400">30일 적립</p>
            <p className="text-[15px] font-extrabold text-pink-400 mt-0.5" style={{ letterSpacing: '-0.02em' }}>
              {isOwner ? formatNumber(monthEarnings) : '—'}
            </p>
          </div>
        </div>

        {/* CTA grid-2 (본인) / 공유 + 좋아요 (다른) */}
        {isOwner ? (
          <div className="grid grid-cols-2 gap-2 mt-3">
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
