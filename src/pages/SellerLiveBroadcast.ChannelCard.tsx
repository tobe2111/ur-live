/**
 * ChannelCard — 활성 YouTube 채널 카드 (다중 채널 picker + 해제 + 토큰 만료 재연동)
 *
 * SellerLiveBroadcastPage.tsx 에서 분리 (TD-006 / audit #10).
 *
 * 🛡️ 2026-04-28: TD-006 추가 분할.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Youtube, Loader2, CheckCircle2 } from 'lucide-react'

export interface YouTubeChannel {
  id: number
  channel_id: string
  channel_title: string
  channel_thumbnail: string
  subscriber_count: number
  is_active: boolean
  has_persistent_key?: boolean
  token_expired?: boolean
}

export default function ChannelCard({ channels, activeChannelId, onSelectChannel, onDisconnect, onReauthenticate, connectingYouTube }: {
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
