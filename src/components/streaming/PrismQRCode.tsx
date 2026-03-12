/**
 * QR Code Auto-Fill for Prism Mobile App
 * Generates QR code that opens a mobile-friendly page with RTMP credentials
 */

import { useState } from 'react'
import { QRCodeSVG as QRCode } from 'qrcode.react'
import { Copy, CheckCircle, Smartphone, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PrismQRCodeProps {
  rtmpUrl: string
  rtmpKey: string
  streamTitle: string
}

export default function PrismQRCode({ rtmpUrl, rtmpKey, streamTitle }: PrismQRCodeProps) {
  const [copied, setCopied] = useState<'url' | 'key' | null>(null)

  // Generate mobile-friendly auto-fill URL
  const autoFillUrl = `https://live.ur-team.com/rtmp-setup?` +
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
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono"
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
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono"
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
          target="_blank"
          rel="noopener noreferrer"
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
