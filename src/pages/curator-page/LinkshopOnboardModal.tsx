/**
 * 🏁 2026-06-14 (사용자 요청 — "처음 가입하고 링크샵 처음 들어가면 닉네임 바꿀 수 있게. @user30 이렇게 된 거"):
 *
 * 신규 가입자는 handle 이 자동생성값(`user{id}`)이라 링크샵 주소가 @user30 처럼 비인격적.
 * 본인(owner)이 자기 링크샵에 처음 들어왔고 handle 이 아직 기본형이면 1회 닉네임 설정 모달을 띄운다.
 * 표시이름(name) + 핸들(@handle) 동시 설정. 핸들 중복/형식은 checkHandle 로 실시간 검증.
 *
 * 닫기/완료/스킵 시 localStorage 로 다시 안 뜨게(스킵은 다음에 또 권유하지 않되, '나중에' 는 세션 한정).
 * 화이트/다크 토글 페이지라 dark: variant 필수.
 */
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { curatorApi } from '@/features/curator/api/curator-api'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { X } from 'lucide-react'

interface Props {
  curatorId: number
  currentHandle: string
  currentName: string
  onDone: (next: { name?: string; handle?: string }) => void
  onClose: () => void
}

export default function LinkshopOnboardModal({ curatorId, currentHandle, currentName, onDone, onClose }: Props) {
  const [name, setName] = useState(currentName && !/^user\d+$/i.test(currentName) ? currentName : '')
  const [handle, setHandle] = useState('')
  const [checking, setChecking] = useState(false)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [checkMsg, setCheckMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 핸들 입력 → 디바운스 중복/형식 검증
  useEffect(() => {
    const h = handle.toLowerCase().trim()
    setAvailable(null)
    setCheckMsg('')
    if (!h) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setChecking(true)
      try {
        const r = await curatorApi.checkHandle(h)
        setAvailable(!!r.available)
        setCheckMsg(r.message || (r.available ? '사용 가능한 주소예요' : '이미 사용 중이거나 형식이 올바르지 않아요'))
      } catch {
        setAvailable(null)
        setCheckMsg('')
      } finally {
        setChecking(false)
      }
    }, 450)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [handle])

  function dismissPermanently() {
    try { localStorage.setItem(`linkshop_nickname_set_${curatorId}`, '1') } catch { /* */ }
    onClose()
  }

  async function save() {
    const h = handle.toLowerCase().trim()
    const nm = name.trim()
    if (!nm && !h) { dismissPermanently(); return }
    setSaving(true)
    try {
      const next: { name?: string; handle?: string } = {}
      // 이름 먼저 저장 (핸들 변경이 실패해도 이름은 반영)
      if (nm) {
        const res = await api.patch('/api/curator/me/profile', { name: nm })
        if (res.data?.success) next.name = nm
      }
      if (h && h !== currentHandle) {
        const r = await curatorApi.updateHandle(h)
        if (r.success && r.handle) {
          next.handle = r.handle
        } else {
          toast.error(r.error || '링크샵 주소 변경에 실패했어요')
          // 이름만이라도 반영됐으면 닫지 않고 사용자가 핸들 다시 시도
          if (next.name) onDone(next)
          setSaving(false)
          return
        }
      }
      try { localStorage.setItem(`linkshop_nickname_set_${curatorId}`, '1') } catch { /* */ }
      toast.success('링크샵 프로필이 설정됐어요')
      onDone(next)
    } catch {
      toast.error('저장 중 오류가 발생했어요')
    } finally {
      setSaving(false)
    }
  }

  const handleValid = !handle || (available === true)

  // 🛠️ 2026-06-16 (모바일 팝업 안 보임 신고): 부모에 transform 이 있으면 position:fixed 가 뷰포트가
  //   아니라 그 부모 기준이 돼 모달이 화면 밖으로 잘림 → document.body 로 portal 해 항상 뷰포트 고정.
  if (typeof document === 'undefined') return null
  return createPortal((
    <div className="fixed inset-0 z-[9500] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="w-full sm:max-w-md max-h-[90dvh] overflow-y-auto bg-white dark:bg-[#121212] rounded-t-3xl sm:rounded-3xl border border-gray-200 dark:border-[#2A2A2A] p-5 animate-sheet-rise">
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-[17px] font-bold text-gray-900 dark:text-white">내 링크샵 꾸미기</h2>
          <button onClick={dismissPermanently} aria-label="닫기" className="p-1 -m-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-4 leading-snug">
          지금 주소가 <span className="font-mono text-gray-700 dark:text-gray-300">@{currentHandle}</span> 예요.
          나만의 이름과 주소로 바꿔보세요.
        </p>

        <label className="block text-[12px] font-semibold text-gray-700 dark:text-gray-300 mb-1">표시 이름</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 40))}
          placeholder="예: 지원의 추천템"
          className="w-full px-3.5 py-2.5 mb-4 rounded-xl border border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#1A1A1A] text-gray-900 dark:text-white text-[14px] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10"
        />

        <label className="block text-[12px] font-semibold text-gray-700 dark:text-gray-300 mb-1">링크샵 주소 (@)</label>
        <div className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#1A1A1A]">
          <span className="text-gray-400 text-[14px]">@</span>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
            placeholder="myshop"
            className="flex-1 bg-transparent text-gray-900 dark:text-white text-[14px] placeholder:text-gray-400 focus:outline-none"
          />
          {checking && <span className="text-[11px] text-gray-400">확인중…</span>}
        </div>
        {checkMsg && (
          <p className={`text-[12px] mt-1.5 ${available ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{checkMsg}</p>
        )}
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">소문자/숫자/_ 만, 3~20자. 비워두면 이름만 바꿔요.</p>

        <div className="flex gap-2 mt-5">
          <button
            onClick={dismissPermanently}
            className="px-4 py-2.5 rounded-xl text-[13px] font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-[#1A1A1A]"
          >
            나중에
          </button>
          <button
            onClick={save}
            disabled={saving || !handleValid || (!name.trim() && !handle.trim())}
            className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-bold bg-gray-900 dark:bg-white text-white dark:text-gray-900 disabled:opacity-40"
          >
            {saving ? '저장 중…' : '저장하기'}
          </button>
        </div>
      </div>
    </div>
  ), document.body)
}
