import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Radio, Clock, Play, ArrowLeft, Bell, Search } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import BroadcastNotifyButton from '@/components/live/BroadcastNotifyButton'

interface LiveStream {
  id: number
  title: string
  youtube_video_id?: string
  status: string
  seller_name?: string
  viewer_count?: number
  current_product?: { name: string; price: number } | null
  scheduled_at?: string
  created_at?: string
  ended_at?: string
  thumbnail_url?: string
  image_url?: string
  category?: string
  tags?: string[] | string
  total_views?: number
  duration_seconds?: number
}

type Tab = 'all' | 'live' | 'scheduled' | 'replay'

export default function LiveListPage() {
  const navigate = useNavigate()
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([])
  const [scheduledStreams, setScheduledStreams] = useState<LiveStream[]>([])
  const [endedStreams, setEndedStreams] = useState<LiveStream[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('all')
  const [activeCategory, setActiveCategory] = useState<string>('all')

  useEffect(() => {
    document.title = '라이브 - 유어딜'
    Promise.allSettled([
      api.get('/api/streams?status=live'),
      api.get('/api/streams?status=scheduled'),
      api.get('/api/streams?status=ended&limit=20'),
    ]).then(([liveRes, scheduledRes, endedRes]) => {
      if (liveRes.status === 'fulfilled' && liveRes.value.data.success) setLiveStreams(liveRes.value.data.data || [])
      if (scheduledRes.status === 'fulfilled' && scheduledRes.value.data.success) setScheduledStreams(scheduledRes.value.data.data || [])
      if (endedRes.status === 'fulfilled' && endedRes.value.data.success) setEndedStreams(endedRes.value.data.data || [])
    }).finally(() => setLoading(false))
  }, [])

  const getThumb = (s: LiveStream) =>
    s.youtube_video_id ? `https://img.youtube.com/vi/${s.youtube_video_id}/hqdefault.jpg`
    : s.thumbnail_url || s.image_url || null

  const categories = useMemo(() => {
    const set = new Set<string>()
    ;[...liveStreams, ...scheduledStreams, ...endedStreams].forEach(s => {
      if (s.category) set.add(s.category)
    })
    return Array.from(set).slice(0, 8)
  }, [liveStreams, scheduledStreams, endedStreams])

  const filterByCat = (arr: LiveStream[]) =>
    activeCategory === 'all' ? arr : arr.filter(s => s.category === activeCategory)

  const filteredLive = filterByCat(liveStreams)
  const filteredScheduled = filterByCat(scheduledStreams)
  const filteredEnded = filterByCat(endedStreams)
  const totalCount = filteredLive.length + filteredScheduled.length + filteredEnded.length

  const heroStream = filteredLive[0] ?? null
  const restLive = heroStream ? filteredLive.slice(1) : []

  return (
    <div className="min-h-screen bg-[#020202] text-white pb-24">
      <SEO title="라이브" description="유어딜 라이브 방송과 다시보기" url="/live" />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#020202]/90 backdrop-blur-md border-b border-[#1A1A1A]">
        <div className="flex items-center justify-between px-4 h-[52px]">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-full hover:bg-white/10"
            aria-label="뒤로가기"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[16px] font-extrabold">라이브</h1>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => navigate('/search?scope=live')}
              className="p-1.5 rounded-full hover:bg-white/10"
              aria-label="라이브 검색"
            >
              <Search className="w-5 h-5 text-gray-400" />
            </button>
            <button
              onClick={() => navigate('/notifications')}
              className="p-1.5 rounded-full hover:bg-white/10"
              aria-label="알림"
            >
              <Bell className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1.5 px-4 pb-2.5 overflow-x-auto no-scrollbar">
          {([
            { key: 'all',       label: '전체',      count: totalCount },
            { key: 'live',      label: '실시간',    count: filteredLive.length },
            { key: 'scheduled', label: '예정',      count: filteredScheduled.length },
            { key: 'replay',    label: '다시보기',  count: filteredEnded.length },
          ] as { key: Tab; label: string; count: number }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold transition-all ${
                tab === t.key
                  ? 'bg-white text-black'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {t.label}
              {t.count > 0 && <span className={`ml-1 ${tab === t.key ? 'opacity-60' : 'text-gray-500'}`}>{t.count}</span>}
            </button>
          ))}
        </div>

        {/* Category chips */}
        {categories.length > 0 && (
          <div className="flex gap-1.5 px-4 pb-2.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveCategory('all')}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors border ${
                activeCategory === 'all'
                  ? 'bg-pink-500/20 text-pink-400 border-pink-500/40'
                  : 'bg-transparent text-gray-500 border-white/10 hover:text-gray-300'
              }`}
            >
              # 전체
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors border ${
                  activeCategory === cat
                    ? 'bg-pink-500/20 text-pink-400 border-pink-500/40'
                    : 'bg-transparent text-gray-500 border-white/10 hover:text-gray-300'
                }`}
              >
                # {cat}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : totalCount === 0 ? (
        <EmptyState onExplore={() => navigate('/')} />
      ) : (
        <div className="pt-3">
          {/* Hero — 가장 인기 있는 실시간 방송 */}
          {(tab === 'all' || tab === 'live') && heroStream && (
            <section className="px-4 mb-6">
              <div className="flex items-center gap-1.5 mb-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                <h2 className="text-[12px] font-extrabold text-red-400 tracking-wide uppercase">지금 HOT</h2>
              </div>
              <HeroCard stream={heroStream} getThumb={getThumb} onClick={() => navigate(`/live/${heroStream.id}`)} />
            </section>
          )}

          {/* Live Now — 나머지 실시간 */}
          {(tab === 'all' || tab === 'live') && restLive.length > 0 && (
            <section className="px-4 mb-6">
              <div className="flex items-center gap-1.5 mb-3">
                <Radio className="h-3.5 w-3.5 text-red-400" strokeWidth={2.5} />
                <h2 className="text-[13px] font-extrabold">실시간 방송</h2>
                <span className="text-[11px] text-red-400 font-bold">{restLive.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {restLive.map(s => (
                  <StreamCard key={s.id} stream={s} type="live" onClick={() => navigate(`/live/${s.id}`)} getThumb={getThumb} />
                ))}
              </div>
            </section>
          )}

          {/* Scheduled */}
          {(tab === 'all' || tab === 'scheduled') && filteredScheduled.length > 0 && (
            <section className="px-4 mb-6">
              <div className="flex items-center gap-1.5 mb-3">
                <Clock className="h-3.5 w-3.5 text-blue-400" strokeWidth={2.5} />
                <h2 className="text-[13px] font-extrabold">방송 예정</h2>
                <span className="text-[11px] text-blue-400 font-bold">{filteredScheduled.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {filteredScheduled.map(s => (
                  <div key={s.id}>
                    <StreamCard stream={s} type="scheduled" onClick={() => navigate(`/live/${s.id}`)} getThumb={getThumb} />
                    <div className="mt-1.5">
                      <BroadcastNotifyButton streamId={s.id} compact />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Replay */}
          {(tab === 'all' || tab === 'replay') && filteredEnded.length > 0 && (
            <section className="px-4 mb-6">
              <div className="flex items-center gap-1.5 mb-3">
                <Play className="h-3.5 w-3.5 text-gray-400" strokeWidth={2.5} fill="currentColor" />
                <h2 className="text-[13px] font-extrabold">다시보기</h2>
                <span className="text-[11px] text-gray-500 font-bold">{filteredEnded.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {filteredEnded.map(s => (
                  <StreamCard key={s.id} stream={s} type="ended" onClick={() => navigate(`/live/${s.id}`)} getThumb={getThumb} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Hero Card (2:3 aspect, 16:9 으로 바꿔 wider feel) ──────────

function HeroCard({ stream, getThumb, onClick }: {
  stream: LiveStream
  getThumb: (s: LiveStream) => string | null
  onClick: () => void
}) {
  const thumb = getThumb(stream)
  return (
    <button
      onClick={onClick}
      className="relative block w-full aspect-[16/10] rounded-2xl overflow-hidden bg-[#121212] active:scale-[0.99] transition-transform text-left group"
    >
      {thumb ? (
        <img src={thumb} alt="" fetchPriority="high" decoding="async" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-red-900/40 to-[#0A0A0A] flex items-center justify-center">
          <Radio className="w-10 h-10 text-red-500/60" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/20" />

      {/* LIVE badge */}
      <div className="absolute top-3 left-3 flex items-center gap-1 bg-red-500 px-2.5 py-1 rounded-full shadow-lg shadow-red-500/30">
        <span className="h-1.5 w-1.5 bg-white rounded-full animate-pulse" />
        <span className="text-[10px] font-extrabold text-white tracking-wide">LIVE</span>
      </div>

      {/* Viewers */}
      {stream.viewer_count !== undefined && (
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full">
          <Eye className="h-3 w-3 text-white" />
          <span className="text-[11px] text-white font-bold">
            {stream.viewer_count.toLocaleString()}
          </span>
        </div>
      )}

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        {stream.seller_name && (
          <p className="text-[11px] text-white/70 font-semibold mb-1">{stream.seller_name}</p>
        )}
        <p className="text-[17px] font-extrabold text-white line-clamp-2 leading-tight tracking-tight">
          {stream.title}
        </p>
        {stream.current_product && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
            <span className="text-[10px] font-bold text-pink-300">NOW</span>
            <span className="text-[11px] text-white font-semibold line-clamp-1 max-w-[200px]">
              {stream.current_product.name}
            </span>
            <span className="text-[11px] font-extrabold text-pink-300">
              {stream.current_product.price.toLocaleString()}원
            </span>
          </div>
        )}
      </div>
    </button>
  )
}

// ─── Regular Stream Card ──────────────────────────────────────

function StreamCard({ stream, type, onClick, getThumb }: {
  stream: LiveStream
  type: 'live' | 'scheduled' | 'ended'
  onClick: () => void
  getThumb: (s: LiveStream) => string | null
}) {
  const thumb = getThumb(stream)
  const schedDate = stream.scheduled_at ? new Date(stream.scheduled_at) : null
  const endedAt = stream.ended_at ? new Date(stream.ended_at) : null

  const timeAgo = endedAt ? relativeTime(endedAt) : null

  return (
    <button onClick={onClick} className="text-left active:scale-[0.97] transition-transform w-full">
      <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-[#121212]">
        {thumb ? (
          <img src={thumb} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
            <Play className="w-7 h-7 text-gray-700" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/10" />

        {/* Badge */}
        {type === 'live' && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-500 px-1.5 py-0.5 rounded shadow-md">
            <span className="h-1 w-1 bg-white rounded-full animate-pulse" />
            <span className="text-[9px] font-extrabold text-white tracking-wide">LIVE</span>
          </div>
        )}
        {type === 'scheduled' && (
          <div className="absolute top-2 left-2 bg-blue-500 px-1.5 py-0.5 rounded">
            <span className="text-[9px] font-extrabold text-white">예정</span>
          </div>
        )}
        {type === 'ended' && (
          <div className="absolute top-2 left-2 flex items-center gap-0.5 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded">
            <Play className="h-2.5 w-2.5 text-white" fill="currentColor" />
            <span className="text-[9px] font-bold text-white">다시보기</span>
          </div>
        )}

        {/* Viewers (live) or Views (ended) */}
        {type === 'live' && stream.viewer_count !== undefined && (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded">
            <Eye className="h-2.5 w-2.5 text-white" />
            <span className="text-[9px] text-white font-bold">{formatCount(stream.viewer_count)}</span>
          </div>
        )}
        {type === 'ended' && stream.total_views !== undefined && (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded">
            <Eye className="h-2.5 w-2.5 text-white" />
            <span className="text-[9px] text-white font-bold">{formatCount(stream.total_views)}</span>
          </div>
        )}

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          {stream.seller_name && (
            <p className="text-[9px] text-white/60 font-semibold mb-0.5 line-clamp-1">
              @{stream.seller_name}
            </p>
          )}
          <p className="text-[11px] font-bold text-white line-clamp-2 leading-tight">
            {stream.title}
          </p>
          {type === 'scheduled' && schedDate && (
            <p className="text-[10px] text-blue-300 mt-1 font-bold">
              {schedDate.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
          {type === 'ended' && timeAgo && (
            <p className="text-[9px] text-gray-400 mt-0.5 font-medium">
              {timeAgo}
            </p>
          )}
        </div>
      </div>
    </button>
  )
}

// ─── Empty State ──────────────────────────────────────────────

function EmptyState({ onExplore }: { onExplore: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center pt-20 pb-24 px-6 text-center">
      <div className="relative mb-5">
        <div className="w-20 h-20 rounded-full bg-[#121212] flex items-center justify-center">
          <Radio className="w-9 h-9 text-gray-600" strokeWidth={1.5} />
        </div>
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
          <span className="h-1.5 w-1.5 bg-red-500 rounded-full animate-pulse" />
        </span>
      </div>
      <h2 className="text-[17px] font-bold text-white mb-1.5">진행 중인 라이브가 없습니다</h2>
      <p className="text-[13px] text-gray-500 mb-6">곧 새로운 방송이 시작됩니다</p>
      <button
        onClick={onExplore}
        className="px-5 py-2.5 bg-white text-black text-[13px] font-bold rounded-full hover:bg-gray-100 transition-colors"
      >
        UR특가 구경하기
      </button>
    </div>
  )
}

// ─── Utils ─────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}천`
  return n.toLocaleString()
}

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return '방금 전'
  if (min < 60) return `${min}분 전`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}시간 전`
  const day = Math.floor(hour / 24)
  if (day < 7) return `${day}일 전`
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}
