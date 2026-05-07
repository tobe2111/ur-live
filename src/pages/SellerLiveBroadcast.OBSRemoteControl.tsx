/**
 * OBSRemoteControl — OBS WebSocket v5 원격 제어 컴포넌트.
 *
 * OBS 28+ Tools → WebSocket Server Settings 에서 활성화. 같은 네트워크에서
 * password 인증 후 시작/중지/씬전환/네트워크상태 모니터링.
 *
 *   - 미연결 상태: RTMP URL/Key 복사 + 권장 프리셋 + OBS 프로파일 다운로드
 *   - 연결됨: 씬 미리보기 (3초 폴링) + 씬 전환 + 시작/중지 + 네트워크 통계
 *
 * SellerLiveBroadcastPage.tsx 에서 분리 (TD-006).
 *
 * 🛡️ 2026-04-28: TD-006 추가 분할 — 270줄.
 */
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Copy, Loader2, Radio } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import {
  OBSWebSocketClient, type OBSConnectConfig, type OBSStatus,
  saveOBSConfig, loadOBSConfig, clearOBSConfig, hasOBSExtension
} from '@/lib/obs-websocket'
import { downloadOBSProfile } from '@/lib/obs-profile'
import { RtmpBlock, RecommendedPresetBlock } from './SellerLiveBroadcast.parts'
import { formatNumber } from '@/utils/format'
import OBSWebSocketSetupWizard from '@/components/streaming/OBSWebSocketSetupWizard'

interface LiveStreamLite {
  id: number
  title: string
  rtmp_url?: string
  rtmp_key?: string
}

function parseTimecode(tc: string): number {
  const parts = tc.split(':')
  if (parts.length !== 3) return 0
  const [h, m, sWithMs] = parts
  const s = parseFloat(sWithMs)
  return Number(h) * 3600 + Number(m) * 60 + (isNaN(s) ? 0 : s)
}

