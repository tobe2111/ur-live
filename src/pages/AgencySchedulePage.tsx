import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import AgencyLayout from '@/components/AgencyLayout'
import { ChevronLeft, ChevronRight, Play, Clock, Loader2 } from 'lucide-react'

export default function AgencySchedulePage() {
  const navigate = useNavigate()
  const [streams, setStreams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const token = localStorage.getItem('agency_token')
  const headers = { Authorization: `Bearer ${token || ''}` }

  useEffect(() => {
    if (!token) {
      navigate('/agency/login', { replace: true })
    }
  }, [token, navigate])

  useEffect(() => {
    api.get('/api/agency/schedule', { headers })
      .then(r => { if (r.data.success) setStreams(r.data.data || []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  const getStreamsForDay = (day: number) => {
    return streams.filter(s => {
      const d = new Date(s.scheduled_at || s.created_at)
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
    })
  }

  const days = ['일', '월', '화', '수', '목', '금', '토']

  return (
    <AgencyLayout title="방송 캘린더">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">방송 캘린더</h1>
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft className="w-5 h-5" /></button>
            <span className="text-sm font-bold text-gray-900 min-w-[120px] text-center">
              {year}년 {month + 1}월
            </span>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight className="w-5 h-5" /></button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
        ) : (
          <>
            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 mb-1">
              {days.map(d => (
                <div key={d} className={`text-center text-xs font-medium py-2 ${d === '일' ? 'text-red-400' : d === '토' ? 'text-blue-400' : 'text-gray-500'}`}>
                  {d}
                </div>
              ))}
            </div>

            {/* 캘린더 그리드 */}
            <div className="grid grid-cols-7 border-t border-l border-gray-200">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="border-r border-b border-gray-200 min-h-[100px] bg-gray-50" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dayStreams = getStreamsForDay(day)
                const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
                const dayOfWeek = (firstDay + i) % 7
                return (
                  <div key={day} className={`border-r border-b border-gray-200 min-h-[100px] p-1.5 ${isToday ? 'bg-blue-50' : 'bg-white'}`}>
                    <span className={`text-xs font-medium inline-block w-6 h-6 rounded-full text-center leading-6 ${
                      isToday ? 'bg-blue-600 text-white' : dayOfWeek === 0 ? 'text-red-400' : dayOfWeek === 6 ? 'text-blue-400' : 'text-gray-700'
                    }`}>{day}</span>
                    <div className="mt-1 space-y-0.5">
                      {dayStreams.slice(0, 3).map((s: { id: number; status: string; scheduled_at?: string; created_at: string; seller_name: string; title: string }) => {
                        const isLive = s.status === 'live'
                        const time = new Date(s.scheduled_at || s.created_at)
                        return (
                          <div key={s.id} className={`text-[10px] px-1.5 py-0.5 rounded truncate ${
                            isLive ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                          }`} title={`${s.seller_name}: ${s.title}`}>
                            {isLive ? <Play className="w-2.5 h-2.5 inline mr-0.5" /> : <Clock className="w-2.5 h-2.5 inline mr-0.5" />}
                            {time.getHours().toString().padStart(2, '0')}:{time.getMinutes().toString().padStart(2, '0')} {s.seller_name}
                          </div>
                        )
                      })}
                      {dayStreams.length > 3 && (
                        <p className="text-[10px] text-gray-400 pl-1">+{dayStreams.length - 3}개</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 오늘의 방송 리스트 */}
            {(() => {
              const todayStreams = getStreamsForDay(today.getDate())
              if (year !== today.getFullYear() || month !== today.getMonth() || todayStreams.length === 0) return null
              return (
                <div className="mt-6">
                  <h2 className="text-sm font-bold text-gray-900 mb-3">오늘의 방송</h2>
                  <div className="space-y-2">
                    {todayStreams.map((s: { id: number; status: string; scheduled_at?: string; created_at: string; seller_name: string; title: string }) => (
                      <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.status === 'live' ? 'bg-red-50' : 'bg-blue-50'}`}>
                          {s.status === 'live' ? <Play className="w-4 h-4 text-red-500" /> : <Clock className="w-4 h-4 text-blue-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{s.title}</p>
                          <p className="text-xs text-gray-500">{s.seller_name} · {new Date(s.scheduled_at || s.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </>
        )}
      </div>
    </AgencyLayout>
  )
}
