/**
 * 🛡️ 2026-04-30: URL 의 ?login=success&new=1 detect → WelcomeOnboardingModal 표시.
 *
 * 카카오 OAuth callback 후 redirect 가 어느 페이지로 가든 (`/`, `/products/X` 등) 동작.
 * App.tsx 에 1번만 마운트.
 *
 * 동작:
 *   - URL 에 ?login=success&new=1 이면 modal 표시
 *   - localStorage 'ur_onboarding_done=1' 면 무시
 *   - modal 닫기 후 URL 의 onboarding 관련 params 만 제거 (returnUrl 보존)
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { isOnboardingDone } from './WelcomeOnboardingModal'

const WelcomeOnboardingModal = lazy(() => import('./WelcomeOnboardingModal'))

export default function OnboardingTrigger() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [show, setShow] = useState(false)
  const [userName, setUserName] = useState<string | undefined>()

  useEffect(() => {
    if (isOnboardingDone()) return
    const isNew = searchParams.get('new') === '1'
    const loginSuccess = searchParams.get('login') === 'success'
    if (isNew && loginSuccess) {
      setUserName(searchParams.get('userName') || undefined)
      // Slight delay so the page underneath renders first (smooth transition)
      const t = setTimeout(() => setShow(true), 600)
      return () => clearTimeout(t)
    }
  }, [searchParams])

  function handleClose() {
    setShow(false)
    // URL 정리 — onboarding 관련 params 만 제거. login=success/userId 등은 다른 곳에서 사용 가능하므로 보존.
    const next = new URLSearchParams(searchParams)
    next.delete('new')
    setSearchParams(next, { replace: true })
  }

  if (!show) return null

  return (
    <Suspense fallback={null}>
      <WelcomeOnboardingModal onClose={handleClose} userName={userName} />
    </Suspense>
  )
}
