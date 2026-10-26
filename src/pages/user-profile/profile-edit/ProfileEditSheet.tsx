/**
 * 👤 프로필 편집 — **사람에 관한 것은 여기 한 곳** (2026-10-11 대표 확정 **A-2**).
 *
 * 대표: *"오른쪽 버튼 눌렀을 때 또 설정할 것들 없어?"* → 세어 보니 빠진 게 아니라 **갈려 있었다**:
 *   프로필 편집(사진·이름·전화번호) ↔ 유어샵 관리(이름·소개·주소·SNS) — **이름이 두 곳**이라
 *   한쪽에서 바꾸고 다른 쪽을 보면 옛 이름이 보이는 날이 온다(에러 0).
 * 시안 A-1(한 장)·A-2(줄 목록)·A-3(전용 화면) 중 **A-2**.
 *
 * ## 무엇이 어디로 저장되나 (엔드포인트가 둘인 이유)
 * | 줄 | 엔드포인트 | 왜 |
 * |---|---|---|
 * | 이름 · 한 줄 소개 · SNS · 사진 | `PATCH /api/curator/me/profile` | **공개 유어샵 캐시를 purge 한다** |
 * | 전화번호 | `PATCH /api/auth/profile` | 전화번호는 그쪽에만 있다 |
 * | 내 주소 | `PATCH /api/curator/me/handle` | 30일 cooldown 이 별도 규칙이라 엔드포인트가 따로다 |
 *
 * 🩸 **이름을 `auth/profile` 로 보내지 말 것** — 둘 다 `users.name` 을 쓰지만 그쪽은 **purge 를
 *   안 한다**. 종전 프로필 편집이 그 길이라, 이름을 바꿔도 공개 유어샵엔 한동안 옛 이름이 떴다
 *   (아무도 신고 안 하는 종류다 — 에러가 없고 본인 화면은 바로 바뀐다). 합치면서 고쳤다.
 *
 * ## 사진은 고르는 즉시 저장한다
 * 줄들의 [저장]과 섞으면 "사진만 바꾸려는 사람"이 전화번호 검증에 막혀 사진을 못 바꾼다.
 * 헤더가 읽는 `localStorage.user_profile_image` 도 **함께** 갱신한다(한쪽만 바꾸면 저장은 됐는데
 * 화면은 옛 사진이다).
 *
 * ⚠️ 핸들이 없는 계정(2026-07-03 이전 가입분 일부)은 `내 가게 주소` 묶음을 **아예 안 그린다** —
 *   없는 주소를 고치라고 내밀 수 없다.
 *
 * ## 🌍 문구는 옛 모달이 쓰던 키를 **그대로 재사용**한다
 * `accountSettings.*` 7개 키가 이미 6개 언어에 있다. 한국어 리터럴로 새로 적으면 영어 UI 사용자가
 * 한국어를 보게 되는 **퇴행**이고, 그 6개 언어 커버리지를 지키는 가드도 앵커를 잃는다.
 * 새 문구만 `defaultValue` 로 둔다(locale 에 없으면 그 값이 쓰인다 — 나중에 번역해도 코드 무수정).
 * 🩸 locale 값이 `defaultValue` 를 **이긴다** — 키가 있으면 코드의 한국어는 안 쓰인다(CLAUDE.md).
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n-lite'
import { X } from 'lucide-react'
import { Z } from '@/constants/z-index'
import api from '@/lib/api'
import { curatorApi } from '@/features/curator/api/curator-api'
import { profileAvatarSrc, profileAvatarOnError, profileAvatarFitCls } from '@/pages/user-profile/profile-avatar'
import { getUserProfileImage } from '@/utils/auth'
import { formatPhone } from '@/utils/format-phone'
import { toast } from '@/hooks/useToast'
import { prepareImageForUpload, UploadTooLargeError } from '@/lib/prepare-upload'
import { EditRow, RowActions, RowGroup, RowNote, ROW_INPUT } from './EditRow'
import { snsLinkStatus, SNS_LABEL, type SnsPlatform } from '@/shared/sns-link'

type Field = 'name' | 'bio' | 'phone' | 'handle' | 'sns' | null

/** 서버에서 읽어 오는 "나" — 로딩 전엔 `undefined`(= 모름. 0·빈칸으로 위장하지 않는다). */
type Me = {
  name: string
  phone: string
  bio: string
  handle: string
  youtube_url: string
  instagram_url: string
  tiktok_url: string
}

