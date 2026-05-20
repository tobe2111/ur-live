/**
 * 🛡️ 2026-05-07: obs-websocket 인라인 셋업 마법사.
 *
 * 셀러가 다른 페이지로 이동 없이 OBS 안에서 WebSocket 활성화 + 비번 설정 + 우리 입력
 * 까지 한 번에 끝낼 수 있게 step-by-step 가이드 + 인라인 입력 폼.
 *
 * HTTPS Mixed Content 제약 (Chrome Extension 미설치 시) 도 1단계에서 사전 안내.
 */
import { useState } from 'react'
import { CheckCircle2, Copy, ExternalLink, ShieldAlert, Info } from 'lucide-react'
import { saveOBSConfig, hasOBSExtension, type OBSConnectConfig } from '@/lib/obs-websocket'
import { toast } from '@/hooks/useToast'

interface Props {
  onComplete: (cfg: OBSConnectConfig) => Promise<boolean> | boolean
  onCancel: () => void
}

export default function OBSWebSocketSetupWizard({ onComplete, onCancel }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [host, setHost] = useState('localhost')
  const [port, setPort] = useState(4455)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const isHttps = typeof location !== 'undefined' && location.protocol === 'https:'
  const extInstalled = hasOBSExtension()
  const blockedByMixedContent = isHttps && !extInstalled && (host === 'localhost' || host === '127.0.0.1')

  async function tryConnect() {
    setBusy(true)
    try {
      const ok = await onComplete({ host, port, password })
      if (ok) {
        saveOBSConfig({ host, port, password })
        toast.success('OBS 연결 성공! 다음 방송부터 자동 송출됩니다.')
      }
    } catch (e: unknown) {
      toast.error((e as Error).message || '연결 실패')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white border-2 border-purple-200 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base font-bold text-gray-900">OBS 자동 송출 셋업</p>
          <p className="text-xs text-gray-500">1회 설정 후 매 방송 OBS 자동 시작/종료</p>
        </div>
        <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600">건너뛰기</button>
      </div>

      {/* 진행 표시 */}
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-purple-500' : 'bg-gray-100'}`} />
        ))}
      </div>

      {/* 1단계: 사전 안내 */}
      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-900">1단계 — 사전 확인</p>
          {blockedByMixedContent ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs text-red-900 leading-relaxed">
                  <b>HTTPS 보안 정책으로 ws://localhost 직접 연결이 차단됩니다.</b>
                  <br />
                  Chrome Extension <b>"UR Live Broadcaster"</b> 설치가 필요해요.
                </p>
              </div>
              <a href="/seller/guide#chrome-extension" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-red-700 hover:text-red-800">
                익스텐션 설치 가이드 <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <p className="text-xs text-green-900">
                {extInstalled ? 'Extension 설치됨 — 모든 환경에서 OBS 자동 제어 가능' : 'localhost 직접 연결 가능 (개발 환경)'}
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={onCancel} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold">취소</button>
            <button onClick={() => setStep(2)} disabled={blockedByMixedContent}
              className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-lg text-xs font-semibold">
              다음 →
            </button>
          </div>
        </div>
      )}

      {/* 2단계: OBS Tools → WebSocket */}
      {step === 2 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-900">2단계 — OBS 에서 WebSocket 활성화</p>
          <ol className="space-y-2 text-xs text-gray-700">
            <li className="flex gap-2"><span className="font-bold text-purple-600">1.</span> OBS Studio 28 이상 실행</li>
            <li className="flex gap-2"><span className="font-bold text-purple-600">2.</span> 상단 메뉴 <kbd className="px-1.5 py-0.5 bg-gray-100 rounded font-mono text-[10px]">Tools</kbd> → <kbd className="px-1.5 py-0.5 bg-gray-100 rounded font-mono text-[10px]">WebSocket Server Settings</kbd></li>
            <li className="flex gap-2"><span className="font-bold text-purple-600">3.</span> <b>"Enable WebSocket Server"</b> 체크 ✓</li>
            <li className="flex gap-2"><span className="font-bold text-purple-600">4.</span> 비밀번호 자동 생성 또는 직접 입력 (예: <code className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">urlive123</code>)</li>
            <li className="flex gap-2"><span className="font-bold text-purple-600">5.</span> <b>"Apply"</b> 클릭</li>
          </ol>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-800">
              OBS 27 이하면 <a href="https://github.com/obsproject/obs-websocket/releases" target="_blank" rel="noopener noreferrer"
                className="underline font-semibold">obs-websocket 플러그인</a>을 별도 설치하세요.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold">← 이전</button>
            <button onClick={() => setStep(3)} className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold">완료, 다음 →</button>
          </div>
        </div>
      )}

      {/* 3단계: 정보 입력 */}
      {step === 3 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-900">3단계 — 연결 정보 입력</p>
          <p className="text-[11px] text-gray-500">OBS 의 WebSocket Server Settings 화면에서 본 정보를 입력해주세요.</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-gray-700 mb-1">Host (보통 localhost)</label>
              <input value={host} onChange={e => setHost(e.target.value)}
                className="w-full px-2.5 py-2 border border-gray-200 dark:border-[#2A2A2A] rounded-lg text-sm text-gray-900 bg-white" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-700 mb-1">Port (보통 4455)</label>
              <input type="number" value={port} onChange={e => setPort(Number(e.target.value) || 4455)}
                className="w-full px-2.5 py-2 border border-gray-200 dark:border-[#2A2A2A] rounded-lg text-sm text-gray-900 bg-white" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-700 mb-1">비밀번호</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="OBS 에서 설정한 비밀번호"
              className="w-full px-2.5 py-2 border border-gray-200 dark:border-[#2A2A2A] rounded-lg text-sm text-gray-900 bg-white" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold">← 이전</button>
            <button onClick={() => setStep(4)} disabled={!password}
              className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-lg text-xs font-semibold">
              연결 테스트 →
            </button>
          </div>
        </div>
      )}

      {/* 4단계: 연결 테스트 + 저장 */}
      {step === 4 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-900">4단계 — 연결 + 저장</p>
          <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-xs">
            <p className="font-mono text-gray-700">{host}:{port}</p>
            <p className="text-gray-500">비밀번호: {password ? '●'.repeat(password.length) : '(없음)'}</p>
          </div>
          <button onClick={tryConnect} disabled={busy}
            className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-bold">
            {busy ? '연결 중…' : '🔌 OBS 연결 + 저장'}
          </button>
          <button onClick={() => setStep(3)} className="w-full py-2 text-xs text-gray-500 hover:text-gray-700">← 정보 수정</button>
        </div>
      )}
    </div>
  )
}

// Re-export Copy icon (사용 안 하더라도 안 깨지게)
export { Copy }
