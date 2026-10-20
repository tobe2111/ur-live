/**
 * 🛡️ SSR 마이그레이션 Phase 1 — entry-client.tsx (placeholder).
 *
 * 가이드: docs/SSR_MIGRATION.md
 *
 * 다음 세션 작업:
 *   1. main.tsx 의 ReactDOM.createRoot().render(<App />) 로직을 여기로 이동
 *   2. SSR HTML 있으면 hydrateRoot, 없으면 createRoot
 *   3. React Query hydrate (server state)
 *   4. main.tsx → entry-client.tsx import 만
 *
 * 현재 = placeholder. main.tsx 는 그대로 작동.
 */

import { hydrateRoot, createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'

/**
 * SSR HTML 이 있으면 hydrate, 없으면 일반 render.
 * Phase 2 에서 main.tsx 의 createRoot().render() 호출 대체.
 */
export function mountApp(element: ReactElement, container: Element): void {
  // SSR 적용된 HTML 이 있으면 hydrate 모드 (이미 그려진 HTML 재사용)
  // 없으면 일반 createRoot (현재 동작).
  const hasSSR = container.hasAttribute('data-ssr')
  if (hasSSR) {
    hydrateRoot(container, element)
  } else {
    createRoot(container).render(element)
  }
}
