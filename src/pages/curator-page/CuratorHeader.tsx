/**
 * 🛡️ 2026-05-25 (C 옵션 통합): 큐레이터 공개페이지 헤더.
 * 🎨 2026-06-18 (사용자 시안 — 나브랜딩 랜딩 리디자인): 마퀴 + 풀블리드 배너 히어로 + 중앙 정렬.
 * 🎫 2026-09-02 (대표 확정 — 유어샵 **안3 "왼정렬 헤더 + 카테고리 칩"** · PC 안P1): 헤더를 다시 짰다.
 *   ① 배너 히어로 **렌더 삭제**(사진 있든 없든) — 시안표 "사업자 배너: 없음(색면)". 첫 화면은 진열대가
 *      가장 많이 보여야 한다(안1 보다 카드 한 줄 더). `banner_url` 데이터는 지우지 않는다(OG 등).
 *   ② 아바타 56 + 이름/핸들·주소/소개 **왼정렬 한 덩어리**, 숫자는 한 줄 텍스트.
 *      ⚠️ 2026-07-07 "프로필 사진 없애줘 · 스탯 필요없어"를 **대표가 고른 안3 이 되돌린다**(시안에 둘 다 있다).
 *   ③ 주인·방문자 차이는 **버튼 한 자리**뿐 — 주인 [유어샵 편집(블루)][공유], 방문자 [공유]. 상단 안내 띠
 *      ("내 유어샵 · 방문자에게 보이는 화면")는 페이지에서 삭제됐다. 팔로우 버튼은 넣지 않는다(대표:
 *      "그냥 방문자는 안보이면 되잖아").
 *   유지: 이름/bio 인라인 편집, SNS 편집, 유어샵 주소(핸들) 변경 카드, 마퀴 — 전부 **편집 모드에서만**.
 *   소유권 신호는 종전 그대로 prop 으로만 받는다(`check-linkshop-ownership` ③).
 *
 * 셀러 권한 있는 user 는 CuratorPage 가 SellerPublicPage inline render (URL /u/:handle 유지).
 * 본 헤더는 일반 user 용 (셀러 권한 없음).
 */

import { useState, useEffect } from 'react'
import { snsUrl } from '@/utils/sns-url'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Share2, Pencil, Check, X } from 'lucide-react'
import { cfImage } from '@/utils/cf-image'
import VerifiedSeal from '@/components/VerifiedSeal'
import api from '@/lib/api'
import { curatorApi } from '@/features/curator/api/curator-api'
import { toast } from '@/hooks/useToast'

// 🔗 2026-06-17 (#6 유어샵 통일): snsUrl → @/utils/sns-url 공유 (셀러 ProfileHeader 와 dedup)

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
  /** 편집 모드(주인이 '유어샵 편집'을 누른 뒤). 인라인 편집 어포던스는 전부 이 값으로만 게이트. */
  isOwner: boolean
  /** 🎫 2026-09-02 안3: 실제 주인 여부(편집 모드와 무관). true 면 '유어샵 편집' 버튼을 낸다. */
  canEdit?: boolean
  onEnterEdit?: () => void
  onExitEdit?: () => void
  /** 숫자 한 줄 — 담은 이용권 / 내 상품. 0 은 그리지 않는다. */
  counts?: { pins?: number; products?: number }
  // 🏁 2026-06-25 (대표 — 일반/사업자 구분 표시): 이름 옆 작은 배지. 'business'=사업자 유저(인증/판매), 'user'=일반.
  accountType?: 'user' | 'business'
  /**
   * 📊 2026-08-26 (대표 승인 — "성과가 쌓이면 딜이 쌓인다"): 헤더 실적 한 줄.
   *   당근은 **사진**으로 신뢰를 만들지만 우리는 **실적**으로 만들 수 있다. 그리고 그게 매장에게
   *   "이 유어샵에 넣고 싶다"는 근거가 된다. 값이 없으면 그 항목은 그리지 않는다(0을 자랑하지 않는다).
   *   ⚠️ 2026-07-20 대표 "신뢰배지 필요없음"으로 **정적 배지**(안전결제/사업자인증)는 폐지됐다 —
   *   이건 배지 부활이 아니라 **실측값** 노출이다.
   */
  stats?: { rating?: number | null; reviews?: number | null; sold?: number | null }
  onCopyLink: () => void
  onCuratorUpdate?: (next: Partial<CuratorHeaderProps['curator']>) => void
}

