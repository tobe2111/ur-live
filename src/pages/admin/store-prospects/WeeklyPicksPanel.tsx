/**
 * 🗓️ 이번 주 영입 N곳 패널 — 결재 store-acquisition-pipeline(2026-09-08 승인) 의 화면.
 *   서버가 고른 이번 주 묶음(같은 주엔 고정) + 추적표(연락함·응답·입점) + 매장별 제안 문구 + 상태 변경.
 *   발송 버튼은 없다 — 문구를 복사해 대표가 직접 보낸다.
 */
import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import ProposalModal from './ProposalModal'

interface Row {
  id: number; rank: number; biz_name: string; category: string | null; uptae: string | null; region: string | null; addr_road: string | null
  phone: string | null; email: string | null; website: string | null; apv_perm_ymd: string | null; is_new_open: number
  status: string; contact_channel: string | null; follow_up_at: string | null; memo: string | null
}
interface Tracker { total: number; contacted: number; responded: number; interested: number; onboarded: number; rejected: number; hold: number }
interface Weekly { week: string; config: { n: number; categories: string[]; regions: string[] }; rows: Row[]; tracker: Tracker; history: Array<{ week: string } & Tracker> }

const STATUS_META: Record<string, { label: string; cls: string }> = {
  new: { label: '신규', cls: 'bg-gray-100 text-gray-700' },
  contacted: { label: '컨택함', cls: 'bg-tone-info-bg text-tone-info' },
  interested: { label: '관심', cls: 'bg-tone-warn-bg text-tone-warn' },
  onboarded: { label: '입점', cls: 'bg-tone-ok-bg text-tone-ok' },
  rejected: { label: '거절', cls: 'bg-tone-bad-bg text-tone-bad' },
  hold: { label: '보류', cls: 'bg-gray-100 text-gray-500' },
}
const STATUSES = Object.keys(STATUS_META)
const pct = (a: number, b: number) => b > 0 ? `${Math.round((a / b) * 100)}%` : '—'

