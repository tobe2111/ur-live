/**
 * SellerLiveBroadcastPage 의 작은 self-contained 컴포넌트 묶음.
 *
 *   - RecommendedPresetBlock + PresetRow:  도구별 권장 프리셋 (해상도/비트레이트)
 *   - RtmpBlock:                            RTMP URL/key 복사 블록
 *   - LiveStatsBar:                         라이브 실시간 통계 (5초 폴링)
 *   - ShareLiveLink:                        시청자 링크 공유 (clipboard)
 *   - StreamList:                           예약/종료 방송 목록
 *
 * 🛡️ 2026-04-28: TD-006 / audit #10 — SellerLiveBroadcastPage.tsx 추가 분할.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { CheckCircle2, Copy, Eye, MessageSquare, ShoppingBag, DollarSign } from 'lucide-react'
import { formatKSTDate } from '@/utils/date'
import { safeDate, safeTime } from '@/utils/safe-date'
import { formatNumber } from '@/utils/format'

interface ToolPreset {
  label: string; resolution: string; fps: number
  video_bitrate_kbps: number; audio_bitrate_kbps: number
  keyframe_interval_sec: number; buffer_sec: number
  recommended_for: string
}

// 부분 인터페이스 — 호출처는 더 풍부한 LiveStream 을 그대로 전달 가능
interface LiveStreamLite {
  id: number; title: string; status: string
  scheduled_at?: string; ended_at?: string; youtube_video_id?: string
}

export function RecommendedPresetBlock({ tool }: { tool: string }) {
  const { t } = useTranslation()
  const [presets, setPresets] = useState<ToolPreset[] | null>(null)
  const [selected, setSelected] = useState(1) // default: 1080p 30fps
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let active = true
    api.get(`/api/platforms/streaming-tools/${tool}/preset`)
      .then(res => { if (active && res.data?.success) setPresets(res.data.data.presets || []) })
      .catch(() => { /* non-critical */ })
    return () => { active = false }
  }, [tool])

  if (!presets || presets.length === 0) return null
  const p = presets[Math.min(selected, presets.length - 1)]

  return (
    <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full px-3 py-2 flex items-center justify-between bg-gray-50 hover:bg-gray-100 text-left">
        <span className="text-xs font-semibold text-gray-700">⚙️ {t('seller.liveBroadcast.recommendedPreset')}</span>
        <span className="text-xs text-gray-500">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="p-3 space-y-2 bg-white">
          <div className="flex gap-1">
            {presets.map((preset, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelected(i)}
                className={`flex-1 px-2 py-1 text-[11px] font-medium rounded border ${
                  selected === i ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-200 text-gray-600'
                }`}>
                {preset.label.split(' ')[0]}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <PresetRow label={t('seller.liveBroadcast.presetResolution')} value={`${p.resolution} @ ${p.fps}fps`} />
            <PresetRow label={t('seller.liveBroadcast.presetVideoBitrate')} value={`${formatNumber(p.video_bitrate_kbps)} kbps`} />
            <PresetRow label={t('seller.liveBroadcast.presetAudioBitrate')} value={`${p.audio_bitrate_kbps} kbps`} />
            <PresetRow label={t('seller.liveBroadcast.presetKeyframe')} value={`${p.keyframe_interval_sec}s`} />
          </div>
          <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-100">{p.recommended_for}</p>
        </div>
      )}
    </div>
  )
}

export function PresetRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-gray-400">{label}</span>
      <span className="font-mono font-semibold text-gray-900">{value}</span>
    </div>
  )
}

// ── RTMP 복사 블록 ─────────────────────────────────────────────────
export function RtmpBlock({ label, value, fieldKey, copiedField, onCopy }: {
  label: string; value: string; fieldKey: string
  copiedField: string | null; onCopy: (v: string, k: string) => void
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      <div className="flex gap-2">
        <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono truncate">
          {value}
        </code>
        <button
          onClick={() => onCopy(value, fieldKey)}
          className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 shrink-0"
        >
          {copiedField === fieldKey
            ? <CheckCircle2 className="w-4 h-4 text-green-500" />
            : <Copy className="w-4 h-4 text-gray-500" />}
        </button>
      </div>
    </div>
  )
}

