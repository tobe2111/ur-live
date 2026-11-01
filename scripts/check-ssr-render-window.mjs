#!/usr/bin/env node
/**
 * 🔬 빌드 시점 SSR 스모크 — **렌더 중 `window`/`document` 접근을 잡는 검사**.
 *    파일을 쓰지 않는다. 산출물이 없는 것이 이 스크립트의 요점이다.
 *
 * 📜 2026-11-01 — 이 파일은 `prerender-main.mjs` 였고 `dist/client/index.html` 의 `#root` 를
 *    구운 HTML 로 교체했다. 그 일을 **그만두는 이유**를 실측으로 적는다(이름도 그래서 바꿨다 —
 *    더는 prerender 를 하지 않는 파일이 그 이름을 갖고 있으면 다음 세션이 낡은 지도를 믿는다):
 *
 *    ① **라이브는 그 산출물을 100% 버린다**(실측). 워커가 `#root` 를 모든 HTML 응답에서 교체한다 —
 *       첫 화면 분기들 + **catch-all `else`**(`worker/index.ts`, 2026-07-07 에 홈까지 확장). 우회로도
 *       없다: `/index.html` 은 Pages 가 **308 → `/`** 로 보내고(라이브 실측), 검색 크롤러는
 *       `app.get('*')` 의 봇 셸(자기 최소 HTML)을 받는다. `#root` 를 읽는 가드는 **0개**다.
 *    ② **구운 것은 로딩 스피너였다**(실측 — 수리 전 `#root` 1,298B 에 `role="status"`). 2026-07-05 가
 *       고치려 만든 `renderAppComplete` 의 `allReady` 경로가 **한 번도 돈 적이 없어서**다:
 *       호출부가 2번째 인자로 `null` 을 넘겼고 받는 쪽 시그니처는 `timeoutMs = 20000` 이다
 *       (기본값은 `undefined` 에만 적용 → `setTimeout(…, null)` = **0ms** → 즉시 폴백).
 *       즉 **3년 묵은 "스피너만 구워진다"가 그대로 살아 있었다.**
 *    ③ 그 인자를 빼면 `allReady` 가 실제로 돈다(실측 107ms · 20,192자 · 에러 0 · Suspense 실패 **1 → 0**).
 *       그런데 `index.html` 이 **28,568 → 47,860B(+19.3KB)** 가 되고 그 19KB 는 ①에 따라
 *       **모든 HTML 응답에서 워커가 파싱한 뒤 버린다**. ⇒ 고치는 쪽이 더 비쌌다.
 *    ⇒ **둘을 같이 하면 순수 이득이다**: `allReady` 를 켜서 검사 범위를 앱 트리 전체로 넓히고(② 해소),
 *       산출물은 쓰지 않아 낭비를 0 으로 만든다(③ 해소). 그래서 이 파일은 **검사기**가 됐다.
 *
 * 🔒 **안전 근거 — "쓰지 않는 상태" 는 이미 프로덕션에서 검증됐다.** 이 단계는 몇 달간 매 빌드
 *    죽어 있었고(그래서 `index.html` 이 갱신되지 않았고) 그동안 라이브는 멀쩡했다. 쓰기를 빼면
 *    `#root` 에는 소스 `index.html` 의 `ur-pre-react` 로더가 남는다 — 워커가 그것을 덮으므로
 *    사람이 보는 화면은 종전과 같다.
 *
 * 🧭 **왜 빌드를 깨뜨리지 않는가**: 이 검사는 앱 트리 전체를 Node 에서 렌더하므로, 의존성 하나가
 *    모듈 평가 중 `window` 를 읽기 시작하면 그날부터 main 배포가 통째로 멎는다. 그래서 빌드 체인에서는
 *    **크게 소리만** 내고(`package.json` 의 `|| echo` 가 exit code 를 삼킨다) 머지를 막는 자리는
 *    **PR** 이다 — `verify.yml` 이 `--strict` 로 같은 검사를 돌려 거기서 `exit 1` 한다.
 *    ⚠️ 그 비대칭을 지우지 말 것: strict 를 빌드 체인에 옮기면 긴급 수정이 막히고, PR 게이트를
 *       빼면 이 검사가 **다시 로그 속 침묵**이 된다(그게 이 사고의 원인이었다).
 *
 * 실행:
 *   npm run build:ssr            → dist/server/entry-server.mjs
 *   node scripts/check-ssr-render-window.mjs   → 검사(빌드 체인 · 소리만)
 *   node scripts/check-ssr-render-window.mjs --strict → 검사(PR 게이트 · 결함이면 exit 1)
 *
 * 가이드: docs/SSR_MIGRATION.md
 */

