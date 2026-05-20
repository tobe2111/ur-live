/**
 * 🛡️ 2026-05-19: 특정 페이지에서 다크 모드 강제 비활성화.
 *
 * 사용처: /checkout (결제 페이지) — 사용자 신고 "테마 깨짐".
 *   결제 화면은 영수증 / 카드 입력 / 금액 표시 등 가독성 최우선.
 *   사용자 테마 설정과 무관하게 항상 라이트로 강제.
 *
 * 동작:
 *   - 마운트 시 <html> 의 `dark` 클래스 제거 (Tailwind dark: variant 무효화)
 *   - 언마운트 시 이전 상태 복원 → 다른 페이지는 원래 테마 유지
 *
 * 사용:
 *   import { useForceLightTheme } from '@/hooks/useForceLightTheme'
 *   export default function CheckoutPage() {
 *     useForceLightTheme()
 *     ...
 *   }
 *
 * ⚠️ 절대 글로벌 CSS invert 사용 금지 (2026-05-03 사고 — docs/INCIDENTS.md).
 *   <html class="dark"> 토글 방식이 유일한 안전 패턴.
 */
import { useEffect } from 'react'

export function useForceLightTheme(): void {
  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const wasDark = root.classList.contains('dark')
    if (wasDark) {
      root.classList.remove('dark')
      root.setAttribute('data-theme', 'light')
    }
    return () => {
      // 다른 페이지로 이동 시 원래 테마 복원.
      if (wasDark) {
        root.classList.add('dark')
        root.setAttribute('data-theme', 'dark')
      }
    }
  }, [])
}