// ── 라이브 실시간 통계 카운터 ────────────────────────────────────
interface LiveStats { viewer_count: number; chat_count: number; order_count: number; revenue: number }
export function LiveStatsBar({ streamId }: { streamId: number }) {
  const { t } = useTranslation()
  const [stats, setStats] = useState<LiveStats>({ viewer_count: 0, chat_count: 0, order_count: 0, revenue: 0 })

  useEffect(() => {
    let active = true
    const fetchStats = async () => {
      try {
        // 병렬로 우리 DB stats + YouTube Live API stats 조회, viewer_count 는 YouTube 값 우선
        const [ours, yt] = await Promise.allSettled([
          api.get(`/api/seller/streams/${streamId}/live-stats`),
          api.get(`/api/seller/youtube/live/${streamId}/youtube-stats`),
        ])
        if (!active) return
        const next: LiveStats = { viewer_count: 0, chat_count: 0, order_count: 0, revenue: 0 }
        if (ours.status === 'fulfilled' && ours.value.data?.success) {
          Object.assign(next, ours.value.data.data)
        }
        if (yt.status === 'fulfilled' && yt.value.data?.success) {
          next.viewer_count = yt.value.data.data.concurrent_viewers || next.viewer_count
        }
        setStats(next)
      } catch { /* silent */ }
    }
    fetchStats()
    // 🛡️ 2026-05-04 (perf): 5s → 10s. 시청자 통계 — 10s 지연 허용.
    const id = setInterval(fetchStats, 10000)
    return () => { active = false; clearInterval(id) }
  }, [streamId])

  const ordersUnit = t('seller.liveBroadcast.ordersUnit')
  const items = [
    { icon: Eye, value: formatNumber(stats.viewer_count) },
    { icon: MessageSquare, value: formatNumber(stats.chat_count) },
    { icon: ShoppingBag, value: `${stats.order_count}${ordersUnit}` },
    { icon: DollarSign, value: `₩${formatNumber(stats.revenue)}` },
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-2.5 flex items-center justify-between gap-2 text-sm">
      {items.map(({ icon: Icon, value }, i) => (
        <div key={i} className="flex items-center gap-1.5 min-w-0">
          <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="font-bold text-gray-900 truncate">{value}</span>
        </div>
      ))}
    </div>
  )
}


// ── 시청자 링크 공유 ─────────────────────────────────────────────
export function ShareLiveLink({ streamId }: { streamId: number }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const url = `https://live.ur-team.com/live/${streamId}`

  function copy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl px-4 py-3">
      <p className="text-xs font-semibold text-blue-800 mb-2">
        {t('seller.liveBroadcast.shareLinkTitle')}
        <span className="ml-1 font-normal text-blue-600">— {t('seller.liveBroadcast.shareLinkDesc')}</span>
      </p>
      <div className="flex gap-2">
        <code className="flex-1 text-xs font-mono bg-white border border-blue-100 rounded-lg px-3 py-2 text-blue-900 truncate">
          {url}
        </code>
        <button
          onClick={copy}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
            copied
              ? 'bg-green-500 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? t('seller.liveBroadcast.copied') : t('seller.liveBroadcast.copy')}
        </button>
      </div>
    </div>
  )
}

// ── 기존/최근 방송 목록 ──────────────────────────────────────────
interface StreamListProps {
  streams: LiveStreamLite[]; onManage: (stream: LiveStreamLite) => void
}
export function StreamList({ streams, onManage }: StreamListProps) {
  const { t } = useTranslation()
  // 자동 redirect가 1시간 이내 예약/라이브 처리 → 여기서는 1시간 이후 예약만 표시
  const upcoming = streams.filter((s: LiveStreamLite) => {
    if (s.status !== 'scheduled') return false
    if (!s.scheduled_at) return true
    return safeTime(s.scheduled_at) - Date.now() > 60 * 60 * 1000
  })
  const ended = streams.filter((s: LiveStreamLite) => s.status === 'ended')
  if (upcoming.length === 0 && ended.length === 0) return null
  return (
    <div className="mt-6 space-y-4">
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-gray-700">{t('seller.liveBroadcast.upcomingBroadcasts')}</h3>
          {upcoming.map((s: LiveStreamLite) => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-orange-100 text-orange-600">
                📅 {safeDate(s.scheduled_at)?.toLocaleString() ?? t('common.scheduled')}
              </span>
              <p className="text-sm font-medium text-gray-900 truncate flex-1">{s.title}</p>
              <button onClick={() => onManage(s)} className="text-xs text-blue-600 font-medium shrink-0">{t('common.manage')} →</button>
            </div>
          ))}
        </div>
      )}
      {ended.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-gray-700">{t('seller.liveBroadcast.recentBroadcasts')}</h3>
          {ended.slice(0, 5).map((s: LiveStreamLite) => (
            <div key={s.id} className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 p-3">
              <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                {s.youtube_video_id && <img src={`https://img.youtube.com/vi/${s.youtube_video_id}/hqdefault.jpg`} alt="" className="w-full h-full object-cover" loading="lazy" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{s.title}</p>
                <p className="text-xs text-gray-500">{s.ended_at ? formatKSTDate(s.ended_at) : ''}</p>
              </div>
              <a href={`/seller/live-analytics/${s.id}`} className="text-xs text-blue-600 font-medium shrink-0">{t('seller.analytics')}</a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
