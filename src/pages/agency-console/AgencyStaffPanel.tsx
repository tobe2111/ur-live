import { useState } from 'react'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/hooks/useToast'
import { panelInputCls } from './AgencyAuthShell'
import { agencyRequest } from './agency-api'
import { agencyStaffLoginLabel, KAKAO_SOLO_NOTICE } from '@/shared/agency-kakao'
import { AgencyStaffStoresEditor } from './AgencyStaffStoresEditor'

export interface StaffRow {
  id: number
  email: string
  name: string | null
  role: 'admin' | 'staff'
  isOwner: boolean
  status: 'active' | 'invited' | string
  lastLoginAt: string | null
  isMe: boolean
  storeScope?: 'all' | 'assigned'
  assignedCount?: number
}

/** 직원 목록 + (관리자만) 초대·재발송·내보내기. */
export function AgencyStaffPanel({ staff, canManage, onChanged, bare = false, solo = false, onMove }: {
  staff: StaffRow[] | null
  canManage: boolean
  onChanged: () => void
  /** 시트 안 — 시트 머리가 이미 '직원' 이라 제목을 또 그리지 않는다. */
  bare?: boolean
  /** 🟡 카카오로 만든 혼자 쓰는 계정(2026-10-26 대표) — 초대 대신 '이메일 계정으로 옮기기' 를 보여 준다. */
  solo?: boolean
  onMove?: () => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'staff' | 'admin'>('staff')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<number | null>(null)

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    const r = await agencyRequest('/staff/invite', { method: 'POST', body: { email, role } })
    setBusy(false)
    if (!r.ok) { setError(r.data.error || '초대하지 못했어요.'); return }
    toast.success(r.data.message || '초대 메일을 보냈어요.')
    setEmail('')
    setRole('staff')
    onChanged()
  }

  async function resend(s: StaffRow) {
    const r = await agencyRequest(`/staff/${s.id}/resend`, { method: 'POST' })
    if (!r.ok) { toast.error(r.data.error || '다시 보내지 못했어요.'); return }
    toast.success(r.data.message || '초대 메일을 다시 보냈어요.')
  }

  async function remove(s: StaffRow) {
    const who = s.name || s.email
    const ok = await confirmDialog({
      message: `${who} 님을 내보낼까요? 지금 바로 이 에이전시에 들어올 수 없게 돼요.`,
      danger: true,
    })
    if (!ok) return
    const r = await agencyRequest(`/staff/${s.id}/remove`, { method: 'POST' })
    if (!r.ok) { toast.error(r.data.error || '내보내지 못했어요.'); return }
    toast.success(r.data.message || '내보냈어요.')
    onChanged()
  }

  return (
    <section className={bare ? '' : 'mt-8'}>
      {!bare && <h2 className="text-[17px] font-semibold text-gray-500 dark:text-gray-400">직원</h2>}
      <div className={`${bare ? '' : 'mt-3 '}rounded-2xl bg-white dark:bg-[#1D1F29] shadow-lift`}>
        {staff === null ? (
          <p className="p-6 text-[13px] text-gray-500 dark:text-gray-400">불러오는 중…</p>
        ) : (
          <ul className="divide-y divide-rule">
            {staff.map((s) => (
              <li key={s.id}>
              <div className="flex min-h-[56px] items-center gap-3 px-6 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-gray-900 dark:text-white">
                    {s.name || agencyStaffLoginLabel(s.email)}
                    {s.isMe && <span className="ml-2 text-[12px] font-semibold text-gray-500 dark:text-gray-400">나</span>}
                  </p>
                  <p className="truncate text-[13px] text-gray-500 dark:text-gray-400">
                    {s.name ? `${agencyStaffLoginLabel(s.email)} · ` : ''}{s.role === 'admin' ? (s.isOwner ? '대표 관리자' : '관리자') : '직원'}
                    {s.status === 'invited' && <span className="text-brand-text"> · 초대 대기</span>}
                    {s.role === 'staff' && <span> · {s.storeScope === 'assigned' ? `매장 ${s.assignedCount ?? 0}곳` : '매장 전부'}</span>}
                  </p>
                </div>
                {canManage && s.role === 'staff' && (
                  <button type="button" onClick={() => setEditing(editing === s.id ? null : s.id)} aria-expanded={editing === s.id}
                    className="h-9 shrink-0 rounded-full px-3 text-[13px] font-semibold text-brand-text hover:bg-[#F8F7FC] dark:hover:bg-[#11141C]">
                    매장 배정
                  </button>
                )}
                {canManage && s.status === 'invited' && (
                  <button type="button" onClick={() => resend(s)} className="h-9 shrink-0 rounded-full px-3 text-[13px] font-semibold text-brand-text hover:bg-[#F8F7FC] dark:hover:bg-[#11141C]">
                    다시 보내기
                  </button>
                )}
                {canManage && !s.isMe && !s.isOwner && (
                  <button type="button" onClick={() => remove(s)} className="h-9 shrink-0 rounded-full px-3 text-[13px] font-semibold text-gray-500 dark:text-gray-400 hover:bg-[#F8F7FC] dark:hover:bg-[#11141C]">
                    내보내기
                  </button>
                )}
              </div>
              {editing === s.id && (
                <AgencyStaffStoresEditor staffId={s.id} who={s.name || s.email}
                  onClose={() => setEditing(null)} onSaved={onChanged} />
              )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {solo ? (
        <div className="mt-4 rounded-2xl bg-white dark:bg-[#1D1F29] p-6 shadow-lift" data-testid="agency-solo-notice">
          <p className="text-[15px] font-medium text-gray-900 dark:text-white">혼자 쓰는 계정이에요</p>
          <p className="mt-1 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">{KAKAO_SOLO_NOTICE}</p>
          {onMove && (
            <button type="button" onClick={onMove} className="mt-4 h-11 rounded-xl bg-brand px-5 text-[15px] font-medium text-white">
              이메일 계정으로 옮기기
            </button>
          )}
        </div>
      ) : canManage ? (
        <form onSubmit={invite} className="mt-4 rounded-2xl bg-white dark:bg-[#1D1F29] p-6 shadow-lift">
          <p className="text-[15px] font-semibold text-gray-900 dark:text-white">직원 초대</p>
          <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">초대 메일의 버튼을 누르면 이름과 비밀번호를 정하고 바로 합류해요. 링크는 7일 동안 쓸 수 있어요.</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy}
              placeholder="직원 업무용 이메일" aria-label="직원 이메일" className={`${panelInputCls} sm:flex-1`} />
            <select value={role} onChange={(e) => setRole(e.target.value === 'admin' ? 'admin' : 'staff')} disabled={busy}
              aria-label="역할" className={`${panelInputCls} sm:w-32`}>
              <option value="staff">직원</option>
              <option value="admin">관리자</option>
            </select>
            <button type="submit" disabled={busy} className="h-12 shrink-0 rounded-xl bg-brand px-5 text-[15px] font-semibold text-white disabled:opacity-50">
              {busy ? '보내는 중…' : '초대하기'}
            </button>
          </div>
          {error && <p role="alert" className="mt-3 text-[13px] text-tone-bad">{error}</p>}
          <p className="mt-3 text-[12px] text-gray-500 dark:text-gray-400">관리자는 정산·직원 관리까지, 직원은 매장 운영만 할 수 있어요. 직원이 들어갈 매장은 [매장 배정]에서 고를 수 있어요.</p>
        </form>
      ) : (
        <p className="mt-3 text-[13px] text-gray-500 dark:text-gray-400">직원 초대와 내보내기는 관리자만 할 수 있어요.</p>
      )}
    </section>
  )
}