import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SERVER_ENTRY = resolve(ROOT, 'dist/server/entry-server.mjs')
const STRICT = process.argv.includes('--strict')
const TAG = '[ssr-render-window]'

// 📏 빈 렌더가 조용히 통과하지 못하게 하는 하한. 실측: `allReady` 20,192자 ↔ 폴백(로더) 3,077자.
//    그 사이에 둔다 — 폴백이면 반드시 걸리고, 실제 마크업이 조금 줄어도 거짓 경보는 안 난다.
const MIN_CHARS = 5000

if (!existsSync(SERVER_ENTRY)) {
  console.error(`${TAG} dist/server/entry-server.mjs 없음. \`npm run build:ssr\` 먼저 실행.`)
  process.exit(1)
}

// 🛡️ 2026-06-04 [근본 수정]: SSR localStorage 크래시 방지 — 렌더 중 localStorage 를 읽는 컴포넌트
//   (예: VouchersPage 의 카테고리 캐시) 하나가 "localStorage is not defined" 를 throw 하면
//   renderToString 의 그 서브트리가 통째로 ErrorBoundary fallback(스피너)으로 떨어짐.
//   클라이언트는 createRoot(re-render, hydrate 아님)라 SSR=로그아웃/빈캐시 뷰 ↔ 클라=실제 상태
//   mismatch 가 무해 → 안전한 no-op 스토리지 스텁으로 전환.
// 🔴 이 스텁은 가드(`src/tests/unit/ssr-render-window-2026-11-01.test.tsx`)의 것과 **같아야** 한다.
//    갈리면 가드가 통과하는 코드가 여기서 죽거나 그 반대가 된다.
const __ssrNoopStorage = {
  getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {},
  key: () => null, get length() { return 0 },
}
if (typeof globalThis.localStorage === 'undefined') globalThis.localStorage = __ssrNoopStorage
if (typeof globalThis.sessionStorage === 'undefined') globalThis.sessionStorage = __ssrNoopStorage
if (typeof globalThis.matchMedia === 'undefined') {
  globalThis.matchMedia = () => ({ matches: false, media: '', onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false } })
}

// 🎧 `entry-server` 의 안전판 로그를 **모은다**. 그 함수는 `process.stderr.write` 를 쓰므로
//    (2026-11-01 수리 — `console.warn` 은 `drop_console` 이 번들에서 지운다) 여기서 감시할 수 있다.
//    🔑 이것이 ②의 재발을 잡는 **유일한** 신호다: `timeoutMs` 가 다시 `null` 이 되면 렌더는
//       성공하고(폴백) 글자수만 줄어든다 — 그 폴백을 썼는지는 이 로그에만 나타난다.
const ssrLogs = []
const realWrite = process.stderr.write.bind(process.stderr)
process.stderr.write = (chunk, ...rest) => {
  try {
    const s = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
    if (s.includes('[entry-server]')) ssrLogs.push(s.trim())
  } catch { /* 감시가 렌더를 막지 않는다 */ }
  return realWrite(chunk, ...rest)
}

