/**
 * 🤝 파트너 매장 소개(리퍼럴) 접수함 — 파트너가 데려온 매장 기록·추적(접힘 기본).
 *   커미션 지급 배선은 머니 룰 별도 세션(partner-referrals.ts 주석) — 여기는 접수/상태만.
 */
import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { kstShort } from '@/utils/format'

interface Referral {
  id: number; partner_lead_id: number | null; partner_name: string
  store_name: string; region: string | null; phone: string | null; memo: string | null
  status: string; created_at: string
}
const ST: Record<string, { label: string; cls: string }> = {
  new: { label: '접수', cls: 'bg-gray-100 text-gray-700' },
  contacted: { label: '컨택중', cls: 'bg-blue-100 text-blue-700' },
  onboarded: { label: '입점 완료', cls: 'bg-green-100 text-green-700' },
  rejected: { label: '무산', cls: 'bg-red-100 text-red-600' },
}
const EMPTY = { partner_name: '', store_name: '', region: '', phone: '', memo: '' }

export default function ReferralPanel() {
  const [rows, setRows] = useState<Referral[]>([])
  const [open, setOpen] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [f, setF] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try { const r = await api.get('/api/admin/partner-pool/referrals'); if (r.data?.success) setRows(r.data.referrals || []) } catch { /* soft */ }
  }, [])
  useEffect(() => { load() }, [load])

  async function submit() {
    if (f.partner_name.trim().length < 2 || f.store_name.trim().length < 2) { toast.error('파트너명·매장명을 입력하세요'); return }
    setSaving(true)
    try {
      const r = await api.post('/api/admin/partner-pool/referrals', f)
      if (r.data?.success) { toast.success('소개 접수됨'); setF({ ...EMPTY }); setShowAdd(false); await load() }
      else toast.error(r.data?.error || '접수 실패')
    } catch { toast.error('접수 실패') } finally { setSaving(false) }
  }

  async function setStatus(id: number, status: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    try { const r = await api.patch(`/api/admin/partner-pool/referrals/${id}`, { status }); if (!r.data?.success) { toast.error(r.data?.error || '변경 실패'); await load() } }
    catch { toast.error('변경 실패'); await load() }
  }

  const newCount = rows.filter(r => r.status === 'new').length

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 mb-5">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between text-left">
        <div>
          <span className="text-sm font-bold text-gray-900">🤝 파트너 매장 소개 접수함</span>
          <span className="ml-2 text-xs text-gray-500">파트너가 데려온 매장 기록·추적{newCount > 0 && <span className="ml-1 text-rose-600 font-semibold">· 신규 {newCount}건</span>}</span>
        </div>
        <span className="text-gray-400 text-xs">{open ? '접기 ▲' : `펼치기 ▼ (${rows.length})`}</span>
      </button>

      {open && (
        <div className="mt-3">
          <button onClick={() => setShowAdd(v => !v)} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium">{showAdd ? '닫기' : '＋ 소개 접수'}</button>
          {showAdd && (
            <div className="mt-2 grid grid-cols-1 md:grid-cols-5 gap-2">
              <input value={f.partner_name} onChange={e => setF({ ...f, partner_name: e.target.value })} placeholder="소개한 파트너 *" className="px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-xs" />
              <input value={f.store_name} onChange={e => setF({ ...f, store_name: e.target.value })} placeholder="소개받은 매장 *" className="px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-xs" />
              <input value={f.region} onChange={e => setF({ ...f, region: e.target.value })} placeholder="지역" className="px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-xs" />
              <input value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="매장 전화(파트너가 전달한 것만)" className="px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-xs" />
              <button onClick={submit} disabled={saving} className="px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-medium disabled:opacity-50">{saving ? '저장 중…' : '접수'}</button>
            </div>
          )}

          {rows.length === 0 ? (
            <p className="mt-3 text-xs text-gray-400">아직 접수된 소개가 없습니다. 파트너 통화에서 "아는 사장님 계시면 소개해 주세요"로 시작하세요.</p>
          ) : (
            <div className="mt-3 space-y-1.5">
              {rows.slice(0, 20).map(r => (
                <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 text-xs">
                  <span className="font-semibold text-gray-900">{r.store_name}</span>
                  <span className="text-gray-400">← {r.partner_name}</span>
                  {r.region && <span className="text-gray-500">{r.region}</span>}
                  {r.phone && <span className="text-gray-500">📞 {r.phone}</span>}
                  <span className="text-gray-300">{kstShort(r.created_at)}</span>
                  <div className="grow" />
                  <select value={r.status} onChange={e => setStatus(r.id, e.target.value)} className={`rounded px-2 py-1 text-[11px] font-medium border-0 ${ST[r.status]?.cls || 'bg-gray-100 text-gray-700'}`}>
                    {Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-[10px] text-gray-400">💰 소개 보상(커미션) 지급은 정산 규칙 검증 후 별도 배선 예정 — 현재는 기록·추적만.</p>
        </div>
      )}
    </div>
  )
}
