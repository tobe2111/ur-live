/**
 * 🎬 메타 검수 시연 화면 — 공용 조각.
 * 화면 글자는 영어가 먼저다(메타 검수자가 영어로 본다) · 한국어는 작은 보조 글씨.
 * ⚠️ 라이트 대시보드(AdminLayout) — dark: variant 금지.
 */
import { useState, type ReactNode } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Loader2, Send, ExternalLink } from 'lucide-react'

export const BASE = '/api/admin/meta-review'

export interface ProviderStatus {
  app_id: string | null
  app_secret_set: boolean
  connected: boolean
  username: string | null
  account_id: string | null
  expires_at: string | null
  redirect_uri: string
  scopes: string[]
}
export interface MetaStatus { threads: ProviderStatus; facebook: ProviderStatus }

export function apiErr(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { error?: string } } }
  return err?.response?.data?.error || fallback
}

export async function getData<T = any>(url: string): Promise<T> {
  const r: any = await api.get(url)
  const body = r?.data ?? r
  return body?.data as T
}

export const field = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900'

export function Section({ step, title, ko, perms, children }: { step: string; title: string; ko: string; perms: string[]; children: ReactNode }) {
  return (
    <section className="mb-5 rounded-xl border border-gray-200 bg-white p-4 lg:p-5">
      <div className="mb-3">
        <p className="text-xs font-semibold text-brand">{step}</p>
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-500">{ko}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {perms.map(p => <code key={p} className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-700">{p}</code>)}
        </div>
      </div>
      {children}
    </section>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-3 text-sm text-gray-500">{children}</p>
}

export function PostRow({ who, text, meta, link, children }: { who?: string | null; text?: string | null; meta?: string; link?: string | null; children?: ReactNode }) {
  return (
    <li className="border-b border-gray-100 py-3 last:border-0">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {who && <p className="text-xs font-semibold text-gray-900">@{who}</p>}
          <p className="whitespace-pre-line text-sm text-gray-800 line-clamp-4">{text || '(no text)'}</p>
          {meta && <p className="mt-1 text-xs text-gray-500">{meta}</p>}
        </div>
        {link && (
          <a href={link} target="_blank" rel="noreferrer" className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Open on Meta">
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
      {children}
    </li>
  )
}

/**
 * 사람이 읽고 확인란을 체크해야만 보내기가 켜진다. 서버도 approved:true 없으면 거절한다.
 */
export function ApprovalSend({ initial, label, onSend }: { initial: string; label: string; onSend: (text: string) => Promise<void> }) {
  const [text, setText] = useState(initial)
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const send = async () => {
    setBusy(true)
    try { await onSend(text); toast.success('Sent / 보냈어요'); setOk(false) } catch (e) { toast.error(apiErr(e, 'Failed / 보내지 못했어요')) } finally { setBusy(false) }
  }
  return (
    <div className="mt-2 rounded-lg bg-gray-50 p-3">
      <textarea className={`${field} min-h-[80px]`} value={text} onChange={e => { setText(e.target.value); setOk(false) }} maxLength={1000} />
      <label className="mt-2 flex items-center gap-2 text-xs text-gray-700">
        <input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} />
        I reviewed this message and approve sending it. <span className="text-gray-500">(사람이 확인함)</span>
      </label>
      <Button size="sm" className="mt-2" disabled={!ok || busy || !text.trim()} onClick={send}>
        {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}{label}
      </Button>
    </div>
  )
}
