/** 🗓️ 숙소 달력 — 객실별 날짜 가용·요금 덮어쓰기 (2026-11-03 `StayManagePanel` 에서 분리 — 파일 크기 래칫). */
import { useState } from 'react'
import { promptDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/hooks/useToast'
import api from '@/lib/api'
import { Calendar, Save, ChevronLeft, ChevronRight, Ban } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import type { StayRoom, CalendarRow } from './StayManagePanel'

// ─── Calendar Tab ─────────────────────────────────────────────────────────
export default function CalendarTab({ productId, rooms, calendar, onChanged }: {
  productId: number; rooms: StayRoom[]; calendar: CalendarRow[]; onChanged: () => void
}) {
  const [activeRoomId, setActiveRoomId] = useState<number | null>(rooms[0]?.id || null)
  const [monthOffset, setMonthOffset] = useState(0)
  const [edits, setEdits] = useState<Record<string, { available_count?: number; price_override?: number | null; is_blocked?: boolean }>>({})
  const [saving, setSaving] = useState(false)

  if (rooms.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
        <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">먼저 '객실' 탭에서 객실을 추가하세요</p>
      </div>
    )
  }

  const room = rooms.find((r) => r.id === activeRoomId) || rooms[0]
  const today = new Date()
  const baseMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
  const monthYear = baseMonth.toISOString().slice(0, 7) // 'YYYY-MM'

  // 해당 월 calendar row 인덱싱.
  const calMap = new Map<string, CalendarRow>()
  calendar.filter((c) => c.room_id === room.id).forEach((c) => calMap.set(c.stay_date, c))

  function priceFor(date: Date): number {
    const dow = date.getDay()
    const isWeekend = dow === 5 || dow === 6
    return isWeekend ? room.base_price_weekend : room.base_price_weekday
  }

  function effectiveFor(date: Date) {
    const ds = date.toISOString().slice(0, 10)
    const cal = calMap.get(ds)
    const edit = edits[ds]
    return {
      ds,
      available_count: edit?.available_count ?? cal?.available_count ?? room.total_inventory,
      price_override: edit?.price_override !== undefined ? edit.price_override : (cal?.price_override ?? null),
      is_blocked: edit?.is_blocked ?? (cal?.is_blocked === 1),
      hasEdit: !!edit,
    }
  }

  function updateDay(ds: string, patch: Partial<{ available_count: number; price_override: number | null; is_blocked: boolean }>) {
    setEdits((e) => ({ ...e, [ds]: { ...e[ds], ...patch } }))
  }

  async function saveBulk() {
    if (Object.keys(edits).length === 0) { toast.error('변경 사항 없음'); return }
    setSaving(true)
    try {
      const token = localStorage.getItem('seller_token')
      const dates = Object.entries(edits).map(([date, p]) => ({
        date,
        available_count: p.available_count ?? room.total_inventory,
        price_override: p.price_override ?? null,
        is_blocked: !!p.is_blocked,
      }))
      const res = await api.put(`/api/seller/stays/${productId}/calendar`,
        { room_id: room.id, dates },
        { headers: { Authorization: `Bearer ${token}` } })
      if (res.data?.success) {
        toast.success(`${dates.length}일 저장됨`)
        setEdits({})
        onChanged()
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '저장 실패')
    } finally { setSaving(false) }
  }

  async function applyBulkInventory() {
    const v = (await promptDialog({ message: `이번 달 모든 날짜에 적용할 잔여 객실 수 (현재 재고 ${room.total_inventory}):`, prompt: { defaultValue: String(room.total_inventory) } }))
    if (v === null) return
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0) { toast.error('숫자 입력 필요'); return }
    const daysInMonth = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 1, 0).getDate()
    const next: typeof edits = { ...edits }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(baseMonth.getFullYear(), baseMonth.getMonth(), d)
      if (date < new Date(today.toDateString())) continue
      const ds = date.toISOString().slice(0, 10)
      next[ds] = { ...next[ds], available_count: n }
    }
    setEdits(next)
  }

  // 캘린더 그리드 (월별).
  const daysInMonth = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 1, 0).getDate()
  const firstDow = baseMonth.getDay()
  const cells: (Date | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(baseMonth.getFullYear(), baseMonth.getMonth(), d))

  return (
    <div className="space-y-4">
      {/* Room selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {rooms.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => { setActiveRoomId(r.id); setEdits({}) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              activeRoomId === r.id ? 'bg-brand-tint text-brand-text' : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
            }`}
          >
            {r.name} (재고 {r.total_inventory})
          </button>
        ))}
      </div>

      {/* Month navigation + actions */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-3">
        <button type="button" onClick={() => setMonthOffset((o) => o - 1)} disabled={monthOffset <= 0} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="text-sm font-bold text-gray-900">
          {baseMonth.getFullYear()}년 {baseMonth.getMonth() + 1}월
          {Object.keys(edits).length > 0 && <span className="text-xs text-gray-700 ml-2">· 미저장 {Object.keys(edits).length}일</span>}
        </p>
        <button type="button" onClick={() => setMonthOffset((o) => o + 1)} className="p-1.5 rounded hover:bg-gray-100">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={applyBulkInventory} className="ur-btn ur-btn-sm ur-btn-secondary">
          이번 달 일괄 재고 적용
        </button>
        <button type="button" onClick={saveBulk} disabled={saving || Object.keys(edits).length === 0} className="ur-btn ur-btn-sm ur-btn-primary ml-auto disabled:opacity-50 inline-flex items-center gap-1">
          <Save className="w-3 h-3" /> {saving ? '저장 중...' : `${Object.keys(edits).length}일 저장`}
        </button>
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-xl border border-gray-200 p-3">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
            <div key={d} className="text-center text-[11px] font-bold text-gray-500">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            if (!cell) return <div key={i} className="aspect-[3/4]" />
            const past = cell < new Date(today.toDateString())
            const eff = effectiveFor(cell)
            const price = eff.price_override ?? priceFor(cell)
            const isWeekend = cell.getDay() === 5 || cell.getDay() === 6
            return (
              <button
                key={i}
                type="button"
                disabled={past}
                onClick={async () => {
                  if (past) return
                  const ds = eff.ds
                  const cur = effectiveFor(cell)
                  // 클릭 사이클: 가용 → 차단 → 가용 복귀.
                  if (cur.is_blocked) {
                    updateDay(ds, { is_blocked: false, available_count: room.total_inventory })
                  } else {
                    const newPrice = (await promptDialog({ message: `${ds} 가격 (비워두면 ${isWeekend ? '주말' : '평일'} ${formatNumber(priceFor(cell))}원), 잔여 수 / 차단:`, prompt: { defaultValue: String(price) } }))
                    if (newPrice === null) return
                    if (newPrice === '') updateDay(ds, { price_override: null })
                    else {
                      const n = Number(newPrice)
                      if (Number.isFinite(n) && n >= 0) updateDay(ds, { price_override: n })
                    }
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  if (past) return
                  updateDay(eff.ds, { is_blocked: !eff.is_blocked })
                }}
                className={`aspect-[3/4] rounded-lg text-left p-1 border transition-all ${
                  past ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed' :
                  eff.is_blocked ? 'bg-white border-rule hover:bg-gray-100' :
                  eff.hasEdit ? 'bg-white border-rule hover:bg-gray-100' :
                  'bg-white border-gray-200 hover:border-rule'
                }`}
              >
                <p className={`text-[10px] font-bold ${isWeekend && !past && !eff.is_blocked ? 'text-tone-warn' : ''}`}>{cell.getDate()}</p>
                {!past && (
                  <>
                    {eff.is_blocked ? (
                      <div className="text-[8px] font-bold text-tone-bad mt-1">차단</div>
                    ) : (
                      <>
                        <p className="text-[8px] text-gray-600 mt-0.5">잔 {eff.available_count}</p>
                        <p className="text-[9px] font-bold text-gray-900">₩{(price / 1000).toFixed(0)}K</p>
                      </>
                    )}
                  </>
                )}
              </button>
            )
          })}
        </div>
        <p className="text-[10px] text-gray-400 mt-2 px-1">
          ※ 좌클릭 = 가격/잔여 수정 · 우클릭 = 차단/해제 토글
        </p>
      </div>
    </div>
  )
}

