import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Eye, Clock } from 'lucide-react'
import api from '@/lib/api'
import { useStreamStore } from '@/shared/stores/useStreamStore'
import { safeDate } from '@/utils/safe-date'

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

function fmt(n: number) { return n.toLocaleString() }

function ScheduledCard({ s }: { s: ScheduledStream }) {
  const navigate = useNavigate()
  const schedDate = safeDate(s.scheduled_at)
  const timeLabel = schedDate
    ? schedDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true })
    : ''
  const minsLeft = schedDate
    ? Math.max(0, Math.floor((schedDate.getTime() - Date.now()) / 60000))
    : null

  return (
    <button
      onClick={() => navigate(`/live/${s.id}`)}
      className="w-full text-left flex items-center gap-3 py-2.5 border-t border-[#1F1F1F] hover:bg-[#141414] transition-colors"
    >
      <div className="text-[13px] font-extrabold text-[#EF4444] w-[52px] shrink-0 tabular-nums">
        {timeLabel}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-white leading-tight line-clamp-1">{s.title}</p>
        <p className="text-[10px] text-gray-500 mt-0.5">@{s.seller_name}</p>
      </div>
      {minsLeft != null && (
        <span className="text-[10px] text-gray-400 shrink-0">
          {minsLeft >= 60 ? `${Math.floor(minsLeft / 60)}시간` : `${minsLeft}분 후`}
        </span>
      )}
    </button>
  )
}

export default function DesktopLiveLeftPanel() {
  const { pathname } = useLocation()
  const streamId = getStreamId(pathname)
  const [scheduled, setScheduled] = useState<ScheduledStream[]>([])

  // 스토어에서 읽기 (ReelCard가 쓴 데이터)
  const viewerCount = useStreamStore(s => s.viewerCount)
  const title = useStreamStore(s => s.title)
  const sellerName = useStreamStore(s => s.sellerName)
  const currentProductId = useStreamStore(s => s.currentProductId)
  const products = useStreamStore(s => s.products)

  const currentProduct = products.find(p => p.id === currentProductId) ?? null

  // 예정 방송 (스트림 무관, 별도 fetch)
  useEffect(() => {
    api.get('/api/home/bundle')
      .then(r => {
        if (r.data?.success) {
          setScheduled((r.data.data?.scheduled ?? []).slice(0, 3))
        }
      })
      .catch((e) => { if (import.meta.env.DEV) console.warn('[DesktopLiveLeftPanel] scheduled fetch:', e?.message || e) })
  }, [])

  if (!streamId) return null

  return (
    <aside className="hidden xl:flex fixed left-56 top-14 bottom-0 z-30 w-[220px] flex-col bg-[#0A0A0A] border-r border-[#1F1F1F] overflow-y-auto">
      <div className="p-4 flex flex-col gap-4">

        {/* LIVE STATS */}
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3.5">
          <p className="text-[10px] font-bold text-gray-500 tracking-widest mb-3">LIVE STATS</p>

          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            <div>
              <p className="text-[22px] font-black text-white leading-none tracking-tight tabular-nums">
                {fmt(viewerCount)}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">현재 시청자</p>
            </div>
          </div>

          {currentProduct && (
            <div className="pt-3 border-t border-[#1F1F1F]">
              <p className="text-[10px] font-bold text-gray-500 tracking-widest mb-1.5">현재 상품</p>
              <p className="text-[12px] font-semibold text-white line-clamp-2 leading-tight">
                {currentProduct.name}
              </p>
              <p className="text-[13px] font-extrabold text-[#EF4444] mt-1">
                {fmt(currentProduct.price)}원
              </p>
            </div>
          )}
        </div>

        {/* 진행자 */}
        {(sellerName || title) && (
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3.5">
            <p className="text-[10px] font-bold text-gray-500 tracking-widest mb-2.5">진행자</p>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full shrink-0 bg-gradient-to-br from-[#EF4444] to-[#EC4899]" />
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-white leading-tight truncate">{sellerName}</p>
                {title && (
                  <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1 leading-tight">{title}</p>
                )}
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
            {scheduled.map(s => <ScheduledCard key={s.id} s={s} />)}
          </div>
        )}

      </div>
    </aside>
  )
}
