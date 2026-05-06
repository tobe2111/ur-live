import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Eye, TrendingUp, Clock } from 'lucide-react'
import api from '@/lib/api'

interface StreamInfo {
  id: number
  title: string
  seller_name: string
  current_viewers: number
  current_product: {
    id: number
    name: string
    price: number
    image_url: string | null
  } | null
}

interface ScheduledStream {
  id: number
  title: string
  seller_name: string
  scheduled_at: string
}

function getStreamId(pathname: string): string | null {
  const m = pathname.match(/^\/live\/(\d+)/)
  return m ? m[1] : null
}

function pad(n: number) { return String(n).padStart(2, '0') }
function fmt(n: number) { return n.toLocaleString() }

function useCountdown(target: string | null) {
  const [left, setLeft] = useState<{ h: number; m: number } | null>(null)
  useEffect(() => {
    if (!target) return
    const tick = () => {
      const diff = new Date(target).getTime() - Date.now()
      if (diff <= 0) { setLeft({ h: 0, m: 0 }); return }
      const totalMins = Math.floor(diff / 60000)
      setLeft({ h: Math.floor(totalMins / 60), m: totalMins % 60 })
    }
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [target])
  return left
}

function ScheduledCard({ s }: { s: ScheduledStream }) {
  const navigate = useNavigate()
  const countdown = useCountdown(s.scheduled_at)
  const schedDate = s.scheduled_at ? new Date(s.scheduled_at) : null
  const timeLabel = schedDate
    ? schedDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true })
    : ''

  return (
    <button
      onClick={() => navigate(`/live/${s.id}`)}
      className="w-full text-left flex items-center gap-3 py-2.5 border-t border-[#1F1F1F] hover:bg-[#141414] transition-colors px-3 -mx-3"
    >
      <div className="text-[13px] font-extrabold text-[#EF4444] w-[52px] shrink-0 tabular-nums">
        {timeLabel}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-white leading-tight line-clamp-1">{s.title}</p>
        <p className="text-[10px] text-gray-500 mt-0.5">@{s.seller_name}</p>
      </div>
      {countdown && (
        <div className="text-[10px] text-gray-400 shrink-0">
          {countdown.h > 0 ? `${countdown.h}시간` : `${pad(countdown.m)}분 후`}
        </div>
      )}
    </button>
  )
}

export default function DesktopLiveLeftPanel() {
  const { pathname } = useLocation()
  const streamId = getStreamId(pathname)

  const [stream, setStream] = useState<StreamInfo | null>(null)
  const [viewers, setViewers] = useState<number | null>(null)
  const [scheduled, setScheduled] = useState<ScheduledStream[]>([])

  // 스트림 기본 정보 (1회)
  useEffect(() => {
    if (!streamId) return
    api.get(`/api/streams/${streamId}`)
      .then(r => { if (r.data?.success) setStream(r.data.data) })
      .catch(() => {})
  }, [streamId])

  // 시청자 수 폴링 (10초마다)
  useEffect(() => {
    if (!streamId) return
    const fetch = () =>
      api.get(`/api/streams/${streamId}/viewer-count`)
        .then(r => { if (r.data?.success) setViewers(r.data.data?.viewer_count ?? null) })
        .catch(() => {})
    fetch()
    const id = setInterval(fetch, 10000)
    return () => clearInterval(id)
  }, [streamId])

  // 예정 방송
  useEffect(() => {
    api.get('/api/home/bundle')
      .then(r => {
        if (r.data?.success) {
          const sched: ScheduledStream[] = (r.data.data?.scheduled ?? []).slice(0, 3)
          setScheduled(sched)
        }
      })
      .catch(() => {})
  }, [])

  // /live 목록 페이지이거나 streamId 없으면 숨김
  if (!streamId) return null

  const viewerDisplay = viewers ?? stream?.current_viewers ?? null

  return (
    <aside className="hidden xl:flex fixed left-56 top-14 bottom-0 z-30 w-[220px] flex-col bg-[#0A0A0A] border-r border-[#1F1F1F] overflow-y-auto">
      <div className="p-4 flex flex-col gap-4">

        {/* LIVE STATS */}
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3.5">
          <p className="text-[10px] font-bold text-gray-500 tracking-widest mb-3">LIVE STATS</p>

          {/* 시청자 수 */}
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            <div>
              <p className="text-[22px] font-black text-white leading-none tracking-tight">
                {viewerDisplay != null ? fmt(viewerDisplay) : '—'}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">현재 시청자</p>
            </div>
          </div>

          {/* 현재 상품 판매 진행 */}
          {stream?.current_product && (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-[#EF4444] shrink-0" />
                <p className="text-[10px] font-bold text-gray-500 tracking-widest">현재 상품</p>
              </div>
              <p className="text-[12px] font-semibold text-white line-clamp-2 leading-tight">
                {stream.current_product.name}
              </p>
              <p className="text-[13px] font-extrabold text-[#EF4444] mt-1">
                {fmt(stream.current_product.price)}원
              </p>
            </div>
          )}
        </div>

        {/* 진행자 */}
        {stream?.seller_name && (
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3.5">
            <p className="text-[10px] font-bold text-gray-500 tracking-widest mb-2.5">진행자</p>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full shrink-0 bg-gradient-to-br from-[#EF4444] to-[#EC4899]" />
              <div>
                <p className="text-[13px] font-bold text-white leading-tight">{stream.seller_name}</p>
                <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1 leading-tight">
                  {stream.title}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 다음 라이브 */}
        {scheduled.length > 0 && (
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3.5">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5 text-gray-500" />
              <p className="text-[10px] font-bold text-gray-500 tracking-widest">다음 라이브</p>
            </div>
            {scheduled.map(s => (
              <ScheduledCard key={s.id} s={s} />
            ))}
          </div>
        )}

      </div>
    </aside>
  )
}
