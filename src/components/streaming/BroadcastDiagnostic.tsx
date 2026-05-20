/**
 * BroadcastDiagnostic — 방송이 감지되지 않을 때 트러블슈팅 플로우
 *
 * 자동 감지 폴링이 실패 횟수 많거나, 사용자가 명시적으로 클릭한 경우 표시.
 * 체크 항목을 순차적으로 진행하면서 문제 위치를 좁혀줌.
 */

import { useEffect, useState, useRef } from 'react'
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { swallow } from '@/shared/utils/swallow'
import { hasOBSExtension, loadOBSConfig } from '@/lib/obs-websocket'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface Check {
  label: string
  status: 'pending' | 'ok' | 'fail' | 'warn'
  hint?: string
}

interface Props {
  streamId: number
  method: 'obs' | 'prism' | 'youtube' | 'youtube-webcam' | 'quick'
  onClose: () => void
}

export function BroadcastDiagnostic({ streamId, method, onClose }: Props) {
  const { t } = useTranslation()
  const tRef = useRef(t)
  tRef.current = t

  const [checks, setChecks] = useState<Check[]>([])
  const [running, setRunning] = useState(true)

  useEffect(() => {
    const t = tRef.current
    let active = true
    ;(async () => {
      const results: Check[] = []

      // 1. 우리 백엔드와 통신 OK?
      results.push({ label: t('broadcastDiag.checkService', { defaultValue: '우리 서비스 연결' }), status: 'pending' })
      setChecks([...results])
      try {
        const res = await api.get(`/api/seller/youtube/live/${streamId}/status`)
        if (!active) return
        if (res.data?.success) {
          results[0] = { label: t('broadcastDiag.checkService', { defaultValue: '우리 서비스 연결' }), status: 'ok' }
        } else {
          results[0] = { label: t('broadcastDiag.checkService', { defaultValue: '우리 서비스 연결' }), status: 'fail', hint: res.data?.error || t('broadcastDiag.hintResponseFail', { defaultValue: '응답 실패' }) }
        }
      } catch {
        if (!active) return
        results[0] = { label: t('broadcastDiag.checkService', { defaultValue: '우리 서비스 연결' }), status: 'fail', hint: t('broadcastDiag.hintNetworkAuth', { defaultValue: '네트워크 또는 인증 문제. 페이지 새로고침 또는 재로그인.' }) }
      }
      setChecks([...results])

      // 2. YouTube broadcast 상태 체크
      results.push({ label: t('broadcastDiag.checkYouTube', { defaultValue: 'YouTube 방송 상태' }), status: 'pending' })
      setChecks([...results])
      try {
        const res = await api.get(`/api/seller/youtube/live/${streamId}/status`)
        if (!active) return
        const ytStatus = res.data?.data?.youtube_status
        if (ytStatus === 'live') {
          results[1] = { label: t('broadcastDiag.checkYouTube', { defaultValue: 'YouTube 방송 상태' }), status: 'ok', hint: t('broadcastDiag.hintYTLive', { defaultValue: 'YouTube 가 라이브로 감지. 우리 앱 자동 전환 대기.' }) }
        } else if (ytStatus === 'ready' || ytStatus === 'testing') {
          results[1] = { label: t('broadcastDiag.checkYouTube', { defaultValue: 'YouTube 방송 상태' }), status: 'warn', hint: t('broadcastDiag.hintYTReady', { defaultValue: 'YouTube 가 RTMP 신호 수신 중이지만 아직 live 아님. 송출 도구에서 방송 시작 누르세요.' }) }
        } else if (ytStatus === 'created') {
          results[1] = { label: t('broadcastDiag.checkYouTube', { defaultValue: 'YouTube 방송 상태' }), status: 'warn', hint: t('broadcastDiag.hintYTCreated', { defaultValue: 'YouTube 가 RTMP 신호를 받지 못함. 송출 도구 RTMP URL/Key 확인.' }) }
        } else {
          results[1] = { label: t('broadcastDiag.checkYouTube', { defaultValue: 'YouTube 방송 상태' }), status: 'fail', hint: t('broadcastDiag.hintYTStatus', { status: ytStatus || 'unknown', defaultValue: `YouTube 상태: ${ytStatus || 'unknown'}` }) }
        }
      } catch { if (active) results[1] = { label: t('broadcastDiag.checkYouTube', { defaultValue: 'YouTube 방송 상태' }), status: 'fail', hint: t('broadcastDiag.hintQueryFail', { defaultValue: '조회 실패' }) } }
      setChecks([...results])

      // 3. 방법별 도구 체크
      if (method === 'obs') {
        results.push({ label: t('broadcastDiag.checkOBS', { defaultValue: 'OBS 연결 (WebSocket)' }), status: 'pending' })
        setChecks([...results])
        const cfg = loadOBSConfig()
        if (!cfg) {
          results[results.length - 1] = { label: t('broadcastDiag.checkOBS', { defaultValue: 'OBS 연결 (WebSocket)' }), status: 'warn', hint: t('broadcastDiag.hintOBSNotSet', { defaultValue: 'OBS WebSocket 미설정. 직접 송출 중이면 OK, 자동 시작 원하면 OBS 설정 필요.' }) }
        } else {
          const isHttps = window.location.protocol === 'https:'
          if (isHttps && !hasOBSExtension()) {
            results[results.length - 1] = { label: t('broadcastDiag.checkOBS', { defaultValue: 'OBS 연결 (WebSocket)' }), status: 'fail', hint: t('broadcastDiag.hintOBSHttps', { defaultValue: 'HTTPS 에서 ws://localhost 차단. Chrome Extension "UR Live — OBS Bridge" 설치 필요.' }) }
          } else {
            results[results.length - 1] = { label: t('broadcastDiag.checkOBS', { defaultValue: 'OBS 연결 (WebSocket)' }), status: 'ok' }
          }
        }
        setChecks([...results])

        results.push({ label: t('broadcastDiag.checkOBSProcess', { defaultValue: 'OBS 프로세스' }), status: 'warn', hint: t('broadcastDiag.hintOBSProcess', { defaultValue: 'OBS 창이 열려있는지 확인. 닫혀 있으면 RTMP 송출 안 됨.' }) })
      } else if (method === 'prism') {
        results.push({ label: t('broadcastDiag.checkPrism', { defaultValue: 'Prism 앱 상태' }), status: 'warn', hint: t('broadcastDiag.hintPrism', { defaultValue: '휴대폰에서 Prism 앱이 실제 송출 중인지 확인. 앱에서 "녹화" 가 아닌 "송출" 버튼 눌렀는지 확인.' }) })
      } else {
        results.push({ label: t('broadcastDiag.checkYTStudio', { defaultValue: 'YouTube Studio' }), status: 'warn', hint: t('broadcastDiag.hintYTStudio', { defaultValue: 'YouTube Studio 팝업에서 "방송 시작" 눌렀는지 확인. 팝업이 닫혔으면 다시 열기.' }) })
      }
      setChecks([...results])

      // 4. 네트워크 체크 (간단한 RTT)
      results.push({ label: t('broadcastDiag.checkNetwork', { defaultValue: '네트워크 상태' }), status: 'pending' })
      setChecks([...results])
      try {
        const t0 = performance.now()
        await api.get('/api/health').catch(swallow('broadcast:diag-health'))
        const rtt = performance.now() - t0
        if (!active) return
        if (rtt < 300) results[results.length - 1] = { label: t('broadcastDiag.checkNetwork', { defaultValue: '네트워크 상태' }), status: 'ok', hint: `RTT ${Math.round(rtt)}ms` }
        else if (rtt < 1000) results[results.length - 1] = { label: t('broadcastDiag.checkNetwork', { defaultValue: '네트워크 상태' }), status: 'warn', hint: t('broadcastDiag.hintNetworkSlow', { rtt: Math.round(rtt), defaultValue: `RTT ${Math.round(rtt)}ms (느림)` }) }
        else results[results.length - 1] = { label: t('broadcastDiag.checkNetwork', { defaultValue: '네트워크 상태' }), status: 'fail', hint: t('broadcastDiag.hintNetworkVerySlow', { rtt: Math.round(rtt), defaultValue: `RTT ${Math.round(rtt)}ms (매우 느림)` }) }
      } catch { if (active) results[results.length - 1] = { label: t('broadcastDiag.checkNetwork', { defaultValue: '네트워크 상태' }), status: 'warn', hint: t('broadcastDiag.hintNetworkUnmeasurable', { defaultValue: '측정 불가' }) } }
      setChecks([...results])
      setRunning(false)
    })()
    return () => { active = false }
  }, [streamId, method])

  // 🛡️ 2026-04-29 a11y: ESC 닫기
  useEscapeKey(onClose)

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="broadcast-diagnostic-title"
        className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl max-h-[85dvh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div>
          <h3 id="broadcast-diagnostic-title" className="text-lg font-bold text-gray-900">{t('broadcastDiag.title', { defaultValue: '🔍 방송 감지 진단' })}</h3>
          <p className="text-xs text-gray-500 mt-1">{t('broadcastDiag.subtitle', { defaultValue: '아래 체크를 확인하여 문제 위치를 찾아보세요.' })}</p>
        </div>
        <ul className="space-y-2">
          {checks.map((c, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className="shrink-0 mt-0.5">
                {c.status === 'pending' && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                {c.status === 'ok' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                {c.status === 'warn' && <AlertCircle className="w-4 h-4 text-amber-500" />}
                {c.status === 'fail' && <XCircle className="w-4 h-4 text-red-500" />}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`font-medium ${c.status === 'fail' ? 'text-red-700' : c.status === 'warn' ? 'text-amber-700' : 'text-gray-900'}`}>
                  {c.label}
                </p>
                {c.hint && <p className="text-[11px] text-gray-500 mt-0.5">{c.hint}</p>}
              </div>
            </li>
          ))}
        </ul>
        {/* 🛡️ 2026-05-13: 자동 복구 액션 버튼 — 진단 후 셀러가 직접 복구 가능 */}
        {!running && <RecoveryActions streamId={streamId} />}

        <button onClick={onClose} disabled={running}
          className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold disabled:opacity-50">
          {running ? t('broadcastDiag.diagnosing', { defaultValue: '진단 중...' }) : t('broadcastDiag.close', { defaultValue: '닫기' })}
        </button>
      </div>
    </div>
  )
}

/**
 * 🛡️ 2026-05-13: 셀러 본인이 누를 수 있는 복구 액션 모음.
 *
 * 콘솔 fetch 안 켜고 버튼 한 번으로:
 *   - force-transition: YouTube broadcast 가 'ready' 정체일 때 강제 live 전환
 *   - reset-zombie: DB.status='live' 인데 OME 에 stream 없을 때 scheduled 로 복귀
 */
function RecoveryActions({ streamId }: { streamId: number }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<{ kind: string; ok: boolean; message: string } | null>(null)

  const call = async (action: 'force-transition' | 'reset-zombie') => {
    setBusy(action)
    setLastResult(null)
    try {
      const res = await api.post(`/api/seller/youtube/live/${streamId}/${action}`)
      const data = res.data
      setLastResult({
        kind: action,
        ok: !!data?.success,
        message: data?.message || data?.error || (data?.success ? '완료' : '실패'),
      })
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string }
      setLastResult({
        kind: action,
        ok: false,
        message: err?.response?.data?.error || err?.message || '실패',
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-2 border-t border-gray-100 dark:border-[#1A1A1A] pt-3">
      <div className="text-xs font-semibold text-gray-700 flex items-center gap-1">🛠️ 자동 복구</div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => call('force-transition')}
          disabled={!!busy}
          className="px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-semibold disabled:opacity-50"
          title="YouTube 가 영상을 'ready' 에서 'live' 로 전환 못 하고 있을 때"
        >
          {busy === 'force-transition' ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : '⚡ 강제 라이브 전환'}
        </button>
        <button
          onClick={() => call('reset-zombie')}
          disabled={!!busy}
          className="px-3 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-xs font-semibold disabled:opacity-50"
          title="DB 에는 라이브인데 실제 송출 신호가 없을 때 (좀비)"
        >
          {busy === 'reset-zombie' ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : '🔄 좀비 복구'}
        </button>
      </div>
      {lastResult && (
        <div className={`text-[11px] px-2 py-1.5 rounded-lg ${lastResult.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {lastResult.ok ? '✅' : '❌'} {lastResult.message}
        </div>
      )}
      <p className="text-[10px] text-gray-500 leading-relaxed">
        ⚡ 강제 전환: YouTube 가 영상 받았는데 'ready' 정체 시. 🔄 좀비 복구: DB만 live, 실제 송출 X 시 → 다시 시작 가능.
      </p>
    </div>
  )
}
