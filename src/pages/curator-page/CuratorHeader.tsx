/**
 * 🛡️ 2026-05-25 (C 옵션 통합): 큐레이터 공개페이지 헤더.
 * 🎨 2026-06-18 (사용자 시안 — 나브랜딩 랜딩 리디자인): "독립 브랜드 랜딩"으로 재구성.
 *   ① 최상단 흐르는 마퀴(linkshop_headline) — 공지/헤드라인 옆으로 스크롤.
 *   ② 풀블리드 배너 히어로(banner_url) — 동그라미 아바타 대신 배너가 정체성. 없으면 그라데이션 폴백.
 *   ③ 이름/태그라인/SNS 중앙 정렬.
 *   유지: 이름/bio 인라인 편집, SNS 편집, 링크샵 주소(핸들) 변경 카드, 방문자 공유.
 *   배너는 카카오 프로필과 별개의 전용 업로드(banner_url). 프로필 사진(profile_image)은
 *   OG/핀 썸네일 등에서 계속 쓰여 데이터는 유지하되 헤더 동그라미 렌더는 제거.
 *
 * 셀러 권한 있는 user 는 CuratorPage 가 SellerPublicPage inline render (URL /u/:handle 유지).
 * 본 헤더는 일반 user 용 (셀러 권한 없음).
 */

import { useRef, useState, useEffect } from 'react'
import { snsUrl } from '@/utils/sns-url'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Share2, Pencil, Check, X, Camera, ImagePlus } from 'lucide-react'
import KakaoShareButton from '@/components/KakaoShareButton'
import { cfImage } from '@/utils/cf-image'
import api from '@/lib/api'
import { curatorApi } from '@/features/curator/api/curator-api'
import { toast } from '@/hooks/useToast'
import { compressForUpload } from '@/lib/image-compress'

// 🔗 2026-06-17 (#6 링크샵 통일): snsUrl → @/utils/sns-url 공유 (셀러 ProfileHeader 와 dedup)

