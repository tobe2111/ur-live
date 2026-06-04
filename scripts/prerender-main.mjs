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
  const { renderApp } = await import(SERVER_ENTRY)

  // 🛡️ API fetch 완전 제거 — 빌드 환경 의존성 0, 무조건 성공.
  //   데이터는 worker HTMLRewriter (runtime) 가 __SSR_INITIAL_MAIN__ inject + React Query fresh fetch.
  //   prerender 의 가치 = React renderToString HTML 미리 그리기 (LCP 단축).
  const initialData = null

  // 🛡️ renderApp 호출 — React renderToString 실행.
  console.log('[prerender-main] renderToString 시작...')
  const start = Date.now()
  const { html } = await renderApp('/', initialData)
  console.log(`[prerender-main] renderToString 완료 (${Date.now() - start}ms, ${html.length} chars)`)

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
main()
  .then(() => {
    console.log('[prerender-main] 종료 (exit 0)')
    process.exit(0)
  })
  .catch((err) => {
    console.error('[prerender-main] 실패:', err)
    process.exit(1)
  })