import HeaderMarquee from './HeaderMarquee'

export default function CuratorHeader({
  curator,
  isOwner,
  canEdit,
  onEnterEdit,
  onExitEdit,
  counts,
  accountType,
  stats,
  onCopyLink,
  onCuratorUpdate,
}: CuratorHeaderProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [editingField, setEditingField] = useState<'name' | 'bio' | null>(null)
  // 🏅 2026-07-02 (대표 — "처음 보는 유저는 저 문양이 뭔지 모름"): 이름 옆 파란 U 인증씰을 클릭하면
  //   "사업자 인증이 된 유저" 설명 팝오버. hover title 은 모바일 미노출이라 tap 기반으로 전환.
  const [showVerified, setShowVerified] = useState(false)
  // 🔗 2026-06-17 (사용자 요청 — 공유 우선 + 주소변경 통합): 헤더 '내 유어샵 주소' 카드의 주소 변경 인라인.
  const shareHost = typeof window !== 'undefined' ? window.location.host : 'urdeal.kr'
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
        toast.success('유어샵 주소가 변경됐어요')
      } else { setHandleStatus('bad'); setHandleMsg(r.error || '변경에 실패했어요') }
    } catch { setHandleStatus('bad'); setHandleMsg('변경에 실패했어요') }
  }
  const [editName, setEditName] = useState(curator.name)
  const [editBio, setEditBio] = useState(curator.bio || '')
  const [saving, setSaving] = useState(false)
  // 🎨 2026-06-18 마퀴 헤드라인 편집(소유자).
  const [editingHeadline, setEditingHeadline] = useState(false)
  const [headlineVal, setHeadlineVal] = useState(curator.headline || '')
  // 🎨 2026-06-19 마퀴 액센트 색 (소유자 조정). 비면 기본 중립 회색(마퀴 바는 면적이 커 로즈=면 강조
  //   '10% 이하' 룰 위배라 중립 유지 — 브랜드 로즈는 폴백 배너 그라데이션·행동 요소에만).
  const ACCENT_DEFAULT = '#6b7280'
  const accentColor = (curator.accent && /^#[0-9A-Fa-f]{6}$/.test(curator.accent)) ? curator.accent : ACCENT_DEFAULT
  // 액센트 밝기로 글자색 자동 대비 (밝으면 잉크, 어두우면 흰색).
  const accentText = (() => {
    const h = accentColor.replace('#', '')
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? '#1D1F29' : '#ffffff'
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
  // 🎨 2026-06-16 유어샵 시안: SNS 링크 편집(소유자).
  const [editingSns, setEditingSns] = useState(false)
  const [snsForm, setSnsForm] = useState({
    youtube_url: curator.youtube_url || '',
    instagram_url: curator.instagram_url || '',
    tiktok_url: curator.tiktok_url || '',
  })
  async function saveSns() {
    if (saving) return
    // 🏎️ 2026-06-17 (유어샵 데이터 변경 속도 감사): 낙관적 저장 — 즉시 반영 + 패널 닫기, 실패 시 되돌림.
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

  // 🏎️ 2026-06-17 (유어샵 데이터 변경 속도 감사): 낙관적 저장 — 값 즉시 반영 + 편집 닫기,
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

  const hasSns = !!(curator.youtube_url || curator.instagram_url || curator.tiktok_url)
  const avatar = curator.profile_image
    ? (curator.profile_image.startsWith('r2://') ? `/api/media/${curator.profile_image.slice(5)}` : curator.profile_image)
    : null
  const initial = (curator.name || curator.handle || '').trim().slice(0, 1).toUpperCase()
  const showStats = !!(stats && ((stats.rating ?? 0) > 0 || (stats.sold ?? 0) > 0 || (stats.reviews ?? 0) > 0))
  const showCounts = (counts?.pins ?? 0) > 0 || (counts?.products ?? 0) > 0
  const editBtnCls = 'flex-1 h-11 rounded-xl bg-brand text-white text-[14px] font-bold inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform'
  const shareBtnCls = 'h-11 rounded-xl bg-white dark:bg-[#1D1F29] text-gray-900 dark:text-white text-[14px] font-bold inline-flex items-center justify-center gap-1.5 shadow-lift active:scale-[0.98] transition-transform'

  return (
    <header>
      <HeaderMarquee
        curator={curator}
        isOwner={isOwner}
        accentColor={accentColor}
        accentText={accentText}
        editingHeadline={editingHeadline}
        setEditingHeadline={setEditingHeadline}
        headlineVal={headlineVal}
        setHeadlineVal={setHeadlineVal}
        saveHeadline={saveHeadline}
        saveAccent={saveAccent}
      />

      <div className="max-w-3xl mx-auto px-4 pt-4 pb-3">
        {/* ② 아바타 + 이름/핸들·주소/소개 — 왼정렬 한 덩어리 */}
        <div className="flex items-start gap-3.5">
          <div className="w-14 h-14 rounded-full shrink-0 overflow-hidden bg-brand-tint text-brand-text flex items-center justify-center text-[19px] font-extrabold select-none">
            {avatar
              ? <img src={cfImage(avatar, { width: 112, format: 'auto' }) || avatar} alt="" width={56} height={56} className="w-full h-full object-cover" loading="eager" decoding="async" onError={(e) => { e.currentTarget.hidden = true }} />
              : initial}
          </div>
          <div className="min-w-0 flex-1">
            {editingField === 'name' ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="min-w-0 flex-1 text-[20px] font-extrabold text-gray-900 dark:text-white bg-transparent border-b-2 border-gray-900 dark:border-white focus:outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && saveField('name', editName)}
                  maxLength={40}
                />
                <button onClick={() => saveField('name', editName)} disabled={saving} aria-label="저장" className="p-1.5 bg-gray-900 dark:bg-white rounded-full text-white dark:text-[#11141C] shrink-0 active:scale-95 disabled:opacity-50"><Check className="w-4 h-4" /></button>
                <button onClick={() => setEditingField(null)} aria-label="취소" className="p-1.5 bg-gray-200 dark:bg-[#2C2F35] rounded-full text-gray-600 dark:text-gray-300 shrink-0 active:scale-95"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0">
                <h1
                  className={`text-[20px] font-extrabold text-gray-900 dark:text-white leading-tight tracking-[-0.02em] truncate ${isOwner ? 'cursor-pointer' : ''}`}
                  onClick={() => isOwner && setEditingField('name')}
                >
                  {curator.name}
                </h1>
                {/* 🏁 2026-06-25 (대표 — 인스타 인증딱지 스타일): 인증 유저(사업자)는 이름 옆 파란 U 씰.
                    🏅 2026-07-02 (대표 — "처음 보는 유저는 저 문양이 뭔지 모름"): 클릭 시 설명 팝오버(tap 기반). */}
                {accountType === 'business' && (
                  <span className="relative inline-flex shrink-0">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setShowVerified(v => !v) }}
                      aria-label={t('curator.verifiedBusinessUser', { defaultValue: '사업자 인증이 된 유저예요' })}
                      aria-expanded={showVerified}
                      className="inline-flex active:scale-90 transition-transform"
                    >
                      <VerifiedSeal size={18} />
                    </button>
                    {showVerified && (
                      <>
                        {/* 바깥 클릭 닫기 백드롭 (span — h1 안이라 inline 요소만 허용) */}
                        <span className="fixed inset-0 z-[10499]" onClick={(e) => { e.stopPropagation(); setShowVerified(false) }} />
                        <span
                          role="tooltip"
                          className="absolute left-0 top-full mt-2 z-[10500] block w-max max-w-[220px] rounded-xl bg-gray-900 dark:bg-white px-3 py-2 text-left shadow-xl ring-1 ring-black/5"
                        >
                          <span className="absolute -top-1 left-2 w-2 h-2 rotate-45 bg-gray-900 dark:bg-white" />
                          <span className="flex items-center gap-1.5">
                            <VerifiedSeal size={13} className="shrink-0" />
                            <span className="text-[12.5px] font-bold text-white dark:text-gray-900 leading-tight whitespace-nowrap">
                              {t('curator.verifiedBusinessUser', { defaultValue: '사업자 인증이 된 유저예요' })}
                            </span>
                          </span>
                          <span className="block mt-1 text-[11px] text-white/70 dark:text-gray-500 leading-snug">
                            {t('curator.verifiedBusinessDesc', { defaultValue: '사업자등록 정보가 확인되었어요.' })}
                          </span>
                        </span>
                      </>
                    )}
                  </span>
                )}
                {isOwner && <Pencil className="w-3.5 h-3.5 shrink-0 text-gray-400 dark:text-gray-500 cursor-pointer" onClick={() => setEditingField('name')} />}
              </div>
            )}
            <p className="mt-0.5 text-[12.5px] text-gray-500 dark:text-gray-400 font-medium truncate">@{curator.handle} · {shareHost}/u/{curator.handle}</p>

            {editingField === 'bio' ? (
              <div className="mt-2">
                <textarea
                  autoFocus
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  rows={2}
                  maxLength={200}
                  className="w-full text-[13.5px] text-gray-900 dark:text-white bg-white dark:bg-[#1D1F29] border border-gray-900 dark:border-white rounded-lg p-2 focus:outline-none resize-none"
                />
                <div className="flex gap-2 mt-1">
                  <button onClick={() => saveField('bio', editBio)} disabled={saving} className="px-3 py-1 bg-gray-900 dark:bg-white text-white dark:text-[#11141C] text-xs font-bold rounded-lg">저장</button>
                  <button onClick={() => setEditingField(null)} className="px-3 py-1 bg-gray-100 dark:bg-[#1D1F29] text-gray-500 dark:text-gray-400 text-xs rounded-lg">취소</button>
                </div>
              </div>
            ) : (curator.bio || isOwner) && (
              <p
                className={`mt-1.5 text-[13.5px] text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line ${isOwner ? 'cursor-pointer' : ''}`}
                onClick={() => isOwner && setEditingField('bio')}
              >
                {curator.bio || (isOwner ? '한 줄 소개를 입력해주세요' : '')}
              </p>
            )}
          </div>
        </div>

        {/* 숫자 한 줄 — 값이 있는 항목만. 0 은 자랑거리가 아니라 숨기는 게 맞다. */}
        {(showCounts || showStats) && (
          <p className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-gray-600 dark:text-gray-300 tabular-nums">
            {(counts?.pins ?? 0) > 0 && <span>{t('curator.countPins', { defaultValue: '담은 이용권' })} <b className="text-gray-900 dark:text-white">{counts!.pins}</b></span>}
            {(counts?.products ?? 0) > 0 && <span>{t('curator.countProducts', { defaultValue: '내 상품' })} <b className="text-gray-900 dark:text-white">{counts!.products}</b></span>}
            {showStats && (stats!.rating ?? 0) > 0 && <span><b className="text-gray-900 dark:text-white">★ {Number(stats!.rating).toFixed(1)}</b></span>}
            {showStats && (stats!.reviews ?? 0) > 0 && <span>{t('curator.statReviews', { defaultValue: '후기 {{n}}', n: stats!.reviews })}</span>}
            {showStats && (stats!.sold ?? 0) > 0 && <span>{t('curator.statSold', { defaultValue: '판매 {{n}}', n: stats!.sold })}</span>}
          </p>
        )}

        {/* SNS 버튼 (유튜브/인스타/틱톡) + 편집 모드 토글 — 왼정렬 */}
        {(hasSns || isOwner) && (
          <div className="flex items-center gap-2 mt-3">
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
              <a href={snsUrl('tiktok', curator.tiktok_url)} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="w-[34px] h-[34px] rounded-[10px] bg-[#1D1F29] flex items-center justify-center">
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

        {/* ③ 버튼 한 쌍 — 주인·방문자의 유일한 차이. 블루 면은 화면에 하나. */}
        <div className="mt-3.5 flex gap-2">
          {canEdit && !isOwner && (
            <button type="button" onClick={onEnterEdit} className={editBtnCls}>
              <Pencil className="w-4 h-4" aria-hidden="true" />{t('curator.editShop', { defaultValue: '유어샵 편집' })}
            </button>
          )}
          {isOwner && (
            <button type="button" onClick={onExitEdit} className={editBtnCls}>
              <Check className="w-4 h-4" aria-hidden="true" />{t('curator.editDone', { defaultValue: '편집 완료' })}
            </button>
          )}
          <button type="button" onClick={onCopyLink} className={`${canEdit || isOwner ? 'flex-1' : 'basis-1/2'} ${shareBtnCls}`}>
            <Share2 className="w-4 h-4" aria-hidden="true" />{t('curator.share', { defaultValue: '공유' })}
          </button>
        </div>

        {/* SNS 편집 패널 (편집 모드) */}
        {isOwner && editingSns && (
          <div className="mt-3 rounded-xl bg-white dark:bg-[#1D1F29] shadow-lift p-3 space-y-2">
            {([['youtube_url', '유튜브'], ['instagram_url', '인스타그램'], ['tiktok_url', '틱톡']] as const).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 w-14 shrink-0">{label}</span>
                <input
                  value={snsForm[key]}
                  onChange={(e) => setSnsForm(s => ({ ...s, [key]: e.target.value }))}
                  placeholder="@핸들 또는 링크"
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-rule bg-white dark:bg-[#11141C] text-[13px] text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none"
                />
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button onClick={saveSns} disabled={saving} className="flex-1 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-[#11141C] text-[13px] font-bold disabled:opacity-50">{saving ? '저장 중…' : '저장'}</button>
              <button onClick={() => setEditingSns(false)} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-[#11141C] text-gray-500 dark:text-gray-400 text-[13px] font-bold">취소</button>
            </div>
          </div>
        )}

        {/* 편집 모드: 내 유어샵 주소 카드(주소 변경). 공유는 위 버튼으로 일원화. */}
        {isOwner && (
          <div className="mt-3 rounded-2xl bg-white dark:bg-[#1D1F29] shadow-lift p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400">내 유어샵 주소</span>
              {!editingHandle && (
                <button
                  onClick={() => { setEditingHandle(true); setHandleVal(curator.handle); setHandleStatus('idle'); setHandleMsg('') }}
                  className="text-[11.5px] font-bold text-brand-text active:opacity-70"
                >
                  주소 변경
                </button>
              )}
            </div>
            {editingHandle ? (
              <div>
                <div className="flex items-center gap-1 px-3 py-2.5 rounded-xl border border-rule-strong bg-white dark:bg-[#11141C]">
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
                  <button onClick={saveHandle} disabled={handleStatus !== 'ok'} className="flex-1 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-[#11141C] text-[13px] font-bold disabled:opacity-40">{handleStatus === 'saving' ? '저장 중…' : '주소 저장'}</button>
                  <button onClick={() => { setEditingHandle(false); setHandleVal(curator.handle); setHandleStatus('idle'); setHandleMsg('') }} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-[#11141C] text-gray-500 dark:text-gray-400 text-[13px] font-bold">취소</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-[#11141C]">
                <span className="truncate text-[13px] font-mono text-gray-700 dark:text-gray-300">{shareHost}/u/{curator.handle}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
