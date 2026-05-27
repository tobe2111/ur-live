/**
 * 🛡️ SSR 마이그레이션 Phase 1 — entry-server.tsx (placeholder).
 *
 * 가이드: docs/SSR_MIGRATION.md
 *
 * 다음 세션 작업 (Phase 2 + 3):
 *   1. React renderToString import
 *   2. StaticRouter wrapping
 *   3. HelmetProvider 의 SSR mode
 *   4. React Query dehydrate
 *
 * 현재 = placeholder. vite build:ssr 명령으로만 build (production 영향 0).
 */

export interface RenderResult {
  html: string
  status: number
  redirect?: string
}

/**
 * 페이지 URL 받아서 HTML 반환.
 * 빌드 시점 prerender 또는 런타임 worker SSR 양쪽 호환.
 *
 * @param url 페이지 path (e.g. "/")
 * @param initialData 미리 fetch 한 API 데이터 (SSR-safe)
 */
export async function renderApp(url: string, initialData?: unknown): Promise<RenderResult> {
  // TODO Phase 2: React renderToString 적용.
  //   - import { StaticRouter } from 'react-router-dom/server'
  //   - import { renderToString } from 'react-dom/server'
  //   - import App from './App-ssr'  (SSR-safe wrapper)
  //   - 모든 메인 페이지 컴포넌트 SSR-safe audit 후
  void url
  void initialData
  return {
    html: '<div id="root"><!-- SSR placeholder — Phase 2 에서 진짜 구현 --></div>',
    status: 200,
  }
}
