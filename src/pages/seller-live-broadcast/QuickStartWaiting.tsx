/**
 * 🛡️ 2026-05-07: Quick 모드 전용 대기 화면 — 자동 OBS 송출 시도.
 *
 * YouTube Studio 모드와 분리:
 *   - YouTube Studio: studio.youtube.com popup + 풀 컨트롤 패널 (전문가)
 *   - Quick: obs-websocket 자동 연결 + RTMP 자동 셋업 + StartStream (초보)
 *
 * 흐름:
 *   1. 저장된 OBS WS 설정 있으면 자동 연결 시도
 *   2. 연결 성공 → SetRtmp + StartStream → 자동 라이브
 *   3. 실패 → OBS 프로필 자동 다운로드 + 수동 가이드 안내
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, AlertCircle, Loader2, Download, Zap } from 'lucide-react'
import { OBSWebSocketClient, loadOBSConfig } from '@/lib/obs-websocket'
import { downloadOBSProfile } from '@/lib/obs-profile'

interface Props {
  stream: { id: number; title: string; rtmp_url?: string | null; rtmp_key?: string | null }
}

type Phase = 'connecting' | 'configuring' | 'starting' | 'done' | 'manual'

export default function QuickStartWaiting({ stream }: Props) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<Phase>('connecting')
  const [error, setError] = useState<string | null>(null)
  const triedRef = useRef(false)

  useEffect(() => {
    if (triedRef.current) return
    triedRef.current = true

    const cfg = loadOBSConfig()
    if (!cfg || !stream.rtmp_url || !stream.rtmp_key) {
      setPhase('manual')
      return
    }

    const client = new OBSWebSocketClient()
    ;(async () => {
      try {
        setPhase('connecting')
        await client.connect(cfg)
        setPhase('configuring')
        await client.setRtmpTarget(stream.rtmp_url!, stream.rtmp_key!)
        setPhase('starting')
        await client.startStreaming()
        setPhase('done')
      } catch (e: unknown) {
        if (import.meta.env.DEV) console.warn('[QuickStart] OBS auto-start failed:', e)
        setError((e as Error).message || '연결 실패')
        setPhase('manual')
      }
    })()

    return () => {
      try { client.disconnect() } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.id])

  if (phase === 'manual') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-900">자동 송출 실패 — 수동 셋업 필요</p>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              {error
                ? `OBS 자동 연결이 안 됐어요 (${error}). 아래 프로필을 다운로드 받아 OBS 에 import 하시거나, "OBS Studio" 모드로 다시 선택해주세요.`
                : 'OBS WebSocket 설정이 없어요. 프로필을 다운로드 받아 OBS 에 import 하시거나, "OBS Studio" 모드로 다시 선택해주세요.'}
            </p>
          </div>
        </div>
        {stream.rtmp_url && stream.rtmp_key && (
          <button
            onClick={() => downloadOBSProfile({
              profileName: 'UR Live',
              rtmpUrl: stream.rtmp_url!,
              rtmpKey: stream.rtmp_key!,
            })}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg py-2.5 flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> OBS 프로필 다운로드
          </button>
        )}
      </div>
    )
  }

  const phaseLabel: Record<Phase, string> = {
    connecting: 'OBS 연결 중…',
    configuring: 'RTMP 설정 적용 중…',
    starting: '송출 시작 중…',
    done: '✅ 자동 송출 시작됨 — 라이브 감지 대기',
    manual: '',
  }

  const phaseColor: Record<Phase, string> = {
    connecting: 'text-blue-600',
    configuring: 'text-purple-600',
    starting: 'text-pink-600',
    done: 'text-green-600',
    manual: '',
  }

  return (
    <div className="bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 border border-pink-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
          <Zap className="w-5 h-5 text-pink-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-900">자동 송출 진행 중</p>
          <p className="text-xs text-gray-600">{stream.title}</p>
        </div>
      </div>

      <div className="bg-white/70 rounded-lg p-3 space-y-2">
        {(['connecting', 'configuring', 'starting', 'done'] as Phase[]).map((p, i) => {
          const order = ['connecting', 'configuring', 'starting', 'done']
          const currentIdx = order.indexOf(phase)
          const thisIdx = order.indexOf(p)
          const isPast = thisIdx < currentIdx
          const isCurrent = thisIdx === currentIdx
          return (
            <div key={p} className="flex items-center gap-2.5">
              {isPast || phase === 'done' ? (
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              ) : isCurrent ? (
                <Loader2 className={`w-4 h-4 animate-spin shrink-0 ${phaseColor[p]}`} />
              ) : (
                <span className="w-4 h-4 rounded-full border-2 border-gray-200 block shrink-0" />
              )}
              <span className={`text-xs ${isCurrent ? 'font-bold ' + phaseColor[p] : isPast ? 'text-gray-500 line-through' : 'text-gray-400'}`}>
                {phaseLabel[p]}
              </span>
            </div>
          )
        })}
      </div>

      <p className="text-[11px] text-gray-500 text-center">
        {t('seller.liveBroadcast.quickAutoNote', { defaultValue: 'obs-websocket 으로 OBS 를 자동 제어합니다. 셀러 액션 불필요.' })}
      </p>
    </div>
  )
}
