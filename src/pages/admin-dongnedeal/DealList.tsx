// 🧭 2026-07-01 (대표 — "기존 동네딜 수정/삭제"): 등록된 동네딜 목록 + 노출토글/수정/삭제.
//   GET /api/admin/dongnedeal/list · PATCH /dongnedeal/:id(is_active) · DELETE /products/:id.
//   🎯 2026-07-03 (대표 — "체크박스로 선택 삭제"): 다중 선택 + 일괄 삭제(단건 DELETE 를 순회 —
//   부속테이블 정리·주문이력 soft-retire 를 단건 엔드포인트가 이미 보장하므로 재사용).
//   라이트 테마(어드민, dark: 미사용).
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { cfImage } from '@/utils/cf-image'
import { formatNumber } from '@/utils/format'
import { Eye, EyeOff, Pencil, Trash2, MapPin, RefreshCw } from 'lucide-react'
import type { DealRow } from './types'
import { CAT_LABEL } from './types'

export default function DealList({ nonce, onEdit, onChanged }: { nonce: number; onEdit: (d: DealRow) => void; onChanged: () => void }) {
  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
  const [rows, setRows] = useState<DealRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  // 🎯 다중 선택(체크박스) — 선택된 product id 집합.
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  const load = () => {
    setLoading(true)
    api.get('/api/admin/dongnedeal/list?limit=100', h)
      .then((r) => { if (r.data?.success) setRows(r.data.data || []) })
      .catch(() => toast.error('목록 불러오기 실패'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { setSelected(new Set()); load() }, [nonce]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleActive = async (d: DealRow) => {
    setBusyId(d.id)
    try {
      await api.patch(`/api/admin/dongnedeal/${d.id}`, { is_active: d.is_active ? 0 : 1 }, h)
      setRows((prev) => prev.map((x) => (x.id === d.id ? { ...x, is_active: d.is_active ? 0 : 1 } : x)))
      onChanged()
    } catch { toast.error('상태 변경 실패') } finally { setBusyId(null) }
  }

  const remove = async (d: DealRow) => {
    if (!confirm(`"${d.name}" 동네딜을 삭제할까요? (되돌릴 수 없음)`)) return
    setBusyId(d.id)
    try {
      await api.delete(`/api/admin/products/${d.id}`, h)
      setRows((prev) => prev.filter((x) => x.id !== d.id))
      setSelected((prev) => { const n = new Set(prev); n.delete(d.id); return n })
      toast.success('삭제됨')
      onChanged()
    } catch { toast.error('삭제 실패') } finally { setBusyId(null) }
  }

  const toggleSelect = (id: number) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const allSelected = rows.length > 0 && rows.every((d) => selected.has(d.id))
  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(rows.map((d) => d.id)))
  }

  const removeSelected = async () => {
    const ids = rows.filter((d) => selected.has(d.id)).map((d) => d.id)
    if (ids.length === 0) return
    if (!confirm(`선택한 ${ids.length}개 동네딜을 삭제할까요? (되돌릴 수 없음 · 주문 이력이 있으면 자동으로 숨김 처리)`)) return
    setBulkBusy(true)
    // 단건 DELETE 순회 — 각 요청이 부속 데이터 정리 + 주문이력 시 soft-retire 를 이미 처리(엔드포인트 정책 재사용).
    const results = await Promise.allSettled(ids.map((id) => api.delete(`/api/admin/products/${id}`, h)))
    const okIds = new Set<number>()
    let failed = 0
    results.forEach((res, i) => { if (res.status === 'fulfilled') okIds.add(ids[i]); else failed++ })
    setRows((prev) => prev.filter((x) => !okIds.has(x.id)))
    setSelected(new Set())
    setBulkBusy(false)
    if (okIds.size > 0) toast.success(`${okIds.size}개 삭제됨${failed ? ` · ${failed}개 실패` : ''}`)
    else toast.error('삭제 실패')
    onChanged()
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-gray-900">등록된 동네딜 ({rows.length})</p>
          {selected.size > 0 && (
            <button
              onClick={removeSelected}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> {bulkBusy ? '삭제 중…' : `선택 삭제 (${selected.size})`}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {rows.length > 0 && (
            <label className="inline-flex items-center gap-1.5 text-[12px] text-gray-500 cursor-pointer select-none">
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="w-4 h-4 accent-gray-900" />
              전체 선택
            </label>
          )}
          <button onClick={load} className="inline-flex items-center gap-1 text-[12px] font-semibold text-gray-500 hover:text-gray-800">
            <RefreshCw className="w-3.5 h-3.5" /> 새로고침
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">아직 등록된 동네딜이 없습니다. 위에서 추가해보세요.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {rows.map((d) => (
            <div key={d.id} className={`flex items-center gap-3 py-2.5 ${selected.has(d.id) ? 'bg-red-50/40 -mx-2 px-2 rounded-lg' : ''}`}>
              <input
                type="checkbox"
                checked={selected.has(d.id)}
                onChange={() => toggleSelect(d.id)}
                className="w-4 h-4 accent-gray-900 shrink-0"
                aria-label={`${d.name} 선택`}
              />
              {d.image_url ? (
                <img src={cfImage(d.image_url, { width: 96, quality: 80, format: 'auto' }) || d.image_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-gray-100 shrink-0" loading="lazy" onError={(e) => { e.currentTarget.style.opacity = '0.25' }} />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 text-lg">🍽️</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={`text-[13px] font-bold truncate ${d.is_active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{d.name}</p>
                  <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">{CAT_LABEL[d.category] || d.category}</span>
                  {!d.is_active && <span className="text-[10px] font-bold text-amber-600 shrink-0">숨김</span>}
                </div>
                <p className="text-[11px] text-gray-500 truncate">
                  {formatNumber(d.price)}원{d.restaurant_name ? ` · ${d.restaurant_name}` : ''}
                  {d.restaurant_lat ? <span className="text-emerald-600"> · 📍지도</span> : <span className="text-amber-500"> · 좌표없음</span>}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => toggleActive(d)} disabled={busyId === d.id} title={d.is_active ? '숨기기' : '노출'} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-40">
                  {d.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button onClick={() => onEdit(d)} title="수정" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => remove(d)} disabled={busyId === d.id} title="삭제" className="p-2 rounded-lg hover:bg-red-50 text-red-500 disabled:opacity-40">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-[11px] text-gray-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> 좌표없음 = 지도 미표시(주소 지오코딩 대기). 수정에서 매장 검색으로 좌표 확보 가능.</p>
    </div>
  )
}
