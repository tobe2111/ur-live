/**
 * 🛡️ 2026-04-28: 인앱 브라우저 안내 배너
 *
 * 카카오톡/네이버/페이스북/인스타그램/라인 등 인앱에서 접속 시 상단에 표시.
 * 사용자가 직접 외부 브라우저로 열도록 유도 (강제 redirect 안 함).
 *
 * window.__urInAppBrowser 는 main.tsx 가 React 마운트 전에 set 함.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  detectInAppBrowser,
  openInExternalBrowser,
  IN_APP_LABELS,
  isIOS,
  type InAppBrowserName,
} from '@/lib/in-app-browser'

const DISMISS_KEY = 'ur_inapp_banner_dismissed_v1'

export default function InAppBrowserBanner() {
  const { t } = useTranslation()
  const [inApp, setInApp] = useState<InAppBrowserName | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const detected = detectInAppBrowser()
    if (!detected) return
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') return
    } catch { /* sessionStorage may be blocked in some webviews */ }
    setInApp(detected)
  }, [])

  if (!inApp || dismissed) return null

  const label = IN_APP_LABELS[inApp]

  const handleOpen = () => {
    const ok = openInExternalBrowser()
    // iOS Facebook/Instagram 등 자동 redirect 미지원 케이스 → 수동 안내 alert
    if (!ok && isIOS()) {
      alert('우측 상단 "..." 메뉴 → "Safari 로 열기" 를 선택해주세요.')
    }
  }

  const handleDismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* ignore */ }
    setDismissed(true)
  }

  return (
    <div
      role="alert"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 9999,
        background: '#FEF3C7',
        borderBottom: '1px solid #F59E0B',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 13,
        color: '#78350F',
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
      <div style={{ flex: 1, lineHeight: 1.4 }}>
        <strong>{label} 인앱 브라우저</strong> 에서는 일부 기능이 제한될 수 있어요.
      </div>
      <button
        onClick={handleOpen}
        style={{
          background: '#0A0A0B',
          color: '#fff',
          border: 0,
          borderRadius: 6,
          padding: '6px 12px',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        외부 브라우저
      </button>
      <button
        onClick={handleDismiss}
        aria-label={t('common.close')}
        style={{
          background: 'transparent',
          border: 0,
          color: '#78350F',
          fontSize: 18,
          cursor: 'pointer',
          padding: '0 4px',
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  )
}
