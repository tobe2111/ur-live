/**
 * 🛡️ 2026-05-25 (C 옵션 통합): 큐레이터 공개페이지 헤더.
 * 🎨 2026-06-10 (사용자 결정 — 구조 개편): 배경(사진/그라데이션 배너) **완전 제거**.
 *   프로필 카드형(Linktree 스타일) — 테마 단색 위에 아바타/이름/소개/CTA 가운데 정렬.
 *   사진이 없어도 완성된 모습 = 업로드 실패·깨짐이 디자인을 못 망가뜨림.
 *   본문 주인공은 핀(교환권/상품) 카드 — 시선이 배경이 아닌 판매 콘텐츠로.
 *   유지: 이름/bio 인라인 편집, 프로필 사진 업로드(압축+objectURL 미리보기+3중 폴백).
 *
 * 셀러 권한 있는 user 는 CuratorPage 가 SellerPublicPage inline render (URL /u/:handle 유지).
 * 본 헤더는 일반 user 용 (셀러 권한 없음).
 */

import { useRef, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Share2, Pencil, Check, X, Camera, Settings } from 'lucide-react'
import KakaoShareButton from '@/components/KakaoShareButton'
import { cfImage } from '@/utils/cf-image'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { compressForUpload } from '@/lib/image-compress'

