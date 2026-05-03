/**
 * 🛡️ 2026-05-03: Cloudflare Turnstile 위젯 (invisible / managed).
 *
 * 사용:
 *   <TurnstileWidget onVerify={(token) => setTurnstileToken(token)} />
 *
 * 그리고 form submit 시:
 *   formData.append('cf-turnstile-response', turnstileToken)
 *
 * 환경 변수: VITE_TURNSTILE_SITE_KEY (build-time, 클라이언트 노출 OK)
 *
 * 미설정 시 위젯 미렌더 (개발 환경 / 미도입 페이지) — 자동 verify 통과 (true)
 *   → 백엔드 verifyTurnstile() 도 secret 미설정 시 fail-open 이라 일관성.
 */
import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string
          callback?: (token: string) => void
          'error-callback'?: () => void
          'expired-callback'?: () => void
          theme?: 'light' | 'dark' | 'auto'
          size?: 'normal' | 'compact' | 'invisible'
          appearance?: 'always' | 'execute' | 'interaction-only'
        },
      ) => string
      remove: (widgetId: string) => void
      reset: (widgetId: string) => void
    }
  }
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js'

let scriptLoading: Promise<void> | null = null

function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.turnstile) return Promise.resolve()
  if (scriptLoading) return scriptLoading

  scriptLoading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_URL}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Turnstile script load failed')))
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Turnstile script load failed'))
    document.head.appendChild(script)
  })
  return scriptLoading
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void
  onError?: () => void
  onExpire?: () => void
  theme?: 'light' | 'dark' | 'auto'
  size?: 'normal' | 'compact' | 'invisible'
  className?: string
}

export default function TurnstileWidget({
  onVerify,
  onError,
  onExpire,
  theme = 'auto',
  size = 'invisible',
  className = '',
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    // SITE_KEY 미설정 = Turnstile 미도입 페이지 → 자동 통과.
    if (!SITE_KEY) {
      onVerify('disabled')
      return
    }
    if (!containerRef.current) return

    let cancelled = false

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          callback: (token) => onVerify(token),
          'error-callback': () => onError?.(),
          'expired-callback': () => onExpire?.(),
          theme,
          size,
        })
      })
      .catch(() => {
        // 스크립트 로드 실패 시 fail-open (서버측 fail-open 과 일관성).
        onVerify('script-load-failed')
      })

    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch { /* ignore */ }
      }
    }
  }, [onVerify, onError, onExpire, theme, size])

  if (!SITE_KEY) return null

  return <div ref={containerRef} className={`cf-turnstile ${className}`} />
}