export default function WeeklyPicksPanel({ onStatusChange }: { onStatusChange: (id: number, status: string) => Promise<void> | void }) {
  const [w, setW] = useState<Weekly | null>(null)
  const [open, setOpen] = useState(true)
  const [proposal, setProposal] = useState<Row | null>(null)
  const [nInput, setNInput] = useState('')

  const load = useCallback(async () => {
    try {
      const r = await api.get('/api/admin/store-prospects/weekly')
      if (r.data?.success) { setW(r.data); setNInput(String(r.data.config?.n ?? 20)) }
    } catch { toast.error('이번 주 영입 묶음을 불러오지 못했습니다') }
  }, [])
  useEffect(() => { load() }, [load])

  const setStatus = async (id: number, status: string) => {
    await onStatusChange(id, status)
    setW(prev => {
      if (!prev) return prev
      const rows = prev.rows.map(r => r.id === id ? { ...r, status } : r)
      const t: Tracker = { total: rows.length, contacted: 0, responded: 0, interested: 0, onboarded: 0, rejected: 0, hold: 0 }
      for (const r of rows) {
        if (r.status !== 'new') t.contacted++
        if (r.status === 'interested') { t.interested++; t.responded++ } else if (r.status === 'onboarded') { t.onboarded++; t.responded++ }
        else if (r.status === 'rejected') { t.rejected++; t.responded++ } else if (r.status === 'hold') t.hold++
      }
      return { ...prev, rows, tracker: t }
    })
  }
  const saveN = async () => {
    const n = Math.trunc(Number(nInput))
    if (!n || n < 1 || n > 100) { toast.error('1~100 사이 숫자'); return }
    try { const r = await api.patch('/api/admin/store-prospects/weekly/config', { ...(w?.config || {}), n }); if (r.data?.success) { toast.success(`다음 주부터 ${n}곳`); setW(prev => prev ? { ...prev, config: r.data.config } : prev) } }
    catch { toast.error('저장 실패') }
  }

  if (!w) return null
  const t = w.tracker
  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <div>
          <span className="text-sm font-semibold text-gray-900">🗓️ 이번 주 영입 {w.config.n}곳</span>
          <span className="ml-2 text-xs text-gray-500">주 시작 {w.week} · 연락함 {t.contacted}/{t.total} · 응답 {t.responded} · 입점 {t.onboarded}</span>
        </div>
        <span className="text-xs text-gray-400">{open ? '접기' : '펼치기'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
            {[['대상', t.total, ''], ['연락함', t.contacted, pct(t.contacted, t.total)], ['응답', t.responded, pct(t.responded, t.contacted)], ['관심', t.interested, ''], ['입점', t.onboarded, pct(t.onboarded, t.total)]].map(([k, v, s]) => (
              <div key={String(k)} className="rounded-lg bg-gray-50 px-3 py-2"><div className="text-[11px] text-gray-500">{k}</div><div className="text-lg font-bold text-gray-900 tabular-nums">{v}<span className="ml-1 text-[11px] font-normal text-gray-400">{s}</span></div></div>
            ))}
          </div>
          {w.rows.length === 0 ? (
            <div className="rounded-lg bg-gray-50 px-3 py-4 text-sm text-gray-500">이번 주 조건(영업중 · 미접촉 · 연락처 보유{w.config.categories.length ? ` · ${w.config.categories.join('/')}` : ''})에 맞는 매장이 없습니다. 위 수집 버튼으로 풀을 채우거나 조건을 넓혀 주세요.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-gray-700">
                <thead><tr className="text-gray-500 text-left"><th className="py-1 pr-2">#</th><th className="py-1 pr-2">매장</th><th className="py-1 pr-2">업종 · 지역</th><th className="py-1 pr-2">연락처</th><th className="py-1 pr-2">상태</th><th className="py-1">문구</th></tr></thead>
                <tbody>
                  {w.rows.map(r => (
                    <tr key={r.id} className="border-t border-gray-100 align-top">
                      <td className="py-1.5 pr-2 tabular-nums text-gray-400">{r.rank}</td>
                      <td className="py-1.5 pr-2"><div className="font-medium text-gray-900">{r.biz_name}{r.is_new_open ? <span className="ml-1 text-[10px] text-rose-600 font-semibold">개업</span> : null}</div><div className="text-[11px] text-gray-400 truncate max-w-[220px]">{r.addr_road || ''}</div></td>
                      <td className="py-1.5 pr-2">{r.category || '—'}<div className="text-[11px] text-gray-400">{r.region || ''}</div></td>
                      <td className="py-1.5 pr-2">{r.phone ? <a href={`tel:${r.phone}`} className="text-blue-600">{r.phone}</a> : <span className="text-gray-300">전화 없음</span>}{r.email ? <div className="text-[11px] text-indigo-600 truncate max-w-[180px]">{r.email}</div> : null}</td>
                      <td className="py-1.5 pr-2">
                        <select value={r.status} onChange={e => setStatus(r.id, e.target.value)} className={`text-xs rounded px-2 py-1 border-0 ${STATUS_META[r.status]?.cls || 'bg-gray-100 text-gray-700'}`}>
                          {STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s]?.label || s}</option>)}
                        </select>
                      </td>
                      <td className="py-1.5"><button onClick={() => setProposal(r)} className="px-2.5 py-1 rounded-lg bg-gray-900 text-white text-[11px] font-semibold">제안 문구</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
            <span>주당 곳수</span>
            <input value={nInput} onChange={e => setNInput(e.target.value)} className="w-16 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900" />
            <button onClick={saveN} className="px-2.5 py-1 rounded border border-gray-300 bg-white text-gray-700">저장</button>
            <span>· 다음 주 월요일(KST)부터 적용. 발송은 대표가 직접 합니다(자동 발송 없음).</span>
          </div>
          {w.history.length > 1 && (
            <div className="mt-3 text-[11px] text-gray-500">
              지난 주: {w.history.filter(h => h.week !== w.week).slice(0, 4).map(h => `${h.week} 연락 ${h.contacted}/${h.total} · 응답 ${h.responded} · 입점 ${h.onboarded}`).join(' | ')}
            </div>
          )}
        </div>
      )}
      {proposal && <ProposalModal prospectId={proposal.id} email={proposal.email} phone={proposal.phone} onClose={() => setProposal(null)} />}
    </div>
  )
}