interface CuratorHeaderProps {
  curator: {
    id: number
    handle: string
    name: string
    bio: string | null
    profile_image: string | null
    banner_url?: string | null // 🎨 2026-06-18 히어로 배너로 재도입 (소유자 전용 업로드)
    headline?: string | null // 🎨 2026-06-18 마퀴(흐르는 헤드라인)
    accent?: string | null // 🎨 2026-06-19 마퀴 액센트 색 (#RRGGBB)
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
  const navigate = useNavigate()
  const [editingField, setEditingField] = useState<'name' | 'bio' | null>(null)
  // 🔗 2026-06-17 (사용자 요청 — 공유 우선 + 주소변경 통합): 헤더 '내 링크샵 주소' 카드의 주소 변경 인라인.
  const shareHost = typeof window !== 'undefined' ? window.location.host : 'live.ur-team.com'
  const [editingHandle, setEditingHandle] = useState(false)
  const [handleVal, setHandleVal] = useState(curator.handle)
  const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'ok' | 'bad' | 'saving'>('idle')
  const [handleMsg, setHandleMsg] = useState('')
  useEffect(() => {
    if (!editingHandle) return
    const h = handleVal.trim().toLowerCase()
    if (h === curator.handle) { setHandleStatus('idle'); setHandleMsg(''); return }
    if (!/^[a-z0-9_]{3,20}$/.test(h)) { setHandleStatus('bad'); setHandleMsg('소문자/숫자/_ 3~20자'); return }
    setHandleStatus('checking'); setHandleMsg('확인 중…')
    const tm = setTimeout(async () => {
      try {
        const r = await curatorApi.checkHandle(h)
        if (r.available) { setHandleStatus('ok'); setHandleMsg('사용 가능한 주소예요') }
        else { setHandleStatus('bad'); setHandleMsg(r.message || '이미 사용 중이에요') }
      } catch { setHandleStatus('idle'); setHandleMsg('') }
    }, 400)
    return () => clearTimeout(tm)
  }, [handleVal, editingHandle, curator.handle])
  async function saveHandle() {
    const h = handleVal.trim().toLowerCase()
    if (h === curator.handle) { setEditingHandle(false); return }
    if (handleStatus !== 'ok') return
    setHandleStatus('saving')
    try {
      const r = await curatorApi.updateHandle(h)
      if (r.success && r.handle) {
        onCuratorUpdate?.({ handle: r.handle })
        setEditingHandle(false)
        navigate(`/u/${r.handle}`, { replace: true })
        toast.success('링크샵 주소가 변경됐어요')
      } else { setHandleStatus('bad'); setHandleMsg(r.error || '변경에 실패했어요') }
    } catch { setHandleStatus('bad'); setHandleMsg('변경에 실패했어요') }
  }
  const [editName, setEditName] = useState(curator.name)
  const [editBio, setEditBio] = useState(curator.bio || '')
  const [saving, setSaving] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  // 🎨 2026-06-18 마퀴 헤드라인 편집(소유자).
  const [editingHeadline, setEditingHeadline] = useState(false)
  const [headlineVal, setHeadlineVal] = useState(curator.headline || '')
  // 🎨 2026-06-19 마퀴 액센트 색 (소유자 조정). 비면 기본 주황.
  const ACCENT_DEFAULT = '#FF6A00'
  const ACCENT_PRESETS = ['#FF6A00', '#E11D48', '#7C3AED', '#2563EB', '#0E9F6E', '#111827']
  const accentColor = (curator.accent && /^#[0-9A-Fa-f]{6}$/.test(curator.accent)) ? curator.accent : ACCENT_DEFAULT
  // 액센트 밝기로 글자색 자동 대비 (밝으면 잉크, 어두우면 흰색).
  const accentText = (() => {
    const h = accentColor.replace('#', '')
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? '#1a1a1a' : '#ffffff'
  })()
  async function saveAccent(hex: string) {
    const prev = curator.accent || ''
    if (hex === prev) return
    onCuratorUpdate?.({ accent: hex })
    try {
      const res = await api.patch('/api/curator/me/profile', { accent: hex })
      if (!res.data?.success) { onCuratorUpdate?.({ accent: prev }); toast.error(res.data?.error || '저장 실패') }
    } catch { onCuratorUpdate?.({ accent: prev }); toast.error('저장 실패') }
  }
  // 🎨 2026-06-16 링크샵 시안: SNS 링크 편집(소유자).
  const [editingSns, setEditingSns] = useState(false)
  const [snsForm, setSnsForm] = useState({
    youtube_url: curator.youtube_url || '',
    instagram_url: curator.instagram_url || '',
    tiktok_url: curator.tiktok_url || '',
  })
  async function saveSns() {
    if (saving) return
    // 🏎️ 2026-06-17 (링크샵 데이터 변경 속도 감사): 낙관적 저장 — 즉시 반영 + 패널 닫기, 실패 시 되돌림.
    const payload = {
      youtube_url: snsForm.youtube_url.trim(),
      instagram_url: snsForm.instagram_url.trim(),
      tiktok_url: snsForm.tiktok_url.trim(),
    }
    const prev = {
      youtube_url: curator.youtube_url || '',
      instagram_url: curator.instagram_url || '',
      tiktok_url: curator.tiktok_url || '',
    }
    onCuratorUpdate?.(payload)
    setEditingSns(false)
    setSaving(true)
    try {
      const res = await api.patch('/api/curator/me/profile', payload)
      if (!res.data?.success) {
        onCuratorUpdate?.(prev)
        toast.error(res.data?.error || '저장 실패')
      }
    } catch {
      onCuratorUpdate?.(prev)
      toast.error('저장 실패')
    } finally { setSaving(false) }
  }

  // 🎨 2026-06-18 마퀴 헤드라인 낙관적 저장.
  async function saveHeadline() {
    const next = headlineVal.trim().slice(0, 80)
    const prev = curator.headline || ''
    if (next === prev) { setEditingHeadline(false); return }
    onCuratorUpdate?.({ headline: next })
    setEditingHeadline(false)
    try {
      const res = await api.patch('/api/curator/me/profile', { headline: next })
      if (!res.data?.success) { onCuratorUpdate?.({ headline: prev }); toast.error(res.data?.error || '저장 실패') }
    } catch { onCuratorUpdate?.({ headline: prev }); toast.error('저장 실패') }
  }

  // 🏎️ 2026-06-17 (링크샵 데이터 변경 속도 감사): 낙관적 저장 — 값 즉시 반영 + 편집 닫기,
  //   PATCH 는 백그라운드. 실패 시 이전 값으로 되돌림.
  async function saveField(field: 'name' | 'bio', value: string) {
    if (saving) return
    const next = value.trim()
    // 이름은 최소 1자(서버 검증과 동일) — 빈 값이면 낙관 적용 없이 편집 유지.
    if (field === 'name' && !next) { toast.error('이름은 최소 1자 필요해요'); return }
    const prev = field === 'name' ? curator.name : (curator.bio || '')
    if (next === prev) { setEditingField(null); return }
    // 낙관적 반영 — 즉시 값 갱신 + 편집 닫기.
    onCuratorUpdate?.({ [field]: next })
    setEditingField(null)
    setSaving(true)
    try {
      const payload = field === 'name' ? { name: next } : { bio: next }
      const res = await api.patch('/api/curator/me/profile', payload)
      if (!res.data?.success) {
        onCuratorUpdate?.({ [field]: prev }) // 실패 → 되돌림
        toast.error(res.data?.error || '저장 실패')
      }
    } catch {
      onCuratorUpdate?.({ [field]: prev })
      toast.error('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  // 🎨 2026-06-18 배너 히어로 업로드(소유자) — 카카오 프로필과 별개의 banner_url.
  //   배너는 풀블리드 표시라 프로필(512px)보다 큰 1440px/0.4MB 한도.
  async function uploadBanner(file: File) {
    if (uploadingBanner) return
    setUploadingBanner(true)
    try {
      const preview = URL.createObjectURL(file)
      setBannerPreview(preview)
      const toSend = await compressForUpload(file, { maxSizeMB: 0.4, maxWidthOrHeight: 1440 }).catch(() => file)
      const fd = new FormData()
      fd.append('file', toSend)
      const res = await api.post('/api/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      // 🏭 2026-06-05: 업로드 응답은 { success, data: { url } } — 중첩 data.url.
      const url = res.data?.data?.url
      if (res.data?.success && url) {
        await api.patch('/api/curator/me/profile', { banner_url: url })
        onCuratorUpdate?.({ banner_url: url })
        toast.success('배너 변경됨')
      } else {
        setBannerPreview(null)
        toast.error(res.data?.error || '업로드 실패')
      }
    } catch (err) {
      setBannerPreview(null)
      const e = err as { response?: { status?: number; data?: { error?: string } } }
      toast.error(e.response?.data?.error || `업로드 실패 (${e.response?.status ?? '네트워크'})`)
    } finally {
      setUploadingBanner(false)
    }
  }

  // 🛡️ banner_url r2:// 레거시 정규화 + objectURL 즉시 미리보기 + 깨짐 시 그라데이션 폴백.
  const normalizedBanner = curator.banner_url?.startsWith('r2://')
    ? `/api/media/${curator.banner_url.slice(5)}`
    : curator.banner_url
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)
  const [bannerBroken, setBannerBroken] = useState(false)
  useEffect(() => { setBannerBroken(false) }, [normalizedBanner])
  const showBanner = (bannerPreview || normalizedBanner) && !bannerBroken
  // 폴백 그라데이션 — 배너 없을 때도 완성된 히어로 (브랜드 앰버 + 잉크).
  const bannerGradient = 'linear-gradient(135deg, #FF6A00 0%, #FF8A3D 42%, #1A1A1A 130%)'

  const hasSns = !!(curator.youtube_url || curator.instagram_url || curator.tiktok_url)

  return (
    <header className="bg-white dark:bg-[#020202] border-b border-gray-100 dark:border-[#1A1A1A]">
      {/* ① 흐르는 마퀴(헤드라인) — 최상단, 풀블리드 */}
      <div className="max-w-3xl mx-auto">
        {editingHeadline ? (
          <div className="px-3 py-2 space-y-2" style={{ background: accentColor }}>
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={headlineVal}
                onChange={(e) => setHeadlineVal(e.target.value.slice(0, 80))}
                onKeyDown={(e) => e.key === 'Enter' && saveHeadline()}
                placeholder="흐르는 한 줄 공지 (예: 신상 입고 · 무료배송 이벤트)"
                maxLength={80}
                className="flex-1 min-w-0 bg-white/20 text-white placeholder:text-white/70 text-[12.5px] font-bold px-2.5 py-1.5 rounded-lg outline-none"
              />
              <button onClick={saveHeadline} aria-label="저장" className="shrink-0 p-1.5 bg-white rounded-lg active:scale-95" style={{ color: accentColor }}><Check className="w-4 h-4" /></button>
              <button onClick={() => { setEditingHeadline(false); setHeadlineVal(curator.headline || '') }} aria-label="취소" className="shrink-0 p-1.5 bg-white/20 rounded-lg text-white active:scale-95"><X className="w-4 h-4" /></button>
            </div>
            {/* 색상 조정 — 프리셋 스와치 + 커스텀 컬러 */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10.5px] font-bold text-white/80 mr-0.5">색상</span>
              {ACCENT_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => saveAccent(c)}
                  aria-label={`색상 ${c}`}
                  className={`w-5 h-5 rounded-full border-2 ${accentColor.toLowerCase() === c.toLowerCase() ? 'border-white' : 'border-white/40'} active:scale-90`}
                  style={{ background: c }}
                />
              ))}
              <label className="w-5 h-5 rounded-full border-2 border-white/40 overflow-hidden cursor-pointer relative ml-0.5" title="직접 선택" style={{ background: 'conic-gradient(red,orange,yellow,green,blue,violet,red)' }}>
                <input type="color" value={accentColor} onChange={(e) => saveAccent(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
              </label>
            </div>
          </div>
        ) : curator.headline ? (
          <div className="relative overflow-hidden" style={{ background: accentColor, color: accentText }}>
            <div className="animate-marquee py-1.5">
              {[0, 1].map((copy) => (
                <div key={copy} className="flex shrink-0" aria-hidden={copy === 1}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <span key={i} className="px-7 text-[12px] font-bold tracking-wide whitespace-nowrap">
                      {curator.headline}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            {isOwner && (
              <button
                onClick={() => { setEditingHeadline(true); setHeadlineVal(curator.headline || '') }}
                aria-label="헤드라인 편집"
                className="absolute top-1/2 right-2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-black/25 backdrop-blur flex items-center justify-center active:scale-90"
              >
                <Pencil className="w-3 h-3 text-white" />
              </button>
            )}
          </div>
        ) : isOwner ? (
          <button
            onClick={() => { setEditingHeadline(true); setHeadlineVal('') }}
            className="w-full text-[11px] font-bold py-1.5 active:opacity-80"
            style={{ background: `${accentColor}1A`, color: accentColor }}
          >
            + 흐르는 헤드라인 추가
          </button>
        ) : null}
      </div>

      {/* ② 풀블리드 배너 히어로 — 화면 가득(좌우 여백 0) + 하단 그라데이션으로 페이지에 녹아듦 */}
      <div className="max-w-3xl mx-auto">
        <div
          className={`relative w-full aspect-[4/3] overflow-hidden ${isOwner ? 'cursor-pointer' : ''}`}
          style={showBanner ? undefined : { background: bannerGradient }}
          onClick={() => isOwner && bannerInputRef.current?.click()}
        >
          {showBanner && (
            <img
              src={bannerPreview || cfImage(normalizedBanner!, { width: 1280, format: 'auto' }) || normalizedBanner!}
              alt=""
              className="w-full h-full object-cover"
              loading="eager"
              decoding="async"
              onError={(e) => {
                const img = e.currentTarget
                if (img.dataset.fb !== '1' && normalizedBanner && !bannerPreview) { img.dataset.fb = '1'; img.src = normalizedBanner }
                else setBannerBroken(true)
              }}
            />
          )}
          {/* 하단 그라데이션 페이드 — 배너가 페이지 배경으로 자연스럽게 melt (좌우 풀블리드 + 부드러운 전환) */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-white dark:to-[#020202]" />
          {/* 공유 (방문자/소유자 공통) — 우상단 오버레이 */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCopyLink() }}
            aria-label="공유"
            className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/35 backdrop-blur flex items-center justify-center active:scale-90"
          >
            <Share2 className="w-4 h-4 text-white" />
          </button>
          {/* 소유자: 배너 변경 — 좌상단 오버레이 (하단 페이드 영역 피해서 위로) */}
          {isOwner && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); bannerInputRef.current?.click() }}
              className="absolute top-3 left-3 z-10 flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-full bg-black/45 backdrop-blur text-white text-[11.5px] font-bold active:scale-95"
            >
              {uploadingBanner ? <Camera className="w-3.5 h-3.5 animate-pulse" /> : <ImagePlus className="w-3.5 h-3.5" />}
              {uploadingBanner ? '업로드 중…' : (showBanner ? '배너 변경' : '배너 추가')}
            </button>
          )}
          {isOwner && (
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBanner(f) }}
            />
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-4">
        {/* ③ 이름 / 핸들 / 태그라인 / SNS — 중앙 정렬 (배너 하단 페이드 위로 살짝 올림) */}
        <div className="-mt-6 relative z-10 text-center">

          {editingField === 'name' ? (
            <div className="flex items-center justify-center gap-2">
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-[22px] font-extrabold text-gray-900 dark:text-white bg-transparent border-b-2 border-gray-900 dark:border-white focus:outline-none text-center max-w-[260px]"
                onKeyDown={(e) => e.key === 'Enter' && saveField('name', editName)}
                maxLength={40}
              />
              <button onClick={() => saveField('name', editName)} disabled={saving} aria-label="저장" className="p-1.5 bg-gray-900 dark:bg-white rounded-full text-white dark:text-[#020202] shrink-0 active:scale-95 disabled:opacity-50"><Check className="w-4 h-4" /></button>
              <button onClick={() => setEditingField(null)} aria-label="취소" className="p-1.5 bg-gray-200 dark:bg-[#2A2A2A] rounded-full text-gray-600 dark:text-gray-300 shrink-0 active:scale-95"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5">
              <h1
                className={`text-[22px] font-extrabold text-gray-900 dark:text-white leading-tight ${isOwner ? 'cursor-pointer' : ''}`}
                onClick={() => isOwner && setEditingField('name')}
              >
                {curator.name}
              </h1>
              {isOwner && <Pencil className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 cursor-pointer" onClick={() => setEditingField('name')} />}
            </div>
          )}
          <p className="text-[12.5px] text-gray-400 dark:text-gray-500 font-medium mt-0.5">@{curator.handle}</p>

          {editingField === 'bio' ? (
            <div className="mt-2.5 max-w-md mx-auto">
              <textarea
                autoFocus
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                rows={2}
                maxLength={200}
                className="w-full text-[13.5px] text-gray-900 dark:text-white bg-gray-50 dark:bg-[#0A0A0A] border border-gray-900 dark:border-white rounded-lg p-2 focus:outline-none resize-none text-center"
              />
              <div className="flex gap-2 mt-1 justify-center">
                <button onClick={() => saveField('bio', editBio)} disabled={saving} className="px-3 py-1 bg-gray-900 dark:bg-white text-white dark:text-[#020202] text-xs font-bold rounded-lg">저장</button>
                <button onClick={() => setEditingField(null)} className="px-3 py-1 bg-gray-100 dark:bg-[#1A1A1A] text-gray-500 dark:text-gray-400 text-xs rounded-lg">취소</button>
              </div>
            </div>
          ) : (curator.bio || isOwner) && (
            <p
              className={`text-[13.5px] text-gray-600 dark:text-gray-300 mt-2 leading-relaxed whitespace-pre-line max-w-md mx-auto ${isOwner ? 'cursor-pointer' : ''}`}
              onClick={() => isOwner && setEditingField('bio')}
            >
              {curator.bio || (isOwner ? '한 줄 소개를 입력해주세요 ✎' : '')}
            </p>
          )}

          {/* SNS 버튼 (유튜브/인스타/틱톡) + 소유자 편집 토글 — 중앙 */}
          {(hasSns || isOwner) && (
            <div className="flex items-center justify-center gap-2 mt-3">
              {curator.youtube_url && (
                <a href={snsUrl('youtube', curator.youtube_url)} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="w-[34px] h-[34px] rounded-[10px] bg-[#FF0000] flex items-center justify-center">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="#fff"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z" /></svg>
                </a>
              )}
              {curator.instagram_url && (
                <a href={snsUrl('instagram', curator.instagram_url)} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center" style={{ background: 'linear-gradient(45deg,#F9CE34,#EE2A7B,#6228D7)' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="3.7" /><circle cx="17.3" cy="6.7" r="1.1" fill="#fff" stroke="none" /></svg>
                </a>
              )}
              {curator.tiktok_url && (
                <a href={snsUrl('tiktok', curator.tiktok_url)} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="w-[34px] h-[34px] rounded-[10px] bg-[#141A2E] flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M16.5 3c.3 2.2 1.6 3.9 3.8 4.1v2.6c-1.3.1-2.5-.3-3.8-1v5.7c0 4.4-3.4 6.9-6.9 5.8-3.2-1-4.1-5-1.7-7.2 1-.9 2.4-1.3 3.8-1.1v2.7c-.4-.1-.8-.1-1.2 0-1.2.3-1.7 1.4-1.3 2.5.4 1.1 1.8 1.5 2.7.7.5-.4.7-1 .7-1.7V3h3.9Z" /></svg>
                </a>
              )}
              {isOwner && (
                <button onClick={() => setEditingSns(v => !v)} className="text-[11px] font-bold text-gray-400 dark:text-gray-500 px-1.5 py-1 active:opacity-70">
                  {hasSns ? 'SNS 편집' : '+ SNS 링크'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* SNS 편집 패널 (소유자) */}
        {isOwner && editingSns && (
          <div className="mt-3 rounded-xl border border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#0A0A0A] p-3 space-y-2 max-w-md mx-auto">
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

        {/* CTA — 본인: [내 링크샵 주소 카드: 공유+주소변경] / 방문자: 카카오 공유 + 복사 */}
        {isOwner ? (
          <div className="mt-4 max-w-md mx-auto">
            {/* 🔗 2026-06-17 (사용자 요청 — "링크 공유가 우선, 주소 변경과 묶어서"): 주소 표시 + 복사/카카오 공유 + 주소 변경 한 카드. */}
            <div className="rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#0A0A0A] p-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400">내 링크샵 주소</span>
                {!editingHandle && (
                  <button
                    onClick={() => { setEditingHandle(true); setHandleVal(curator.handle); setHandleStatus('idle'); setHandleMsg('') }}
                    className="text-[11.5px] font-bold text-gray-900 dark:text-white active:opacity-70"
                  >
                    주소 변경
                  </button>
                )}
              </div>
              {editingHandle ? (
                <div>
                  <div className="flex items-center gap-1 px-3 py-2.5 rounded-xl border border-gray-300 dark:border-[#2A2A2A] bg-white dark:bg-[#121212]">
                    <span className="shrink-0 text-[13px] font-mono text-gray-400">{shareHost}/u/</span>
                    <input
                      value={handleVal}
                      onChange={(e) => setHandleVal(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
                      autoFocus
                      className="flex-1 min-w-0 bg-transparent font-mono text-[13px] text-gray-900 dark:text-white outline-none"
                    />
                    {handleStatus === 'checking' && <span className="shrink-0 text-[11px] text-gray-400">확인중…</span>}
                  </div>
                  {handleMsg && (
                    <p className={`text-[11.5px] mt-1.5 ${handleStatus === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : handleStatus === 'checking' ? 'text-gray-400' : 'text-red-500'}`}>{handleMsg}</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button onClick={saveHandle} disabled={handleStatus !== 'ok'} className="flex-1 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-[#020202] text-[13px] font-bold disabled:opacity-40">{handleStatus === 'saving' ? '저장 중…' : '주소 저장'}</button>
                    <button onClick={() => { setEditingHandle(false); setHandleVal(curator.handle); setHandleStatus('idle'); setHandleMsg('') }} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-[#1A1A1A] text-gray-500 dark:text-gray-400 text-[13px] font-bold">취소</button>
                  </div>
                </div>
              ) : (
                // 🔗 2026-06-18 (사용자 요청 — 배너 우상단 공유 버튼과 중복): 주소 카드의 링크복사/카카오공유 제거.
                //   주소 표시 + '주소 변경'만 유지. 공유는 배너 히어로 우상단 공유 아이콘으로 일원화.
                <div className="flex items-center px-3 py-2.5 rounded-xl bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A]">
                  <span className="truncate text-[13px] font-mono text-gray-700 dark:text-gray-300">{shareHost}/u/{curator.handle}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          // 🔗 2026-06-17 (방문자 공유): 라벨 단 균등 2버튼 (오너 카드와 동일 톤).
          <div className="flex gap-2 mt-4 max-w-md mx-auto">
            <button
              onClick={onCopyLink}
              className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-white/[0.08] text-gray-900 dark:text-white text-[13px] font-bold flex items-center justify-center gap-1.5 active:opacity-80"
            >
              <Share2 className="w-3.5 h-3.5" /> {t('curator.copyLink', { defaultValue: '링크 복사' })}
            </button>
            <div className="flex-1">
              <KakaoShareButton
                title={`${curator.name} 의 링크샵`}
                description={curator.bio || `${pinCount}개 상품 추천 중`}
                imageUrl={`https://live.ur-team.com/api/og/curator/${curator.handle}`}
                link={`/u/${curator.handle}`}
                className="w-full py-2.5 bg-[#FEE500] hover:bg-[#FDD835] text-[#3C1E1E] rounded-xl text-[13px] font-bold transition-colors"
                buttonText="카카오 공유"
              />
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
