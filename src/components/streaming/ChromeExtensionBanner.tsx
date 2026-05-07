/**
 * 🛡️ 2026-05-07: Chrome Extension 안내 배너 — YouTube Studio 모드 전용.
 *
 * 익스텐션 설치 시 가능:
 *   - YouTube Studio 안에 우리 사이드바 (상품 카드 / 채팅) 표시
 *   - YouTube Live Chat ↔ 우리 채팅 양방향 동기화 (UI proxy)
 *   - "Go Live" 자동 클릭
 *
 * 설치 안 됐을 때만 노출. hasOBSExtension() 으로 감지 (같은 익스텐션이 OBS WS proxy + Studio sidebar 동시 제공).
 */
import { useEffect, useState } from 'react'
import { Chrome, X, ExternalLink } from 'lucide-react'
import { hasOBSExtension } from '@/lib/obs-websocket'

const DISMISS_KEY = 'ur_ext_banner_dismissed_v1'
const EXTENSION_URL = 'https://chrome.google.com/webstore/detail/ur-live-broadcaster/' // TODO: 실제 ID 채울 것

export default function ChromeExtensionBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (hasOBSExtension()) return
    if (localStorage.getItem(DISMISS_KEY) === '1') return
    // Chrome / Edge 외엔 의미 없음
    const isChromium = /Chrome|Edg/.test(navigator.userAgent) && !/Mobi|Android|iPhone/.test(navigator.userAgent)
    if (!isChromium) return
    setShow(true)
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3.5 relative">
      <button onClick={dismiss}
        aria-label="닫기"
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600">
        <X className="w-3.5 h-3.5" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shrink-0 shadow-sm">
          <Chrome className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">유어딜 라이브 익스텐션</p>
          <p className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">
            YouTube Studio 안에서 <b>상품 카드</b> · <b>실시간 채팅</b> · <b>OBS 자동 제어</b> 사용 가능.
          </p>
          <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700">
            Chrome 웹스토어에서 설치 <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  )
}
