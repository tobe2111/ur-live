/**
 * 🛡️ 2026-05-07: 방송 시작 전 사전 점검 — 카메라/마이크/네트워크/OBS/익스텐션.
 *
 * 셀러가 "방송 시작" 누르기 전에 noticeable 한 issue 를 미리 발견 + 가이드.
 * 30초 후 "데이터 없음" 으로 멈추는 사고를 사전 방지.
 */
import { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle, Loader2, Info } from 'lucide-react'
import { hasOBSExtension, loadOBSConfig } from '@/lib/obs-websocket'

type CheckStatus = 'pending' | 'pass' | 'warn' | 'fail'

interface CheckResult {
  key: string
  label: string
  status: CheckStatus
  detail?: string
}

interface Props {
  method: 'quick' | 'youtube' | 'obs' | 'prism'
  onAllChecked?: (allPass: boolean) => void
}

export default function BroadcastPreflightCheck({ method, onAllChecked }: Props) {
  const [results, setResults] = useState<CheckResult[]>([])
  const [running, setRunning] = useState(false)

  async function runChecks() {
    setRunning(true)
    const items: CheckResult[] = []

    // 1. 카메라 권한
    try {
      const cam = await navigator.permissions?.query({ name: 'camera' as PermissionName })
      items.push({
        key: 'camera',
        label: '카메라 권한',
        status: cam?.state === 'granted' ? 'pass' : cam?.state === 'denied' ? 'fail' : 'warn',
        detail: cam?.state === 'denied' ? '주소창 자물쇠 → 카메라 → 허용' : cam?.state === 'prompt' ? '아직 미허용 (방송 시작 시 프롬프트)' : undefined,
      })
    } catch {
      items.push({ key: 'camera', label: '카메라 권한', status: 'warn', detail: '확인 불가 (모바일 PWA)' })
    }

    // 2. 마이크 권한 (OBS/Prism 은 자체 처리, Quick/Studio 는 OBS 가 처리)
    try {
      const mic = await navigator.permissions?.query({ name: 'microphone' as PermissionName })
      items.push({
        key: 'mic',
        label: '마이크 권한',
        status: mic?.state === 'granted' ? 'pass' : mic?.state === 'denied' ? 'warn' : 'warn',
        detail: mic?.state === 'denied' ? 'OBS/Prism 자체 마이크는 별도 권한' : undefined,
      })
    } catch {
      items.push({ key: 'mic', label: '마이크 권한', status: 'warn' })
    }

    // 3. 인터넷 RTT
    try {
      const t0 = performance.now()
      await fetch('/api/health', { method: 'GET', cache: 'no-store' })
      const rtt = Math.round(performance.now() - t0)
      items.push({
        key: 'network',
        label: '네트워크 응답',
        status: rtt < 500 ? 'pass' : rtt < 1500 ? 'warn' : 'fail',
        detail: `RTT ${rtt}ms` + (rtt >= 1500 ? ' (불안정 — Wi-Fi 확인)' : ''),
      })
    } catch {
      items.push({ key: 'network', label: '네트워크 응답', status: 'fail', detail: '연결 끊김' })
    }

    // 4. OBS WebSocket (Quick/OBS 모드만)
    if (method === 'quick' || method === 'obs') {
      const cfg = loadOBSConfig()
      const ext = hasOBSExtension()
      items.push({
        key: 'obs',
        label: 'OBS 자동 제어',
        status: cfg ? 'pass' : 'warn',
        detail: cfg
          ? (ext ? 'WebSocket + Extension' : 'WebSocket')
          : 'OBS WebSocket 설정 없음 — 수동 송출 필요',
      })
    }

    // 5. Chrome Extension (YouTube Studio 모드만)
    if (method === 'youtube') {
      items.push({
        key: 'extension',
        label: 'YouTube Studio 익스텐션',
        status: hasOBSExtension() ? 'pass' : 'warn',
        detail: hasOBSExtension() ? '설치됨' : '미설치 — 사이드바 동기화 불가',
      })
    }

    setResults(items)
    setRunning(false)
    const allPass = items.every(i => i.status === 'pass')
    onAllChecked?.(allPass)
  }

  useEffect(() => {
    runChecks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method])

  const failed = results.filter(r => r.status === 'fail').length
  const warned = results.filter(r => r.status === 'warn').length

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
          <Info className="w-4 h-4 text-blue-500" /> 사전 점검
        </p>
        {!running && (
          <span className={`text-[11px] font-bold ${failed > 0 ? 'text-red-600' : warned > 0 ? 'text-amber-600' : 'text-green-600'}`}>
            {failed > 0 ? `❌ ${failed}건 실패` : warned > 0 ? `⚠️ ${warned}건 주의` : '✅ 모두 정상'}
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {running ? (
          <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
            <Loader2 className="w-4 h-4 animate-spin" /> 점검 중…
          </div>
        ) : (
          results.map(r => (
            <div key={r.key} className="flex items-start gap-2 text-xs">
              {r.status === 'pass' && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />}
              {r.status === 'warn' && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />}
              {r.status === 'fail' && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800">{r.label}</p>
                {r.detail && <p className="text-[10px] text-gray-500 leading-tight">{r.detail}</p>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