async function main() {
  console.log(`${TAG} 시작${STRICT ? ' (strict — 결함이면 exit 1)' : ''}`)

  const serverEntry = await import(SERVER_ENTRY)

  // 🔴 `renderAppComplete` 가 **필수**다. `renderApp`(renderToString)로 폴백하면 lazy 페이지
  //    모듈 본문이 평가되지 않아 이 검사의 범위가 Suspense 폴백까지로 좁아진다 — 그게 ②다.
  //    없으면 조용히 좁아지는 대신 소리낸다.
  if (typeof serverEntry.renderAppComplete !== 'function') {
    console.error(`${TAG} ❌ entry-server 가 renderAppComplete 를 export 하지 않는다 — 앱 트리 전체 검사가 불가능하다.`)
    process.exit(1)
  }

  // 🔑 **인자를 넘기지 않는다.** `renderAppComplete(url, timeoutMs = 20000)` 이므로 두 번째 인자를
  //    주면 그것이 타임아웃이 된다. 종전엔 `initialData`(항상 `null`)를 넘겨 0ms 가 됐다.
  //    데이터는 넘길 것이 없다 — 워커가 런타임에 `__SSR_INITIAL_*` 을 주입한다.
  console.log(`${TAG} 렌더 시작 (allReady — 앱 트리 전체)...`)
  const start = Date.now()
  const { html } = await serverEntry.renderAppComplete('/')
  const ms = Date.now() - start
  console.log(`${TAG} 렌더 완료 (${ms}ms, ${html.length}자)`)

  // ── 판정 ────────────────────────────────────────────────────────────────
  const problems = []

  // ① 빈/짧은 렌더 = 통과가 아니다(이 레포가 반복해 당한 "헛도는 검사").
  if (html.length < MIN_CHARS) {
    problems.push(`렌더 결과가 ${html.length}자뿐이다(하한 ${MIN_CHARS}) — 서브트리가 떨어졌거나 폴백이 돌았다`)
  }

  // ② `allReady` 가 실제로 돌았는가. 폴백을 썼으면 검사 범위가 좁아진 것이고 그 자체가 결함이다.
  const fellBack = ssrLogs.filter((l) => /타임아웃|폴백/.test(l))
  if (fellBack.length > 0) {
    problems.push(`allReady 가 안 돌고 renderToString 으로 폴백했다 → ${fellBack.join(' / ')}`)
  }

  // ③ 렌더 중 브라우저 전역 접근의 흔적.
  for (const [what, rx] of [
    ['window/document 접근', /\b(window|document|localStorage|sessionStorage|navigator) is not defined\b/],
    ['Suspense 경계 실패(data-msg)', /<template data-msg=/],
    ['Suspense 경계 실패 마커', /<!--\$!-->/],
  ]) {
    const hits = html.match(rx)
    if (hits) problems.push(`${what} — HTML 에 \`${hits[0].slice(0, 80)}\` 가 구워졌다`)
  }

  // ④ entry-server 가 남긴 그 밖의 안전판 로그(셸 실패·boundary 오류).
  const otherLogs = ssrLogs.filter((l) => !/타임아웃|폴백/.test(l))
  if (otherLogs.length > 0) problems.push(`entry-server 경고 — ${otherLogs.join(' / ')}`)

  if (problems.length === 0) {
    console.log(`${TAG} ✅ 결함 0 — 렌더 중 브라우저 전역 접근 없음(앱 트리 전체)`)
    return
  }

  console.error('')
  console.error(`${TAG} ❌ 결함 ${problems.length}건:`)
  for (const p of problems) console.error(`   · ${p}`)
  console.error('')
  console.error('   어느 컴포넌트인지 좁히려면:')
  console.error('   npx vitest run src/tests/unit/ssr-render-window-2026-11-01.test.tsx')
  console.error('')
  if (STRICT) process.exit(1)
  console.error(`${TAG} ⚠️ 빌드는 계속된다(배포를 막지 않는다 — 머리말 🧭). PR 게이트가 --strict 로 막는다.`)
}

// 🛡️ 2026-05-28: 작업 완료 후 강제 exit.
//   App entry tree 의 module-level 핸들(타이머/리스너/싱글톤)이 Node 이벤트 루프를 살려둬
//   렌더 성공 후에도 프로세스가 안 죽음 → build/deploy 무한 hang.
// 🔊 2026-11-01 (이 단계가 몇 달간 매 빌드 죽고 있었다 — 그런데 빌드는 초록이었다):
//   왜 안 보였나(실측 3겹):
//     ① `entry-server` 의 안전판 warn 이 `drop_console` 로 번들에서 제거돼 있었다(같은 날 수리).
//     ② 그 폴백(`renderToString`)이 **같은 에러를 React 콜백 안에서 다시** 던져 아래 `.catch`
//        밖으로 나갔다 → 처리 안 된 예외로 프로세스 사망, 이 스크립트 이름이 찍힌 줄도 없음.
//     ③ `package.json` 의 `|| …` 가 exit code 를 삼켰다.
//   아래 두 핸들러가 ②를 막는다 — 어떤 경로로 죽어도 **이 스크립트의 이름으로** 보고된다.
const fatal = (why) => (err) => {
  console.error(`\n❌ ${TAG} ${why}`)
  console.error('   원인:', err && err.stack ? err.stack : String(err))
  console.error('   렌더 중 window/document 접근이면 가드가 지목한다:')
  console.error('   npx vitest run src/tests/unit/ssr-render-window-2026-11-01.test.tsx\n')
  process.exit(1)
}
process.on('uncaughtException', fatal('처리 안 된 예외로 죽었다'))
process.on('unhandledRejection', fatal('처리 안 된 거절로 죽었다'))

main()
  .then(() => {
    console.log(`${TAG} 종료 (exit 0)`)
    process.exit(0)
  })
  .catch(fatal('렌더 실패'))
