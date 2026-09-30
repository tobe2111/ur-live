/**
 * 🔧 2026-09-28 (대표 확정 **e3 — 편집 모드 분리**): 유어샵 헤더에 인라인으로 박혀 있던 편집 어포던스
 *   (이름·한 줄 소개 / 유어샵 주소 / SNS 링크 / 흐르는 문구)를 **그대로 옮긴 카드 묶음**.
 *
 *   왜 옮겼나: 종전 [유어샵 편집]은 방문자 화면 **위에 다섯 덩어리를 덧칠**해서, 주인이 보는 화면과
 *   손님이 보는 화면이 갈렸다. e3 는 그 둘을 나눈다 — 유어샵은 손님 화면 하나뿐이고, 고치는 일은
 *   `/u/me/manage` 로 나온다. 그래서 **여기는 볼륨 규율(s3)에서 자유롭다**(손님이 안 본다).
 *
 *   ⚠️ 저장 규약은 종전과 **동일하다** — 낙관적 반영(값 즉시 갱신 + 닫기) 후 PATCH, 실패 시 되돌림.
 *      그 패턴을 바꾸면 2026-06-17 "유어샵 데이터 변경 속도 감사" 의 결론이 사라진다.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { curatorApi } from '@/features/curator/api/curator-api'
import { toast } from '@/hooks/useToast'

export interface ManageCurator {
  id: number
  handle: string
  name: string
  bio: string | null
  headline?: string | null
  youtube_url?: string | null
  instagram_url?: string | null
  tiktok_url?: string | null
}

type Field = 'name' | 'bio' | 'handle' | 'sns' | null

const rowCls = 'w-full flex items-center gap-2 px-4 py-3 border-t border-rule first:border-t-0 text-left'
const keyCls = 'text-[13px] font-semibold text-gray-900 dark:text-white shrink-0'
const valCls = 'ml-auto min-w-0 truncate text-[12px] text-gray-400 dark:text-gray-500'
const inputCls = 'w-full px-3 py-2 rounded-lg border border-rule-strong bg-surface text-[13px] text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none'
const saveCls = 'flex-1 py-2 rounded-lg bg-gray-900 dark:bg-white text-warm text-[13px] font-bold disabled:opacity-40'
const cancelCls = 'px-4 py-2 rounded-lg bg-wash text-gray-500 dark:text-gray-400 text-[13px] font-bold'

export default function ShopInfoCards({ curator, onCuratorUpdate }: {
  curator: ManageCurator
  onCuratorUpdate: (next: Partial<ManageCurator>) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState<Field>(null)
  const [saving, setSaving] = useState(false)
  const shareHost = typeof window !== 'undefined' ? window.location.host : 'urdeal.kr'

  const [editName, setEditName] = useState(curator.name)
  const [editBio, setEditBio] = useState(curator.bio || '')
  const [snsForm, setSnsForm] = useState({
    youtube_url: curator.youtube_url || '',
    instagram_url: curator.instagram_url || '',
    tiktok_url: curator.tiktok_url || '',
  })

  // 🏎️ 낙관적 저장 — 값 즉시 반영 + 닫기, PATCH 는 뒤에서. 실패하면 되돌린다.
  async function patch(payload: Record<string, unknown>, prev: Record<string, unknown>) {
    onCuratorUpdate(payload as Partial<ManageCurator>)
    setOpen(null)
    setSaving(true)
    try {
      const res = await api.patch('/api/curator/me/profile', payload)
      if (!res.data?.success) {
        onCuratorUpdate(prev as Partial<ManageCurator>)
        toast.error(res.data?.error || t('curator.saveFailed', { defaultValue: '저장 실패' }))
      }
    } catch {
      onCuratorUpdate(prev as Partial<ManageCurator>)
      toast.error(t('curator.saveFailed', { defaultValue: '저장 실패' }))
    } finally { setSaving(false) }
  }

  // ── 유어샵 주소(핸들) — 중복 확인 후 저장. 규약은 종전 헤더 카드와 동일.
  const [handleVal, setHandleVal] = useState(curator.handle)
  const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'ok' | 'bad' | 'saving'>('idle')
  const [handleMsg, setHandleMsg] = useState('')
  useEffect(() => {
    if (open !== 'handle') return
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
  }, [handleVal, open, curator.handle])

  async function saveHandle() {
    const h = handleVal.trim().toLowerCase()
    if (h === curator.handle) { setOpen(null); return }
    if (handleStatus !== 'ok') return
    setHandleStatus('saving')
    try {
      const r = await curatorApi.updateHandle(h)
      if (r.success && r.handle) {
        onCuratorUpdate({ handle: r.handle })
        setOpen(null)
        setHandleStatus('idle')
        toast.success('유어샵 주소가 변경됐어요')
      } else { setHandleStatus('bad'); setHandleMsg(r.error || '변경에 실패했어요') }
    } catch { setHandleStatus('bad'); setHandleMsg('변경에 실패했어요') }
  }

  const snsCount = [curator.youtube_url, curator.instagram_url, curator.tiktok_url].filter(Boolean).length

  return (
    <div className="mx-4 rounded-xl bg-surface shadow-lift overflow-hidden">
      {/* 이름 · 한 줄 소개 */}
      {open === 'name' ? (
        <div className="p-4 border-t border-rule first:border-t-0">
          <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={40} className={inputCls} placeholder="유어샵 이름" />
          <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} rows={2} maxLength={200} className={`${inputCls} mt-2 resize-none`} placeholder="한 줄 소개" />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => {
                const n = editName.trim()
                if (!n) { toast.error('이름은 최소 1자 필요해요'); return }
                patch({ name: n, bio: editBio.trim() }, { name: curator.name, bio: curator.bio || '' })
              }}
              disabled={saving}
              className={saveCls}
            >{saving ? '저장 중…' : '저장'}</button>
            <button onClick={() => setOpen(null)} className={cancelCls}>취소</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => { setEditName(curator.name); setEditBio(curator.bio || ''); setOpen('name') }} className={rowCls}>
          <span className={keyCls}>이름 · 한 줄 소개</span>
          <span className={valCls}>{curator.name}</span>
          <span className="text-[12px] text-gray-400 dark:text-gray-500">›</span>
        </button>
      )}

      {/* 유어샵 주소 */}
      {open === 'handle' ? (
        <div className="p-4 border-t border-rule">
          <div className="flex items-center gap-1 px-3 py-2 rounded-lg border-rule-strong bg-surface shadow-lift">
            <span className="shrink-0 text-[13px] text-gray-400">{shareHost}/u/</span>
            <input
              autoFocus
              value={handleVal}
              onChange={(e) => setHandleVal(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
              className="flex-1 min-w-0 bg-transparent text-[13px] text-gray-900 dark:text-white outline-none"
            />
          </div>
          {handleMsg && (
            <p className={`text-[12px] mt-2 ${handleStatus === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : handleStatus === 'checking' ? 'text-gray-400 dark:text-gray-500' : 'text-red-500'}`}>{handleMsg}</p>
          )}
          <p className="text-[12px] mt-2 text-gray-400 dark:text-gray-500">주소를 바꾸면 전에 뿌린 링크는 이 주소로 넘어와요.</p>
          <div className="flex gap-2 mt-2">
            <button onClick={saveHandle} disabled={handleStatus !== 'ok'} className={saveCls}>{handleStatus === 'saving' ? '저장 중…' : '주소 저장'}</button>
            <button onClick={() => { setOpen(null); setHandleVal(curator.handle); setHandleStatus('idle'); setHandleMsg('') }} className={cancelCls}>취소</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => { setHandleVal(curator.handle); setHandleStatus('idle'); setHandleMsg(''); setOpen('handle') }} className={rowCls}>
          <span className={keyCls}>유어샵 주소</span>
          <span className={valCls}>{shareHost}/u/{curator.handle}</span>
          <span className="text-[12px] text-gray-400 dark:text-gray-500">›</span>
        </button>
      )}

      {/* SNS 링크 */}
      {open === 'sns' ? (
        <div className="p-4 border-t border-rule space-y-2">
          {([['youtube_url', '유튜브'], ['instagram_url', '인스타그램'], ['tiktok_url', '틱톡']] as const).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400 w-14 shrink-0">{label}</span>
              <input value={snsForm[key]} onChange={(e) => setSnsForm(s => ({ ...s, [key]: e.target.value }))} placeholder="@핸들 또는 링크" className={inputCls} />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => patch(
                { youtube_url: snsForm.youtube_url.trim(), instagram_url: snsForm.instagram_url.trim(), tiktok_url: snsForm.tiktok_url.trim() },
                { youtube_url: curator.youtube_url || '', instagram_url: curator.instagram_url || '', tiktok_url: curator.tiktok_url || '' },
              )}
              disabled={saving}
              className={saveCls}
            >{saving ? '저장 중…' : '저장'}</button>
            <button onClick={() => setOpen(null)} className={cancelCls}>취소</button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setSnsForm({ youtube_url: curator.youtube_url || '', instagram_url: curator.instagram_url || '', tiktok_url: curator.tiktok_url || '' })
            setOpen('sns')
          }}
          className={rowCls}
        >
          <span className={keyCls}>SNS 링크</span>
          <span className={valCls}>{snsCount > 0 ? `${snsCount}개 연결됨` : '연결 안 함'}</span>
          <span className="text-[12px] text-gray-400 dark:text-gray-500">›</span>
        </button>
      )}

      {/* 🩸 2026-09-29 (대표 *"배고프다 뭐먹지?는 아예 빼기"*): '흐르는 문구' 편집 행을 뺐다.
          유어샵 헤더의 마퀴가 유일한 표시 자리였고 그게 사라졌다 — 편집만 남기면 주인이
          아무도 못 보는 값을 계속 쓴다(에러가 안 나서 아무도 모르는 종류).
          서버 필드 `headline` 은 그대로 둔다: 되살릴 때 값이 남아 있어야 한다. */}
    </div>
  )
}
