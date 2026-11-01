#!/usr/bin/env node
/**
 * 🛡️ SSR 마이그레이션 Phase 3 Step 3-3 — prerender-main.mjs.
 *
 * 가이드: docs/SSR_MIGRATION.md
 *
 * 빌드 후 메인 페이지를 정적 HTML 로 pre-render.
 *
 * 실행:
 *   1. npm run build:client → dist/client/index.html
 *   2. npm run build:ssr → dist/server/entry-server.mjs
 *   3. node scripts/prerender-main.mjs → dist/client/index.html 갱신
 *
 * 효과:
 *   - 사용자 첫 진입 시 React mount 전에도 카드 HTML 보임 → LCP ↓
 *   - Cloudflare Pages 가 정적 HTML 즉시 응답 (worker 호출 0).
 *
 * SSR-safe 위험:
 *   - 메인 페이지 entry tree 컴포넌트 중 module-level 에서 window 접근 시 throw.
 *   - 발견 시 docs/SSR_MIGRATION.md 의 audit checklist 따라 fix.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const CLIENT_HTML = resolve(ROOT, 'dist/client/index.html')
const SERVER_ENTRY = resolve(ROOT, 'dist/server/entry-server.mjs')

if (!existsSync(CLIENT_HTML)) {
  console.error('[prerender-main] dist/client/index.html 없음. npm run build:client 먼저 실행.')
  process.exit(1)
}
if (!existsSync(SERVER_ENTRY)) {
  console.error('[prerender-main] dist/server/entry-server.mjs 없음. npm run build:ssr 먼저 실행.')
  process.exit(1)
}

// 🛡️ 2026-06-04 [근본 수정]: SSR localStorage 크래시 방지 — 렌더 중 localStorage 를 읽는 컴포넌트
//   (예: VouchersPage 의 카테고리 캐시) 하나가 "localStorage is not defined" 를 throw 하면
//   renderToString 의 그 서브트리가 통째로 ErrorBoundary fallback(스피너)으로 떨어짐 →
//   prerender 결과 index.html 이 "콘텐츠 없이 스피너만" 이 되어 모든 페이지 첫 paint 가 느려짐.
//   (사용자 신고: 동네딜 리스트 로딩 느림 — HTML 에 `data-msg="localStorage is not defined"` + spinner 확인)
//
//   이전 정책은 "polyfill 안 함 — 컴포넌트가 typeof window 가드" 였으나, 한 컴포넌트만 누락돼도
//   SSR 전체가 조용히 스피너가 되는 취약 구조였음. 클라이언트는 createRoot(re-render, hydrate 아님)라
//   SSR=로그아웃/빈캐시 뷰 ↔ 클라=실제 상태 mismatch 가 무해 → 안전한 no-op 스토리지 스텁으로 전환.
const __ssrNoopStorage = {
  getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {},
  key: () => null, get length() { return 0 },
}
if (typeof globalThis.localStorage === 'undefined') globalThis.localStorage = __ssrNoopStorage
if (typeof globalThis.sessionStorage === 'undefined') globalThis.sessionStorage = __ssrNoopStorage
if (typeof globalThis.matchMedia === 'undefined') {
  globalThis.matchMedia = () => ({ matches: false, media: '', onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false } })
}

async function main() {
  console.log('[prerender-main] 시작')

  // 🛡️ entry-server dynamic import — Node ESM 호환.
  // 🧵 2026-07-05 (prerender 스피너 근본수정): renderAppComplete(onAllReady — lazy 실마크업까지
  //   구움, 실패/타임아웃 시 내부적으로 renderToString 폴백) 우선, 구버전 번들이면 renderApp.
  const serverEntry = await import(SERVER_ENTRY)
  const renderApp = serverEntry.renderAppComplete || serverEntry.renderApp

  // 🛡️ API fetch 완전 제거 — 빌드 환경 의존성 0, 무조건 성공.
  //   데이터는 worker HTMLRewriter (runtime) 가 __SSR_INITIAL_MAIN__ inject + React Query fresh fetch.
  //   prerender 의 가치 = React renderToString HTML 미리 그리기 (LCP 단축).
  const initialData = null

  // 🛡️ renderApp 호출 — React renderToString 실행.
  console.log('[prerender-main] 렌더 시작 (allReady 모드)...')
  const start = Date.now()
  const { html: rawHtml } = await renderApp('/', initialData)
  console.log(`[prerender-main] 렌더 완료 (${Date.now() - start}ms, ${rawHtml.length} chars)`)

  // 🧹 2026-07-05: Suspense 실패 잔재 제거 — SSR-unsafe 경계가 남긴 `<template data-msg="...">`
  //   (에러 메시지가 그대로 서빙 HTML 에 박히던 잔재)를 스트립. `<!--$-->` 류 마커 주석은
  //   createRoot(비-hydrate) 라 무해하지만 data-msg 는 진단 노이즈 + 바이트 낭비라 제거.
  const html = rawHtml.replace(/<template data-msg="[^"]*"[^>]*><\/template>/g, '')
  const strippedCount = (rawHtml.match(/<template data-msg=/g) || []).length
  if (strippedCount > 0) {
    console.warn(`[prerender-main] ⚠️ SSR-unsafe 경계 ${strippedCount}곳 (data-msg 템플릿 스트립됨) — docs/SSR_MIGRATION.md 체크리스트로 해당 컴포넌트 점검 권장`)
  }

  // 🛡️ dist/client/index.html 의 <div id="root"></div> 를 SSR HTML 로 교체.
  let indexHtml = readFileSync(CLIENT_HTML, 'utf-8')
  // 🛡️ root div opening tag + pre-React placeholder 전체 → SSR html 로 교체.
  //   root div 안에 ur-pre-react loading screen 이 nested 구조 → balanced parser 어려움.
  //   대안: opening tag 정확히 찾고 → body 닫기 직전 마지막 `</div>` 까지 한 번에 교체.
  const rootOpenRegex = /<div\s+id=["']root["']([^>]*)>/
  const rootOpenMatch = indexHtml.match(rootOpenRegex)
  if (!rootOpenMatch) {
    console.error('[prerender-main] <div id="root"...> opening tag 못 찾음.')
    process.exit(1)
  }
  const rootOpenIdx = indexHtml.indexOf(rootOpenMatch[0])
  // 🛡️ </body> 위치 찾기 → 그 직전의 마지막 `</div>` 가 root 의 닫는 부분 (script tag 들 사이).
  const bodyCloseIdx = indexHtml.indexOf('</body>')
  if (bodyCloseIdx < 0) {
    console.error('[prerender-main] </body> 못 찾음.')
    process.exit(1)
  }
  // root opening 부터 body close 직전까지의 string 분석. 단순화: 마지막 `</div>` 가 root closing.
  const before = indexHtml.slice(0, rootOpenIdx)
  const middle = indexHtml.slice(rootOpenIdx, bodyCloseIdx)
  const after = indexHtml.slice(bodyCloseIdx)
  // 마지막 `</div>` 의 index (root 의 닫는 태그).
  const lastDivClose = middle.lastIndexOf('</div>')
  if (lastDivClose < 0) {
    console.error('[prerender-main] root closing </div> 못 찾음.')
    process.exit(1)
  }
  // script tag 들 (root 다음, body 전) 보존.
  const afterRootScripts = middle.slice(lastDivClose + '</div>'.length)
  indexHtml = before + `<div id="root"${rootOpenMatch[1]} data-ssr="main">${html}</div>` + afterRootScripts + after

  // 🛡️ initialData 도 inline 으로 (client React Query hydrate).
  if (initialData) {
    const dataScript = `<script id="__SSR_INITIAL_MAIN__" type="application/json">${JSON.stringify(initialData).replace(/<\/script/gi, '<\\/script')}</script>`
    indexHtml = indexHtml.replace('</head>', `${dataScript}\n  </head>`)
  }

  writeFileSync(CLIENT_HTML, indexHtml, 'utf-8')
  console.log('[prerender-main] dist/client/index.html 갱신 완료 ✅')
}

// 🛡️ 2026-05-28: 작업 완료 후 강제 exit.
//   App entry tree 의 module-level 핸들 (타이머/리스너/싱글톤) 이 Node 이벤트 루프를
//   살려둬 renderToString + 파일 쓰기 성공 후에도 프로세스가 안 죽음 → build/deploy 무한 hang.
//   prerender 는 파일 1개 쓰는 게 전부라 성공 후 즉시 exit(0) 가 올바름.
// 🔊 2026-11-01 (이 단계가 몇 달간 매 빌드 죽고 있었다 — 그런데 빌드는 초록이었다):
//
//   왜 안 보였나(실측 3겹):
//     ① `entry-server` 의 안전판 warn 이 `drop_console` 로 번들에서 제거돼 있었다(같은 날 수리).
//     ② 그 폴백(`renderToString`)이 **같은 에러를 React 콜백 안에서 다시** 던져 아래 `.catch`
//        밖으로 나갔다 → 처리 안 된 예외로 프로세스 사망, `[prerender-main] 실패:` 줄도 없음.
//     ③ `package.json` 의 `|| …` 가 exit code 를 삼켰다.
//   아래 두 핸들러가 ②를 막는다 — 어떤 경로로 죽어도 **이 스크립트의 이름으로** 보고된다.
//
// 🧭 **왜 빌드를 깨뜨리지 않는가**(2026-11-01 결정):
//   - 이 산출물은 **지금 아무도 안 쓴다**. 워커의 `#root` catch-all 이 홈까지 정적 로더로 덮으므로
//     (CLAUDE.md 2026-07-07 — 구운 shell 이 `__SSR_INITIAL_MAIN__` 을 안 먹어 "순수 낭비") 이 단계가
//     실패해도 사용자 피해가 0 이고, 오히려 `index.html` 이 워커가 기대하는 원형으로 남는다.
//   - 그런데 여기서 `exit 1` 로 **배포를 막으면** 쓰지도 않는 단계 하나가 긴급 수정까지 세운다.
//     이 스크립트는 앱 트리 전체를 Node 에서 렌더하므로, 의존성 하나가 모듈 평가 중 `window` 를
//     읽기 시작하면 그날부터 main 배포가 통째로 멎는다 — 이 레포가 반복해 겪은 위험이다.
//   - ⇒ **게이트는 PR 단위 시험**(`src/tests/unit/ssr-render-window-2026-11-01.test.tsx`)이 맡는다.
//     같은 조건(node + 같은 스토리지 스텁)으로 렌더해 **1.9초**에 같은 결함을 잡고, 머지를 막는
//     자리는 배포가 아니라 PR 이다. 여기서는 **크게 소리만** 낸다.
//   ⚠️ 이 균형은 "산출물을 아무도 안 쓴다" 에 달려 있다. prerender 결과를 다시 쓰게 되는 날
//      이 결정을 뒤집고(`exit 1` 을 빌드가 존중하게) 그 이유를 여기 적을 것.
const fatal = (why) => (err) => {
  console.error(`\n❌ [prerender-main] ${why} — prerender 산출물이 갱신되지 않았다(빌드는 계속된다).`)
  console.error('   원인:', err && err.stack ? err.stack : String(err))
  console.error('   렌더 중 window/document 접근이면 가드가 지목한다:')
  console.error('   npx vitest run src/tests/unit/ssr-render-window-2026-11-01.test.tsx\n')
  process.exit(1)
}
process.on('uncaughtException', fatal('처리 안 된 예외로 죽었다'))
process.on('unhandledRejection', fatal('처리 안 된 거절로 죽었다'))

main()
  .then(() => {
    console.log('[prerender-main] 종료 (exit 0)')
    process.exit(0)
  })
  .catch(fatal('렌더 실패'))
