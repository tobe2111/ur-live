/**
 * 🛡️ SSR 마이그레이션 Phase 3 Step 3-2 — entry-server.tsx 진짜 구현.
 *
 * 가이드: docs/SSR_MIGRATION.md
 *
 * 사용:
 *   1. 빌드: npm run build:ssr → dist/server/entry-server.js
 *   2. prerender: scripts/prerender-main.mjs 가 dynamic import + renderApp() 호출
 *   3. 정적 HTML 생성 → dist/client/index.html inject
 *
 * SSR-safe 요건:
 *   - 메인 페이지 entry tree 의 모든 module 이 module-level 에서 window 미접근.
 *   - useEffect / onClick 안 접근은 SSR 시 실행 안 됨 (safe).
 *   - lazy import 페이지는 Suspense fallback 만 렌더 (실제 module 평가 안 됨, safe).
 */

import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import App, { type RouterLike } from './App'

export interface RenderResult {
  html: string
  status: number
  redirect?: string
  /** dehydrated React Query state (script tag inline for client hydrate) */
  dehydratedState?: unknown
}

/**
 * 페이지 URL 받아서 HTML 반환.
 *
 * @param url 페이지 path (e.g. "/")
 * @param initialData 미리 fetch 한 API 데이터 (script tag inline 으로 클라이언트가 사용)
 */
export async function renderApp(url: string, _initialData?: unknown): Promise<RenderResult> {
  // 🛡️ React renderToString — App 의 모든 sync 컴포넌트 렌더 (lazy 는 Suspense fallback).
  //   StaticRouter location prop → 클라이언트의 BrowserRouter 대신 SSR 라우팅.
  //   App 컴포넌트가 Router prop 받음 (Phase 3 Step 3-1 에서 추가).
  const html = renderToString(
    <App
      Router={StaticRouter as unknown as RouterLike}
      routerProps={{ location: url }}
    />,
  )

  return {
    html,
    status: 200,
  }
}
