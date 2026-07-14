/**
 * 🎟️ 2026-07-14 공구 엔진 조종석 — 어드민 (STEP 2 선결, gap A1 해소).
 *   상품별 공구 세션(gb_mode·특가·마감·소개비율·링크전용) 설정. 저장은 product_supply_meta(gb_* 키).
 *   ⚠️ 값 저장만 — 실제 공구가/소개비 적용은 platform_settings.gb_engine_enabled 게이트 뒤(엔진).
 *   백엔드: features/group-buy/api/gb-cockpit.routes.ts (/api/admin/gb-cockpit).
 */
import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { toast } from '@/hooks/useToast'
import { formatWon } from '@/utils/format'
import { Rocket, RefreshCw, Search, Link2, AlertTriangle } from 'lucide-react'

type GbMode = 'off' | 'scheduled' | 'live' | 'ended'
interface GbSession {
  mode: GbMode; startAt?: string | null; deadline?: string | null; target?: number | null
  price?: number | null; promoPct?: number | null; linkOnly?: boolean
}
interface Row {
  id: number; name: string; price: number; original_price?: number | null; category?: string
  seller_id?: number | null; restaurant_name?: string | null; gb: GbSession; gb_effective_status: GbMode
}

const MODE_LABEL: Record<GbMode, string> = { off: '없음', scheduled: '예약', live: '진행중', ended: '종료' }
const MODE_BADGE: Record<GbMode, string> = {
  off: 'bg-gray-100 text-gray-500', scheduled: 'bg-amber-50 text-amber-600',
  live: 'bg-emerald-50 text-emerald-600', ended: 'bg-gray-100 text-gray-400',
}

// ISO ↔ datetime-local('YYYY-MM-DDTHH:MM') 변환(입력 편의).
function isoToLocal(iso?: string | null): string {
  if (!iso) return ''
  const d = String(iso).replace(' ', 'T')
  return d.length >= 16 ? d.slice(0, 16) : d
}

function EditForm({ row, onSaved }: { row: Row; onSaved: () => void }) {
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
            {discount > 0 && <span className="text-[10px] text-emerald-600">할인 {discount}%</span>}
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
          <label className="text-[12px] text-gray-600">마감 <span className="text-red-500">*</span>
            <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] text-gray-900" />
          </label>
          <label className="col-span-2 flex items-center gap-2 text-[12px] text-gray-700 mt-1">
            <input type="checkbox" checked={linkOnly} onChange={(e) => setLinkOnly(e.target.checked)} className="w-4 h-4" />
            <Link2 className="w-3.5 h-3.5" /> 링크 전용(gb_link_only) — 체크 시 ?ref 링크로만 공구가, 상시 노출은 상시가. 미체크=공구가로 통일
          </label>
        </>}
      </div>
      <div className="flex justify-end">
        <button type="button" disabled={busy} onClick={save} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-[13px] font-semibold disabled:opacity-50">저장</button>
      </div>
    </div>
  )
}

export default function AdminGbCockpitPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [gbEngine, setGbEngine] = useState<boolean | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get(`/api/admin/gb-cockpit/products${q ? `?q=${encodeURIComponent(q)}` : ''}`)
      if (r.data?.success) { setRows(r.data.data || []); setGbEngine(!!r.data.gb_engine) }
    } catch { toast.error('불러오기 실패') } finally { setLoading(false) }
  }, [q])
  useEffect(() => { void load() }, [load])

  return (
    <AdminLayout>
      <DashboardPageHeader icon={Rocket} title="공구 엔진 조종석" subtitle="상품별 공구(gb_mode) 설정 — 진행 상태·특가·마감·소개비율" />

      {gbEngine === false && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>공구 엔진 게이트가 <b>OFF</b>입니다(<code>gb_engine_enabled</code>). 지금 설정은 저장되지만 소비자/결제엔 <b>미적용</b> — 파일럿 검증 후 플랫폼 설정에서 켜면 활성화됩니다.</span>
        </div>
      )}

      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="상품명·매장명 검색" className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-[13px] text-gray-900" />
        </div>
        <button type="button" onClick={() => void load()} className="px-3 py-2 rounded-xl border border-gray-200 text-[13px] text-gray-700 flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" />새로고침</button>
      </div>

      {loading ? (
        <p className="text-[13px] text-gray-400 py-8 text-center">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-gray-400 py-8 text-center">상품이 없습니다.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-3">
              <button type="button" onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="w-full flex items-center gap-2 text-left">
                <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ${MODE_BADGE[r.gb_effective_status] || MODE_BADGE.off}`}>{MODE_LABEL[r.gb_effective_status] || '없음'}</span>
                <span className="flex-1 truncate text-[13px] font-semibold text-gray-900">{r.name}</span>
                {r.restaurant_name && <span className="shrink-0 text-[11px] text-gray-400 truncate max-w-[120px]">{r.restaurant_name}</span>}
                <span className="shrink-0 text-[12px] text-gray-500">{formatWon(r.price)}</span>
                {r.gb?.mode !== 'off' && r.gb?.price ? <span className="shrink-0 text-[11px] text-emerald-600 font-bold">공구 {formatWon(r.gb.price)}</span> : null}
              </button>
              {expanded === r.id && <EditForm row={r} onSaved={() => void load()} />}
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
