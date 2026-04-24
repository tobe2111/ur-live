import { useTranslation } from 'react-i18next'
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { formatKSTDate } from '@/utils/date'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import {
  Youtube, Loader2, Radio, Play,
  VideoIcon, CheckCircle2, AlertCircle, Copy,
  Smartphone, ArrowLeft, Gavel, Zap,
  Globe, EyeOff, Lock, Users, AlertTriangle,
  Eye, MessageSquare, ShoppingBag, DollarSign
} from 'lucide-react'
import { isSellerAuthenticated } from '@/lib/seller-auth'
import PrismQRCode from '@/components/streaming/PrismQRCode'
import LiveChatPanel from '@/components/seller/LiveChatPanel'

// ── Types ──────────────────────────────────────────────────────────
interface YouTubeChannel {
  id: number
  channel_id: string
  channel_title: string
  channel_thumbnail: string
  subscriber_count: number
  is_active: boolean
  has_persistent_key?: boolean
  token_expired?: boolean
}

interface Product {
  id: number
  name: string
  price: number
  image_url: string
  stock: number
  is_active: boolean
  is_supply_product?: boolean
}

interface LiveStream {
  id: number
  title: string
  youtube_video_id: string
  youtube_broadcast_id?: string
  youtube_url?: string
  rtmp_url?: string
  rtmp_key?: string
  status: 'scheduled' | 'live' | 'ended'
  viewer_count: number
  current_product_id?: number
  ended_at?: string
  scheduled_at?: string
}

type WizardStep = 'info' | 'setup' | 'live'
// 송출 도구 (streaming tool): 셀러가 영상을 어떻게 push 할지
type StreamMethod = 'youtube' | 'obs' | 'prism' | 'quick'
// 목적지 플랫폼 (destination): 시청자가 어디서 보는지
type Destination = 'youtube' | 'tiktok' | 'chzzk' | 'soop'

// ── 멀티플랫폼 API 타입 ────────────────────────────────────────────
interface DestinationPlatform {
  key: string; label: string; status: 'available' | 'coming_soon' | 'deprecated'
  icon: string; region: string
  features: { rtmp_ingest: boolean; chat_relay: boolean; product_overlay: boolean; oauth_required: boolean }
  eta?: string; note?: string
}

// ── 권장 프리셋 블록 (OBS/Prism 세팅 안내) ──────────────────────────
// 🛡️ 2026-04-23 배치 167: /api/platforms/streaming-tools/:tool/preset 로부터 로드.
//   사용자가 프리셋을 선택하면 해상도/비트레이트/키프레임/오디오 값을 한 번에 확인 가능.
interface ToolPreset {
  label: string; resolution: string; fps: number
  video_bitrate_kbps: number; audio_bitrate_kbps: number
  keyframe_interval_sec: number; buffer_sec: number
  recommended_for: string
}
function RecommendedPresetBlock({ tool }: { tool: string }) {
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
            <PresetRow label={t('seller.liveBroadcast.presetVideoBitrate')} value={`${p.video_bitrate_kbps.toLocaleString()} kbps`} />
            <PresetRow label={t('seller.liveBroadcast.presetAudioBitrate')} value={`${p.audio_bitrate_kbps} kbps`} />
            <PresetRow label={t('seller.liveBroadcast.presetKeyframe')} value={`${p.keyframe_interval_sec}s`} />
          </div>
          <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-100">{p.recommended_for}</p>
        </div>
      )}
    </div>
  )
}
function PresetRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-gray-400">{label}</span>
      <span className="font-mono font-semibold text-gray-900">{value}</span>
    </div>
  )
}

