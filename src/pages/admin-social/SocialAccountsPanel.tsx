/**
 * 🆕 2026-07-15 어드민 소셜 홍보 — 계정 연결/상태 패널.
 *   플랫폼별 게이트(env 킬스위치) 상태 + 연결 계정 + 수동 등록/해제.
 *   토큰은 서버에서 암호화 저장(여기선 입력만, 비노출).
 */
import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { Link2, Unlink, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { PLATFORMS, type SocialAccount, type SocialGate, type SocialPlatform } from './types'

interface Props {
  accounts: SocialAccount[]
  gates: SocialGate[]
  onChange: () => void
}

export default function SocialAccountsPanel({ accounts, gates, onChange }: Props) {
  const [openForm, setOpenForm] = useState<SocialPlatform | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<{ account_ref: string; display_name: string; access_token: string; refresh_token: string; extra: string }>(
    { account_ref: '', display_name: '', access_token: '', refresh_token: '', extra: '' },
  )

  const gateOf = (p: SocialPlatform) => gates.find((g) => g.platform === p)
  const accountOf = (p: SocialPlatform) => accounts.find((a) => a.platform === p)

  const openConnect = (p: SocialPlatform) => {
    setForm({ account_ref: '', display_name: '', access_token: '', refresh_token: '', extra: '' })
    setOpenForm(openForm === p ? null : p)
  }

  const submit = async (p: SocialPlatform) => {
    if (!form.access_token.trim()) { toast.error('액세스 토큰을 입력하세요'); return }
    setSaving(true)
    try {
      let extra: Record<string, unknown> | undefined
      if (form.extra.trim()) { try { extra = JSON.parse(form.extra) } catch { toast.error('extra 는 JSON 형식이어야 합니다'); setSaving(false); return } }
      const { data } = await api.post('/api/admin/social/accounts', {
        platform: p, account_ref: form.account_ref.trim() || undefined, display_name: form.display_name.trim() || undefined,
        access_token: form.access_token.trim(), refresh_token: form.refresh_token.trim() || undefined, extra,
      })
      if (data?.success) { toast.success('계정을 연결했습니다'); setOpenForm(null); onChange() }
      else toast.error(data?.error || '연결 실패')
    } catch (e: any) { toast.error(e?.response?.data?.error || '연결 중 오류') } finally { setSaving(false) }
  }

  const disconnect = async (a: SocialAccount) => {
    if (!(await confirmDialog({ message: `${a.platform} 계정 연결을 해제할까요?` }))) return
    try {
      const { data } = await api.delete(`/api/admin/social/accounts/${a.id}`)
      if (data?.success) { toast.success('연결을 해제했습니다'); onChange() } else toast.error(data?.error || '해제 실패')
    } catch (e: any) { toast.error(e?.response?.data?.error || '해제 중 오류') }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {PLATFORMS.map(({ key, label, emoji }) => {
        const gate = gateOf(key)
        const acct = accountOf(key)
        const isOpen = openForm === key
        return (
          <div key={key} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{emoji}</span>
                <span className="font-semibold text-gray-900">{label}</span>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${gate?.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {gate?.enabled ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                {gate?.enabled ? '발행 ON' : '발행 OFF'}
              </span>
            </div>

            <div className="mt-3 text-sm">
              {acct ? (
                <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-gray-900">{acct.display_name || acct.account_ref || '연결됨'}</div>
                    <div className="truncate text-xs text-gray-500">ID: {acct.account_ref || '-'}</div>
                  </div>
                  <button onClick={() => disconnect(acct)} className="ml-2 shrink-0 text-gray-400 hover:text-red-500" title="연결 해제">
                    <Unlink className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="rounded-lg bg-gray-50 px-3 py-2 text-gray-500">연결된 계정 없음</div>
              )}
            </div>

            <button onClick={() => openConnect(key)} className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50">
              <Link2 className="h-4 w-4" /> {acct ? '토큰 갱신/재연결' : '계정 연결'}
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {isOpen && (
              <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                <input value={form.account_ref} onChange={(e) => setForm({ ...form, account_ref: e.target.value })}
                  placeholder={key === 'youtube' ? '채널 ID' : key === 'instagram' ? 'IG 비즈니스 계정 ID' : '스레드 User ID'}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900" />
                <input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  placeholder="표시 이름(@handle 등, 선택)" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900" />
                <input value={form.access_token} onChange={(e) => setForm({ ...form, access_token: e.target.value })}
                  placeholder="액세스 토큰(필수)" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900" />
                {key === 'youtube' && (
                  <input value={form.refresh_token} onChange={(e) => setForm({ ...form, refresh_token: e.target.value })}
                    placeholder="리프레시 토큰(만료 자동갱신용)" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900" />
                )}
                {key === 'instagram' && (
                  <input value={form.extra} onChange={(e) => setForm({ ...form, extra: e.target.value })}
                    placeholder='extra JSON (예: {"fb_page_id":"123"})' className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900" />
                )}
                <div className="flex gap-2">
                  <Button onClick={() => submit(key)} disabled={saving} className="flex-1">{saving ? '저장 중…' : '저장'}</Button>
                  <button onClick={() => setOpenForm(null)} className="rounded-lg border border-gray-200 px-3 text-sm text-gray-600">취소</button>
                </div>
                <p className="text-xs text-gray-400">토큰은 서버에서 암호화 저장되며 다시 표시되지 않습니다.</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
