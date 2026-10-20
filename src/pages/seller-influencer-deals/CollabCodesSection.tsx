/**
 * 🔑 협업 코드 — 매장(주인·운영자)이 인플루언서에게 줄 코드를 만든다 (2026-09-19 대표 확정 플로우 6·7번)
 *
 * 코드 하나 = "이 매장, 커미션 N%". 인플루언서가 마이페이지에 넣거나 링크(`/i/join/CODE`)를 탭하면
 * 딜이 활성된다. 코드는 여러 개 만들 수 있다(등급별 % 가 다를 때) — 입력 뒤 개별 조정은 딜 목록에서.
 *
 * 백엔드: `marketing/collab-codes.ts` (`/api/seller-marketing/codes`).
 * ⚠️ `/api/seller-marketing` 은 api 인터셉터가 토큰을 안 넣는다 — 부모가 headers 를 내려준다.
 */
import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { KeyRound, Copy, Plus, Ban, Loader2 } from 'lucide-react'
import { formatKSTDate } from '@/utils/date'

interface CodeRow {
  code: string; display: string; join_url: string
  commission_pct: number | null; requires_approval: number; label: string | null
  created_at: string; expires_at: string | null; revoked_at: string | null
  use_count: number; max_uses: number | null
}

export default function CollabCodesSection({ headers }: { headers: Record<string, string> }) {
  const [codes, setCodes] = useState<CodeRow[]>([])
  const [cap, setCap] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ commission_pct: '5', label: '', requires_approval: false, max_uses: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/api/seller-marketing/codes', { headers })
      if (r.data?.success) { setCodes(r.data.data.codes || []); setCap(r.data.data.influencer_pct_cap ?? null) }
    } catch { /* 목록이 안 떠도 만들기는 된다 */ } finally { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { void load() }, [load])

  async function create() {
    const pct = Number(form.commission_pct)
    if (!Number.isFinite(pct) || pct <= 0) { toast.error('커미션 % 를 입력해주세요'); return }
    setBusy(true)
    try {
      const r = await api.post('/api/seller-marketing/codes', {
        commission_pct: pct, label: form.label || undefined, requires_approval: form.requires_approval,
        max_uses: form.max_uses ? Number(form.max_uses) : undefined,
      }, { headers })
      if (!r.data?.success) throw new Error(r.data?.error)
      toast.success(`코드 ${r.data.data.display} 를 만들었어요`)
      setOpen(false); setForm({ commission_pct: '5', label: '', requires_approval: false, max_uses: '' })
      await load()
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } }; message?: string }
      toast.error(ax.response?.data?.error || ax.message || '코드를 만들지 못했어요')
    } finally { setBusy(false) }
  }

  async function revoke(c: CodeRow) {
    const ok = await confirmDialog({ title: `${c.display} 회수`, message: '이 코드는 더 이상 쓸 수 없게 돼요. 이미 맺어진 딜은 그대로 유지됩니다.', danger: true })
    if (!ok) return
    try {
      const r = await api.post(`/api/seller-marketing/codes/${c.code}/revoke`, {}, { headers })
      if (!r.data?.success) throw new Error(r.data?.error)
      await load()
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '회수하지 못했어요')
    }
  }

  async function copy(text: string, what: string) {
    try { await navigator.clipboard.writeText(text); toast.success(`${what}를 복사했어요`) } catch { toast.error('복사에 실패했어요') }
  }

  const live = codes.filter((c) => !c.revoked_at)

  return (
    <div className="rounded-[var(--dash-radius,16px)] border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-gray-900"><KeyRound className="h-4 w-4 text-gray-500" /> 협업 코드 <span className="text-gray-400">{live.length}</span></h2>
        <button type="button" onClick={() => setOpen((v) => !v)} className="ur-btn ur-btn-sm ur-btn-primary inline-flex items-center gap-1">
          <Plus className="h-3 w-3" /> {open ? '닫기' : '코드 만들기'}
        </button>
      </div>
      <p className="px-4 pt-3 text-[11px] leading-relaxed text-gray-600">
        인플루언서에게 코드나 링크를 보내세요. 넣는 순간 이 매장과의 협업이 시작되고, 그 사람 링크로 팔린 이용권마다 정한 % 가 적립돼요.
        {cap != null && <> 이 매장의 커미션 상한은 <b className="text-gray-900">{cap}%</b> 예요.</>}
      </p>

      {open && (
        <div className="mx-4 mt-3 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold text-gray-700">커미션 %</span>
              <input type="number" step="0.5" min="0.5" max={cap ?? 90} value={form.commission_pct}
                onChange={(e) => setForm((f) => ({ ...f, commission_pct: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold text-gray-700">라벨 <span className="font-normal text-gray-400">(선택)</span></span>
              <input value={form.label} maxLength={40} placeholder="예: 유튜버용 · 9월 캠페인"
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold text-gray-700">사용 횟수 상한 <span className="font-normal text-gray-400">(선택)</span></span>
              <input type="number" min="1" value={form.max_uses} placeholder="비우면 무제한"
                onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400" />
            </label>
            <label className="flex items-start gap-2 pt-5">
              <input type="checkbox" checked={form.requires_approval} onChange={(e) => setForm((f) => ({ ...f, requires_approval: e.target.checked }))} className="mt-0.5 h-4 w-4" />
              <span className="text-[11px] leading-snug text-gray-700"><b>내가 승인해야 시작</b><br />체크하면 넣은 사람이 '대기'로 들어오고, 아래 딜 목록에서 수락해야 활성돼요.</span>
            </label>
          </div>
          <button type="button" onClick={create} disabled={busy} className="ur-btn ur-btn-md ur-btn-primary w-full disabled:opacity-50">
            {busy ? '만드는 중…' : '코드 만들기'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
      ) : live.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-gray-400">아직 코드가 없어요. 위에서 하나 만들어 보내 보세요.</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100">
          {live.map((c) => (
            <li key={c.code} className="flex flex-wrap items-center gap-2 px-4 py-3">
              <div className="min-w-[160px] flex-1">
                <p className="font-mono text-[15px] font-bold tracking-wider text-gray-900">{c.display}</p>
                <p className="mt-0.5 text-[11px] text-gray-500">
                  {c.commission_pct}%{c.requires_approval ? ' · 승인 필요' : ' · 즉시 활성'}{c.label ? ` · ${c.label}` : ''}
                  {' · '}사용 {c.use_count}{c.max_uses ? `/${c.max_uses}` : ''}회 · {formatKSTDate(c.created_at)}
                </p>
              </div>
              <button type="button" onClick={() => copy(c.display, '코드')} className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-bold text-gray-700 hover:bg-gray-50"><Copy className="h-3 w-3" /> 코드</button>
              <button type="button" onClick={() => copy(c.join_url, '링크')} className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-bold text-gray-700 hover:bg-gray-50"><Copy className="h-3 w-3" /> 링크</button>
              <button type="button" onClick={() => revoke(c)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-tone-bad hover:bg-gray-100"><Ban className="h-3 w-3" /> 회수</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
