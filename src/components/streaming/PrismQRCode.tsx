/**
 * QR Code Auto-Fill for Prism Mobile App
 * Generates QR code that opens a mobile-friendly page with RTMP credentials
 */

import { useState } from 'react'
import { QRCodeSVG as QRCode } from 'qrcode.react'
import { Copy, CheckCircle, Smartphone, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Prism Live Studio deep-link 시도.
 * Prism의 공식 URL scheme 은 공개되지 않음. 일부 사용자 레포트 기반 추정 스키마:
 *   - prismlive://
 *   - prism://
 * 모바일에서 링크 클릭 → 앱 설치되어 있으면 열림, 아니면 무반응 (우리 페이지 유지).
 * Timeout 후에도 페이지 유지되면 QR 폴백 안내.
 */
function tryPrismDeepLink(rtmpUrl: string, rtmpKey: string): Promise<boolean> {
  return new Promise(resolve => {
    const candidates = [
      `prismlive://rtmp?url=${encodeURIComponent(rtmpUrl)}&key=${encodeURIComponent(rtmpKey)}`,
      `prism://live/rtmp?url=${encodeURIComponent(rtmpUrl)}&key=${encodeURIComponent(rtmpKey)}`,
    ]
    const start = Date.now()
    let resolved = false
    const onVisibilityChange = () => {
      if (document.hidden) {
        resolved = true
        document.removeEventListener('visibilitychange', onVisibilityChange)
        resolve(true)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.location.href = candidates[0]
    setTimeout(() => {
      if (!resolved && Date.now() - start > 1800) {
        document.removeEventListener('visibilitychange', onVisibilityChange)
        resolve(false)
      }
    }, 2000)
  })
}

/**
 * Larix Broadcaster deep link (공식 지원).
 * https://softvelum.com/larix/mobilesettings/
 * 스키마: larix://set/?name=...&url=...&mode=audio+video
 */
function tryLarixDeepLink(rtmpUrl: string, rtmpKey: string, title: string): Promise<boolean> {
  return new Promise(resolve => {
    // Larix 는 URL 에 key 가 포함된 형태를 기대: rtmp://server/app/KEY
    const fullUrl = rtmpUrl.endsWith('/') ? `${rtmpUrl}${rtmpKey}` : `${rtmpUrl}/${rtmpKey}`
    const link = `larix://set/?name=${encodeURIComponent(title || 'UR Live')}&url=${encodeURIComponent(fullUrl)}&mode=audio%2Bvideo`
    let resolved = false
    const onVisibilityChange = () => {
      if (document.hidden) {
        resolved = true
        document.removeEventListener('visibilitychange', onVisibilityChange)
        resolve(true)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.location.href = link
    setTimeout(() => {
      if (!resolved) {
        document.removeEventListener('visibilitychange', onVisibilityChange)
        resolve(false)
      }
    }, 2000)
  })
}

interface PrismQRCodeProps {
  rtmpUrl: string
  rtmpKey: string
  streamTitle: string
}

export default function PrismQRCode({ rtmpUrl, rtmpKey, streamTitle }: PrismQRCodeProps) {
  const [copied, setCopied] = useState<'url' | 'key' | null>(null)
  const [deeplinkStatus, setDeeplinkStatus] = useState<'idle' | 'trying' | 'failed'>('idle')
  const [larixStatus, setLarixStatus] = useState<'idle' | 'trying' | 'failed'>('idle')
  const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone/i.test(navigator.userAgent)

  async function openPrismDirectly() {
    setDeeplinkStatus('trying')
    const ok = await tryPrismDeepLink(rtmpUrl, rtmpKey)
    setDeeplinkStatus(ok ? 'idle' : 'failed')
  }

  async function openLarixDirectly() {
    setLarixStatus('trying')
    const ok = await tryLarixDeepLink(rtmpUrl, rtmpKey, streamTitle)
    setLarixStatus(ok ? 'idle' : 'failed')
  }

  // 🛡️ 2026-05-07: PC 사용자에게 OBS 모드 권장 (Prism 은 모바일 전용)
  if (!isMobile) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
        <div className="flex items-start gap-3">
          <Smartphone className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-900">PC 에서 Prism 모드를 선택하셨네요</p>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              Prism Mobile 은 핸드폰 전용 앱이에요. PC 라면 <b>"OBS Studio"</b> 모드를 추천드립니다 (화질 + 안정성 모두 우수).
            </p>
          </div>
        </div>
        <div className="bg-white rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-700">📱 핸드폰으로 진행하려면 — QR 스캔</p>
          <div className="flex justify-center">
            <QRCode value={typeof window !== 'undefined' ? window.location.href : ''} size={140} level="M" includeMargin={true} />
          </div>
          <p className="text-[10px] text-center text-gray-500">핸드폰으로 위 QR 스캔 → 같은 페이지를 모바일에서 진행</p>
        </div>
      </div>
    )
  }

  // Generate mobile-friendly auto-fill URL
  const appBaseUrl = import.meta.env.VITE_APP_BASE_URL || 'https://live.ur-team.com'
  const autoFillUrl = `${appBaseUrl}/rtmp-setup?` +
    `url=${encodeURIComponent(rtmpUrl)}&` +
    `key=${encodeURIComponent(rtmpKey)}&` +
    `title=${encodeURIComponent(streamTitle)}`

  function copyToClipboard(text: string, type: 'url' | 'key') {
    navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-6">
      {/* QR Code Section */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 text-center">
        <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full mb-4">
          <Smartphone className="h-4 w-4 text-indigo-600" />
          <span className="text-sm font-semibold text-gray-700">Prism 모바일 간편 설정</span>
        </div>

        <div className="bg-white p-6 rounded-xl inline-block shadow-lg mb-4">
          <QRCode
            value={autoFillUrl}
            size={240}
            level="H"
            includeMargin={true}
          />
        </div>

        <div className="space-y-2 text-sm text-gray-600">
          <p className="font-semibold text-gray-900">📱 스마트폰으로 QR 코드 스캔</p>
          <p>→ RTMP 설정 페이지가 자동으로 열립니다</p>
          <p>→ Prism 앱에서 "Custom RTMP" 선택</p>
          <p>→ 복사 버튼 2번만 누르면 완료!</p>
        </div>

        {/* 🛡️ 2026-05-07: Larix 우선 노출 (공식 deep link 지원) — Prism 은 비공식이라 보조로 강등 */}
        {isMobile && (
          <div className="mt-4 space-y-2">
            <Button
              onClick={openLarixDirectly}
              disabled={larixStatus === 'trying'}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {larixStatus === 'trying' ? 'Larix 열기 시도 중...' : '🚀 Larix Broadcaster 로 자동 입력'}
            </Button>
            {larixStatus === 'failed' && (
              <p className="text-[11px] text-amber-700">
                Larix 가 설치 안 된 것 같아요. App Store / Play Store 에서 "Larix Broadcaster" 검색 → 설치 후 다시 시도.
              </p>
            )}
            <p className="text-[10px] text-gray-500 leading-relaxed">
              💡 <strong>Larix</strong> 는 Custom RTMP URL scheme 을 공식 지원해서 자동 입력이 안정적이에요.
              Prism 도 시도하려면 ↓
            </p>
            <Button
              onClick={openPrismDirectly}
              disabled={deeplinkStatus === 'trying'}
              variant="outline"
              className="w-full border-green-300 text-green-700"
            >
              {deeplinkStatus === 'trying' ? 'Prism 열기 시도 중...' : 'Prism 앱 시도 (비공식 deep link)'}
            </Button>
            {deeplinkStatus === 'failed' && (
              <p className="text-[11px] text-gray-500">
                Prism deep link 가 동작 안 했어요. 아래 QR 또는 복사로 진행하거나 Larix 사용 권장.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Manual Copy Section (Backup) */}
      <div className="space-y-3">
        <h4 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
          <Copy className="h-4 w-4" />
          또는 직접 복사해서 입력
        </h4>

        <div className="space-y-2">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              RTMP URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={rtmpUrl}
                readOnly
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 font-mono"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(rtmpUrl, 'url')}
              >
                {copied === 'url' ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Stream Key
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={rtmpKey}
                readOnly
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 font-mono"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(rtmpKey, 'key')}
              >
                {copied === 'key' ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm space-y-2">
        <p className="font-semibold text-blue-900">📖 Prism 설정 방법</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-800">
          <li>Prism Live Studio 앱 열기</li>
          <li>"Live" 탭 → "Add Destination" 선택</li>
          <li>"Custom RTMP" 선택</li>
          <li>위의 RTMP URL과 Stream Key 붙여넣기</li>
          <li>"Go Live" 버튼 누르기</li>
        </ol>
        <a
          href="https://prismlive.com/support"
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium mt-2"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Prism 공식 가이드 보기
        </a>
      </div>

      {/* Alternative Options */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>💡 <strong>꿀팁:</strong> Prism 대신 OBS Studio(PC)나 Streamlabs(모바일)도 사용 가능합니다</p>
        <p>✅ 모든 RTMP 인코더와 호환됩니다</p>
      </div>
    </div>
  )
}
