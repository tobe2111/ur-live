/**
 * 🎉 개업 웰컴 패널 — 최근 개업 매장 큐(전환율 최고 시그널) + 개업 컨설팅 브리핑 진입.
 *   대표 2026-07-27 "모두 진행하자, 개업 컨설팅도 가능하겠네" — 개업 감지를 매출 활동으로 바꾸는 첫 화면.
 *   접을 수 있는 카드(기본 펼침, 큐 있을 때만 표시). 연락처 보유 우선 정렬은 서버(new-open-digest)가 담당.
 */
import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import OpeningBriefingModal from './OpeningBriefingModal'

interface Row {
  id: number; biz_name: string; category: string | null; uptae: string | null
  region: string | null; addr_road: string | null; phone: string | null; email: string | null
  apv_perm_ymd: string | null; status: string
}
interface Digest { total: number; days: number; rows: Row[]; byRegion: Array<{ k: string; n: number }> }

const dDay = (ymd: string | null): string => {
  if (!ymd || ymd.length !== 8) return ''
  const t = Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8))
  const n = Math.max(0, Math.floor((Date.now() - t) / 86400_000))
  return n === 0 ? '오늘' : `D+${n}`
}

export default function OpeningWelcomePanel({ onStatusChange }: { onStatusChange: (id: number, status: string) => void }) {
  const [digest, setDigest] = useState<Digest | null>(null)
  const [open, setOpen] = useState(true)
  const [briefingId, setBriefingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    try { const r = await api.get('/api/admin/store-prospects/new-open-digest?days=14'); if (r.data?.success) setDigest(r.data) } catch { /* soft */ }
  }, [])
  useEffect(() => { load() }, [load])

  if (!digest || digest.total === 0) return null

  const markContacted = (id: number) => {
    onStatusChange(id, 'contacted')
    setDigest(d => d ? { ...d, rows: d.rows.map(r => r.id === id ? { ...r, status: 'contacted' } : r) } : d)
    toast.success('컨택함으로 표시했습니다')
  }

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 mb-5">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between text-left">
        <div>
          <span className="text-sm font-bold text-gray-900">🎉 개업 웰컴 — 최근 {digest.days}일 신규 개업 {formatNumber(digest.total)}곳</span>
          <span className="ml-2 text-xs text-gray-500">개업 초기 = 입점 전환율 최고 · 브리핑으로 상권 수치 들고 전화하세요</span>
        </div>
        <span className="text-gray-400 text-xs">{open ? '접기 ▲' : '펼치기 ▼'}</span>
      </button>

      {open && (
        <>
          {digest.byRegion.length > 0 && (
            <div className="mt-2 text-[11px] text-gray-500">
              지역: {digest.byRegion.map(r => `${r.k} ${r.n}`).join(' · ')}
            </div>
          )}
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {digest.rows.slice(0, 12).map(r => (
              <div key={r.id} className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">
                      <span className="mr-1 text-[10px] px-1 py-0.5 rounded bg-rose-100 text-rose-600 font-bold">{dDay(r.apv_perm_ymd)}</span>
                      {r.biz_name}
                    </div>
                    <div className="text-[11px] text-gray-400 truncate">{[r.region, r.category, r.uptae].filter(Boolean).join(' · ')}</div>
                    <div className="text-[11px] text-gray-600 mt-0.5">
                      {r.phone ? <a href={`tel:${r.phone}`} className="text-blue-600">📞 {r.phone}</a> : <span className="text-gray-300">전화 미확보</span>}
                      {r.email && <span className="ml-2 text-gray-500">✉ {r.email}</span>}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <button onClick={() => setBriefingId(r.id)} className="px-2.5 py-1 rounded-lg bg-gray-900 text-white text-[11px]">📊 브리핑</button>
                  {r.status === 'new'
                    ? <button onClick={() => markContacted(r.id)} className="px-2.5 py-1 rounded-lg border border-gray-300 bg-white text-gray-600 text-[11px]">컨택함으로</button>
                    : <span className="text-[11px] text-gray-400">상태: {r.status}</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {briefingId != null && <OpeningBriefingModal prospectId={briefingId} onClose={() => setBriefingId(null)} />}
    </div>
  )
}
