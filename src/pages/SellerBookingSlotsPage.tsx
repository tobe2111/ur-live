/**
 * 🛡️ 2026-05-21: 셀러 — 상품의 예약 가능 시간 슬롯 등록 / 관리.
 *   URL: /seller/products/:id/booking-slots
 *   카테고리: 뷰티/액티비티/건강/펫 등 sub-1day 예약 카테고리만 활성화.
 *
 * 흐름:
 *   1. 요일 7개 × 시간대 패턴 (예: 토 14:00-15:00 cap 2)
 *   2. 저장 시 자동으로 products.booking_required=1 설정
 *   3. 유저가 결제 후 슬롯 선택 → 자동 예약
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Calendar, Plus, Trash2 } from 'lucide-react'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

interface Slot {
  id: number
  day_of_week: number
  start_time: string
  end_time: string
  capacity: number
  is_active: number
}

interface NewSlot {
  day_of_week: number
  start_time: string
  end_time: string
  capacity: number
}

export default function SellerBookingSlotsPage() {
  const { id: productId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [newSlots, setNewSlots] = useState<NewSlot[]>([
    { day_of_week: 1, start_time: '10:00', end_time: '11:00', capacity: 1 },
  ])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('seller_token')) { navigate('/seller/login'); return }
    load()
  }, [productId])

  async function load() {
    try {
      setLoading(true)
      const res = await api.get(`/api/seller/products/${productId}/booking-slots`)
      if (res.data?.success) setSlots(res.data.data || [])
    } catch (e) {
      console.error('load slots', e)
    } finally {
      setLoading(false)
    }
  }

  async function submit() {
    const valid = newSlots.filter(s =>
      Number.isInteger(s.day_of_week) && s.day_of_week >= 0 && s.day_of_week <= 6
      && /^\d{2}:\d{2}$/.test(s.start_time) && /^\d{2}:\d{2}$/.test(s.end_time)
      && s.start_time < s.end_time && s.capacity >= 1
    )
    if (valid.length === 0) { toast.error('유효한 슬롯이 없습니다.'); return }
    try {
      setSubmitting(true)
      const res = await api.post(`/api/seller/products/${productId}/booking-slots`, { slots: valid })
      if (res.data?.success) {
        toast.success(`${res.data.data.inserted}개 슬롯 추가됨`)
        setNewSlots([{ day_of_week: 1, start_time: '10:00', end_time: '11:00', capacity: 1 }])
        load()
      } else {
        toast.error(res.data?.error || '저장 실패')
      }
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '저장 실패')
    } finally {
      setSubmitting(false)
    }
  }

  async function remove(slotId: number) {
    if (!confirm('이 슬롯을 삭제하시겠습니까?')) return
    try {
      await api.delete(`/api/seller/products/${productId}/booking-slots/${slotId}`)
      load()
    } catch {
      toast.error('삭제 실패')
    }
  }

  return (
    <SellerLayout title="예약 시간 관리">
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          icon={<Calendar className="h-5 w-5" />}
          title="예약 시간 관리"
          subtitle="고객이 결제 후 선택할 수 있는 가용 시간 슬롯을 요일별로 등록하세요."
        />

        {/* 기존 슬롯 목록 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-bold text-gray-900 mb-3">등록된 슬롯 ({slots.length}개)</h2>
          {loading ? (
            <p className="text-xs text-gray-400 py-6 text-center">불러오는 중...</p>
          ) : slots.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">아직 등록된 슬롯이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {slots.map(s => (
                <div key={s.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3 text-sm">
                    <span className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${s.day_of_week === 0 || s.day_of_week === 6 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                      {DAYS[s.day_of_week]}
                    </span>
                    <span className="font-mono text-gray-900">{s.start_time} ~ {s.end_time}</span>
                    <span className="text-xs text-gray-500">동시 {s.capacity}명</span>
                  </div>
                  <button onClick={() => remove(s.id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 신규 슬롯 추가 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-bold text-gray-900 mb-3">신규 슬롯 추가</h2>
          <div className="space-y-2">
            {newSlots.map((s, i) => (
              <div key={i} className="flex items-center gap-2 flex-wrap">
                <select
                  value={s.day_of_week}
                  onChange={e => setNewSlots(arr => arr.map((x, j) => j === i ? { ...x, day_of_week: Number(e.target.value) } : x))}
                  className="px-2 py-1.5 border border-gray-200 rounded text-sm text-gray-900 bg-white"
                >
                  {DAYS.map((d, idx) => <option key={idx} value={idx}>{d}요일</option>)}
                </select>
                <input
                  type="time"
                  value={s.start_time}
                  onChange={e => setNewSlots(arr => arr.map((x, j) => j === i ? { ...x, start_time: e.target.value } : x))}
                  className="px-2 py-1.5 border border-gray-200 rounded text-sm text-gray-900 bg-white w-28"
                />
                <span className="text-gray-400">~</span>
                <input
                  type="time"
                  value={s.end_time}
                  onChange={e => setNewSlots(arr => arr.map((x, j) => j === i ? { ...x, end_time: e.target.value } : x))}
                  className="px-2 py-1.5 border border-gray-200 rounded text-sm text-gray-900 bg-white w-28"
                />
                <span className="text-xs text-gray-500">동시</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={s.capacity}
                  onChange={e => setNewSlots(arr => arr.map((x, j) => j === i ? { ...x, capacity: Math.max(1, Number(e.target.value)) } : x))}
                  className="px-2 py-1.5 border border-gray-200 rounded text-sm text-gray-900 bg-white w-16"
                />
                <span className="text-xs text-gray-500">명</span>
                {newSlots.length > 1 && (
                  <button onClick={() => setNewSlots(arr => arr.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 ml-auto">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={() => setNewSlots(arr => [...arr, { day_of_week: 1, start_time: '10:00', end_time: '11:00', capacity: 1 }])}
              className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200"
            >
              <Plus className="w-3 h-3" /> 행 추가
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="ml-auto px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 disabled:opacity-50"
            >
              {submitting ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>

        <div className="text-xs text-gray-500">
          💡 한 슬롯에 여러 고객 동시 수용 가능 (예: 미용실 의자 3개 = 동시 3명).
          저장 시 자동으로 이 상품의 예약 시스템이 활성화됩니다.
        </div>
      </div>
    </SellerLayout>
  )
}
