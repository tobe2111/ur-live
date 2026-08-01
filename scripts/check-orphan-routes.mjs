#!/usr/bin/env node
/**
 * 🛡️ 2026-08-01: **라우트는 있는데 아무도 못 가는 페이지**를 래칫으로 막는다.
 *
 * ## 이 레포가 반복해서 만든 모양
 *
 * *"실패가 아니라 조용한 부재."* 페이지를 만들고 라우트를 달면 **다 된 것처럼 보인다** —
 * 빌드도 통과하고 타입도 맞고 테스트도 초록이다. 그런데 **누를 데가 없으면 없는 것과 같다.**
 * 에러가 안 나므로 몇 달이 지나도 아무도 모른다.
 *
 * 같은 클래스로 이미 세 번 났다:
 *   - `/influencer` 랜딩이 대시보드에 가려져 두 달간 렌더 0회(→ `check-duplicate-routes`)
 *   - `GET /api/returns/seller` 가 있는데 **소비 화면 0건**(2026-08-01 `SellerReturnsPage` 로 해소)
 *   - O9 운영자 문의가 **확정만 되고 구현 0**
 *
 * 실측(2026-08-01): 정적 라우트 361개 중 **21개**가 소스 어디에도 문자열로 안 나온다.
 * 그중엔 `/account/settings`(사용자가 자기 테마·언어를 바꾸는 화면)도 있다 — **주석에만** 있었다.
 *
 * ## 판정
 *
 * 라우트 파일(`src/App.tsx`·`src/routes/*.tsx`)의 **정적** `path="..."` 를 모으고,
 * 그 경로가 **다른 소스 어디에도 문자열 리터럴로 안 나오면** 고아로 본다.
 *
 * 판정을 **일부러 느슨하게** 잡았다(prefix 없는 `notifyUser(..., '/my-returns')` 같은
 * 인자도 도달 경로다). 엄격하게 하면 오탐이 62건까지 늘어나고, **오탐이 많은 가드는
 * 결국 아무도 안 본다** — 이 레포에서 `check-input-text-color` 가 정확히 그래서
 * 두 달간 어디에도 등록되지 못했다.
 *
 * ## 래칫
 *
 * 기존 고아는 `scripts/orphan-routes-baseline.json` 에 동결한다. **새 고아만 차단**한다.
 * 동결분은 "링크를 달지 / 페이지를 지울지" 판단이 필요한 백로그이지 자동 수리 대상이 아니다.
 * 링크를 달았으면 `node scripts/check-orphan-routes.mjs --rebaseline` 로 줄인다.
 *
 * ## 한계 (과신 금지)
 *
 *   - **앱 밖에서 들어오는 경로는 고아가 맞다**: OAuth 콜백(`/auth/kakao/callback`)·
 *     PG 리턴(`/success`·`/fail`)은 카카오/토스 콘솔에 등록된 URL 이라 소스에 링크가 없다.
 *     ⇒ 그래서 **삭제 가드가 아니라 래칫**이다. 동결 목록에 그대로 둔다.
 *   - **주석 속 경로도 문자열로 센다.** `/account/settings` 가 주석에만 있어도 이 가드는
 *     통과시킨다(이번엔 사람이 찾았다). 잡는 것은 *"어디에도 안 나온다"* 뿐이다.
 *   - 동적 경로(`/u/:handle`)와 `<Navigate>` 별칭은 검사 대상이 아니다.
 *
 * 기본 warn-only(exit 0). 차단: `STRICT_ORPHAN_ROUTES=1` 또는 `-s`.
 * 의도적 예외: 라우트 파일에 `orphan-route-ok` 주석.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const STRICT = process.env.STRICT_ORPHAN_ROUTES === '1' || process.argv.includes('-s')
const REBASE = process.argv.includes('--rebaseline')
const BASELINE = 'scripts/orphan-routes-baseline.json'

// ── 라우트 정의 파일 ───────────────────────────────────────────────
const routeFiles = ['src/App.tsx']
if (existsSync('src/routes')) {
  for (const n of readdirSync('src/routes')) {
    if (n.endsWith('.tsx')) routeFiles.push(join('src/routes', n))
  }
}

const norm = (p) => p.replace(/\/+$/, '') || '/'

/** 정적 경로만 — 동적 세그먼트·와일드카드는 문자열 비교로 도달성을 판정할 수 없다. */
const routes = new Map()
for (const rf of routeFiles) {
  if (!existsSync(rf)) continue
  const text = readFileSync(rf, 'utf8')
  if (text.includes('orphan-route-ok')) continue
  for (const m of text.matchAll(/path="(\/[^"]*)"/g)) {
    const p = m[1]
    if (p.includes(':') || p.includes('*')) continue
    routes.set(norm(p), rf)
  }
}

