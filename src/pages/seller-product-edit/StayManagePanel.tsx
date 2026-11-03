/**
 * 🛡️ 2026-05-18: 셀러 숙소 상세 — 객실 + 캘린더 관리 (PR 2/6).
 *
 * 3개 탭:
 *   1) 기본 정보 — 숙소 메타 수정 (체크인/취소정책/어메니티)
 *   2) 객실 — 객실 타입 CRUD (스탠다드/디럭스/스위트)
 *   3) 캘린더 — 객실별 날짜 가용 + 가격 override (Bulk UPSERT)
 */
import { useEffect, useState } from 'react'
import { confirmDialog, promptDialog } from '@/components/ui/confirm-dialog'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from '@/hooks/useToast'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { DashboardLoading } from '@/components/dashboard'
import { Building2, Bed, Calendar, ArrowLeft, Plus, Trash2, Save, ChevronLeft, ChevronRight, Ban, Edit, Link2 } from 'lucide-react'
import { MultiImageUpload } from '@/components/upload/ImageUpload'
import { formatNumber } from '@/utils/format'
import CalendarTab from './StayCalendarTab'

export interface StayRoom {
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

export interface CalendarRow {
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

/**
 * 🏨 숙소 관리 — 객실 · 달력 · 숙소 정보 (2026-11-03 대표 *"응 합쳐줘"* — 숙소 수정을 이용권 수정 화면 하나로)
 *
 * 종전엔 숙소 [수정] 이 5월에 만든 별도 화면(`/seller/stays/:id`, `SellerStayDetailPage`)으로 갔다 — 대표 사진·소개 같은
 * 이용권 공통 정보는 못 고치고, 모양도 옛 대시보드였다. 이제 이용권 수정 화면(`SellerProductEditPage`)이 숙소일 때 이 부품을
 * 아래에 붙인다. 이름·사진·소개·판매 상태는 위 공통 칸에서, 객실·날짜별 요금·체크인 정책은 여기서.
 * 옛 주소 `/seller/stays/:id` 는 이용권 수정으로 보낸다(라우트).
 */
export default function StayManagePanel({ productId }: { productId: number }) {
  const [tab, setTab] = useState<'rooms' | 'calendar' | 'info'>('rooms')
  // 🛡️ 2026-06-03 Tier2(대시보드): 수동 페칭 → useApiQuery (product+rooms+calendar 단일 응답).
  const stayQ = useApiQuery<{ product: StayInfo | null; rooms: StayRoom[]; calendar: CalendarRow[] }>(
    ['seller', 'stay-detail', productId], `/api/seller/stays/${productId}`,
    { enabled: Number.isFinite(productId) && productId > 0, select: (r: any) => ({ product: r?.success ? r.data.product : null, rooms: r?.success ? (r.data.rooms || []) : [], calendar: r?.success ? (r.data.calendar || []) : [] }) },
  )
  const info = stayQ.data?.product ?? null
  const rooms = stayQ.data?.rooms ?? []
  const calendar = stayQ.data?.calendar ?? []
  const loadAll = () => stayQ.refetch()

  if (stayQ.isLoading) return <DashboardLoading />
  if (!info) return <div className="bg-white rounded-xl border border-gray-200 p-6 text-sm text-gray-500">숙소 정보가 아직 없어요. 등록 때 객실 저장이 실패했다면 아래 [객실] 에서 다시 넣어 주세요.</div>

  return (
    <section className="space-y-4" data-stay-manage>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900">숙소 관리</h2>
        <ShareLinkButton productId={productId} />
      </div>
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { key: 'rooms' as const, label: `객실 (${rooms.length})`, icon: <Bed className="w-4 h-4" /> },
          { key: 'calendar' as const, label: '달력', icon: <Calendar className="w-4 h-4" /> },
          { key: 'info' as const, label: '체크인·정책', icon: <Building2 className="w-4 h-4" /> },
        ].map((tb) => (
          <button key={tb.key} type="button" onClick={() => setTab(tb.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${tab === tb.key ? 'border-brand text-brand-text' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {tb.icon} {tb.label}
          </button>
        ))}
      </div>
      {tab === 'info' && <InfoTab info={info} productId={productId} onSaved={loadAll} />}
      {tab === 'rooms' && <RoomsTab productId={productId} rooms={rooms} onChanged={loadAll} />}
      {tab === 'calendar' && <CalendarTab productId={productId} rooms={rooms} calendar={calendar} onChanged={loadAll} />}
    </section>
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
        className="ur-btn ur-btn-md ur-btn-primary inline-flex items-center gap-1.5 disabled:opacity-50"
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
          className="ur-btn ur-btn-sm ur-btn-primary inline-flex items-center gap-1.5"
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
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  ><Edit className="w-4 h-4" /></button>
                  <RoomDeleteButton productId={productId} roomId={r.id} onDeleted={onChanged} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-gray-50 rounded">
                  <p className="text-gray-500">평일</p>
                  <p className="font-bold text-gray-900">₩{formatNumber(r.base_price_weekday)}</p>
                </div>
                <div className="p-2 border border-rule bg-white rounded">
                  <p className="text-tone-warn">주말</p>
                  <p className="font-bold text-gray-900">₩{formatNumber(r.base_price_weekend)}</p>
                </div>
              </div>
              {!r.is_active && (
                <p className="text-[10px] text-tone-bad mt-2 font-semibold">⊘ 비활성</p>
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
    if (!(await confirmDialog({ message: '이 객실을 삭제하시겠습니까? (활성 예약 있을 시 차단됨)', danger: true }))) return
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
      className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-tone-bad disabled:opacity-50"
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
    <div className="fixed inset-0 z-[10500] bg-black/50 backdrop-blur-sm p-4 flex items-start justify-center overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-[var(--dash-radius,16px)] w-full max-w-2xl my-8 p-6" onClick={(e) => e.stopPropagation()}>
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
          <button type="button" onClick={onClose} disabled={saving} className="ur-btn ur-btn-md ur-btn-secondary flex-1">취소</button>
          <button type="button" onClick={submit} disabled={saving} className="ur-btn ur-btn-md ur-btn-primary flex-1 disabled:opacity-50">
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
      toast.success('소개 링크를 복사했어요. 소개해 줄 분에게 공유하세요')
    } catch {
      toast.error('링크 복사 실패')
    }
  }
  return (
    <button
      type="button"
      onClick={copyLink}
      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-brand-tint text-brand-text text-xs font-semibold rounded-lg hover:bg-brand-tint"
      title="이 숙소의 소개 링크 복사"
    >
      <Link2 className="h-3.5 w-3.5" /> 소개 링크
    </button>
  )
}
