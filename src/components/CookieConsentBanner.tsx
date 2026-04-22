/**
 * Cookie Consent Banner
 *
 * 🛡️ 2026-04-22: 비회원도 사이트 진입 시 쿠키/추적 동의 받기.
 *   GDPR (EU) + PIPA (한국) + COPPA-lite 가이드.
 *
 * - localStorage 'cookie_consent_v1' = 'accepted' | 'rejected' | null
 * - 동의 전: GA / Sentry replay / Kakao SDK 추적 비활성화 (수동 적용 필요)
 * - 회원가입한 사용자는 RegisterPage 의 PIPA 동의로 대체됨 (2중 표시 회피)
 */
import { useEffect, useState } from 'react'

const KEY = 'cookie_consent_v1'

export type ConsentValue = 'accepted' | 'rejected'

export function getCookieConsent(): ConsentValue | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'accepted' || v === 'rejected' ? v : null
  } catch {
    return null
  }
}

export function setCookieConsent(v: ConsentValue) {
  try { localStorage.setItem(KEY, v) } catch {}
  // 다른 컴포넌트가 즉시 반응할 수 있도록 storage event 트리거
  try { window.dispatchEvent(new Event('cookie-consent-changed')) } catch {}
}

export default function CookieConsentBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (getCookieConsent() === null) setShow(true)
    const onChange = () => { if (getCookieConsent() !== null) setShow(false) }
    window.addEventListener('cookie-consent-changed', onChange)
    return () => window.removeEventListener('cookie-consent-changed', onChange)
  }, [])

  if (!show) return null

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="쿠키 사용 동의"
      className="fixed bottom-0 left-0 right-0 z-[9999] bg-[#020202]/95 backdrop-blur-md border-t border-[#2A2A2A] p-4 shadow-2xl"
    >
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <p className="text-sm text-gray-300 flex-1">
          유어딜은 서비스 운영, 보안, 분석을 위해 필수 쿠키와 선택적 분석 쿠키를 사용합니다.{' '}
          <a href="/privacy" className="underline text-pink-400 hover:text-pink-300">개인정보 처리방침</a>
          {' · '}
          <a href="/gdpr" className="underline text-pink-400 hover:text-pink-300">GDPR</a>
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setCookieConsent('rejected')}
            className="px-4 py-2 text-sm font-semibold text-gray-300 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg hover:bg-[#2A2A2A] transition-colors"
            aria-label="선택적 쿠키 거부"
          >
            거부
          </button>
          <button
            onClick={() => setCookieConsent('accepted')}
            className="px-4 py-2 text-sm font-bold text-white bg-pink-500 rounded-lg hover:bg-pink-600 transition-colors"
            aria-label="모든 쿠키 동의"
          >
            동의
          </button>
        </div>
      </div>
    </div>
  )
}