// ── 도달 신호: 소스 어디든 문자열 리터럴로 등장 ────────────────────
const sources = []
const walk = (dir) => {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name)
    if (name.isDirectory()) {
      if (name.name === 'node_modules' || name.name === 'tests') continue
      walk(p)
    } else if (/\.tsx?$/.test(name.name)) {
      // 라우트 정의 자신과 **가이드/자동참조 문서 본문**은 도달 경로가 아니다
      // (문서에 경로가 적혀 있는 것은 링크가 아니다 — 이 함정으로 첫 측정이 0건을 냈다).
      // ⚠️ `return` 이면 그 디렉터리 순회 전체가 끊긴다 — 첫 구현이 그래서 스캔 0건을 냈고
      //    아래 "측정 0건 = 실패" 자기검증이 그걸 잡았다. 반드시 `continue`.
      if (routeFiles.includes(p)) continue
      if (p.includes('guides/') || p.endsWith('auto-reference.ts')) continue
      sources.push(p)
    }
  }
}
walk('src')

const seen = new Set()
for (const f of sources) {
  let t
  try { t = readFileSync(f, 'utf8') } catch { continue }
  for (const m of t.matchAll(/['"`](\/[A-Za-z0-9_\-/]*)['"`?#]/g)) seen.add(norm(m[1]))
}

// 🛡️ 측정 대상 0건은 통과가 아니라 스캔이 깨진 것이다.
if (routes.size === 0) {
  console.error('❌ [orphan-routes] 정적 라우트를 한 건도 못 찾았다 — 파싱이 깨졌다.')
  process.exit(1)
}
if (seen.size === 0) {
  console.error('❌ [orphan-routes] 경로 문자열을 한 건도 못 찾았다 — 소스 스캔이 깨졌다.')
  process.exit(1)
}

const orphans = [...routes.keys()].filter((p) => !seen.has(p)).sort()

if (REBASE) {
  writeFileSync(BASELINE, `${JSON.stringify({ orphans }, null, 2)}\n`)
  console.log(`✅ orphan-routes: baseline 갱신 — 동결 ${orphans.length}건`)
  process.exit(0)
}

const base = existsSync(BASELINE)
  ? new Set(JSON.parse(readFileSync(BASELINE, 'utf8')).orphans || [])
  : new Set()
const fresh = orphans.filter((p) => !base.has(p))

if (fresh.length) {
  console.error(`❌ [orphan-routes] 어디에서도 닿을 수 없는 새 라우트 ${fresh.length}건:`)
  for (const p of fresh) console.error(`   ${p}   ← ${routes.get(p)}`)
  console.error('\n   → 라우트만 있고 **누를 데가 없으면 없는 것과 같습니다**(에러가 안 나서 안 보입니다).')
  console.error('     링크/버튼을 달거나, 앱 밖에서 들어오는 경로(OAuth·PG 리턴)면')
  console.error(`     \`node scripts/check-orphan-routes.mjs --rebaseline\` 로 동결하세요.`)
  process.exit(STRICT ? 1 : 0)
}

const healed = [...base].filter((p) => routes.has(p) && !orphans.includes(p))
if (healed.length) {
  console.log(`ℹ️  orphan-routes: 동결분 ${healed.length}건이 이제 도달 가능 — --rebaseline 로 줄이세요.`)
}
console.log(`✅ orphan-routes: 새 고아 없음 — 정적 라우트 ${routes.size}건 검사(동결 ${base.size}).`)