export default function OBSRemoteControl({ stream, hasPersistentKey, copiedField, onCopy }: {
  stream: LiveStreamLite; hasPersistentKey: boolean
  copiedField: string | null; onCopy: (v: string, k: string) => void
}) {
  const { t } = useTranslation()
  const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone/i.test(navigator.userAgent)
  const clientRef = useRef<OBSWebSocketClient | null>(null)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const [setupForm, setSetupForm] = useState<OBSConnectConfig>(() =>
    loadOBSConfig() || { host: 'localhost', port: 4455, password: '' })
  const [obsStatus, setObsStatus] = useState<OBSStatus>({ outputActive: false })
  const [starting, setStarting] = useState(false)
  const [showWizard, setShowWizard] = useState(false)

  // 저장된 설정 있으면 자동 연결 시도
  useEffect(() => {
    const cfg = loadOBSConfig()
    if (!cfg) return
    const client = new OBSWebSocketClient()
    clientRef.current = client
    const off = client.onStatusChange(s => setObsStatus(prev => ({ ...prev, ...s })))
    setConnecting(true)
    client.connect(cfg).then(ok => {
      setConnected(ok)
      setConnecting(false)
    })
    return () => { off(); client.disconnect() }
  }, [])

  // 연결됨 & 스트리밍 중 → 3초마다 OBS 씬 미리보기 스크린샷
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!connected || !clientRef.current) return
    let active = true
    const tick = async () => {
      try {
        const img = await clientRef.current?.getPreviewScreenshot()
        if (active) setPreviewUrl(img || null)
      } catch { if (active) setPreviewUrl(null) }
    }
    tick()
    const id = setInterval(tick, 3000)
    return () => { active = false; clearInterval(id) }
  }, [connected, obsStatus.currentScene])

  async function connect() {
    if (!clientRef.current) clientRef.current = new OBSWebSocketClient()
    setConnecting(true)
    const ok = await clientRef.current.connect(setupForm)
    setConnecting(false)
    if (ok) {
      saveOBSConfig(setupForm)
      setConnected(true)
      setShowSetup(false)
      toast.success(t('seller.liveBroadcast.obsConnected'))
    } else {
      toast.error(t('seller.liveBroadcast.obsConnectFailed'))
    }
  }

  function disconnect() {
    clientRef.current?.disconnect()
    clientRef.current = null
    clearOBSConfig()
    setConnected(false)
  }

  async function startOBSStream() {
    if (!clientRef.current || !stream.rtmp_url || !stream.rtmp_key) return
    setStarting(true)
    try {
      await clientRef.current.setRtmpTarget(stream.rtmp_url, stream.rtmp_key)
      await clientRef.current.startStreaming()
      toast.success(t('seller.liveBroadcast.obsStreamStarted'))
    } catch {
      toast.error(t('seller.liveBroadcast.obsStreamFailed'))
    } finally {
      setStarting(false)
    }
  }

  // ── 모바일: OBS WebSocket 불필요 — Larix/Streamlabs RTMP 안내
  if (isMobile) {
    const fullRtmpUrl = stream.rtmp_url && stream.rtmp_key
      ? (stream.rtmp_url.endsWith('/') ? `${stream.rtmp_url}${stream.rtmp_key}` : `${stream.rtmp_url}/${stream.rtmp_key}`)
      : ''
    const larixLink = fullRtmpUrl
      ? `larix://set/?name=${encodeURIComponent(stream.title || 'UR Live')}&url=${encodeURIComponent(fullRtmpUrl)}&mode=audio%2Bvideo`
      : ''

    return (
      <div className="space-y-4">
        {/* Larix 딥링크 — 공식 URL scheme, RTMP 자동 입력 */}
        {larixLink && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2">
              <span className="text-xl shrink-0">🚀</span>
              <div>
                <p className="text-sm font-bold text-indigo-900">Larix Broadcaster (권장)</p>
                <p className="text-xs text-indigo-700 mt-0.5">{t('seller.liveBroadcast.larixDesc')}</p>
              </div>
            </div>
            <a href={larixLink}
              className="block w-full text-center py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg">
              {t('seller.liveBroadcast.larixConnect', { defaultValue: 'Larix 앱으로 자동 연결' })}
            </a>
            <p className="text-[10px] text-indigo-600">{t('seller.liveBroadcast.larixHint')}</p>
          </div>
        )}

        {/* RTMP 수동 복사 */}
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-purple-800">{t('seller.liveBroadcast.rtmpManualLabel')}</p>
          {stream.rtmp_url && (
            <button onClick={() => onCopy(`URL: ${stream.rtmp_url}\nKey: ${stream.rtmp_key}`, 'all')}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2">
              {copiedField === 'all' ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedField === 'all' ? '복사됨!' : 'RTMP URL + Key 복사'}
            </button>
          )}
          <RtmpBlock label="RTMP URL" value={stream.rtmp_url || ''} fieldKey="rtmp_url" copiedField={copiedField} onCopy={onCopy} />
          {stream.rtmp_key && <RtmpBlock label="Stream Key" value={stream.rtmp_key} fieldKey="rtmp_key" copiedField={copiedField} onCopy={onCopy} />}
        </div>

        {/* Prism 모드 권장 */}
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
          <span className="text-base shrink-0">💡</span>
          <p className="text-xs text-green-800">{t('seller.liveBroadcast.prismTip')}</p>
        </div>
      </div>
    )
  }

  // ── 미연결: 연결 UI OR 기존 RTMP 복사 fallback ─────────────────
  if (!connected) {
    return (
      <div className="space-y-3">
        {hasPersistentKey ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
            <div className="flex-1">
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
              <summary className="cursor-pointer text-purple-700 hover:text-purple-900 select-none">{t('seller.liveBroadcast.showIndividual')}</summary>
              <div className="mt-2 space-y-2">
                <RtmpBlock label="RTMP URL" value={stream.rtmp_url} fieldKey="rtmp_url" copiedField={copiedField} onCopy={onCopy} />
                {stream.rtmp_key && <RtmpBlock label={t('seller.liveBroadcast.streamKey')} value={stream.rtmp_key} fieldKey="rtmp_key" copiedField={copiedField} onCopy={onCopy} />}
                <RecommendedPresetBlock tool="obs" />
                <button
                  onClick={() => downloadOBSProfile({
                    profileName: 'UR Live',
                    rtmpUrl: stream.rtmp_url!,
                    rtmpKey: stream.rtmp_key || '',
                  })}
                  className="w-full py-2 bg-white border border-purple-300 hover:bg-purple-50 text-purple-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5">
                  📥 OBS 프로파일 파일 다운로드 (최초 1회)
                </button>
              </div>
            </details>
          </div>
        )}

        {/* 🛡️ 2026-05-07: OBS 자동 송출 셋업 마법사 — 모든 환경에서 노출 (HTTPS 차단 사전 안내 포함) */}
        {showWizard && (
          <OBSWebSocketSetupWizard
            onCancel={() => setShowWizard(false)}
            onComplete={async (cfg) => {
              if (!clientRef.current) clientRef.current = new OBSWebSocketClient()
              const ok = await clientRef.current.connect(cfg)
              if (ok) {
                setSetupForm(cfg)
                setConnected(true)
                setShowWizard(false)
              }
              return ok
            }}
          />
        )}

        {/* OBS 원격 제어 연결 — Wizard 추천 + 고급 manual 옵션 */}
        {!showWizard && (hasOBSExtension() || (typeof window !== 'undefined' && window.location.protocol !== 'https:') ||
          (typeof window !== 'undefined' && window.location.protocol === 'https:')) && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          {!showSetup ? (
            <div className="space-y-2">
              <button onClick={() => setShowWizard(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg flex items-center justify-center gap-2 text-sm font-bold">
                🪄 OBS 자동 송출 셋업 마법사 (1회만, 약 1분)
              </button>
              <button onClick={() => setShowSetup(true)}
                className="w-full text-[11px] text-blue-600 hover:text-blue-800 py-1.5 underline">
                고급: 직접 host/port/password 입력
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-blue-900">{t('seller.liveBroadcast.obsConnectTitle')}</p>
              <p className="text-[10px] text-blue-700">
                OBS → Tools → WebSocket Server Settings 에서 Enable + Password 설정 후 아래 입력
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input value={setupForm.host} onChange={e => setSetupForm(f => ({ ...f, host: e.target.value }))}
                  placeholder="localhost"
                  className="px-2 py-1.5 border border-blue-200 rounded-lg text-xs text-gray-900 bg-white" />
                <input type="number" value={setupForm.port} onChange={e => setSetupForm(f => ({ ...f, port: Number(e.target.value) || 4455 }))}
                  placeholder="4455"
                  className="px-2 py-1.5 border border-blue-200 rounded-lg text-xs text-gray-900 bg-white" />
              </div>
              <input type="password" value={setupForm.password || ''}
                onChange={e => setSetupForm(f => ({ ...f, password: e.target.value }))}
                placeholder={t('seller.liveBroadcast.obsPassword') as string}
                className="w-full px-2 py-1.5 border border-blue-200 rounded-lg text-xs text-gray-900 bg-white" />
              <div className="flex gap-2">
                <button onClick={() => setShowSetup(false)}
                  className="flex-1 py-2 bg-white border border-blue-200 text-blue-700 rounded-lg text-xs font-semibold">
                  {t('common.cancel')}
                </button>
                <button onClick={connect} disabled={connecting}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50">
                  {connecting ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : t('seller.liveBroadcast.obsConnect')}
                </button>
              </div>
              <p className="text-[9px] text-blue-600 mt-1">
                💡 HTTPS 브라우저에서 ws://localhost 연결은 Mixed Content 로 차단될 수 있어요. 개발 환경 먼저 테스트 권장.
              </p>
            </div>
          )}
        </div>
        )}
      </div>
    )
  }

  // ── 연결됨: 원격 제어 UI ────────────────────────────────────────
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <p className="text-sm font-bold text-blue-900">{t('seller.liveBroadcast.obsConnectedTitle')}</p>
        </div>
        <button onClick={disconnect} className="text-[10px] text-blue-600 hover:text-blue-800 underline">
          {t('seller.liveBroadcast.obsDisconnect')}
        </button>
      </div>

      {previewUrl && (
        <div className="bg-black rounded-lg overflow-hidden">
          <img src={previewUrl} alt="OBS preview" className="w-full aspect-video object-contain" loading="lazy" />
          <p className="text-[10px] text-white/70 px-2 py-1 bg-black/60">
            🎬 {t('seller.liveBroadcast.obsLivePreview')} · {obsStatus.currentScene}
          </p>
        </div>
      )}

      {obsStatus.outputActive ? (
        <div className="bg-red-500 text-white rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-sm font-bold">{t('seller.liveBroadcast.obsStreaming')}</span>
            {obsStatus.outputTimecode && <span className="text-xs font-mono opacity-90">{obsStatus.outputTimecode}</span>}
          </div>
        </div>
      ) : (
        <button onClick={startOBSStream} disabled={starting || !stream.rtmp_url}
          className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2">
          {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
          {t('seller.liveBroadcast.obsStartFromApp')}
        </button>
      )}

      {obsStatus.sceneList && obsStatus.sceneList.length > 1 && (
        <div>
          <p className="text-[10px] font-semibold text-blue-700 mb-1.5">{t('seller.liveBroadcast.obsScenes')}</p>
          <div className="flex gap-1.5 flex-wrap">
            {obsStatus.sceneList.map(scene => (
              <button key={scene}
                onClick={() => clientRef.current?.switchScene(scene)}
                className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
                  obsStatus.currentScene === scene
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-blue-700 border-blue-200 hover:border-blue-400'
                }`}>
                {scene}
              </button>
            ))}
          </div>
        </div>
      )}

      {obsStatus.outputActive && (
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          {obsStatus.outputCongestion !== undefined && (
            <div className="bg-white/60 rounded-md px-2 py-1.5 text-center">
              <p className="text-blue-600">{t('seller.liveBroadcast.obsNetworkHealth')}</p>
              <p className="font-bold text-gray-900">
                {obsStatus.outputCongestion < 0.3 ? t('seller.liveBroadcast.networkGood') : obsStatus.outputCongestion < 0.7 ? t('seller.liveBroadcast.networkOk') : t('seller.liveBroadcast.networkBad')}
              </p>
            </div>
          )}
          {obsStatus.outputBytes !== undefined && obsStatus.outputTimecode && (() => {
            const sec = parseTimecode(obsStatus.outputTimecode)
            const kbps = sec > 0 ? Math.round((obsStatus.outputBytes * 8) / sec / 1000) : 0
            return (
              <div className="bg-white/60 rounded-md px-2 py-1.5 text-center">
                <p className="text-blue-600">{t('seller.liveBroadcast.statsBitrate')}</p>
                <p className="font-bold text-gray-900">{formatNumber(kbps)} kbps</p>
              </div>
            )
          })()}
          {obsStatus.outputTotalFrames !== undefined && obsStatus.outputSkippedFrames !== undefined && (() => {
            const total = obsStatus.outputTotalFrames || 0
            const drop = obsStatus.outputSkippedFrames || 0
            const pct = total > 0 ? (drop / total) * 100 : 0
            return (
              <div className="bg-white/60 rounded-md px-2 py-1.5 text-center">
                <p className="text-blue-600">{t('seller.liveBroadcast.statsDroppedFrames')}</p>
                <p className={`font-bold ${pct < 1 ? 'text-gray-900' : pct < 5 ? 'text-amber-600' : 'text-red-600'}`}>
                  {drop} ({pct.toFixed(1)}%)
                </p>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