const SNS = [
  ['instagram_url', '인스타그램'],
  ['youtube_url', '유튜브'],
  ['tiktok_url', '틱톡'],
] as const

export default function ProfileEditSheet({ onClose, initialName, onNameChange }: {
  onClose: () => void
  initialName: string
  /** 헤더의 이름을 같이 갈아 끼운다(저장했는데 위쪽이 옛 이름이면 저장 안 된 것처럼 보인다). */
  onNameChange: (name: string) => void
}) {
  const { t } = useTranslation()
  const [me, setMe] = useState<Me | undefined>(undefined)
  const [image, setImage] = useState(() => getUserProfileImage() || '')
  const [open, setOpen] = useState<Field>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sns, setSns] = useState<Record<string, string>>({})
  const [handleState, setHandleState] = useState<'idle' | 'checking' | 'ok' | 'bad'>('idle')
  const [handleMsg, setHandleMsg] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  /** 🔎 두 곳에서 읽는다 — 전화번호는 `auth/me`, 나머지는 공개 유어샵 페이로드. 새 엔드포인트 0. */
  useEffect(() => {
    let alive = true
    const handle = (() => { try { return localStorage.getItem('user_handle') || '' } catch { return '' } })()
    const phoneP = api.get('/api/auth/me').then(r => String(r.data?.data?.phone || '')).catch(() => '')
    const curP = handle
      ? curatorApi.getPage(handle).then(r => r?.curator).catch(() => null)
      : Promise.resolve(null)
    void Promise.all([phoneP, curP]).then(([phone, cur]) => {
      if (!alive) return
      setMe({
        name: cur?.name || initialName,
        phone,
        bio: cur?.bio || '',
        handle: cur?.handle || handle,
        youtube_url: cur?.youtube_url || '',
        instagram_url: cur?.instagram_url || '',
        tiktok_url: cur?.tiktok_url || '',
      })
    })
    return () => { alive = false }
  }, [initialName])

  /** 🔤 내 주소 중복 확인 — 입력이 멈춘 뒤에 묻는다(글자마다 묻지 않는다). */
  useEffect(() => {
    if (open !== 'handle' || !me) return
    const v = draft.trim().toLowerCase()
    if (!v || v === me.handle) { setHandleState('idle'); setHandleMsg(''); return }
    setHandleState('checking'); setHandleMsg(t('profileEdit.checking', { defaultValue: '확인 중…' }))
    const id = setTimeout(() => {
      void curatorApi.checkHandle(v).then(r => {
        if (r.available) { setHandleState('ok'); setHandleMsg(t('profileEdit.handleFree', { defaultValue: '사용 가능한 주소예요' })) }
        else { setHandleState('bad'); setHandleMsg(r.message || t('profileEdit.handleTaken', { defaultValue: '이미 쓰는 주소예요' })) }
      }).catch(() => { setHandleState('bad'); setHandleMsg(t('profileEdit.checkFailed', { defaultValue: '확인하지 못했어요' })) })
    }, 450)
    return () => clearTimeout(id)
  }, [draft, open, me])

  const start = useCallback((f: Exclude<Field, null>, initial: string) => {
    setOpen(f); setDraft(initial); setHandleState('idle'); setHandleMsg('')
  }, [])

  async function uploadPhoto(file: File) {
    // 🩸 2026-10-11 (대표 신고 — 413): 종전엔 **원본을 그대로** 올렸고 가드는 "5MB 이하" 였는데,
    //   실제로 자르는 것은 전역 `bodyLimit(1MB)` 라 폰 사진은 예외 없이 413 이었다.
    //   `prepareImageForUpload` 가 압축하고 천장을 우리가 먼저 판정한다 — `shared/upload-limits.ts`.
    setUploading(true)
    const prev = image
    try {
      const ready = await prepareImageForUpload(file, { thumbnail: true })
      const fd = new FormData()
      fd.append('file', ready)
      const up = await api.post('/api/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const url: string | undefined = up.data?.data?.url
      if (!up.data?.success || !url) throw new Error(up.data?.error || '')
      const saved = await api.patch('/api/curator/me/profile', { profile_image: url })
      if (!saved.data?.success) throw new Error(saved.data?.error || '')
      setImage(url)
      try { localStorage.setItem('user_profile_image', url) } catch { /* quota */ }
      toast.success(t('accountSettings.photoUpdated', { defaultValue: '프로필 사진이 바뀌었습니다' }))
    } catch (err) {
      setImage(prev)
      if (err instanceof UploadTooLargeError) {
        toast.error(t('accountSettings.photoTooBig', { defaultValue: '사진이 너무 커요. 다른 사진을 골라주세요' }))
        return
      }
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || t('accountSettings.photoFailed', { defaultValue: '사진을 바꾸지 못했어요' }))
    } finally { setUploading(false) }
  }

  /** 공통 저장 — 낙관 반영 없이 **서버가 성공한 뒤에** 화면을 바꾼다(실패를 성공으로 보이지 않게). */
  async function patch(body: Record<string, string>, next: Partial<Me>, done: string) {
    setSaving(true)
    try {
      const r = await api.patch('/api/curator/me/profile', body)
      if (!r.data?.success) throw new Error(r.data?.error || '')
      setMe(m => (m ? { ...m, ...next } : m))
      setOpen(null)
      toast.success(done)
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || t('profileEdit.saveFailed', { defaultValue: '저장하지 못했어요' }))
    } finally { setSaving(false) }
  }

  async function saveName() {
    const v = draft.trim()
    if (!v) { toast.error(t('accountSettings.nameRequired', { defaultValue: '이름을 입력해주세요' })); return }
    await patch({ name: v }, { name: v }, t('profileEdit.nameSaved', { defaultValue: '이름이 바뀌었어요' }))
    onNameChange(v)
    try { localStorage.setItem('user_name', v) } catch { /* quota */ }
  }

  async function savePhone() {
    /**
     * 📞 전화번호는 선택 정보가 아니다 — 교환권이 **MMS 로 이 번호에** 가고 이용권·주문 안내도
     * 알림톡으로 간다. 번호가 없으면 산 물건이 도착할 곳이 없다(2026-09-02 대표 지시).
     * ⚠️ 빈칸만 막으면 "010" 한 글자로도 통과하므로 형식까지 본다.
     */
    const v = draft.trim()
    if (!v) { toast.error(t('accountSettings.phoneRequired', { defaultValue: '전화번호를 입력해주세요 — 교환권·알림톡이 이 번호로 갑니다' })); return }
    if (!/^01[016789]-?\d{3,4}-?\d{4}$/.test(v)) {
      toast.error(t('accountSettings.phoneInvalid', { defaultValue: '전화번호 형식을 확인해주세요 (010-0000-0000)' })); return
    }
    setSaving(true)
    try {
      const r = await api.patch('/api/auth/profile', { phone: v })
      if (!r.data?.success) throw new Error('')
      setMe(m => (m ? { ...m, phone: v } : m))
      setOpen(null)
      toast.success(t('profileEdit.phoneSaved', { defaultValue: '전화번호가 바뀌었어요' }))
    } catch (err) {
      const e = err as { response?: { data?: { error?: string | { message?: string } } } }
      const raw = e?.response?.data?.error
      toast.error(typeof raw === 'string' ? raw : (raw?.message || t('profileEdit.saveFailed', { defaultValue: '저장하지 못했어요' })))
    } finally { setSaving(false) }
  }

  async function saveHandle() {
    if (handleState !== 'ok' || !me) return
    const v = draft.trim().toLowerCase()
    setSaving(true)
    try {
      const r = await curatorApi.updateHandle(v)
      if (!r.success || !r.handle) throw new Error(r.error || '')
      setMe(m => (m ? { ...m, handle: r.handle as string } : m))
      try { localStorage.setItem('user_handle', r.handle) } catch { /* quota */ }
      setOpen(null)
      toast.success(t('profileEdit.handleSaved', { defaultValue: '유어샵 주소가 바뀌었어요' }))
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string }
      toast.error(e?.response?.data?.error || e?.message || t('profileEdit.handleFailed', { defaultValue: '주소를 바꾸지 못했어요' }))
    } finally { setSaving(false) }
  }

  const snsSummary = me
    ? SNS.filter(([k]) => (me[k] || '').trim()).map(([, l]) => l).join(', ')
    : ''

  return (
    <>
      <div
        className="fixed inset-0 bg-black/45 ur-sheet-veil"
        style={{ zIndex: Z.SHEET_BACKDROP }} onClick={onClose} aria-hidden="true"
      />
      <div
        role="dialog" aria-modal="true" aria-label={t('userProfile.editProfile', { defaultValue: '프로필 편집' })}
        className={
          'fixed inset-x-0 bottom-0 max-h-[85dvh] flex flex-col rounded-t-2xl bg-surface'
          /* 🎬 등장은 `.ur-sheet-in` 한 클래스가 소유한다(폰=올라옴 / lg+=투명도만 / 동작 줄이기=정지).
             여기에 `animate-slide-up` 을 직접 쓰면 아래 가운데 정렬 `transform` 을 덮어 **튄다**.
             근거·실측은 `src/index.css` 의 `.ur-sheet-in` 머리말. */
          + ' ur-sheet-in'
          + ' lg:inset-x-auto lg:left-1/2 lg:top-1/2 lg:bottom-auto'
          + ' lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-[min(460px,92vw)] lg:rounded-2xl lg:shadow-2xl'
        }
        style={{ zIndex: Z.SHEET_BODY }}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-rule shrink-0">
          <h3 className="text-[17px] font-bold text-gray-900 dark:text-white">{t('userProfile.editProfile', { defaultValue: '프로필 편집' })}</h3>
          <button type="button" onClick={onClose} aria-label="닫기" className="w-9 h-9 -mr-2 flex items-center justify-center">
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pb-[max(8px,env(safe-area-inset-bottom))]">
          {/* 📸 사진 — 고르는 즉시 저장(위 머리말) */}
          <div className="flex items-center gap-4 px-4 py-4">
            <img
              src={profileAvatarSrc(image, 160)}
              alt="" className={`w-[72px] h-[72px] rounded-full shrink-0 bg-gray-100 dark:bg-white/[0.06] ${profileAvatarFitCls(image)}`}
              onError={(e) => profileAvatarOnError(e.currentTarget, image)}
            />
            <div className="min-w-0">
              <label className="inline-flex items-center gap-2 px-3 h-9 rounded-full bg-wash text-[13px] font-medium text-gray-700 dark:text-gray-200 cursor-pointer active:opacity-70">
                {uploading ? t('profileEdit.uploading', { defaultValue: '올리는 중…' }) : t('profileEdit.changePhoto', { defaultValue: '사진 변경' })}
                <input type="file" accept="image/*" className="hidden" disabled={uploading}
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadPhoto(f) }} />
              </label>
              <p className="mt-2 text-[12px] text-gray-500 dark:text-gray-400 truncate">
                {(() => { const hint = t('accountSettings.photoHint', { defaultValue: '사진은 자동으로 줄여 올립니다' }); try { return localStorage.getItem('user_email') || hint } catch { return hint } })()}
              </p>
            </div>
          </div>

          <RowGroup>{t('profileEdit.groupMe', { defaultValue: '내 정보' })}</RowGroup>
          <EditRow label={t('accountSettings.editName', { defaultValue: '이름' })} value={me?.name} empty={me ? t('profileEdit.none', { defaultValue: '아직 없어요' }) : t('profileEdit.loading', { defaultValue: '불러오는 중…' })}
            open={open === 'name'} onOpen={() => start('name', me?.name || '')}>
            <input className={ROW_INPUT} value={draft} onChange={e => setDraft(e.target.value)} placeholder={t('profileEdit.namePh', { defaultValue: '홍길동' })} maxLength={40} />
            <RowActions onSave={saveName} onCancel={() => setOpen(null)} saving={saving} />
          </EditRow>

          <EditRow label={t('profileEdit.bio', { defaultValue: '한 줄 소개' })} value={me?.bio} empty={me ? t('profileEdit.none', { defaultValue: '아직 없어요' }) : t('profileEdit.loading', { defaultValue: '불러오는 중…' })}
            open={open === 'bio'} onOpen={() => start('bio', me?.bio || '')}>
            <input className={ROW_INPUT} value={draft} onChange={e => setDraft(e.target.value)}
              placeholder={t('profileEdit.bioPh', { defaultValue: '예) 동네 맛집만 모읍니다' })} maxLength={60} />
            <RowNote>{t('profileEdit.bioNote', { defaultValue: '내 유어샵에 뜨는 한 줄이에요.' })}</RowNote>
            <RowActions onSave={() => patch({ bio: draft.trim() }, { bio: draft.trim() }, t('profileEdit.bioSaved', { defaultValue: '소개가 바뀌었어요' }))}
              onCancel={() => setOpen(null)} saving={saving} />
          </EditRow>

          <EditRow label={t('accountSettings.editPhone', { defaultValue: '전화번호' })} value={me?.phone}
            required empty={me ? t('profileEdit.phoneMissing', { defaultValue: '입력 필요' }) : t('profileEdit.loading', { defaultValue: '불러오는 중…' })}
            open={open === 'phone'} onOpen={() => start('phone', me?.phone || '')}>
            <input className={ROW_INPUT} type="tel" inputMode="numeric" maxLength={13}
              value={draft} onChange={e => setDraft(formatPhone(e.target.value))} placeholder="010-0000-0000" />
            <RowNote>{t('profileEdit.phoneNote', { defaultValue: '교환권·알림톡이 이 번호로 갑니다. 회원 탈퇴 시까지 보유.' })}</RowNote>
            <RowActions onSave={savePhone} onCancel={() => setOpen(null)} saving={saving} />
          </EditRow>

          {/* 🏷️ 핸들이 없는 계정엔 이 묶음을 아예 안 그린다(위 머리말) */}
          {me?.handle && (
            <>
              <RowGroup>{t('profileEdit.groupShop', { defaultValue: '내 가게 주소' })}</RowGroup>
              <EditRow label={t('profileEdit.handle', { defaultValue: '내 주소' })} value={`urdeal.kr/u/${me.handle}`}
                open={open === 'handle'} onOpen={() => start('handle', me.handle)}>
                <div className="flex items-center gap-1">
                  <span className="text-[15px] text-gray-500 dark:text-gray-400 shrink-0">urdeal.kr/u/</span>
                  <input className={ROW_INPUT} value={draft} maxLength={30}
                    onChange={e => setDraft(e.target.value.replace(/[^A-Za-z0-9_-]/g, '').toLowerCase())} />
                </div>
                {handleMsg && <RowNote tone={handleState === 'ok' ? 'ok' : handleState === 'bad' ? 'bad' : undefined}>{handleMsg}</RowNote>}
                <RowNote>{t('profileEdit.handleNote', { defaultValue: '주소를 바꾸면 전에 뿌린 링크는 이 주소로 넘어와요. 30일에 한 번 바꿀 수 있어요.' })}</RowNote>
                <RowActions onSave={saveHandle} onCancel={() => setOpen(null)} saving={saving}
                  disabled={handleState !== 'ok'} saveLabel={t('profileEdit.handleSave', { defaultValue: '주소 저장' })} />
              </EditRow>

              <EditRow label={t('profileEdit.sns', { defaultValue: 'SNS 링크' })} value={snsSummary} empty={me ? t('profileEdit.none', { defaultValue: '아직 없어요' }) : t('profileEdit.loading', { defaultValue: '불러오는 중…' })}
                open={open === 'sns'}
                onOpen={() => { setOpen('sns'); setSns({ instagram_url: me.instagram_url, youtube_url: me.youtube_url, tiktok_url: me.tiktok_url }) }}>
                {SNS.map(([key, label]) => {
                  // 🔒 2026-10-26 대표 — 그 칸은 그 플랫폼 주소·아이디만. 서버도 같은 함수로 거절한다.
                  const bad = snsLinkStatus(key.replace('_url', '') as SnsPlatform, sns[key]).kind === 'bad'
                  return (
                    <div key={key} className="mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-16 shrink-0 text-[13px] font-medium text-gray-500 dark:text-gray-400">{label}</span>
                        <input className={ROW_INPUT} value={sns[key] ?? ''} placeholder={t('profileEdit.snsPh', { defaultValue: '@아이디 또는 링크' })}
                          aria-invalid={bad} onChange={e => setSns(s => ({ ...s, [key]: e.target.value }))} />
                      </div>
                      {bad && (
                        <RowNote tone="bad">{t('profileEdit.snsBad', { defaultValue: '{{name}} 주소나 아이디만 넣을 수 있어요', name: SNS_LABEL[key.replace('_url', '') as SnsPlatform] })}</RowNote>
                      )}
                    </div>
                  )
                })}
                <RowActions
                  disabled={SNS.some(([key]) => snsLinkStatus(key.replace('_url', '') as SnsPlatform, sns[key]).kind === 'bad')}
                  onSave={() => patch(
                    { instagram_url: sns.instagram_url ?? '', youtube_url: sns.youtube_url ?? '', tiktok_url: sns.tiktok_url ?? '' },
                    { instagram_url: sns.instagram_url ?? '', youtube_url: sns.youtube_url ?? '', tiktok_url: sns.tiktok_url ?? '' },
                    t('profileEdit.snsSaved', { defaultValue: 'SNS 링크가 바뀌었어요' }),
                  )}
                  onCancel={() => setOpen(null)} saving={saving} />
              </EditRow>
            </>
          )}
        </div>
      </div>
    </>
  )
}
