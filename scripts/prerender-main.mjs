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

// 🛡️ SSR 시 필요한 browser 전역 polyfill (Node 환경).
//   메인 페이지 entry tree 가 useEffect 안에서만 window 접근 = 평가 안 됨.
//   단 module-level 접근 컴포넌트 있으면 throw — audit 후 fix.
// SSR 시 window/document 가 undefined — 컴포넌트가 `typeof window` 가드 사용해야.
// polyfill 안 함 (의도적 — undefined 일 때 컴포넌트가 안전 분기 타도록).

async function main() {
  console.log('[prerender-main] 시작')

  // 🛡️ entry-server dynamic import — Node ESM 호환.
  const { renderApp } = await import(SERVER_ENTRY)

  // 🛡️ API 데이터 fetch (선택). cloud 환경에서 외부 접근 불가 시 빈 initialData.
  //   진짜 데이터는 client hydrate 후 React Query 가 fresh fetch.
  let initialData = null
  try {
    const res = await fetch('https://live.ur-team.com/api/group-buy/products?status=active&category=all', {
      headers: { 'User-Agent': 'ur-live-prerender/1.0' },
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) initialData = await res.json()
  } catch (err) {
    console.warn('[prerender-main] API fetch 실패 (skip, SSR 만 진행):', String(err))
  }

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

main().catch((err) => {
  console.error('[prerender-main] 실패:', err)
  process.exit(1)
})
