// 🧭 2026-07-01 (대표 — "기존 동네딜 수정/삭제"): 등록된 동네딜 목록 + 노출토글/수정/삭제.
//   GET /api/admin/dongnedeal/list · PATCH /dongnedeal/:id(is_active) · DELETE /products/:id.
//   라이트 테마(어드민, dark: 미사용).
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { Eye, EyeOff, Pencil, Trash2, MapPin, RefreshCw } from 'lucide-react'
import type { DealRow } from './types'
import { CAT_LABEL } from './types'

export default function DealList({ nonce, onEdit, onChanged }: { nonce: number; onEdit: (d: DealRow) => void; onChanged: () => void }) {
  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
  const [rows, setRows] = useState<DealRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    api.get('/api/admin/dongnedeal/list?limit=100', h)
      .then((r) => { if (r.data?.success) setRows(r.data.data || []) })
      .catch(() => toast.error('목록 불러오기 실패'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [nonce]) // eslint-disable-line react-hooks/exhaustive-deps

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
      toast.success('삭제됨')
      onChanged()
    } catch { toast.error('삭제 실패') } finally { setBusyId(null) }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-gray-900">등록된 동네딜 ({rows.length})</p>
        <button onClick={load} className="inline-flex items-center gap-1 text-[12px] font-semibold text-gray-500 hover:text-gray-800">
          <RefreshCw className="w-3.5 h-3.5" /> 새로고침
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">아직 등록된 동네딜이 없습니다. 위에서 추가해보세요.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {rows.map((d) => (
            <div key={d.id} className="flex items-center gap-3 py-2.5">
              {d.image_url ? (
                <img src={d.image_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-gray-100 shrink-0" loading="lazy" onError={(e) => { e.currentTarget.style.opacity = '0.25' }} />
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