// 🎨 2026-06-16 링크샵 시안: SNS 핸들/URL → 절대 URL (핸들·@핸들·전체URL 허용).
function snsUrl(platform: 'youtube' | 'instagram' | 'tiktok', v: string): string {
  const s = v.trim()
  if (/^https?:\/\//i.test(s)) return s
  const h = s.replace(/^@/, '')
  if (platform === 'youtube') return `https://youtube.com/@${h}`
  if (platform === 'instagram') return `https://instagram.com/${h}`
  return `https://tiktok.com/@${h}`
}

interface CuratorHeaderProps {
  curator: {
    id: number
    handle: string
    name: string
    bio: string | null
    profile_image: string | null
    banner_url?: string | null // 레거시 — 더 이상 렌더하지 않음 (배경 제거)
    youtube_url?: string | null
    instagram_url?: string | null
    tiktok_url?: string | null
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  // 🎨 2026-06-16 링크샵 시안: SNS 링크 편집(소유자).
  const [editingSns, setEditingSns] = useState(false)
  const [snsForm, setSnsForm] = useState({
    youtube_url: curator.youtube_url || '',
    instagram_url: curator.instagram_url || '',
    tiktok_url: curator.tiktok_url || '',
  })
  async function saveSns() {
    if (saving) return
    setSaving(true)
    try {
      const payload = {
        youtube_url: snsForm.youtube_url.trim(),
        instagram_url: snsForm.instagram_url.trim(),
        tiktok_url: snsForm.tiktok_url.trim(),
      }
      const res = await api.patch('/api/curator/me/profile', payload)
      if (res.data?.success) {
        onCuratorUpdate?.(payload)
        setEditingSns(false)
      }
    } catch { /* no-op */ } finally { setSaving(false) }
  }

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
      const preview = URL.createObjectURL(file)
      setAvatarPreview(preview)
      // 🔬 2026-06-11 (사용자 신고 "프로필 이미지 너무 느림" — prod 실측 779KB 서빙): 아바타는
      //   ≤96px 표시라 1MB/1024px 한도가 과함. 512px/0.15MB 로 — 레티나 포함 시각 차이 0, ~40KB.
      //   (/api/media 는 리사이즈 없이 원본 서빙이라 업로드 시점 압축이 유일한 크기 통제 지점)
      const toSend = await compressForUpload(file, { maxSizeMB: 0.15, maxWidthOrHeight: 512 }).catch(() => file)
      const fd = new FormData()
      fd.append('file', toSend)
      const res = await api.post('/api/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      // 🏭 2026-06-05: 업로드 응답은 { success, data: { url } } — 중첩 data.url 을 읽어야 함(ImageUpload 와 동일).
      const url = res.data?.data?.url
      if (res.data?.success && url) {
        await api.patch('/api/curator/me/profile', { profile_image: url })
        onCuratorUpdate?.({ profile_image: url })
        toast.success('프로필 사진 변경됨')
      } else {
        toast.error(res.data?.error || '업로드 실패')
      }
    } catch (err) {
      setAvatarPreview(null)
      const e = err as { response?: { status?: number; data?: { error?: string } } }
      toast.error(e.response?.data?.error || `업로드 실패 (${e.response?.status ?? '네트워크'})`)
    } finally {
      setUploading(false)
    }
  }

  // 🛡️ 2026-06-10 (사용자 신고 — 프로필 사진 깨짐): 3중 방어 유지.
  //   ① r2:// 레거시 정규화 ② objectURL 즉시 미리보기 ③ 프록시→원본→이니셜 폴백.
  const normalizedAvatar = curator.profile_image?.startsWith('r2://')
    ? `/api/media/${curator.profile_image.slice(5)}`
    : curator.profile_image
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarBroken, setAvatarBroken] = useState(false)
  useEffect(() => { setAvatarBroken(false) }, [normalizedAvatar])

  return (
    // 🎨 2026-06-16 링크샵 시안 그대로: 가로형 컴팩트 프로필(아바타 좌 · 이름/핸들/소개 우) — 흰 배경 + 얇은 구분선, 세로 높이 절반.
    <header className="bg-white dark:bg-[#020202] border-b border-gray-100 dark:border-[#1A1A1A]">
      <div className="max-w-3xl mx-auto px-4 pt-4 pb-4">
        <div className="flex items-center gap-3.5">
          {/* 아바타 (62px) + 업로드(본인) */}
          <div className="relative shrink-0">
            <div
              className={`w-[62px] h-[62px] rounded-full ring-1 ring-gray-200 dark:ring-[#2A2A2A] bg-gray-100 dark:bg-[#121212] overflow-hidden shadow-sm ${isOwner ? 'cursor-pointer' : ''}`}
              onClick={() => isOwner && fileInputRef.current?.click()}
            >
              {(avatarPreview || normalizedAvatar) && !avatarBroken ? (
                <img
                  src={avatarPreview || cfImage(normalizedAvatar!, { width: 160, format: 'auto' }) || normalizedAvatar!}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="eager"
                  decoding="async"
                  onError={(e) => {
                    const img = e.currentTarget
                    if (img.dataset.fb !== '1' && normalizedAvatar && !avatarPreview) { img.dataset.fb = '1'; img.src = normalizedAvatar }
                    else setAvatarBroken(true)
                  }}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-2xl font-bold text-white">
                  {(curator.name || '?').slice(0, 1)}
                </div>
              )}
              {isOwner && uploading && (
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
            {isOwner && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="프로필 사진 변경"
                className="absolute -bottom-0.5 -right-0.5 z-10 w-6 h-6 rounded-full bg-gray-900 dark:bg-white border-2 border-white dark:border-[#020202] flex items-center justify-center shadow-md active:scale-90 transition-transform"
              >
                <Camera className="w-3 h-3 text-white dark:text-[#020202]" />
              </button>
            )}
            {isOwner && (
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadProfileImage(f) }}
              />
            )}
          </div>

          {/* 이름 / 핸들 / 소개 — 우측 컬럼 */}
          <div className="flex-1 min-w-0">
            {editingField === 'name' ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-[18px] font-extrabold text-gray-900 dark:text-white bg-transparent border-b-2 border-gray-900 dark:border-white focus:outline-none flex-1 min-w-0"
                  onKeyDown={(e) => e.key === 'Enter' && saveField('name', editName)}
                  maxLength={40}
                />
                <button onClick={() => saveField('name', editName)} disabled={saving} aria-label="저장" className="p-1.5 bg-gray-900 dark:bg-white rounded-full text-white dark:text-[#020202] shrink-0 active:scale-95 disabled:opacity-50"><Check className="w-4 h-4" /></button>
                <button onClick={() => setEditingField(null)} aria-label="취소" className="p-1.5 bg-gray-200 dark:bg-[#2A2A2A] rounded-full text-gray-600 dark:text-gray-300 shrink-0 active:scale-95"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1
                  className={`text-[18px] font-extrabold text-gray-900 dark:text-white leading-tight ${isOwner ? 'cursor-pointer' : ''}`}
                  onClick={() => isOwner && setEditingField('name')}
                >
                  {curator.name}
                </h1>
                <span className="text-[12.5px] text-gray-400 dark:text-gray-500 font-medium">@{curator.handle}</span>
                {isOwner && <Pencil className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-pointer" onClick={() => setEditingField('name')} />}
              </div>
            )}

            {editingField === 'bio' ? (
              <div className="mt-1.5">
                <textarea
                  autoFocus
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  rows={2}
                  maxLength={200}
                  className="w-full text-[13px] text-gray-900 dark:text-white bg-gray-50 dark:bg-[#0A0A0A] border border-gray-900 dark:border-white rounded-lg p-2 focus:outline-none resize-none"
                />
                <div className="flex gap-2 mt-1">
                  <button onClick={() => saveField('bio', editBio)} disabled={saving} className="px-3 py-1 bg-gray-900 dark:bg-white text-white dark:text-[#020202] text-xs font-bold rounded-lg">저장</button>
                  <button onClick={() => setEditingField(null)} className="px-3 py-1 bg-gray-100 dark:bg-[#1A1A1A] text-gray-500 dark:text-gray-400 text-xs rounded-lg">취소</button>
                </div>
              </div>
            ) : (curator.bio || isOwner) && (
              <p
                className={`text-[12.5px] text-gray-600 dark:text-gray-300 mt-1 leading-snug line-clamp-2 ${isOwner ? 'cursor-pointer' : ''}`}
                onClick={() => isOwner && setEditingField('bio')}
              >
                {curator.bio || (isOwner ? '한 줄 소개를 입력해주세요 ✎' : '')}
              </p>
            )}
            {/* 🎨 2026-06-16 링크샵 시안: SNS 버튼 (유튜브/인스타/틱톡) + 소유자 편집 토글 */}
            {(curator.youtube_url || curator.instagram_url || curator.tiktok_url || isOwner) && (
              <div className="flex items-center gap-2 mt-2">
                {curator.youtube_url && (
                  <a href={snsUrl('youtube', curator.youtube_url)} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="w-[30px] h-[30px] rounded-[9px] bg-[#FF0000] flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z" /></svg>
                  </a>
                )}
                {curator.instagram_url && (
                  <a href={snsUrl('instagram', curator.instagram_url)} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center" style={{ background: 'linear-gradient(45deg,#F9CE34,#EE2A7B,#6228D7)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="3.7" /><circle cx="17.3" cy="6.7" r="1.1" fill="#fff" stroke="none" /></svg>
                  </a>
                )}
                {curator.tiktok_url && (
                  <a href={snsUrl('tiktok', curator.tiktok_url)} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="w-[30px] h-[30px] rounded-[9px] bg-[#141A2E] flex items-center justify-center">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff"><path d="M16.5 3c.3 2.2 1.6 3.9 3.8 4.1v2.6c-1.3.1-2.5-.3-3.8-1v5.7c0 4.4-3.4 6.9-6.9 5.8-3.2-1-4.1-5-1.7-7.2 1-.9 2.4-1.3 3.8-1.1v2.7c-.4-.1-.8-.1-1.2 0-1.2.3-1.7 1.4-1.3 2.5.4 1.1 1.8 1.5 2.7.7.5-.4.7-1 .7-1.7V3h3.9Z" /></svg>
                  </a>
                )}
                {isOwner && (
                  <button onClick={() => setEditingSns(v => !v)} className="text-[11px] font-bold text-gray-400 dark:text-gray-500 px-1.5 py-1 active:opacity-70">
                    {(curator.youtube_url || curator.instagram_url || curator.tiktok_url) ? 'SNS 편집' : '+ SNS 링크'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* SNS 편집 패널 (소유자) */}
        {isOwner && editingSns && (
          <div className="mt-3 rounded-xl border border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#0A0A0A] p-3 space-y-2">
            {([['youtube_url', '유튜브'], ['instagram_url', '인스타그램'], ['tiktok_url', '틱톡']] as const).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 w-14 shrink-0">{label}</span>
                <input
                  value={snsForm[key]}
                  onChange={(e) => setSnsForm(s => ({ ...s, [key]: e.target.value }))}
                  placeholder="@핸들 또는 링크"
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] text-[13px] text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none"
                />
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button onClick={saveSns} disabled={saving} className="flex-1 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-[#020202] text-[13px] font-bold disabled:opacity-50">{saving ? '저장 중…' : '저장'}</button>
              <button onClick={() => setEditingSns(false)} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-[#1A1A1A] text-gray-500 dark:text-gray-400 text-[13px] font-bold">취소</button>
            </div>
          </div>
        )}

        {/* CTA — 본인: 프로필 수정 / 수익 대시보드, 방문자: 카카오 공유 + 복사 */}
        {isOwner ? (
          <div className="grid grid-cols-2 gap-2 mt-3.5">
            <button
              type="button"
              onClick={() => setEditingField('name')}
              className="py-2.5 rounded-xl bg-gray-100 dark:bg-white/[0.08] text-gray-900 dark:text-white text-[13px] font-bold flex items-center justify-center gap-1.5 active:opacity-80"
            >
              <Pencil className="w-3.5 h-3.5" /> 프로필 수정
            </button>
            <Link
              to="/u/me/earnings"
              className="py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-[#020202] text-[13px] font-bold flex items-center justify-center gap-1.5 active:opacity-80"
            >
              <Settings className="w-3.5 h-3.5" /> 수익 대시보드
            </Link>
          </div>
        ) : (
          <div className="flex gap-2 mt-3.5">
            <div className="flex-1">
              <KakaoShareButton
                title={`${curator.name} 의 링크샵`}
                description={curator.bio || `${pinCount}개 상품 추천 중`}
                imageUrl={`https://live.ur-team.com/api/og/curator/${curator.handle}`}
                link={`/u/${curator.handle}`}
                className="w-full py-2.5 bg-[#FEE500] hover:bg-[#FDD835] text-[#3C1E1E] rounded-xl text-sm font-bold transition-colors"
                buttonText="카카오톡 공유"
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
          </div>
        )}
      </div>
    </header>
  )
}
