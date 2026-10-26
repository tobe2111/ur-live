import { useCallback, useEffect, useRef, useState } from 'react'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/hooks/useToast'
import { agencyRequest } from './agency-api'

interface Invite { url: string; expiresAt?: string; useCount: number }

/**
 * 🔗 매장 초대 링크(관리자) — 사장님께 카톡으로 보내는 링크. 사장님이 열어 [맡기기] 를 누르면 바로 운영이 시작된다.
 * 링크는 에이전시당 하나 — 새로 만들면 옛 링크는 끊긴다(엉뚱한 곳에 퍼졌을 때 거두는 방법).
 */
export function AgencyInviteLinkCard() {
  const [invite, setInvite] = useState<Invite | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setError('')
    const r = await agencyRequest<{ invite: Invite | null }>('/store-invite')
    if (!r.ok) { setError(r.data.error || '초대 링크를 불러오지 못했어요.'); return }
    setInvite(r.data.invite)
  }, [])

  useEffect(() => { load() }, [load])

  async function create() {
    if (invite && !(await confirmDialog({ message: '새 링크를 만들면 지금 링크는 더 이상 쓸 수 없어요. 만들까요?', danger: true }))) return
    setBusy(true)
    const r = await agencyRequest<{ invite: Invite; message?: string }>('/store-invite', { method: 'POST' })
    setBusy(false)
    if (!r.ok) { toast.error(r.data.error || '링크를 만들지 못했어요.'); return }
    setInvite(r.data.invite)
    toast.success('초대 링크를 만들었어요. 복사해서 사장님께 보내 주세요.')
  }

  async function revoke() {
    if (!(await confirmDialog({ message: '이 링크를 끊을까요? 이미 맡긴 매장은 그대로예요.', danger: true }))) return
    setBusy(true)
    const r = await agencyRequest('/store-invite/revoke', { method: 'POST' })
    setBusy(false)
    if (!r.ok) { toast.error(r.data.error || '끊지 못했어요.'); return }
    setInvite(null)
  }

  async function copy() {
    if (!invite) return
    try {
      await navigator.clipboard.writeText(invite.url)
      toast.success('링크를 복사했어요.')
    } catch {
      inputRef.current?.select()
      toast.info('링크를 선택해 두었어요. 길게 눌러 복사해 주세요.')
    }
  }

  return (
    <div className="mt-3 rounded-2xl bg-white dark:bg-[#1D1F29] p-6 shadow-lift">
      <p className="text-[15px] font-semibold text-gray-900 dark:text-white">매장 초대 링크</p>
      <p className="mt-1 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
        사장님께 카톡으로 보내면, 사장님이 링크를 열어 [맡기기] 한 번으로 이 에이전시에 매장을 맡겨요. 따로 수락할 필요 없이 바로 운영할 수 있어요.
      </p>
      {error ? (
        <p className="mt-3 text-[13px] text-tone-bad">{error}</p>
      ) : invite === undefined ? (
        <p className="mt-3 text-[13px] text-gray-500 dark:text-gray-400">불러오는 중…</p>
      ) : invite ? (
        <>
          <div className="mt-4 flex gap-2">
            <input ref={inputRef} readOnly value={invite.url} onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-xl bg-gray-50 dark:bg-white/5 px-3 py-2 text-[13px] text-gray-700 dark:text-gray-200 outline-none" />
            <button type="button" onClick={copy} className="h-10 shrink-0 rounded-xl bg-brand px-4 text-[13px] font-semibold text-white">복사</button>
          </div>
          <div className="mt-3 flex items-center gap-3 text-[12px] text-gray-500 dark:text-gray-400">
            <span>이 링크로 맡긴 매장 {invite.useCount}곳</span>
            <button type="button" disabled={busy} onClick={create} className="ml-auto font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-50">새로 만들기</button>
            <button type="button" disabled={busy} onClick={revoke} className="font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-50">끊기</button>
          </div>
        </>
      ) : (
        <button type="button" disabled={busy} onClick={create}
          className="mt-4 h-10 rounded-xl bg-brand px-4 text-[13px] font-semibold text-white disabled:opacity-50">초대 링크 만들기</button>
      )}
    </div>
  )
}