// ── RTMP 복사 블록 ─────────────────────────────────────────────────
function RtmpBlock({ label, value, fieldKey, copiedField, onCopy }: {
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

// ── 방송 종료 확인 모달 (P0-2) ──────────────────────────────────
function EndBroadcastModal({ stream, onConfirm, onCancel }: {
  stream: LiveStream; onConfirm: () => void; onCancel: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6 text-red-600" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-lg font-bold text-gray-900">{t('seller.liveBroadcast.endConfirmTitle')}</h3>
          <p className="text-sm text-gray-600 truncate">{stream.title}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-xs">
          <div className="flex items-start gap-2 text-gray-700">
            <span className="text-amber-500 shrink-0">●</span>
            <span>{t('seller.liveBroadcast.endWarn1')}</span>
          </div>
          <div className="flex items-start gap-2 text-gray-700">
            <span className="text-amber-500 shrink-0">●</span>
            <span>{t('seller.liveBroadcast.endWarn2')}</span>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onCancel}
            className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold">
            {t('common.cancel')}
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold">
            {t('seller.liveBroadcast.endBroadcast')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 범용 확인 모달 (다양한 confirm 대체) ─────────────────────────
function ConfirmModal({ title, description, confirmLabel, confirmStyle = 'bg-red-600 hover:bg-red-700', onConfirm, onCancel }: {
  title: string; description: string; confirmLabel: string
  confirmStyle?: string; onConfirm: () => void; onCancel: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6 text-amber-600" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onCancel}
            className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold">
            {t('common.cancel')}
          </button>
          <button onClick={onConfirm}
            className={`flex-1 py-2.5 ${confirmStyle} text-white rounded-xl text-sm font-semibold`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 텍스트 입력 모달 (prompt 대체) ──────────────────────────────
function PromptModal({ title, placeholder, confirmLabel, onConfirm, onCancel }: {
  title: string; placeholder: string; confirmLabel: string
  onConfirm: (value: string) => void; onCancel: () => void
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        <input autoFocus value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder}
          onKeyDown={e => { if (e.key === 'Enter' && value.trim()) onConfirm(value.trim()) }}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold">
            {t('common.cancel')}
          </button>
          <button onClick={() => value.trim() && onConfirm(value.trim())} disabled={!value.trim()}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 방송 종료 후 리캡 모달 (P1-7) ────────────────────────────────
function RecapModal({ stream, stats, onClose }: {
  stream: LiveStream
  stats: { duration: string; viewers: number; chat: number; orders: number; revenue: number }
  onClose: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // 백드롭 클릭 방지 — 명시적 닫기만 허용
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
        <div className="text-center space-y-1">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">{t('seller.liveBroadcast.recapTitle')}</p>
          <h3 className="text-lg font-bold text-gray-900 truncate">{stream.title}</h3>
          <p className="text-xs text-gray-500">{stats.duration}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <Eye className="w-4 h-4 text-blue-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-blue-700">{stats.viewers.toLocaleString()}</p>
            <p className="text-[10px] text-blue-600">{t('seller.liveBroadcast.statsViewers')}</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-3 text-center">
            <MessageSquare className="w-4 h-4 text-purple-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-purple-700">{stats.chat.toLocaleString()}</p>
            <p className="text-[10px] text-purple-600">{t('seller.liveBroadcast.statsChat')}</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-3 text-center">
            <ShoppingBag className="w-4 h-4 text-amber-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-amber-700">{stats.orders}</p>
            <p className="text-[10px] text-amber-600">{t('seller.liveBroadcast.statsOrders')}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <DollarSign className="w-4 h-4 text-green-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-green-700">₩{stats.revenue.toLocaleString()}</p>
            <p className="text-[10px] text-green-600">{t('seller.liveBroadcast.statsRevenue')}</p>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold">
            {t('common.close')}
          </button>
          <button onClick={() => { onClose(); navigate(`/seller/live-analytics/${stream.id}`) }}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold">
            {t('seller.liveBroadcast.viewAnalytics')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 채널 카드 (다중 채널 + 해제 + 토큰 만료 재연동) ──────────────
function ChannelCard({ channels, activeChannelId, onSelectChannel, onDisconnect, onReauthenticate, connectingYouTube }: {
  channels: YouTubeChannel[]
  activeChannelId: number | null
  onSelectChannel: (id: number) => void
  onDisconnect: (id: number) => void
  onReauthenticate: () => void
  connectingYouTube: boolean
}) {
  const { t } = useTranslation()
  const [pickerOpen, setPickerOpen] = useState(false)
  const active = channels.find(c => c.id === activeChannelId) || channels[0]
  if (!active) return null
  const hasMultiple = channels.length > 1

  return (
    <div className={`relative bg-white rounded-xl px-4 py-3 border mb-5 ${active.token_expired ? 'border-amber-300' : 'border-gray-200'}`}>
      <div className="flex items-center gap-3">
        {active.channel_thumbnail
          ? <img src={active.channel_thumbnail} alt="" className="w-8 h-8 rounded-full" />
          : <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center"><Youtube className="h-4 w-4 text-red-500" /></div>}
        <button
          onClick={() => hasMultiple && setPickerOpen(v => !v)}
          className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-gray-900 truncate flex items-center gap-1">
            {active.channel_title}
            {hasMultiple && <span className="text-xs text-gray-400">▾</span>}
          </p>
          <p className="text-xs text-gray-400">{String(t('seller.liveBroadcast.subscribers', { count: active.subscriber_count?.toLocaleString() || '0' } as Record<string, string>))}</p>
        </button>
        {active.token_expired ? (
          <button onClick={onReauthenticate} disabled={connectingYouTube}
            className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-full font-medium flex items-center gap-1">
            {connectingYouTube ? <Loader2 className="w-3 h-3 animate-spin" /> : <Youtube className="w-3 h-3" />}
            재연동
          </button>
        ) : (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{t('seller.liveBroadcast.linked')}</span>
        )}
        <button onClick={() => onDisconnect(active.id)}
          className="text-gray-300 hover:text-red-500 transition-colors p-1"
          title={t('seller.liveBroadcast.disconnectChannel')}
          aria-label={t('seller.liveBroadcast.disconnectChannel')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>

      {pickerOpen && hasMultiple && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-60 overflow-y-auto">
          {channels.map(ch => (
            <button key={ch.id}
              onClick={() => { onSelectChannel(ch.id); setPickerOpen(false) }}
              className={`w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 ${ch.id === active.id ? 'bg-blue-50' : ''}`}>
              {ch.channel_thumbnail && <img src={ch.channel_thumbnail} alt="" className="w-6 h-6 rounded-full" />}
              <span className="text-xs font-medium text-gray-900 truncate flex-1">{ch.channel_title}</span>
              {ch.id === active.id && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
            </button>
          ))}
        </div>
      )}

    </div>
  )
}

// ── 송출 도구 마지막 선택 기억 ──────────────────────────────────
const METHOD_STORAGE_KEY = 'seller_live_last_method'
function getLastUsedMethod(): StreamMethod {
  try {
    const v = localStorage.getItem(METHOD_STORAGE_KEY)
    if (v === 'youtube' || v === 'obs' || v === 'prism' || v === 'quick') return v
  } catch { /* SSR or blocked */ }
  if (typeof window !== 'undefined' && /Mobi|Android|iPhone/i.test(navigator.userAgent)) return 'prism'
  return 'obs'
}
function rememberMethod(m: StreamMethod) {
  try { localStorage.setItem(METHOD_STORAGE_KEY, m) } catch { /* ignore */ }
}

// ── 최근 사용 상품 / 마지막 방송 값 prefill ─────────────────────
const RECENT_PRODUCTS_KEY = 'seller_live_recent_products'
const LAST_BROADCAST_KEY = 'seller_live_last_broadcast'
const TEMPLATES_KEY = 'seller_live_templates'

interface BroadcastTemplate {
  name: string
  title: string
  description: string
  privacy: 'public' | 'unlisted' | 'private'
  productIds: number[]
}

function getRecentProducts(): number[] {
  try {
    const v = localStorage.getItem(RECENT_PRODUCTS_KEY)
    return v ? JSON.parse(v) : []
  } catch { return [] }
}
function rememberRecentProducts(ids: number[]) {
  try { localStorage.setItem(RECENT_PRODUCTS_KEY, JSON.stringify(ids.slice(0, 20))) } catch { /* ignore */ }
}
function getLastBroadcast(): { description?: string; thumbnailUrl?: string; privacy?: 'public' | 'unlisted' | 'private' } {
  try {
    const v = localStorage.getItem(LAST_BROADCAST_KEY)
    return v ? JSON.parse(v) : {}
  } catch { return {} }
}
function rememberLastBroadcast(data: { description: string; thumbnailUrl: string; privacy: 'public' | 'unlisted' | 'private' }) {
  try { localStorage.setItem(LAST_BROADCAST_KEY, JSON.stringify(data)) } catch { /* ignore */ }
}
function getTemplates(): BroadcastTemplate[] {
  try {
    const v = localStorage.getItem(TEMPLATES_KEY)
    return v ? JSON.parse(v) : []
  } catch { return [] }
}
function saveTemplates(templates: BroadcastTemplate[]) {
  try { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates.slice(0, 10))) } catch { /* ignore */ }
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────
export default function SellerLiveBroadcastPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { streamId: urlStreamId } = useParams<{ streamId?: string }>()

  // 데이터
  const [channels, setChannels] = useState<YouTubeChannel[]>([])
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [streams, setStreams] = useState<LiveStream[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [connectingYouTube, setConnectingYouTube] = useState(false)

  // 위저드 상태
  const [step, setStep] = useState<WizardStep>('info')
  const [method, setMethod] = useState<StreamMethod>(() => getLastUsedMethod())
  const [destination, setDestination] = useState<Destination>('youtube')
  const [destinations, setDestinations] = useState<DestinationPlatform[]>([])
  const [currentStream, setCurrentStream] = useState<LiveStream | null>(null)

  // Step 1 폼 (마지막 방송 값으로 prefill)
  const lastBroadcast = useRef(getLastBroadcast()).current
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState(lastBroadcast.description || '')
  const [thumbnailUrl, setThumbnailUrl] = useState(lastBroadcast.thumbnailUrl || '')
  const [selectedProducts, setSelectedProducts] = useState<number[]>([])
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [privacy, setPrivacy] = useState<'public' | 'unlisted' | 'private'>(lastBroadcast.privacy || 'public')

  // UI
  const [creating, setCreating] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [endModalOpen, setEndModalOpen] = useState(false)
  const [recapStream, setRecapStream] = useState<LiveStream | null>(null)
  const [recapStats, setRecapStats] = useState<{ duration: string; viewers: number; chat: number; orders: number; revenue: number } | null>(null)
  const [pollFailures, setPollFailures] = useState(0)
  const restoredRef = useRef(false)
  const liveStartTimeRef = useRef<number>(0)

  useEffect(() => {
    if (!isSellerAuthenticated()) { navigate('/seller/login'); return }
    loadData()
  }, [navigate])

  // URL streamId 기반 상태 복원 (새로고침 / 직접 진입 대응)
  useEffect(() => {
    if (!urlStreamId || restoredRef.current) return
    restoredRef.current = true
    const id = parseInt(urlStreamId)
    if (!Number.isFinite(id)) return
    ;(async () => {
      try {
        const res = await api.get(`/api/seller/streams/${id}`)
        if (!res.data?.success || !res.data.stream) {
          navigate('/seller/live-broadcast', { replace: true })
          return
        }
        const s = res.data.stream
        if (s.status === 'ended') {
          navigate('/seller/live-broadcast', { replace: true })
          return
        }
        setCurrentStream({
          id: s.id,
          title: s.title,
          youtube_video_id: s.youtube_video_id || '',
          youtube_broadcast_id: s.youtube_broadcast_id,
          youtube_url: s.youtube_video_id ? `https://www.youtube.com/watch?v=${s.youtube_video_id}` : undefined,
          rtmp_url: s.rtmp_url,
          rtmp_key: s.rtmp_key,
          status: s.status,
          viewer_count: 0,
          current_product_id: s.current_product_id,
          scheduled_at: s.scheduled_at,
        })
        setStep(s.status === 'live' ? 'live' : 'setup')
        if (s.status === 'live') liveStartTimeRef.current = Date.now()
      } catch {
        navigate('/seller/live-broadcast', { replace: true })
      }
    })()
  }, [urlStreamId, navigate])

  // P0-1: 진행 중 방송 자동 redirect (URL 없을 때만, 1시간 이내 임박한 것만)
  useEffect(() => {
    if (urlStreamId || loading) return
    const active = streams.find(s => {
      if (s.status === 'live') return true
      if (s.status === 'scheduled' && s.scheduled_at) {
        const minsUntil = (new Date(s.scheduled_at).getTime() - Date.now()) / 60000
        return minsUntil >= -10 && minsUntil <= 60 // -10분 ~ +60분
      }
      return false
    })
    if (active) navigate(`/seller/live-broadcast/${active.id}`, { replace: true })
  }, [streams, urlStreamId, loading, navigate])

  // Step 2: OBS/Prism/YouTube 연결 자동 감지 폴링 (P2-10: 실패 카운터)
  useEffect(() => {
    if (step !== 'setup' || !currentStream) return
    const poll = async () => {
      try {
        const res = await api.get(`/api/seller/youtube/live/${currentStream.id}/status`)
        setPollFailures(0)
        if (res.data?.success && res.data.data?.synced && res.data.data?.status === 'live') {
          toast.success(t('seller.liveBroadcast.broadcastStartedAuto'))
          setCurrentStream(s => s ? { ...s, status: 'live' } : s)
          setStep('live')
          liveStartTimeRef.current = Date.now()
        }
      } catch { setPollFailures(c => c + 1) }
    }
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [step, currentStream, t])

  async function loadData() {
    try {
      setLoading(true); setLoadError(null)
      const [chRes, prRes, stRes, dRes] = await Promise.allSettled([
        api.get('/api/seller/youtube/channels'),
        api.get('/api/seller/products'),
        api.get('/api/seller/streams'),
        api.get('/api/platforms/destinations'),
      ])
      if (chRes.status === 'fulfilled' && chRes.value.data?.success) {
        const chs = chRes.value.data.data || []
        setChannels(chs)
        if (chs.length > 0 && !activeChannelId) setActiveChannelId(chs[0].id)
      }
      if (prRes.status === 'fulfilled' && prRes.value.data?.success)
        setProducts(prRes.value.data.data || [])
      if (stRes.status === 'fulfilled' && stRes.value.data?.success)
        setStreams(stRes.value.data.data || [])
      if (dRes.status === 'fulfilled' && dRes.value.data?.success)
        setDestinations(dRes.value.data.data || [])
    } catch { setLoadError(t('seller.liveBroadcast.dataLoadFailed')) }
    finally { setLoading(false) }
  }

  // P2-11: 채널 연결 해제 (모달 기반)
  const [disconnectChannelId, setDisconnectChannelId] = useState<number | null>(null)
  function requestDisconnect(channelId: number) { setDisconnectChannelId(channelId) }
  async function confirmDisconnect() {
    if (!disconnectChannelId) return
    const id = disconnectChannelId
    setDisconnectChannelId(null)
    try {
      await api.delete(`/api/seller/youtube/oauth/${id}`)
      toast.success(t('seller.liveBroadcast.disconnected'))
      await loadData()
    } catch { toast.error(t('seller.liveBroadcast.disconnectFailed')) }
  }

  async function connectYouTube() {
    try {
      setConnectingYouTube(true)
      const res = await api.get('/api/seller/youtube/auth-url')
      if (res.data.success && res.data.data?.authUrl)
        window.location.href = res.data.data.authUrl
      else toast.error(t('seller.liveBroadcast.youtubeApiNotSet'))
    } catch { toast.error(t('seller.liveBroadcast.youtubeConnectFailed')) }
    finally { setConnectingYouTube(false) }
  }

  async function createBroadcast(overrides?: { title?: string; productIds?: number[] }) {
    const effectiveTitle = overrides?.title ?? title
    const effectiveProducts = overrides?.productIds ?? selectedProducts
    if (!effectiveTitle.trim()) { toast.error(t('seller.liveBroadcast.enterTitle')); return }
    if (effectiveProducts.length === 0) { toast.error(t('seller.liveBroadcast.selectOneProduct')); return }
    try {
      setCreating(true)
      let scheduledStartTime = new Date().toISOString()
      if (isScheduled && scheduledDate && scheduledTime)
        scheduledStartTime = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString()

      const res = await api.post('/api/seller/youtube/live/create', {
        title: effectiveTitle.trim(), description: description.trim(),
        thumbnail_url: thumbnailUrl.trim() || undefined,
        product_ids: effectiveProducts,
        scheduled_start_time: scheduledStartTime,
        privacy_status: privacy,
        channel_id: activeChannelId || undefined,
      })
      if (res.data?.success) {
        const d = res.data.data
        setCurrentStream({
          id: d.stream_id, title: effectiveTitle.trim(),
          youtube_video_id: d.broadcast?.id || '',
          youtube_broadcast_id: d.broadcast?.id,
          youtube_url: d.youtube_url,
          rtmp_url: d.rtmp_url, rtmp_key: d.rtmp_key,
          status: 'scheduled', viewer_count: 0,
          scheduled_at: scheduledStartTime,
        })
        setStep('setup')
        rememberMethod(method)
        rememberRecentProducts([...effectiveProducts, ...getRecentProducts().filter(id => !effectiveProducts.includes(id))])
        rememberLastBroadcast({ description: description.trim(), thumbnailUrl: thumbnailUrl.trim(), privacy })
        navigate(`/seller/live-broadcast/${d.stream_id}`, { replace: true })
      } else {
        if (res.data?.error_code === 'YOUTUBE_AUTH_REQUIRED') {
          setChannels(prev => prev.map(ch => ({ ...ch, token_expired: true })))
        } else {
          toast.error(res.data?.error || t('seller.liveBroadcast.createFailed'))
        }
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error_code?: string; error?: string } } }
      if (axiosErr.response?.data?.error_code === 'YOUTUBE_AUTH_REQUIRED') {
        setChannels(prev => prev.map(ch => ({ ...ch, token_expired: true })))
      } else {
        toast.error(axiosErr.response?.data?.error || t('seller.liveBroadcast.createFailed'))
      }
    } finally { setCreating(false) }
  }

  async function goLive() {
    if (!currentStream) return
    try {
      await api.post(`/api/seller/youtube/live/${currentStream.id}/start`)
      setCurrentStream(s => s ? { ...s, status: 'live' } : s)
      setStep('live')
      toast.success(t('seller.liveBroadcast.liveStarted'))
    } catch { toast.error(t('seller.liveBroadcast.startFailed')) }
  }

  function requestEndStream() {
    if (!currentStream) return
    setEndModalOpen(true)
  }

  async function confirmEndStream() {
    if (!currentStream) return
    setEndModalOpen(false)
    const endingStream = currentStream
    // 리캡 통계 미리 가져오기
    let stats = null
    try {
      const res = await api.get(`/api/seller/streams/${endingStream.id}/live-stats`)
      if (res.data?.success) stats = res.data.data
    } catch { /* ignore */ }

    try {
      await api.post(`/api/seller/youtube/live/${endingStream.id}/end`)
      toast.success(t('seller.liveBroadcast.ended'))
      // 리캡 표시
      if (stats && liveStartTimeRef.current > 0) {
        const sec = Math.floor((Date.now() - liveStartTimeRef.current) / 1000)
        const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
        const duration = h > 0 ? `${h}시간 ${m}분 ${s}초` : `${m}분 ${s}초`
        setRecapStream(endingStream)
        setRecapStats({ duration, viewers: stats.viewer_count, chat: stats.chat_count, orders: stats.order_count, revenue: stats.revenue })
      }
      setCurrentStream(null); setStep('info')
      setTitle(''); setSelectedProducts([])
      navigate('/seller/live-broadcast', { replace: true })
      restoredRef.current = false
      liveStartTimeRef.current = 0
      await loadData()
    } catch { toast.error(t('seller.liveBroadcast.endFailed')) }
  }

  function copyField(value: string, key: string) {
    navigator.clipboard.writeText(value)
    setCopiedField(key)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // ── 로딩 / 에러 ───────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      {urlStreamId && <p className="text-sm text-gray-500">{t('seller.liveBroadcast.restoringBroadcast')}</p>}
    </div>
  )

  if (loadError) return (
    <SellerLayout title={t('seller.nav.liveBroadcast')}>
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <p className="text-gray-700">{loadError}</p>
        <Button onClick={loadData}>{t('common.retry')}</Button>
      </div>
    </SellerLayout>
  )

  // ── YouTube 미연동 ────────────────────────────────────────────
  if (channels.length === 0) return (
    <SellerLayout title={t('seller.nav.liveBroadcast')}>
      <div className="max-w-md mx-auto py-16 text-center space-y-6">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto">
          <Youtube className="h-8 w-8 text-red-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">{t('seller.liveBroadcast.youtubeRequired')}</h2>
          <p className="text-sm text-gray-500">{t('seller.liveBroadcast.youtubeRequiredDesc')}</p>
        </div>
        <Button onClick={connectYouTube} disabled={connectingYouTube} className="bg-red-600 hover:bg-red-700 text-white w-full">
          {connectingYouTube ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Youtube className="h-4 w-4 mr-2" />}
          {t('seller.liveBroadcast.connectYoutube')}
        </Button>
      </div>
    </SellerLayout>
  )

  const sellableProducts = products.filter(p => !p.is_supply_product)

  // ── 메인 렌더 (위저드) ────────────────────────────────────────
  return (
    <SellerLayout title={t('seller.nav.liveBroadcast')}>
      <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6 lg:p-8">
        {/* 🛡️ 2026-04-22 배치 131: 디자인 시스템 적용 */}
        <DashboardPageHeader
          title={t('seller.nav.liveBroadcast')}
          subtitle={t('seller.liveBroadcastSubtitle') || '라이브 방송 시작 및 관리'}
          icon={<Youtube className="h-5 w-5" />}
        />

        {/* 연동 채널 (P2-9 다중 채널 + P2-11 해제 메뉴) */}
        <ChannelCard
          channels={channels}
          activeChannelId={activeChannelId}
          onSelectChannel={setActiveChannelId}
          onDisconnect={requestDisconnect}
          onReauthenticate={connectYouTube}
          connectingYouTube={connectingYouTube}
        />

        {/* STEP 1: 방송 정보 */}
        {step === 'info' && (
          <StepInfo
            title={title} setTitle={setTitle}
            description={description} setDescription={setDescription}
            thumbnailUrl={thumbnailUrl} setThumbnailUrl={setThumbnailUrl}
            privacy={privacy} setPrivacy={setPrivacy}
            isScheduled={isScheduled} setIsScheduled={setIsScheduled}
            scheduledDate={scheduledDate} setScheduledDate={setScheduledDate}
            scheduledTime={scheduledTime} setScheduledTime={setScheduledTime}
            sellableProducts={sellableProducts}
            selectedProducts={selectedProducts}
            setSelectedProducts={setSelectedProducts}
            toggleProduct={(id: number) => setSelectedProducts(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
            method={method} setMethod={setMethod}
            destination={destination} setDestination={setDestination}
            destinations={destinations}
            creating={creating} onCreate={createBroadcast}
            navigate={navigate}
            channels={channels}
            recentProductIds={getRecentProducts()}
            tokenExpired={!!channels.find(c => c.id === activeChannelId)?.token_expired}
            onReauthenticate={connectYouTube}
            connectingYouTube={connectingYouTube}
          />
        )}

        {/* STEP 2: 연결 설정 */}
        {step === 'setup' && currentStream && (
          <StepSetup
            stream={currentStream}
            method={method}
            channels={channels}
            copiedField={copiedField}
            onCopy={copyField}
            onGoLive={goLive}
            onBack={() => { setCurrentStream(null); setStep('info') }}
          />
        )}

        {/* STEP 3: 라이브 중 */}
        {step === 'live' && currentStream && (
          <StepLive
            stream={currentStream}
            products={sellableProducts}
            onChangeProduct={(productId: number) => setCurrentStream(s => s ? { ...s, current_product_id: productId } : s)}
            onEndStream={requestEndStream}
          />
        )}

        {/* 기존 방송 목록 (info 단계에서만) */}
        {step === 'info' && (
          <StreamList
            streams={streams}
            onManage={(stream: LiveStream) => {
              navigate(`/seller/live-broadcast/${stream.id}`)
            }}
          />
        )}

        {/* P2-10: 네트워크 끊김 표시 */}
        {pollFailures >= 3 && step === 'setup' && (
          <div className="fixed bottom-4 right-4 z-40 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 shadow-lg flex items-center gap-2.5 max-w-xs">
            <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
            <p className="text-xs text-amber-800">{t('seller.liveBroadcast.reconnecting')}</p>
          </div>
        )}

        {/* P0-2: 방송 종료 확인 모달 */}
        {endModalOpen && currentStream && (
          <EndBroadcastModal
            stream={currentStream}
            onConfirm={confirmEndStream}
            onCancel={() => setEndModalOpen(false)}
          />
        )}

        {/* P1-7: 방송 종료 후 리캡 모달 */}
        {recapStream && recapStats && (
          <RecapModal
            stream={recapStream}
            stats={recapStats}
            onClose={() => { setRecapStream(null); setRecapStats(null) }}
          />
        )}

        {/* 채널 연결 해제 확인 모달 */}
        {disconnectChannelId !== null && (
          <ConfirmModal
            title="채널 연결을 해제하시겠습니까?"
            description="해제하면 이 채널로는 방송할 수 없어요. 다시 연동하면 복구 가능합니다."
            confirmLabel={t('seller.liveBroadcast.disconnectChannel')}
            confirmStyle="bg-red-600 hover:bg-red-700"
            onConfirm={confirmDisconnect}
            onCancel={() => setDisconnectChannelId(null)}
          />
        )}

      </div>
    </SellerLayout>
  )
}

// ── Step 1: 방송 정보 입력 ───────────────────────────────────────
interface StepInfoProps {
  title: string; setTitle: (v: string) => void
  description: string; setDescription: (v: string) => void
  thumbnailUrl: string; setThumbnailUrl: (v: string) => void
  privacy: 'public' | 'unlisted' | 'private'; setPrivacy: (v: 'public' | 'unlisted' | 'private') => void
  isScheduled: boolean; setIsScheduled: (fn: (v: boolean) => boolean) => void
  scheduledDate: string; setScheduledDate: (v: string) => void
  scheduledTime: string; setScheduledTime: (v: string) => void
  sellableProducts: Product[]; selectedProducts: number[]
  setSelectedProducts: React.Dispatch<React.SetStateAction<number[]>>
  toggleProduct: (id: number) => void
  method: StreamMethod; setMethod: (v: StreamMethod) => void
  destination: Destination; setDestination: (v: Destination) => void
  destinations: DestinationPlatform[]
  creating: boolean; onCreate: (overrides?: { title?: string; productIds?: number[] }) => void
  navigate: ReturnType<typeof useNavigate>
  channels: YouTubeChannel[]
  recentProductIds: number[]
  tokenExpired: boolean
  onReauthenticate: () => void
  connectingYouTube: boolean
}

function StepInfo({ title, setTitle, description, setDescription, thumbnailUrl, setThumbnailUrl, privacy, setPrivacy,
  isScheduled, setIsScheduled, scheduledDate, setScheduledDate, scheduledTime, setScheduledTime,
  sellableProducts, selectedProducts, setSelectedProducts, toggleProduct, method, setMethod,
  destination, setDestination, destinations,
  creating, onCreate, navigate, channels, recentProductIds,
  tokenExpired, onReauthenticate, connectingYouTube
}: StepInfoProps) {
  const { t } = useTranslation()
  const [advancedOpen, setAdvancedOpen] = useState(false)
  // 고급 설정이 마지막 방송과 동일한지 (description/thumbnail/privacy)
  const lastBc = getLastBroadcast()
  const advancedUnchanged =
    description === (lastBc.description || '') &&
    thumbnailUrl === (lastBc.thumbnailUrl || '') &&
    privacy === (lastBc.privacy || 'public') &&
    !isScheduled
  const [productSearch, setProductSearch] = useState('')
  const [templates, setTemplates] = useState<BroadcastTemplate[]>(() => getTemplates())
  const [showTemplates, setShowTemplates] = useState(false)
  const hasPersistentKey = channels[0]?.has_persistent_key
  const privacyOptions: { key: 'public' | 'unlisted' | 'private'; icon: typeof Globe; label: string; desc: string }[] = [
    { key: 'public', icon: Globe, label: t('seller.liveBroadcast.public'), desc: t('seller.liveBroadcast.publicDesc') },
    { key: 'unlisted', icon: EyeOff, label: t('seller.liveBroadcast.unlisted'), desc: t('seller.liveBroadcast.unlistedDesc') },
    { key: 'private', icon: Lock, label: t('seller.liveBroadcast.private'), desc: t('seller.liveBroadcast.privateDesc') },
  ]
  const methodOptions = [
    { key: 'quick' as const, icon: Play, label: t('seller.liveBroadcast.quickStart'), desc: t('seller.liveBroadcast.quickStartDesc'), active: 'border-pink-400 bg-pink-50', iconActive: 'text-pink-600', hasKey: false },
    { key: 'youtube' as const, icon: Youtube, label: 'YouTube Studio', desc: t('seller.liveBroadcast.webBrowser'), active: 'border-red-400 bg-red-50', iconActive: 'text-red-600', hasKey: false },
    { key: 'obs' as const, icon: VideoIcon, label: 'OBS Studio', desc: t('seller.liveBroadcast.pcBroadcast'), active: 'border-purple-400 bg-purple-50', iconActive: 'text-purple-600', hasKey: !!hasPersistentKey },
    { key: 'prism' as const, icon: Smartphone, label: t('seller.liveBroadcast.naverPrism'), desc: t('seller.liveBroadcast.mobile'), active: 'border-green-400 bg-green-50', iconActive: 'text-green-600', hasKey: !!hasPersistentKey },
  ]

  // 상품 정렬: 선택된 것 → 최근 사용 → 나머지
  const filteredProducts = (() => {
    const q = productSearch.trim().toLowerCase()
    const filtered = q ? sellableProducts.filter(p => p.name.toLowerCase().includes(q)) : sellableProducts
    const selectedSet = new Set(selectedProducts)
    const recentSet = new Set(recentProductIds)
    return [...filtered].sort((a, b) => {
      const aSel = selectedSet.has(a.id) ? 0 : recentSet.has(a.id) ? 1 : 2
      const bSel = selectedSet.has(b.id) ? 0 : recentSet.has(b.id) ? 1 : 2
      return aSel - bSel
    })
  })()

  function applyTemplate(tpl: BroadcastTemplate) {
    setTitle(tpl.title)
    setDescription(tpl.description)
    setPrivacy(tpl.privacy)
    const validProducts = tpl.productIds.filter(id => sellableProducts.some(p => p.id === id))
    setSelectedProducts(validProducts)
    setShowTemplates(false)
    const removed = tpl.productIds.length - validProducts.length
    if (removed > 0) {
      toast.info(t('seller.liveBroadcast.templateAppliedPartial', { removed }) as string)
    } else {
      toast.success(t('seller.liveBroadcast.templateApplied'))
    }
  }

  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  function handleSaveTemplate(name: string) {
    const newTpl: BroadcastTemplate = { name, title, description, privacy, productIds: selectedProducts }
    const updated = [newTpl, ...templates.filter(t => t.name !== name)]
    saveTemplates(updated)
    setTemplates(updated)
    setShowSaveTemplate(false)
    toast.success(t('seller.liveBroadcast.templateSaved'))
  }
  // 🛡️ 2026-04-23 배치 164: 1-click quick start (P1 UX 단순화)
  //   클릭 한 번으로 기본값(오늘 날짜 제목 + 최근 상품 3개 + quick 방식)으로 방송 생성.
  //   세부 설정이 필요한 사용자는 아래 폼을 이용.
  const canQuickStart = sellableProducts.length > 0 && !creating
  const handleQuickStart = () => {
    if (!canQuickStart) return
    // i18n 로케일 기반 자동 포맷 (한국식 → ko, 미국식 → en, etc.)
    const now = new Date()
    const lng = (typeof navigator !== 'undefined' && navigator.language) || 'ko'
    const dateFmt = new Intl.DateTimeFormat(lng, { month: 'short', day: 'numeric' }).format(now)
    const timeFmt = new Intl.DateTimeFormat(lng, { hour: 'numeric', hour12: false }).format(now)
    const autoTitle = t('seller.liveBroadcast.quickAutoTitle', { date: dateFmt, hour: timeFmt }) as string
    const productIds = sellableProducts.slice(0, 5).map(p => p.id)
    setTitle(autoTitle)
    setSelectedProducts(productIds)
    setMethod('quick')
    onCreate({ title: autoTitle, productIds })
  }
  // 토큰 만료 시 폼 전체 차단 + 재연동 CTA
  if (tokenExpired) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8 text-amber-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-amber-900 mb-1">YouTube 연동이 만료됐어요</h3>
          <p className="text-sm text-amber-700">방송을 시작하려면 채널을 다시 연동해야 합니다.<br/>약 30초 소요됩니다.</p>
        </div>
        <Button onClick={onReauthenticate} disabled={connectingYouTube}
          className="bg-red-600 hover:bg-red-700 text-white px-8 h-11 text-sm font-semibold">
          {connectingYouTube ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Youtube className="w-4 h-4 mr-2" />}
          지금 재연동하기
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900">{t('seller.liveBroadcast.enterBroadcastInfo')}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{t('seller.liveBroadcast.enterBroadcastInfoDesc')}</p>
        </div>
        {/* Quick Start: 작은 보조 버튼으로 이동 */}
        {canQuickStart && (
          <button onClick={handleQuickStart}
            className="text-xs bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white px-3 py-1.5 rounded-full font-semibold flex items-center gap-1 shrink-0">
            <Zap className="w-3 h-3" />
            {t('seller.liveBroadcast.quickStart')}
          </button>
        )}
        {templates.length > 0 && (
          <div className="relative shrink-0">
            <button onClick={() => setShowTemplates(v => !v)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              📋 {t('seller.liveBroadcast.templates')}
            </button>
            {showTemplates && (
              <div className="absolute top-6 right-0 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-56 overflow-y-auto">
                {templates.map(tpl => (
                  <button key={tpl.name} onClick={() => applyTemplate(tpl)}
                    className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{tpl.name}</p>
                    <p className="text-[10px] text-gray-500 truncate">{tpl.title}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 제목 (필수) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.liveBroadcast.broadcastTitle')} <span className="text-red-500">*</span></label>
        <input value={title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
          placeholder={t('seller.liveBroadcast.broadcastTitlePlaceholder')} maxLength={100}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
      </div>

      {/* 상품 선택 (필수, 검색 + 정렬) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('seller.liveBroadcast.saleProducts')} <span className="text-red-500">*</span>
          {selectedProducts.length > 0 && <span className="ml-1 text-xs text-blue-600 font-normal">{t('seller.liveBroadcast.selectedCount', { count: selectedProducts.length })}</span>}
        </label>
        {sellableProducts.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500 mb-2">{t('seller.liveBroadcast.noProducts')}</p>
            <button onClick={() => navigate('/seller/products/new')} className="text-sm text-blue-600 font-medium">{t('seller.liveBroadcast.registerProduct')}</button>
          </div>
        ) : (
          <>
            {sellableProducts.length > 6 && (
              <input type="text" value={productSearch}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProductSearch(e.target.value)}
                placeholder={t('seller.liveBroadcast.searchProducts')}
                className="w-full px-3 py-2 mb-2 border border-gray-200 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            )}
            {recentProductIds.length > 0 && !productSearch && (
              <button type="button"
                onClick={() => {
                  const recent = recentProductIds.filter(id => sellableProducts.some(p => p.id === id)).slice(0, 5)
                  setSelectedProducts(prev => [...new Set([...prev, ...recent])])
                }}
                className="text-[11px] text-blue-600 hover:text-blue-700 mb-2 underline underline-offset-2">
                + {t('seller.liveBroadcast.addRecent')}
              </button>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto">
              {filteredProducts.map((p: Product) => (
                <button key={p.id} onClick={() => toggleProduct(p.id)}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-all ${selectedProducts.includes(p.id) ? 'border-blue-500 bg-blue-50' : recentProductIds.includes(p.id) ? 'border-gray-300 hover:border-blue-300' : 'border-gray-200 hover:border-gray-300'}`}>
                  {p.image_url && <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />}
                  <span className="truncate flex-1">{p.name}</span>
                  {selectedProducts.includes(p.id) && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 송출 도구 (필수) — P0-3 영구키 배지 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.liveBroadcast.streamingTool')}</label>
        <p className="text-xs text-gray-400 mb-2">{t('seller.liveBroadcast.streamingToolDesc')}</p>
        <div className="grid grid-cols-3 gap-3">
          {methodOptions.map(m => (
            <button key={m.key} onClick={() => setMethod(m.key)}
              className={`relative p-4 rounded-xl border-2 transition-all text-center active:scale-95 ${method === m.key ? m.active : 'border-gray-100 hover:border-gray-200'}`}>
              {m.hasKey && (
                <span className="absolute top-1 right-1 text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">
                  ✓ 저장됨
                </span>
              )}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 ${method === m.key ? m.active.split(' ')[1] : 'bg-gray-100'}`}>
                <m.icon className={`h-5 w-5 ${method === m.key ? m.iconActive : 'text-gray-400'}`} />
              </div>
              <p className="text-xs font-semibold text-gray-900">{m.label}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 고급 설정 접기 + 마지막 방송과 동일 힌트 */}
      <div className="border-t border-gray-100 pt-4">
        <button type="button" onClick={() => setAdvancedOpen(v => !v)}
          className="w-full flex items-center justify-between text-sm font-medium text-gray-600 hover:text-gray-900">
          <span className="flex items-center gap-2">
            {t('seller.liveBroadcast.advancedSettings')}
            {!advancedOpen && advancedUnchanged && (
              <span className="text-[10px] text-gray-400 font-normal">{t('seller.liveBroadcast.sameAsLast')}</span>
            )}
          </span>
          <span className="text-xs">{advancedOpen ? '▾' : '▸'}</span>
        </button>
        {advancedOpen && (
          <div className="mt-4 space-y-4">
            {/* 설명 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.description')} <span className="text-xs text-gray-400 font-normal">({t('common.optional')})</span></label>
              <textarea value={description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                placeholder={t('seller.liveBroadcast.descriptionPlaceholder')} rows={2} maxLength={500}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none" />
            </div>

            {/* 썸네일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.liveBroadcast.thumbnail')} <span className="text-xs text-gray-400 font-normal">({t('common.optional')})</span></label>
              <input value={thumbnailUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setThumbnailUrl(e.target.value)}
                placeholder={t('seller.liveBroadcast.thumbnailPlaceholder')}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              {thumbnailUrl && (
                <img src={thumbnailUrl} alt={t('seller.preview')} className="mt-2 w-full max-w-[200px] rounded-lg object-cover"
                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none' }} />
              )}
            </div>

            {/* 공개 설정 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('seller.liveBroadcast.privacySetting')}</label>
              <div className="grid grid-cols-3 gap-2">
                {privacyOptions.map(opt => (
                  <button key={opt.key} onClick={() => setPrivacy(opt.key)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-xs transition-all ${privacy === opt.key ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}>
                    <opt.icon className={`w-4 h-4 ${privacy === opt.key ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span className={`font-semibold ${privacy === opt.key ? 'text-blue-700' : 'text-gray-700'}`}>{opt.label}</span>
                    <span className="text-gray-400">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 예약 */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">{t('seller.liveBroadcast.scheduleBroadcast')}</p>
                <p className="text-xs text-gray-500">{isScheduled ? t('seller.liveBroadcast.startAtScheduled') : t('seller.liveBroadcast.startNow')}</p>
              </div>
              <button onClick={() => setIsScheduled((v: boolean) => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors ${isScheduled ? 'bg-blue-600' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${isScheduled ? 'translate-x-5' : ''}`} />
              </button>
            </div>
            {isScheduled && (
              <div className="flex gap-3">
                <input type="date" value={scheduledDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScheduledDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
                <input type="time" value={scheduledTime} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScheduledTime(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
              </div>
            )}

            {/* 목적지 */}
            {destinations.filter(d => d.status === 'available').length > 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.liveBroadcast.destination')}</label>
                <p className="text-xs text-gray-400 mb-2">{t('seller.liveBroadcast.destinationDesc')}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {destinations.map(d => {
                    const isAvailable = d.status === 'available'
                    const isSelected = destination === d.key
                    return (
                      <button key={d.key}
                        onClick={() => isAvailable && setDestination(d.key as Destination)}
                        disabled={!isAvailable}
                        className={`relative p-3 rounded-xl border-2 text-left transition-all ${!isAvailable ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed' : isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-semibold ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>{d.label}</span>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
                        </div>
                        {!isAvailable && (
                          <p className="text-[10px] text-amber-600 font-medium">
                            {t('seller.liveBroadcast.comingSoon')}{d.eta ? ` · ${d.eta}` : ''}
                          </p>
                        )}
                        {d.note && !isAvailable && (
                          <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">{d.note}</p>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* P2-8: 템플릿으로 저장 */}
            {title && selectedProducts.length > 0 && (
              <button type="button" onClick={() => setShowSaveTemplate(true)}
                className="w-full text-xs text-blue-600 hover:text-blue-700 underline underline-offset-2 py-1">
                📋 {t('seller.liveBroadcast.saveAsTemplate')}
              </button>
            )}
          </div>
        )}
      </div>

      {showSaveTemplate && (
        <PromptModal
          title={t('seller.liveBroadcast.templateNamePrompt')}
          placeholder="예: 매주 화요일 신상 라이브"
          confirmLabel={t('seller.liveBroadcast.templateSaved').replace(/되었습니다|saved/i, '저장')}
          onConfirm={handleSaveTemplate}
          onCancel={() => setShowSaveTemplate(false)}
        />
      )}

      <Button onClick={() => onCreate()} disabled={creating || !title.trim() || selectedProducts.length === 0}
        className="w-full h-12 bg-red-600 hover:bg-red-700 text-white text-base font-semibold">
        {creating ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Radio className="h-5 w-5 mr-2" />}
        {creating ? t('seller.liveBroadcast.creating') : t('seller.liveBroadcast.createBroadcast')}
      </Button>
      </div>
    </div>
  )
}

// ── 예약 방송 대기 화면 (P1-5) ──────────────────────────────────
function ScheduledBroadcastWaiting({ stream, onBack }: { stream: LiveStream; onBack: () => void }) {
  const { t } = useTranslation()
  const [countdown, setCountdown] = useState('')

  useEffect(() => {
    const tick = () => {
      if (!stream.scheduled_at) return
      const target = new Date(stream.scheduled_at).getTime()
      const diff = target - Date.now()
      if (diff <= 0) { setCountdown('00:00:00'); return }
      const days = Math.floor(diff / (24 * 3600 * 1000))
      const hours = Math.floor((diff % (24 * 3600 * 1000)) / (3600 * 1000))
      const minutes = Math.floor((diff % (3600 * 1000)) / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)
      setCountdown(days > 0
        ? `${days}일 ${hours}시간 ${minutes}분`
        : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [stream.scheduled_at])

  const scheduledDate = stream.scheduled_at ? new Date(stream.scheduled_at) : null
  const scheduledStr = scheduledDate
    ? `${scheduledDate.getFullYear()}-${String(scheduledDate.getMonth() + 1).padStart(2, '0')}-${String(scheduledDate.getDate()).padStart(2, '0')} ${String(scheduledDate.getHours()).padStart(2, '0')}:${String(scheduledDate.getMinutes()).padStart(2, '0')}`
    : ''

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
      <div className="text-center space-y-1">
        <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">📅</span>
        </div>
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">{t('seller.liveBroadcast.scheduledBroadcast')}</p>
        <h2 className="text-lg font-bold text-gray-900 truncate">{stream.title}</h2>
        <p className="text-xs text-gray-500">{scheduledStr}</p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-center">
        <p className="text-[11px] text-blue-700 font-semibold mb-1">{t('seller.liveBroadcast.timeRemaining')}</p>
        <p className="text-2xl font-bold font-mono text-blue-900">{countdown}</p>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 flex-1">{t('seller.liveBroadcast.scheduledStartHint')}</p>
      </div>

      <ShareLiveLink streamId={stream.id} />

      <div className="flex items-center justify-center pt-2 border-t border-gray-100">
        <button onClick={onBack}
          className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2">
          {t('common.cancel')}
        </button>
      </div>
    </div>
  )
}

// ── YouTube Studio 대기 화면 (Quick / YouTube 공통) ─────────────
// Step 2 진입 시 자동으로 Studio 새 탭 오픈 + 자동 감지 안내.
// onGoLive() 호출 안 함 — 폴링이 YouTube live 상태 감지 시에만 전환.
function YouTubeStudioWaiting({ stream, accent }: { stream: LiveStream; accent: 'pink' | 'red' }) {
  const { t } = useTranslation()
  const openedRef = useRef(false)
  const vid = stream.youtube_video_id || stream.youtube_broadcast_id
  const studioUrl = vid
    ? `https://studio.youtube.com/video/${vid}/livestreaming`
    : 'https://studio.youtube.com/channel/UC/livestreaming'

  useEffect(() => {
    if (openedRef.current) return
    openedRef.current = true
    const tid = setTimeout(() => {
      try { window.open(studioUrl, '_blank', 'noopener') } catch { /* blocked */ }
    }, 200)
    return () => clearTimeout(tid)
  }, [studioUrl])

  const colorMap = {
    pink: { bg: 'bg-pink-50', border: 'border-pink-200', icon: 'bg-pink-100 text-pink-600', dot: 'bg-pink-400', accent: 'text-pink-700' },
    red: { bg: 'bg-red-50', border: 'border-red-200', icon: 'bg-red-100 text-red-600', dot: 'bg-red-400', accent: 'text-red-700' },
  }[accent]

  function reopenStudio() {
    try { window.open(studioUrl, '_blank', 'noopener') } catch { /* blocked */ }
  }

  return (
    <div className={`${colorMap.bg} border ${colorMap.border} rounded-xl p-5 space-y-4`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 ${colorMap.icon} rounded-xl flex items-center justify-center`}>
          <Youtube className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-900">{t('seller.liveBroadcast.studioOpened')}</p>
          <p className="text-xs text-gray-600 mt-0.5">{t('seller.liveBroadcast.studioOpenedDesc')}</p>
        </div>
      </div>

      <div className={`flex items-center gap-2 bg-white/60 rounded-lg px-3 py-2.5 border ${colorMap.border}`}>
        <span className="flex gap-1 shrink-0">
          {[0, 0.2, 0.4].map((d, i) => (
            <span key={i} className={`w-1.5 h-1.5 rounded-full ${colorMap.dot} animate-bounce`}
              style={{ animationDelay: `${d}s` }} />
          ))}
        </span>
        <p className={`text-xs font-medium ${colorMap.accent} flex-1`}>
          {t('seller.liveBroadcast.autoDetecting')}
        </p>
      </div>

      <button onClick={reopenStudio}
        className="w-full text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2 py-1">
        {t('seller.liveBroadcast.reopenStudio')}
      </button>
    </div>
  )
}

// ── Step 2: 연결 설정 ────────────────────────────────────────────
interface StepSetupProps {
  stream: LiveStream; method: StreamMethod; channels: YouTubeChannel[]
  copiedField: string | null; onCopy: (v: string, k: string) => void
  onGoLive: () => void; onBack: () => void
}

function StepSetup({ stream, method, channels, copiedField, onCopy, onGoLive, onBack }: StepSetupProps) {
  const { t } = useTranslation()
  const hasPersistentKey = channels.some((ch: YouTubeChannel) => ch.has_persistent_key)

  // P1-5: 예약 방송이고 시작 시간이 30분 이상 미래면 카운트다운 화면
  const scheduledTime = stream.scheduled_at ? new Date(stream.scheduled_at).getTime() : 0
  const minutesUntil = scheduledTime > 0 ? (scheduledTime - Date.now()) / 60000 : -1
  if (minutesUntil > 30) {
    return <ScheduledBroadcastWaiting stream={stream} onBack={onBack} />
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse shrink-0" />
        <p className="text-sm font-semibold text-gray-900 truncate flex-1">{stream.title}</p>
        <span className="text-[11px] text-amber-600 font-medium shrink-0">{t('seller.liveBroadcast.waitingConnection')}</span>
      </div>

      {(method === 'quick' || method === 'youtube') && (
        <YouTubeStudioWaiting
          stream={stream}
          accent={method === 'quick' ? 'pink' : 'red'}
        />
      )}

      {method === 'obs' && (
        <div className="space-y-3">
          {hasPersistentKey ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">{t('seller.liveBroadcast.rtmpSetupDone')}</p>
                <p className="text-xs text-green-700">{t('seller.liveBroadcast.obsJustStart')}</p>
              </div>
            </div>
          ) : stream.rtmp_url && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-purple-700">{t('seller.liveBroadcast.obsRtmpSetupDesc')}</p>
              <button onClick={() => onCopy(`URL: ${stream.rtmp_url}\nKey: ${stream.rtmp_key}`, 'all')}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
                {copiedField === 'all' ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedField === 'all' ? t('seller.liveBroadcast.copyDone') : 'RTMP URL + Key 복사'}
              </button>
              <details className="text-xs">
                <summary className="cursor-pointer text-purple-700 hover:text-purple-900 select-none">개별 복사 + 권장 설정 보기</summary>
                <div className="mt-2 space-y-2">
                  <RtmpBlock label="RTMP URL" value={stream.rtmp_url} fieldKey="rtmp_url" copiedField={copiedField} onCopy={onCopy} />
                  {stream.rtmp_key && <RtmpBlock label={t('seller.liveBroadcast.streamKey')} value={stream.rtmp_key} fieldKey="rtmp_key" copiedField={copiedField} onCopy={onCopy} />}
                  <RecommendedPresetBlock tool="obs" />
                </div>
              </details>
            </div>
          )}
        </div>
      )}

      {method === 'prism' && (
        <div className="space-y-3">
          {hasPersistentKey ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">{t('seller.liveBroadcast.rtmpSetupDone')}</p>
                <p className="text-xs text-green-700">{t('seller.liveBroadcast.prismJustStart')}</p>
              </div>
            </div>
          ) : stream.rtmp_url && stream.rtmp_key ? (
            <PrismQRCode rtmpUrl={stream.rtmp_url} rtmpKey={stream.rtmp_key} streamTitle={stream.title} />
          ) : null}
        </div>
      )}

      <div className="pt-3 border-t border-gray-100 space-y-3">
        {(method === 'obs' || method === 'prism') && (
          <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <span className="flex gap-1 shrink-0">
              {[0, 0.2, 0.4].map((d, i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"
                  style={{ animationDelay: `${d}s` }} />
              ))}
            </span>
            <p className="text-xs text-blue-700 flex-1">
              {method === 'obs' ? 'OBS' : 'Prism'}에서 스트리밍을 시작하면 자동으로 방송이 시작됩니다
            </p>
          </div>
        )}
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-4 h-4" /> {t('common.cancel')}
          </button>
          <div className="flex-1" />
          <button onClick={onGoLive}
            className="text-[11px] text-gray-300 hover:text-gray-500 underline underline-offset-2">
            {t('seller.liveBroadcast.manualStartHint')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Step 3: 라이브 중 ────────────────────────────────────────────
interface StepLiveProps {
  stream: LiveStream; products: Product[]
  onChangeProduct: (productId: number) => void; onEndStream: () => void
}

function StepLive({ stream, products, onChangeProduct, onEndStream }: StepLiveProps) {
  const { t } = useTranslation()
  const startedAtRef = useRef(Date.now())
  const [elapsed, setElapsed] = useState('00:00')
  const [showShortcuts, setShowShortcuts] = useState(false)

  // 방송 경과 시간 타이머
  useEffect(() => {
    const tick = () => {
      const sec = Math.floor((Date.now() - startedAtRef.current) / 1000)
      const h = Math.floor(sec / 3600)
      const m = Math.floor((sec % 3600) / 60)
      const s = sec % 60
      setElapsed(h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // P2-12: 키보드 단축키 (input 포커스 중에는 무시)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '?') { e.preventDefault(); setShowShortcuts(v => !v) }
      else if (e.key === ' ' || e.key.toLowerCase() === 'n') {
        e.preventDefault()
        const idx = products.findIndex(p => p.id === stream.current_product_id)
        const next = products[(idx + 1) % products.length]
        if (next) {
          api.post(`/api/seller/streams/${stream.id}/change-product`, { productId: next.id })
            .then(() => { onChangeProduct(next.id); toast.success(`${next.name} ▶`) })
            .catch(() => { /* silent */ })
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [products, stream.id, stream.current_product_id, onChangeProduct])

  return (
    <div className="space-y-4">
      {/* 상태 바 */}
      <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-gray-200">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full shrink-0">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" /> LIVE
          </span>
          <span className="text-xs font-mono text-gray-500 shrink-0">{elapsed}</span>
          <p className="text-sm font-semibold text-gray-900 truncate">{stream.title}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => setShowShortcuts(v => !v)}
            className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold"
            title="키보드 단축키 (?)">
            ?
          </button>
          <Button onClick={onEndStream} size="sm" variant="destructive">{t('seller.liveBroadcast.endBroadcast')}</Button>
        </div>
      </div>

      {/* P2-12: 단축키 도움말 */}
      {showShortcuts && (
        <div className="bg-gray-900 text-white rounded-xl p-4 text-xs space-y-1.5">
          <p className="font-bold text-gray-100 mb-2">{t('seller.liveBroadcast.shortcutsTitle')}</p>
          <div className="flex justify-between"><span className="text-gray-300">{t('seller.liveBroadcast.shortcutNextProduct')}</span><kbd className="bg-gray-800 px-2 py-0.5 rounded font-mono">Space</kbd></div>
          <div className="flex justify-between"><span className="text-gray-300">{t('seller.liveBroadcast.shortcutToggleHelp')}</span><kbd className="bg-gray-800 px-2 py-0.5 rounded font-mono">?</kbd></div>
        </div>
      )}

      {/* 실시간 통계 카운터 */}
      <LiveStatsBar streamId={stream.id} />

      {/* 시청자 링크 공유 */}
      <ShareLiveLink streamId={stream.id} />

      {/* 채팅 (영상 미리보기 제거 — YouTube embed는 30초 지연으로 모니터링 무의미) */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden" style={{ minHeight: 320 }}>
        <LiveChatPanel streamId={stream.id} />
      </div>

      {/* 상품 전환 + 경매/타임딜 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-2">{t('seller.liveBroadcast.switchProduct')} <span className="text-gray-400 font-normal">({t('seller.liveBroadcast.tapToSwitch')})</span></p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {products.map((p: Product) => {
              const isCurrent = stream.current_product_id === p.id
              return (
                <button key={p.id}
                  onClick={async () => {
                    try {
                      await api.post(`/api/seller/streams/${stream.id}/change-product`,
                        { productId: p.id },
                        { headers: { Authorization: `Bearer ${localStorage.getItem('seller_token')}` } })
                      onChangeProduct(p.id)
                      toast.success(`${p.name} ${t('seller.liveBroadcast.nowShowing')}`)
                    } catch { toast.error(t('seller.liveBroadcast.switchFailed')) }
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium shrink-0 transition-all active:scale-95 ${
                    isCurrent ? 'border-red-500 bg-red-50 text-red-600 shadow-sm' : 'border-gray-200 text-gray-700 hover:border-blue-300'
                  }`}>
                  {p.image_url && <img src={p.image_url} alt="" className="w-7 h-7 rounded object-cover" />}
                  <span className="truncate max-w-[90px]">{p.name}</span>
                  {isCurrent && <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
        <AuctionTimeDealControls streamId={stream.id} products={products} />
      </div>
    </div>
  )
}

// ── 기존/최근 방송 목록 ──────────────────────────────────────────
interface StreamListProps {
  streams: LiveStream[]; onManage: (stream: LiveStream) => void
}

// ── 라이브 실시간 통계 카운터 ────────────────────────────────────
interface LiveStats { viewer_count: number; chat_count: number; order_count: number; revenue: number }
function LiveStatsBar({ streamId }: { streamId: number }) {
  const { t } = useTranslation()
  const [stats, setStats] = useState<LiveStats>({ viewer_count: 0, chat_count: 0, order_count: 0, revenue: 0 })

  useEffect(() => {
    let active = true
    const fetchStats = async () => {
      try {
        const res = await api.get(`/api/seller/streams/${streamId}/live-stats`)
        if (active && res.data?.success) setStats(res.data.data)
      } catch { /* silent */ }
    }
    fetchStats()
    const id = setInterval(fetchStats, 5000)
    return () => { active = false; clearInterval(id) }
  }, [streamId])

  const ordersUnit = t('seller.liveBroadcast.ordersUnit')
  const items = [
    { icon: Eye, value: stats.viewer_count.toLocaleString() },
    { icon: MessageSquare, value: stats.chat_count.toLocaleString() },
    { icon: ShoppingBag, value: `${stats.order_count}${ordersUnit}` },
    { icon: DollarSign, value: `₩${stats.revenue.toLocaleString()}` },
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
function ShareLiveLink({ streamId }: { streamId: number }) {
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

function StreamList({ streams, onManage }: StreamListProps) {
  const { t } = useTranslation()
  // 자동 redirect가 1시간 이내 예약/라이브 처리 → 여기서는 1시간 이후 예약만 표시
  const upcoming = streams.filter((s: LiveStream) => {
    if (s.status !== 'scheduled') return false
    if (!s.scheduled_at) return true
    return new Date(s.scheduled_at).getTime() - Date.now() > 60 * 60 * 1000
  })
  const ended = streams.filter((s: LiveStream) => s.status === 'ended')
  if (upcoming.length === 0 && ended.length === 0) return null
  return (
    <div className="mt-6 space-y-4">
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-gray-700">{t('seller.liveBroadcast.upcomingBroadcasts')}</h3>
          {upcoming.map((s: LiveStream) => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-orange-100 text-orange-600">
                📅 {s.scheduled_at ? new Date(s.scheduled_at).toLocaleString() : t('common.scheduled')}
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
          {ended.slice(0, 5).map((s: LiveStream) => (
            <div key={s.id} className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 p-3">
              <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                {s.youtube_video_id && <img src={`https://img.youtube.com/vi/${s.youtube_video_id}/hqdefault.jpg`} alt="" className="w-full h-full object-cover" />}
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

// ── 경매 / 타임딜 컨트롤 ─────────────────────────────────────────
function AuctionTimeDealControls({ streamId, products }: { streamId: number; products: Product[] }) {
  const { t } = useTranslation()
  const [showAuction, setShowAuction] = useState(false)
  const [showTimeDeal, setShowTimeDeal] = useState(false)
  const [showGroupBuy, setShowGroupBuy] = useState(false)
  const [auctionForm, setAuctionForm] = useState({ product_id: 0, title: '', start_price: 1000, min_increment: 1000, duration_seconds: 180 })
  const [dealForm, setDealForm] = useState({ product_id: 0, discount_percent: 30, max_claims: 10, duration_seconds: 30 })
  const [groupBuyForm, setGroupBuyForm] = useState({ product_id: 0, target_participants: 20, bonus_discount_percent: 50, duration_minutes: 10 })
  const [submitting, setSubmitting] = useState(false)
  const [activeAuction, setActiveAuction] = useState<{ ends_at?: string } | null>(null)
  const [activeTimeDeal, setActiveTimeDeal] = useState<{ ends_at?: string; is_group_buy?: boolean } | null>(null)
  const [tick, setTick] = useState(0)
  const token = localStorage.getItem('seller_token')

  // 활성 경매/타임딜 5초 폴링
  useEffect(() => {
    let active = true
    const fetchActive = async () => {
      try {
        const [au, td] = await Promise.allSettled([
          api.get(`/api/auction/stream/${streamId}`),
          api.get(`/api/timedeal/stream/${streamId}`),
        ])
        if (!active) return
        setActiveAuction(au.status === 'fulfilled' && au.value.data?.success ? (au.value.data.data || null) : null)
        setActiveTimeDeal(td.status === 'fulfilled' && td.value.data?.success ? (td.value.data.data || null) : null)
      } catch { /* silent */ }
    }
    fetchActive()
    const id = setInterval(fetchActive, 5000)
    return () => { active = false; clearInterval(id) }
  }, [streamId])

  // 1초 카운트다운 갱신
  useEffect(() => {
    if (!activeAuction?.ends_at && !activeTimeDeal?.ends_at) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [activeAuction?.ends_at, activeTimeDeal?.ends_at])

  function fmtRemaining(endsAt?: string): string {
    if (!endsAt) return ''
    const sec = Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000))
    void tick
    const m = Math.floor(sec / 60), s = sec % 60
    return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
  }

  async function createAuction() {
    if (!auctionForm.title || !auctionForm.start_price) { toast.error(t('seller.liveBroadcast.enterTitleAndPrice')); return }
    setSubmitting(true)
    try {
      const res = await api.post('/api/auction/create', { stream_id: streamId, ...auctionForm }, { headers: { Authorization: `Bearer ${token}` } })
      if (res.data.success) { toast.success(t('seller.liveBroadcast.auctionStarted')); setShowAuction(false) }
      else toast.error(res.data.error)
    } catch (err: unknown) { const e = err as { response?: { data?: { error?: string } } }; toast.error(e?.response?.data?.error || t('seller.liveBroadcast.auctionCreateFailed')) }
    finally { setSubmitting(false) }
  }

  async function createTimeDeal() {
    if (!dealForm.product_id) { toast.error(t('seller.liveBroadcast.selectProduct')); return }
    setSubmitting(true)
    try {
      const res = await api.post('/api/timedeal/create', { stream_id: streamId, ...dealForm }, { headers: { Authorization: `Bearer ${token}` } })
      if (res.data.success) { toast.success(t('seller.liveBroadcast.timeDealStarted', { seconds: dealForm.duration_seconds })); setShowTimeDeal(false) }
      else toast.error(res.data.error)
    } catch (err: unknown) { const e = err as { response?: { data?: { error?: string } } }; toast.error(e?.response?.data?.error || t('seller.liveBroadcast.timeDealCreateFailed')) }
    finally { setSubmitting(false) }
  }

  async function createGroupBuy() {
    if (!groupBuyForm.product_id) { toast.error(t('seller.liveBroadcast.selectProduct')); return }
    setSubmitting(true)
    try {
      const res = await api.post('/api/timedeal/create', {
        stream_id: streamId,
        product_id: groupBuyForm.product_id,
        discount_percent: 0,
        max_claims: 100,
        duration_seconds: groupBuyForm.duration_minutes * 60,
        is_group_buy: true,
        target_participants: groupBuyForm.target_participants,
        bonus_discount_percent: groupBuyForm.bonus_discount_percent,
      }, { headers: { Authorization: `Bearer ${token}` } })
      if (res.data.success) { toast.success(t('seller.liveBroadcast.groupBuyStarted')); setShowGroupBuy(false) }
      else toast.error(res.data.error)
    } catch (err: unknown) { const e = err as { response?: { data?: { error?: string } } }; toast.error(e?.response?.data?.error || t('seller.liveBroadcast.groupBuyCreateFailed')) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="space-y-2">
      {/* 활성 진행 상태 */}
      {(activeAuction || activeTimeDeal) && (
        <div className="flex flex-wrap gap-2">
          {activeAuction && (
            <span className="flex items-center gap-1.5 text-xs bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full font-semibold">
              <Gavel className="w-3 h-3" />
              {t('seller.liveBroadcast.auction')} · {fmtRemaining(activeAuction.ends_at)}
            </span>
          )}
          {activeTimeDeal && (
            <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${activeTimeDeal.is_group_buy ? 'bg-pink-100 text-pink-800' : 'bg-red-100 text-red-800'}`}>
              {activeTimeDeal.is_group_buy ? <Users className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
              {activeTimeDeal.is_group_buy ? t('seller.liveBroadcast.liveGroupBuy') : t('seller.liveBroadcast.timeDeal')} · {fmtRemaining(activeTimeDeal.ends_at)}
            </span>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={() => { setShowAuction(!showAuction); setShowTimeDeal(false); setShowGroupBuy(false) }}
          disabled={!!activeAuction}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 ${showAuction ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
          <Gavel className="w-3.5 h-3.5" /> {t('seller.liveBroadcast.auction')}
        </button>
        <button onClick={() => { setShowTimeDeal(!showTimeDeal); setShowAuction(false); setShowGroupBuy(false) }}
          disabled={!!activeTimeDeal}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 ${showTimeDeal ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600 border border-red-200'}`}>
          <Zap className="w-3.5 h-3.5" /> {t('seller.liveBroadcast.timeDeal')}
        </button>
        <button onClick={() => { setShowGroupBuy(!showGroupBuy); setShowAuction(false); setShowTimeDeal(false) }}
          disabled={!!activeTimeDeal}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 ${showGroupBuy ? 'bg-pink-500 text-white' : 'bg-pink-50 text-pink-600 border border-pink-200'}`}>
          <Users className="w-3.5 h-3.5" /> {t('seller.liveBroadcast.liveGroupBuy')}
        </button>
      </div>

      {showAuction && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
          <p className="text-xs font-bold text-amber-800">{t('seller.liveBroadcast.auctionSetup')}</p>
          <input value={auctionForm.title} onChange={e => setAuctionForm(f => ({ ...f, title: e.target.value }))}
            placeholder={t('seller.liveBroadcast.auctionTitlePlaceholder')} className="w-full px-2.5 py-2 border border-amber-200 rounded-lg text-xs text-gray-900 bg-white" />
          <select value={auctionForm.product_id} onChange={e => setAuctionForm(f => ({ ...f, product_id: Number(e.target.value) }))}
            className="w-full px-2.5 py-2 border border-amber-200 rounded-lg text-xs text-gray-900 bg-white">
            <option value={0}>{t('seller.liveBroadcast.selectProductOptional')}</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="grid grid-cols-3 gap-2">
            {([['start_price', t('seller.liveBroadcast.startPrice')], ['min_increment', t('seller.liveBroadcast.minIncrement')], ['duration_seconds', t('seller.liveBroadcast.durationSec')]] as const).map(([key, label]) => (
              <div key={key}>
                <label className="text-[10px] text-amber-700">{label}</label>
                <input type="number" value={auctionForm[key]} onChange={e => setAuctionForm(f => ({ ...f, [key]: Number(e.target.value) }))}
                  className="w-full px-2 py-1.5 border border-amber-200 rounded-lg text-xs text-gray-900 bg-white" />
              </div>
            ))}
          </div>
          <button onClick={createAuction} disabled={submitting}
            className="w-full py-2 bg-amber-500 text-white text-xs font-bold rounded-lg disabled:opacity-50">
            {submitting ? t('common.creating') : t('seller.liveBroadcast.startAuction')}
          </button>
        </div>
      )}

      {showTimeDeal && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
          <p className="text-xs font-bold text-red-700">{t('seller.liveBroadcast.timeDealSetup')}</p>
          <select value={dealForm.product_id} onChange={e => setDealForm(f => ({ ...f, product_id: Number(e.target.value) }))}
            className="w-full px-2.5 py-2 border border-red-200 rounded-lg text-xs text-gray-900 bg-white">
            <option value={0}>{t('seller.liveBroadcast.selectProductRequired')}</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.price?.toLocaleString()}{t('common.won')})</option>)}
          </select>
          {/* 퀵 프리셋 */}
          <div className="flex gap-1.5">
            {[60, 180, 300].map(sec => (
              <button key={sec} type="button"
                onClick={() => setDealForm(f => ({ ...f, duration_seconds: sec }))}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg border ${
                  dealForm.duration_seconds === sec ? 'bg-red-500 text-white border-red-500' : 'bg-white text-red-600 border-red-200'
                }`}>
                {sec < 60 ? `${sec}s` : `${sec / 60}분`}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([['discount_percent', t('seller.liveBroadcast.discountPercent')], ['max_claims', t('common.quantity')], ['duration_seconds', t('seller.liveBroadcast.durationSec')]] as const).map(([key, label]) => (
              <div key={key}>
                <label className="text-[10px] text-red-600">{label}</label>
                <input type="number" value={dealForm[key]} onChange={e => setDealForm(f => ({ ...f, [key]: Number(e.target.value) }))}
                  className="w-full px-2 py-1.5 border border-red-200 rounded-lg text-xs text-gray-900 bg-white" />
              </div>
            ))}
          </div>
          <button onClick={createTimeDeal} disabled={submitting || !dealForm.product_id}
            className="w-full py-2 bg-red-500 text-white text-xs font-bold rounded-lg disabled:opacity-50">
            {submitting ? t('common.creating') : t('seller.liveBroadcast.startTimeDeal', { seconds: dealForm.duration_seconds })}
          </button>
        </div>
      )}

      {showGroupBuy && (
        <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 space-y-2">
          <p className="text-xs font-bold text-pink-700">{t('seller.liveBroadcast.groupBuySetup')}</p>
          <p className="text-[10px] text-pink-600">{t('seller.liveBroadcast.groupBuySetupDesc')}</p>
          <select value={groupBuyForm.product_id} onChange={e => setGroupBuyForm(f => ({ ...f, product_id: Number(e.target.value) }))}
            className="w-full px-2.5 py-2 border border-pink-200 rounded-lg text-xs text-gray-900 bg-white">
            <option value={0}>{t('seller.liveBroadcast.selectProductRequired')}</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.price?.toLocaleString()}{t('common.won')})</option>)}
          </select>
          <div className="grid grid-cols-3 gap-2">
            {([['target_participants', t('seller.liveBroadcast.targetParticipants')], ['bonus_discount_percent', t('seller.liveBroadcast.discountPercent')], ['duration_minutes', t('seller.liveBroadcast.durationMin')]] as const).map(([key, label]) => (
              <div key={key}>
                <label className="text-[10px] text-pink-600">{label}</label>
                <input type="number" value={groupBuyForm[key]} onChange={e => setGroupBuyForm(f => ({ ...f, [key]: Number(e.target.value) }))}
                  className="w-full px-2 py-1.5 border border-pink-200 rounded-lg text-xs text-gray-900 bg-white" />
              </div>
            ))}
          </div>
          <button onClick={createGroupBuy} disabled={submitting || !groupBuyForm.product_id}
            className="w-full py-2 bg-pink-500 text-white text-xs font-bold rounded-lg disabled:opacity-50">
            {submitting ? t('common.creating') : t('seller.liveBroadcast.startGroupBuy')}
          </button>
        </div>
      )}
    </div>
  )
}
