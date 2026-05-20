/**
 * 🛡️ 2026-05-07: YouTube Live Chat 동기화 표시 + 옵션 활성화.
 *
 * 동작:
 *   - 셀러가 토글 ON → /api/youtube/live/:id/chat polling 시작
 *   - 새 메시지 → 우리 채팅 시스템으로 forward (chatPostFn)
 *   - YouTube API quota 보호: pollingIntervalMillis 응답값 준수
 *
 * 토글 OFF 가 default — 셀러가 명시적으로 켜야 시작 (quota 절약).
 */
import { useEffect, useRef, useState } from 'react'
import { Youtube, MessageSquare, Loader2 } from 'lucide-react'
import api from '@/lib/api'

interface YouTubeChatItem {
  id: string
  message: string
  author: string
  avatar?: string
  isOwner: boolean
  isModerator: boolean
  published_at?: string
  type: string
}

interface Props {
  streamId: number
  onMessage?: (msg: YouTubeChatItem) => void
}

// 🛡️ 2026-05-07: localStorage 로 토글 상태 영구 저장 + default ON.
//   YouTube Studio 모드 셀러는 채팅 통합이 핵심 가치 → default ON 으로 변경.
const STORAGE_KEY = 'ur_yt_chat_sync_enabled_v2'

export default function YouTubeChatSyncIndicator({ streamId, onMessage }: Props) {
  const [enabled, setEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved === null ? true : saved === '1' // default ON
    } catch { return true }
  })

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0') } catch { /* ignore */ }
  }, [enabled])
  const [polling, setPolling] = useState(false)
  const [count, setCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const tokenRef = useRef<string>('')
  const seenIdsRef = useRef<Set<string>>(new Set())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelRef = useRef(false)

  useEffect(() => {
    if (!enabled) {
      cancelRef.current = true
      if (timerRef.current) clearTimeout(timerRef.current)
      setPolling(false)
      return
    }
    cancelRef.current = false

    async function poll() {
      if (cancelRef.current) return
      setPolling(true)
      setError(null)
      try {
        const res = await api.get(`/api/youtube/live/${streamId}/chat`, {
          params: {
            forward: '1',
            ...(tokenRef.current ? { nextPageToken: tokenRef.current } : {}),
          },
        })
        if (res.data?.success) {
          const items = (res.data.data.items || []) as YouTubeChatItem[]
          for (const item of items) {
            if (seenIdsRef.current.has(item.id)) continue
            seenIdsRef.current.add(item.id)
            onMessage?.(item)
            setCount(c => c + 1)
          }
          tokenRef.current = res.data.data.next_page_token || ''
          const interval = Math.max(3000, res.data.data.polling_interval_ms || 5000)
          if (!cancelRef.current) {
            timerRef.current = setTimeout(poll, interval)
          }
        } else {
          setError(res.data?.error || '실패')
          // 실패 시 10초 후 재시도
          if (!cancelRef.current) timerRef.current = setTimeout(poll, 10000)
        }
      } catch (e: unknown) {
        setError((e as Error).message || '에러')
        if (!cancelRef.current) timerRef.current = setTimeout(poll, 10000)
      } finally {
        setPolling(false)
      }
    }

    poll()
    return () => {
      cancelRef.current = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, streamId])

  return (
    <div className="bg-white border border-gray-200 dark:border-[#2A2A2A] rounded-xl p-3 flex items-center gap-3">
      <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center shrink-0">
        <Youtube className="w-5 h-5 text-red-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-bold text-gray-900">YouTube 채팅 동기화</p>
          {polling && <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />}
        </div>
        <p className="text-[11px] text-gray-500">
          {enabled
            ? error
              ? `에러: ${error.slice(0, 50)}`
              : `수신 ${count}건 · YouTube → 우리 채팅 자동 전달`
            : 'OFF — 켜면 YouTube 라이브 채팅을 우리 채팅으로 가져와요'}
        </p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer shrink-0">
        <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="sr-only peer" />
        <div className="w-9 h-5 bg-gray-200 peer-checked:bg-red-500 rounded-full peer-focus:ring-2 peer-focus:ring-red-300 transition" />
        <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
      </label>
      {count > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-gray-500 shrink-0">
          <MessageSquare className="w-3 h-3" />
          {count}
        </div>
      )}
    </div>
  )
}
