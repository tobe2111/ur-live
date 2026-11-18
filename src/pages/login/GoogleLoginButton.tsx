/**
 * 🌏 구글로 계속하기 — 외국인 손님에게만 (2026-11-18 대표 지시).
 *
 * 보이는 조건 둘:
 *   ① 기기(브라우저) 언어가 한국어가 아니다 — `navigator.language` 가 'ko' 로 시작하지 않는다.
 *      관광객은 한국에서 한국 IP 를 쓰므로 IP 나라로 가르지 않는다.
 *   ② 서버가 구글 로그인이 설정됐다고 답한다 — `GET /api/auth/google/enabled`.
 * 한국어 손님은 **요청도 하지 않고** 아무것도 그리지 않는다(로그인 화면이 지금과 똑같다).
 *
 * 디자인: 중립 버튼(구글 브랜드 가이드의 neutral 테마 — 채운 회색 면, 테두리 없음 · 색은 토큰/회색 램프) + 공식 "G" 로고 인라인 SVG.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n-lite'

/** 기기 언어가 한국어가 아닌가. 언어를 모르면(빈 값) 한국어로 본다 — 확실할 때만 보인다. */
export function isForeignLanguage(lang: string | null | undefined): boolean {
  const l = (lang || '').trim().toLowerCase()
  if (!l) return false
  return !l.startsWith('ko')
}

export default function GoogleLoginButton({ returnUrl }: { returnUrl: string }) {
  const { t } = useTranslation()
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (typeof navigator === 'undefined' || !isForeignLanguage(navigator.language)) return
    let alive = true
    fetch('/api/auth/google/enabled', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() as Promise<{ enabled?: boolean }> : null))
      .then((j: { enabled?: boolean } | null) => { if (alive && j?.enabled === true) setEnabled(true) })
      .catch(() => { /* 못 물으면 안 보인다 — 카카오·이메일은 그대로 */ })
    return () => { alive = false }
  }, [])

  if (!enabled) return null

  return (
    <button
      type="button"
      onClick={() => {
        // 로그인 화면을 이력에 남기지 않는다(카카오와 같다 — 돌아온 뒤 뒤로가 로그인 화면을 거치지 않게).
        window.location.replace(`/auth/google/start?${new URLSearchParams({ redirect: returnUrl }).toString()}`)
      }}
      className="mt-3 w-full h-[52px] bg-gray-100 hover:bg-gray-200 dark:bg-surface dark:hover:bg-gray-800 text-ink rounded-xl text-[15px] font-medium tracking-tight transition-colors cursor-pointer flex items-center justify-center gap-2"
    >
      <svg className="w-[18px] h-[18px]" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </svg>
      <span>{t('login.googleContinue', { defaultValue: 'Continue with Google' })}</span>
    </button>
  )
}
