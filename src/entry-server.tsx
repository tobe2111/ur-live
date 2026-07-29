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

import { renderToString, renderToPipeableStream } from 'react-dom/server'
// 🧵 2026-07-05 (prerender 스피너 근본수정): node:stream 은 이 번들의 유일 소비자가
//   prerender-main.mjs(Node) 라서 안전 — worker 는 dist/server 를 임포트하지 않음.
import { PassThrough } from 'node:stream'
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

/**
 * 🧵 2026-07-05 (prerender 스피너 근본수정 — 무한로딩 사건의 부차 원인 마감):
 * renderToString 은 Suspense 를 못 기다려 lazy 페이지가 **스피너(fallback)+
 * `<template data-msg>` 잔재**로 구워졌다. 이 함수는 renderToPipeableStream 의
 * **onAllReady**(모든 lazy 모듈 로드 완료) 시점 HTML 을 수집 — 실제 페이지 마크업이 구워짐.
 *
 * 안전판: SSR-unsafe 모듈(window 접근)이 있어도 해당 Suspense 경계만 fallback 으로
 * 남고(오늘과 동일한 최악치), 셸 자체가 실패하거나 타임아웃이면 기존 renderToString
 * 결과로 **완전 폴백** — prerender 는 어떤 경우에도 현행보다 나빠지지 않는다.
 * 데이터 fetch 는 SSR 에서 effect 미실행이라 allReady 가 네트워크를 기다리지 않음(모듈 로드만).
 */
export async function renderAppComplete(url: string, timeoutMs = 20000): Promise<RenderResult> {
  const app = (
    <App
      Router={StaticRouter as unknown as RouterLike}
      routerProps={{ location: url }}
    />
  )
  const syncFallback = (): RenderResult => ({ html: renderToString(app), status: 200 })

  return await new Promise<RenderResult>((resolvePromise) => {
    let settled = false
    const settle = (r: RenderResult) => { if (!settled) { settled = true; resolvePromise(r) } }
    const timer = setTimeout(() => {
      try { stream.abort() } catch { /* already done */ }
      console.warn(`[entry-server] allReady ${timeoutMs}ms 타임아웃 — renderToString 폴백`)
      settle(syncFallback())
    }, timeoutMs)

    const stream = renderToPipeableStream(app, {
      onAllReady() {
        clearTimeout(timer)
        const pass = new PassThrough()
        let out = ''
        pass.on('data', (chunk: Buffer | string) => { out += String(chunk) })
        pass.on('end', () => settle({ html: out, status: 200 }))
        pass.on('error', () => settle(syncFallback()))
        stream.pipe(pass)
      },
      onShellError(err: unknown) {
        clearTimeout(timer)
        console.warn('[entry-server] shell 렌더 실패 — renderToString 폴백:', err)
        settle(syncFallback())
      },
      onError(err: unknown) {
        // 경계 단위 오류(SSR-unsafe lazy 모듈 등) — 그 경계만 fallback 으로 남음(현행과 동일). 관측만.
        console.warn('[entry-server] boundary 오류(해당 섹션 fallback 유지):', err)
      },
    })
  })
}
