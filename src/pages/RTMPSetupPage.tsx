/**
 * Mobile RTMP Setup Page
 * Auto-fills RTMP credentials for easy copy-paste into Prism
 */

import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Copy, CheckCircle2, ExternalLink, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function RTMPSetupPage() {
  const [searchParams] = useSearchParams()
  const [copied, setCopied] = useState<'url' | 'key' | 'all' | null>(null)

  const rtmpUrl = searchParams.get('url') || ''
  const rtmpKey = searchParams.get('key') || ''
  const streamTitle = searchParams.get('title') || '라이브 방송'

  // Auto-copy all on mobile for convenience
  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    if (isMobile && rtmpUrl && rtmpKey) {
      // Don't auto-copy (annoying), just show prominent copy buttons
    }
  }, [rtmpUrl, rtmpKey])

  function copyToClipboard(text: string, type: 'url' | 'key' | 'all') {
    navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  function copyAll() {
    const text = `RTMP URL: ${rtmpUrl}\nStream Key: ${rtmpKey}`
    copyToClipboard(text, 'all')
  }

  if (!rtmpUrl || !rtmpKey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <p className="text-lg text-gray-600">
            잘못된 접근입니다. QR 코드를 다시 스캔해주세요.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4">
      <div className="max-w-md mx-auto pt-8 pb-12">
        {/* Header */}
        <div className="bg-white rounded-t-2xl p-6 text-center border-b-4 border-indigo-500">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
            <Smartphone className="h-8 w-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Prism 간편 설정
          </h1>
          <p className="text-sm text-gray-600">
            {streamTitle}
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-b-2xl shadow-xl p-6 space-y-6">
          {/* Quick Copy All Button */}
          <Button
            onClick={copyAll}
            className="w-full h-16 text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
          >
            {copied === 'all' ? (
              <>
                <CheckCircle2 className="h-6 w-6 mr-2" />
                복사 완료! ✅
              </>
            ) : (
              <>
                <Copy className="h-6 w-6 mr-2" />
                모두 복사하기
              </>
            )}
          </Button>

          {/* RTMP URL */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">
              1️⃣ RTMP URL
            </label>
            <div className="relative">
              <input
                type="text"
                value={rtmpUrl}
                readOnly
                className="w-full px-4 py-3 pr-12 bg-gray-50 border-2 border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => copyToClipboard(rtmpUrl, 'url')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {copied === 'url' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <Copy className="h-5 w-5 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          {/* Stream Key */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">
              2️⃣ Stream Key
            </label>
            <div className="relative">
              <input
                type="text"
                value={rtmpKey}
                readOnly
                className="w-full px-4 py-3 pr-12 bg-gray-50 border-2 border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => copyToClipboard(rtmpKey, 'key')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {copied === 'key' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <Copy className="h-5 w-5 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 space-y-3">
            <p className="font-bold text-gray-900 flex items-center gap-2">
              📱 Prism에 붙여넣기
            </p>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
              <li className="pl-2">
                <strong>Prism Live Studio</strong> 앱 열기
              </li>
              <li className="pl-2">
                "<strong>Live</strong>" 탭 → "<strong>Add Destination</strong>" 선택
              </li>
              <li className="pl-2">
                "<strong>Custom RTMP</strong>" 선택
              </li>
              <li className="pl-2">
                위에서 복사한 <strong>RTMP URL</strong>과 <strong>Stream Key</strong> 붙여넣기
              </li>
              <li className="pl-2">
                "<strong>Go Live</strong>" 버튼 눌러서 방송 시작!
              </li>
            </ol>
          </div>

          {/* Prism Download Link */}
          <a
            href="https://prismlive.com/ko_kr/pcapp/"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-semibold transition-all"
          >
            <ExternalLink className="inline h-4 w-4 mr-2" />
            Prism 앱 다운로드
          </a>

          {/* Alternative Apps */}
          <div className="text-xs text-center text-gray-500 space-y-1">
            <p>💡 Prism 외에도 사용 가능:</p>
            <p>
              <strong>OBS Studio</strong> (PC/Mac) •{' '}
              <strong>Streamlabs</strong> (모바일) •{' '}
              <strong>XSplit</strong> (PC)
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>UR-Live 라이브 커머스 플랫폼</p>
          <p className="mt-1">© 2026 UR Team. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}
