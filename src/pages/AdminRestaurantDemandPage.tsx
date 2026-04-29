/**
 * Admin 수요 신호 대시보드 — 카카오 일반 맛집 → 셀러 영입 우선순위.
 *
 * GET /api/restaurant-suggestions/stats — kakao_place_id 별 집계.
 * 사용자가 회색 핀 (식사권 미출시) 클릭 후 영입/알림 신청한 매장 top N.
 *
 * 🛡️ 2026-04-28: restaurant-map 옵션 B 의 admin 대시보드.
 */
import { useEffect, useState, useCallback } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { TrendingUp, MapPin, Phone, Bell, Handshake, RefreshCw, Navigation } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface SuggestionStat {
  kakao_place_id: string
  place_name: string
  category_name: string | null
  road_address: string | null
  phone: string | null
  lat: number
  lng: number
  suggestion_count: number
  invite_count: number
  notify_count: number
  latest_at: string
}

export default function AdminRestaurantDemandPage() {
  const [items, setItems] = useState<SuggestionStat[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'invite' | 'notify'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('admin_token')
      const r = await api.get('/api/restaurant-suggestions/stats', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (r.data?.success) setItems(r.data.data || [])
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || '데이터 로드 실패')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = items.filter(i => {
    if (filter === 'invite') return i.invite_count > 0
    if (filter === 'notify') return i.notify_count > 0
    return true
  })

  const totalInvite = items.reduce((s, i) => s + i.invite_count, 0)
  const totalNotify = items.reduce((s, i) => s + i.notify_count, 0)

  return (
    <AdminLayout title="맛집 수요 신호">
      <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="맛집 수요 신호"
          subtitle="사용자가 식사권을 원하는 매장 — 셀러 영입 우선순위"
          icon={<TrendingUp className="h-5 w-5" />}
          actions={
            <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
              <RefreshCw className="w-3.5 h-3.5" /> 새로고침
            </button>
          }
        />

        {/* 요약 카드 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
            <p className="text-2xl font-bold text-blue-600">{items.length}</p>
            <p className="text-xs text-gray-500 mt-1">신호 받은 매장</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
            <p className="text-2xl font-bold text-purple-600">{totalInvite}</p>
            <p className="text-xs text-gray-500 mt-1">셀러 영입 신청</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
            <p className="text-2xl font-bold text-pink-600">{totalNotify}</p>
            <p className="text-xs text-gray-500 mt-1">출시 알림 등록</p>
          </div>
        </div>

        {/* 필터 칩 */}
        <div className="flex gap-2">
          {([
            { key: 'all', label: '전체' },
            { key: 'invite', label: '셀러 영입 우선' },
            { key: 'notify', label: '알림 등록' },
          ] as const).map(f => (
            <button key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-full text-xs font-semibold border transition-colors ${
                filter === f.key
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* 리스트 */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-900 font-bold">아직 수요 신호가 없어요</p>
            <p className="text-sm text-gray-500 mt-1">사용자가 카카오 일반 맛집 핀을 클릭해 신청하면 여기에 표시됩니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((it, idx) => (
              <div key={it.kakao_place_id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                <span className="text-xl font-extrabold w-8 shrink-0 text-gray-300">{idx + 1}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-sm font-bold text-gray-900 truncate">{it.place_name}</h3>
                    {it.category_name && (
                      <span className="text-[10px] text-gray-500 shrink-0">
                        {it.category_name.split('>').slice(-1)[0]?.trim()}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {it.road_address || '주소 미상'}
                    {it.phone && (
                      <>
                        <span className="text-gray-300">·</span>
                        <Phone className="w-3 h-3" />
                        <a href={`tel:${it.phone}`} className="text-blue-600 hover:underline">{it.phone}</a>
                      </>
                    )}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    최근: {new Date(it.latest_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                {/* 신호 카운트 */}
                <div className="flex items-center gap-2 shrink-0">
                  {it.invite_count > 0 && (
                    <span className="flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded-md text-xs font-bold">
                      <Handshake className="w-3 h-3" /> {it.invite_count}
                    </span>
                  )}
                  {it.notify_count > 0 && (
                    <span className="flex items-center gap-1 px-2 py-1 bg-pink-50 text-pink-700 rounded-md text-xs font-bold">
                      <Bell className="w-3 h-3" /> {it.notify_count}
                    </span>
                  )}
                  <a
                    href={`https://map.kakao.com/link/to/${encodeURIComponent(it.place_name)},${it.lat},${it.lng}`}
                    target="_blank" rel="noopener noreferrer"
                    aria-label="카카오맵 길찾기"
                    className="p-1.5 bg-[#FEE500] text-[#3C1E1E] rounded-md"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-xs text-gray-400 pt-4 border-t border-gray-100">
          <p>💡 <strong>활용 팁</strong></p>
          <ul className="mt-1 space-y-0.5 list-disc list-inside">
            <li>셀러 영입 신청 (보라색) 이 많은 매장 → 영입 영업 우선</li>
            <li>알림 등록 (분홍) 이 많은 매장 → 출시 시 즉시 알림 발송 가능 (앞으로 자동화)</li>
            <li>전화번호 있는 매장 → 직접 연락 가능</li>
          </ul>
        </div>
      </div>
    </AdminLayout>
  )
}
