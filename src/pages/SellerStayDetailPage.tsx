/**
 * 🛡️ 2026-05-18: 셀러 숙소 상세 — 객실 + 캘린더 관리 (PR 2/6).
 *
 * 3개 탭:
 *   1) 기본 정보 — 숙소 메타 수정 (체크인/취소정책/어메니티)
 *   2) 객실 — 객실 타입 CRUD (스탠다드/디럭스/스위트)
 *   3) 캘린더 — 객실별 날짜 가용 + 가격 override (Bulk UPSERT)
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from '@/hooks/useToast'
import api from '@/lib/api'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader, DashboardLoading } from '@/components/dashboard'
import { Building2, Bed, Calendar, ArrowLeft, Plus, Trash2, Save, ChevronLeft, ChevronRight, Ban, Edit } from 'lucide-react'
import { MultiImageUpload } from '@/components/upload/ImageUpload'
import { formatNumber } from '@/utils/format'

interface StayRoom {
  id: number
  product_id: number
  name: string
  description: string | null
  display_order: number
  base_guests: number
  max_guests: number
  extra_guest_fee: number
  bed_config: string | null
  room_size_sqm: number | null
  base_price_weekday: number
  base_price_weekend: number
  base_price_holiday: number | null
  total_inventory: number
  amenities: string | null
  image_urls: string | null
  is_active: number
}

interface CalendarRow {
  id: number
  room_id: number
  product_id: number
  stay_date: string
  available_count: number
  price_override: number | null
  is_blocked: number
  blocked_reason: string | null
}

interface StayInfo {
  id: number
  name: string
  property_type: string
  star_rating: number | null
  region_sido: string
  region_sigungu: string
  check_in_time: string
  check_out_time: string
  cancellation_policy: string
  min_nights: number
  advance_booking_days: number
  is_active: number
}

export default function SellerStayDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const productId = Number(id)

  const [tab, setTab] = useState<'info' | 'rooms' | 'calendar'>('info')
  const [loading, setLoading] = useState(true)
  const [info, setInfo] = useState<StayInfo | null>(null)
  const [rooms, setRooms] = useState<StayRoom[]>([])
  const [calendar, setCalendar] = useState<CalendarRow[]>([])

  useEffect(() => {
    const token = localStorage.getItem('seller_token')
    if (!token) { navigate('/seller/login'); return }
    if (!Number.isFinite(productId)) { navigate('/seller/stays'); return }
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  async function loadAll() {
    setLoading(true)
    try {
      const token = localStorage.getItem('seller_token')
      const res = await api.get(`/api/seller/stays/${productId}`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.data?.success) {
        setInfo(res.data.data.product as StayInfo)
        setRooms((res.data.data.rooms as StayRoom[]) || [])
        setCalendar((res.data.data.calendar as CalendarRow[]) || [])
      }
    } catch {
      toast.error('로딩 실패')
    } finally { setLoading(false) }
  }

  if (loading) return <SellerLayout title="숙소"><DashboardLoading /></SellerLayout>
  if (!info) return <SellerLayout title="숙소"><div className="p-8 text-center text-gray-500">숙소 정보를 불러올 수 없습니다</div></SellerLayout>

  return (
    <SellerLayout title={info.name}>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title={info.name}
          subtitle={`${info.region_sido} ${info.region_sigungu} · 체크인 ${info.check_in_time} / 체크아웃 ${info.check_out_time}`}
          icon={<Building2 className="h-5 w-5" />}
          actions={
            <div className="flex items-center gap-2">
              <ShareLinkButton productId={productId} />
              <button
                type="button"
                onClick={() => navigate('/seller/stays')}
                className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-3.5 h-3.5" />목록
              </button>
            </div>
          }
        />

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          {[
            { key: 'info' as const, label: '기본 정보', icon: <Building2 className="w-4 h-4" /> },
            { key: 'rooms' as const, label: `객실 (${rooms.length})`, icon: <Bed className="w-4 h-4" /> },
            { key: 'calendar' as const, label: '캘린더', icon: <Calendar className="w-4 h-4" /> },
          ].map((tb) => (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                tab === tb.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tb.icon} {tb.label}
            </button>
          ))}
        </div>

        {tab === 'info' && <InfoTab info={info} productId={productId} onSaved={loadAll} />}
        {tab === 'rooms' && <RoomsTab productId={productId} rooms={rooms} onChanged={loadAll} />}
        {tab === 'calendar' && <CalendarTab productId={productId} rooms={rooms} calendar={calendar} onChanged={loadAll} />}
      </div>
    </SellerLayout>
  )
}

// ─── Info Tab ─────────────────────────────────────────────────────────────
function InfoTab({ info, productId, onSaved }: { info: StayInfo; productId: number; onSaved: () => void }) {
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState(info)

  async function save() {
    setSaving(true)
    try {
      const token = localStorage.getItem('seller_token')
      const res = await api.put(`/api/seller/stays/${productId}`, f, { headers: { Authorization: `Bearer ${token}` } })
      if (res.data?.success) { toast.success('저장됨'); onSaved() }
    } catch { toast.error('저장 실패') } finally { setSaving(false) }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">숙소명</label>
          <input
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">최소 숙박 박수</label>
          <input
            type="number"
            min={1}
            value={f.min_nights}
            onChange={(e) => setF({ ...f, min_nights: Number(e.target.value) || 1 })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">체크인 시간</label>
          <input
            type="time"
            value={f.check_in_time}
            onChange={(e) => setF({ ...f, check_in_time: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">체크아웃 시간</label>
          <input
            type="time"
            value={f.check_out_time}
            onChange={(e) => setF({ ...f, check_out_time: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        <Save className="w-3.5 h-3.5" /> {saving ? '저장 중...' : '저장'}
      </button>
    </div>
  )
}

// ─── Rooms Tab ────────────────────────────────────────────────────────────
function RoomsTab({ productId, rooms, onChanged }: { productId: number; rooms: StayRoom[]; onChanged: () => void }) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<StayRoom | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-3.5 h-3.5" /> 객실 추가
        </button>
      </div>

      {rooms.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <Bed className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">객실이 없습니다 — 첫 객실을 추가하세요</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {rooms.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{r.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {r.bed_config && `${r.bed_config} · `}
                    {r.base_guests}-{r.max_guests}인 · 재고 {r.total_inventory}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => { setEditing(r); setShowForm(true) }}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                  ><Edit className="w-4 h-4" /></button>
                  <RoomDeleteButton productId={productId} roomId={r.id} onDeleted={onChanged} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-gray-50 rounded">
                  <p className="text-gray-500">평일</p>
                  <p className="font-bold text-gray-900">₩{formatNumber(r.base_price_weekday)}</p>
                </div>
                <div className="p-2 bg-amber-50 rounded">
                  <p className="text-amber-700">주말</p>
                  <p className="font-bold text-gray-900">₩{formatNumber(r.base_price_weekend)}</p>
                </div>
              </div>
              {!r.is_active && (
                <p className="text-[10px] text-red-600 mt-2 font-semibold">⊘ 비활성</p>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <RoomFormModal
          productId={productId}
          room={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); onChanged() }}
        />
      )}
    </div>
  )
}

function RoomDeleteButton({ productId, roomId, onDeleted }: { productId: number; roomId: number; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false)
  async function del() {
    if (!confirm('이 객실을 삭제하시겠습니까? (활성 예약 있을 시 차단됨)')) return
    setBusy(true)
    try {
      const token = localStorage.getItem('seller_token')
      const res = await api.delete(`/api/seller/stays/${productId}/rooms/${roomId}`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.data?.success) { toast.success('삭제됨'); onDeleted() }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '삭제 실패')
    } finally { setBusy(false) }
  }
  return (
    <button
      type="button"
      onClick={del}
      disabled={busy}
      className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
    ><Trash2 className="w-4 h-4" /></button>
  )
}

function RoomFormModal({ productId, room, onClose, onSaved }: {
  productId: number; room: StayRoom | null; onClose: () => void; onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState({
    name: room?.name || '',
    description: room?.description || '',
    base_guests: room?.base_guests || 2,
    max_guests: room?.max_guests || 2,
    extra_guest_fee: room?.extra_guest_fee || 0,
    bed_config: room?.bed_config || '',
    room_size_sqm: room?.room_size_sqm ?? '',
    base_price_weekday: room?.base_price_weekday || 0,
    base_price_weekend: room?.base_price_weekend || 0,
    base_price_holiday: room?.base_price_holiday ?? '',
    total_inventory: room?.total_inventory || 1,
    image_urls: ((): string[] => {
      if (!room?.image_urls) return []
      try { const v = JSON.parse(room.image_urls); return Array.isArray(v) ? v : [] } catch { return [] }
    })(),
    is_active: room?.is_active ?? 1,
  })

  async function submit() {
    if (!f.name.trim()) { toast.error('객실명 필수'); return }
    if (!f.base_price_weekday || !f.base_price_weekend) { toast.error('평일/주말 가격 필수'); return }
    setSaving(true)
    try {
      const token = localStorage.getItem('seller_token')
      const payload = {
        ...f,
        room_size_sqm: f.room_size_sqm === '' ? null : Number(f.room_size_sqm),
        base_price_holiday: f.base_price_holiday === '' ? null : Number(f.base_price_holiday),
        image_urls: f.image_urls,
      }
      const url = room
        ? `/api/seller/stays/${productId}/rooms/${room.id}`
        : `/api/seller/stays/${productId}/rooms`
      const method = room ? 'put' : 'post'
      const res = await api[method](url, payload, { headers: { Authorization: `Bearer ${token}` } })
      if (res.data?.success) { toast.success(room ? '수정됨' : '추가됨'); onSaved() }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '저장 실패')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm p-4 flex items-start justify-center overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl my-8 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 mb-4">{room ? '객실 수정' : '객실 추가'}</h3>
        <div className="space-y-3">
          <Inp label="객실명 *" value={f.name} onChange={(v) => setF({ ...f, name: v as string })} placeholder="스탠다드 더블" />
          <Inp label="설명" value={f.description} onChange={(v) => setF({ ...f, description: v as string })} />
          <div className="grid grid-cols-3 gap-2">
            <Inp label="기준 인원" type="number" value={f.base_guests} onChange={(v) => setF({ ...f, base_guests: Number(v) || 1 })} />
            <Inp label="최대 인원" type="number" value={f.max_guests} onChange={(v) => setF({ ...f, max_guests: Number(v) || 1 })} />
            <Inp label="추가 1인 요금" type="number" value={f.extra_guest_fee} onChange={(v) => setF({ ...f, extra_guest_fee: Number(v) || 0 })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Inp label="침대 구성" value={f.bed_config} onChange={(v) => setF({ ...f, bed_config: v as string })} placeholder="퀸 1 + 싱글 1" />
            <Inp label="면적 (㎡)" type="number" value={f.room_size_sqm} onChange={(v) => setF({ ...f, room_size_sqm: v as number })} placeholder="25" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Inp label="평일 가격 *" type="number" value={f.base_price_weekday} onChange={(v) => setF({ ...f, base_price_weekday: Number(v) || 0 })} />
            <Inp label="주말 가격 *" type="number" value={f.base_price_weekend} onChange={(v) => setF({ ...f, base_price_weekend: Number(v) || 0 })} />
            <Inp label="공휴일 가격" type="number" value={f.base_price_holiday} onChange={(v) => setF({ ...f, base_price_holiday: v as number })} placeholder="(주말과 동일)" />
          </div>
          <Inp label="객실 재고 (이 타입 총 객실 수)" type="number" value={f.total_inventory} onChange={(v) => setF({ ...f, total_inventory: Number(v) || 1 })} />
          <MultiImageUpload
            label="객실 이미지 (최대 10장, 첫 번째 대표)"
            values={f.image_urls}
            onChange={(urls) => setF({ ...f, image_urls: urls })}
            tokenKey="seller_token"
            max={10}
          />
        </div>
        <div className="flex gap-2 mt-5">
          <button type="button" onClick={onClose} disabled={saving} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 disabled:opacity-50">취소</button>
          <button type="button" onClick={submit} disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? '저장 중...' : (room ? '수정' : '추가')}
          </button>
        </div>
      </div>
    </div>
  )
}

function Inp({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string | number; onChange: (v: string | number) => void; type?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={value as string | number}
        onChange={(e) => onChange(type === 'number' ? e.target.value : e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
      />
    </div>
  )
}

// ─── Calendar Tab ─────────────────────────────────────────────────────────
function CalendarTab({ productId, rooms, calendar, onChanged }: {
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

  function applyBulkInventory() {
    const v = prompt(`이번 달 모든 날짜에 적용할 잔여 객실 수 (현재 재고 ${room.total_inventory}):`, String(room.total_inventory))
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
              activeRoomId === r.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
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
          {Object.keys(edits).length > 0 && <span className="text-xs text-blue-600 ml-2">· 미저장 {Object.keys(edits).length}일</span>}
        </p>
        <button type="button" onClick={() => setMonthOffset((o) => o + 1)} className="p-1.5 rounded hover:bg-gray-100">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={applyBulkInventory} className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
          이번 달 일괄 재고 적용
        </button>
        <button type="button" onClick={saveBulk} disabled={saving || Object.keys(edits).length === 0} className="ml-auto text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1">
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
                onClick={() => {
                  if (past) return
                  const ds = eff.ds
                  const cur = effectiveFor(cell)
                  // 클릭 사이클: 가용 → 차단 → 가용 복귀.
                  if (cur.is_blocked) {
                    updateDay(ds, { is_blocked: false, available_count: room.total_inventory })
                  } else {
                    const newPrice = prompt(`${ds} 가격 (비워두면 ${isWeekend ? '주말' : '평일'} ${formatNumber(priceFor(cell))}원), 잔여 수 / 차단:`, String(price))
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
                  eff.is_blocked ? 'bg-red-50 border-red-200 hover:bg-red-100' :
                  eff.hasEdit ? 'bg-blue-50 border-blue-300 hover:bg-blue-100' :
                  'bg-white border-gray-200 hover:border-blue-300'
                }`}
              >
                <p className={`text-[10px] font-bold ${isWeekend && !past && !eff.is_blocked ? 'text-amber-600' : ''}`}>{cell.getDate()}</p>
                {!past && (
                  <>
                    {eff.is_blocked ? (
                      <div className="text-[8px] font-bold text-red-600 mt-1">차단</div>
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

// 🛡️ 2026-05-18: 인플 / 셀러 본인 공유용 referral 링크 복사 버튼.
function ShareLinkButton({ productId }: { productId: number }) {
  async function copyLink() {
    try {
      const token = localStorage.getItem('seller_token')
      const r = await api.get(`/api/affiliate/link/stay/${productId}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      const url = r.data?.data?.url
      if (!url) { toast.error('링크 생성 실패'); return }
      await navigator.clipboard.writeText(url)
      toast.success('🔗 referral 링크 복사 완료 — 인플루언서에게 공유')
    } catch {
      toast.error('링크 복사 실패')
    }
  }
  return (
    <button
      type="button"
      onClick={copyLink}
      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-pink-50 text-pink-700 text-xs font-semibold rounded-lg hover:bg-pink-100"
      title="이 숙소의 인플루언서 추천 링크 복사"
    >
      🔗 referral 링크
    </button>
  )
}
