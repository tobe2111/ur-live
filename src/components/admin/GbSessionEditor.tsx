/**
 * 🎟️ 이용권 판매 설정(공구 세션) 편집기 — 상태·특가·마감·소개비율·링크전용.
 *   〔2026-10-20 옛 '공구 엔진 조종석'(AdminGbCockpitPage)에서 그대로 추출 — 그 화면은 '이용권 관리' 의
 *    줄마다 [판매 설정] 으로 흡수됐다(대표 *"상품관리 + 이용권 공구 … 역할이 모호해"*). 저장 로직 불변.〕
 *   저장: PUT /api/admin/gb-cockpit/products/:id → product_supply_meta(gb_* 키).
 *   ⚠️ 값 저장만 — 실제 적용은 platform_settings.gb_engine_enabled 게이트 뒤(엔진).
 */
import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatWon } from '@/utils/format'
import { Link2 } from 'lucide-react'

export type GbMode = 'off' | 'scheduled' | 'live' | 'ended'
export interface GbSession {
  mode: GbMode; startAt?: string | null; deadline?: string | null; target?: number | null
  price?: number | null; promoPct?: number | null; linkOnly?: boolean
}
export interface GbRow {
  id: number; name: string; price: number; original_price?: number | null; category?: string
  seller_id?: number | null; restaurant_name?: string | null; gb: GbSession; gb_effective_status: GbMode
}

export const MODE_LABEL: Record<GbMode, string> = { off: '없음', scheduled: '예약', live: '진행중', ended: '종료' }
export const MODE_BADGE: Record<GbMode, string> = {
  off: 'bg-gray-100 text-gray-500', scheduled: 'border border-rule bg-white text-tone-warn',
  live: 'bg-tone-ok-bg text-tone-ok', ended: 'bg-gray-100 text-gray-400',
}

// ISO ↔ datetime-local('YYYY-MM-DDTHH:MM') 변환(입력 편의).
function isoToLocal(iso?: string | null): string {
  if (!iso) return ''
  const d = String(iso).replace(' ', 'T')
  return d.length >= 16 ? d.slice(0, 16) : d
}

export function GbSessionEditor({ row, onSaved }: { row: GbRow; onSaved: () => void }) {
  const g = row.gb || { mode: 'off' as GbMode }
  const [mode, setMode] = useState<GbMode>(g.mode || 'off')
  const [price, setPrice] = useState(String(g.price ?? ''))
  const [start, setStart] = useState(isoToLocal(g.startAt))
  const [deadline, setDeadline] = useState(isoToLocal(g.deadline))
  const [promoPct, setPromoPct] = useState(String(g.promoPct ?? ''))
  const [linkOnly, setLinkOnly] = useState(!!g.linkOnly)
  const [target, setTarget] = useState(String(g.target ?? ''))
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      const r = await api.put(`/api/admin/gb-cockpit/products/${row.id}`, {
        mode, price: price || null, startAt: start || null, deadline: deadline || null,
        promoPct: promoPct || null, linkOnly, target: target || null,
      })
      if (r.data?.success) { toast.success(`저장 — 실효상태: ${MODE_LABEL[r.data.gb_effective_status as GbMode] || '없음'}`); onSaved() }
      else toast.error(r.data?.error || '저장 실패')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '저장 실패')
    } finally { setBusy(false) }
  }

  const active = mode === 'scheduled' || mode === 'live'
  const discount = active && Number(price) > 0 && row.price > 0 ? Math.round((1 - Number(price) / row.price) * 100) : 0

  return (
    <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <label className="text-[12px] text-gray-600">공구 상태
          <select value={mode} onChange={(e) => setMode(e.target.value as GbMode)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] text-gray-900 bg-white">
            <option value="off">없음(off)</option>
            <option value="scheduled">예약(scheduled)</option>
            <option value="live">진행중(live)</option>
            <option value="ended">종료(ended)</option>
          </select>
        </label>
        {active && <>
          <label className="text-[12px] text-gray-600">공구 특가(원) · 상시가 {formatWon(row.price)}
            <input value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] text-gray-900" />
            {discount > 0 && <span className="text-[10px] text-tone-ok">할인 {discount}%</span>}
          </label>
          <label className="text-[12px] text-gray-600">소개비율 %(0~50)
            <input value={promoPct} onChange={(e) => setPromoPct(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] text-gray-900" />
          </label>
          <label className="text-[12px] text-gray-600">목표 수량(선택)
            <input value={target} onChange={(e) => setTarget(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] text-gray-900" />
          </label>
          <label className="text-[12px] text-gray-600">시작(선택 — 예약)
            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] text-gray-900" />
          </label>
          <label className="text-[12px] text-gray-600">마감 <span className="text-tone-bad">*</span>
            <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] text-gray-900" />
          </label>
          <label className="col-span-2 flex items-center gap-2 text-[12px] text-gray-700 mt-1">
            <input type="checkbox" checked={linkOnly} onChange={(e) => setLinkOnly(e.target.checked)} className="w-4 h-4" />
            <Link2 className="w-3.5 h-3.5" /> 링크 전용(gb_link_only) — 체크 시 ?ref 링크로만 공구가, 상시 노출은 상시가. 미체크=공구가로 통일
          </label>
        </>}
      </div>
      <div className="flex justify-end">
        <button type="button" disabled={busy} onClick={save} className="ur-btn ur-btn-md ur-btn-primary text-[13px] disabled:opacity-50">저장</button>
      </div>
    </div>
  )
}
