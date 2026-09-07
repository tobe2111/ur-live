#!/usr/bin/env node
/**
 * 🎨 빌드 산출 CSS 검사 — Tailwind 트리셰이킹이 실제로 무엇을 지웠는지 본다.
 *
 * ## 왜 별도 스크립트인가 (2026-08-31 — 대표 지시로 분리)
 *
 * 이 검사는 원래 `src/tests/unit/button-system.test.ts` 의 마지막 케이스였는데,
 * **CI 에서 실패할 수 없는 상태**였다. `verify.yml` 은 유닛테스트를 step 5 에서 돌리고
 * `Build client` 는 step 96 이다 — 그 시점에 `dist/` 는 존재한 적이 없고, 테스트는
 * `if (!existsSync(dir)) return` 으로 조용히 통과했다. 몇 달간 초록불만 찍었다.
 *
 * 반대로 로컬에서는 **오래된 `dist/` 를 읽고 가짜 빨간불**을 냈다(2026-08-31 실측:
 * 4일 전 산출물이라 실패 → 새로 빌드하니 통과). 즉 판정이 언제나 틀린 검사였다.
 *
 * 이 레포가 반복해 당한 "가드가 있는데 안 돎 / 실패할 수 없음" 클래스다
 * (`check-bundle-size` 의 gzip 예산이 몇 달간 0 을 재며 통과만 하던 사고와 같은 모양).
 * ⇒ 빌드 **뒤에** 도는 자리로 옮기고, **산출물이 없으면 통과가 아니라 실패**로 바꿨다.
 *
 * ## 무엇을 보는가
 *
 * `src/index.css` 가 정의한 `.ur-btn*` 클래스 중 **소스에서 실제로 쓰이는 것**은
 * 빌드 CSS 에 반드시 남아 있어야 한다. 기대 목록을 손으로 적지 않고 소스에서 뽑기 때문에
 * 크기 하나를 새로 만들거나 없애도 이 검사가 저절로 따라온다(목록이 낡지 않는다).
 *
 * ### 막으려는 사고
 * 마크업은 `className="ur-btn ur-btn-lg"` 라고 선언하는데 번들에 그 규칙이 없으면
 * **버튼이 높이도 패딩도 없이 렌더된다.** 에러가 안 나서 아무도 모른다.
 * `@layer components` 안의 클래스는 Tailwind 가 사용처를 못 찾으면 통째로 지운다 —
 * 사용처가 리팩토링으로 사라지거나 클래스 이름이 문자열 조립(`` `ur-btn-${size}` ``)으로
 * 바뀌면 스캐너가 못 보고 조용히 빠진다.
 *
 * ### 이 검사가 못 막는 것
 * - 규칙이 남아 있지만 **값이 틀린** 경우(높이가 0 이 된다든지) — 그건 소스 단언의 몫이다.
 * - `.ur-btn` 을 안 쓰고 인라인으로 버튼을 그리는 화면(아직 2,600여 곳).
 *
 * 우회: `built-css-ok` — 이 파일 상단이 아니라 **호출부(verify.yml)** 에서 스텝을 지우는 것이
 * 유일한 우회이고, 그러면 `check-guard-registry` 가 "안 도는 가드" 로 잡는다.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const ASSETS = resolve(ROOT, 'dist/client/assets')

let failed = false
const fail = (msg) => { console.error(`   ✗ ${msg}`); failed = true }

// ── ① 산출물이 있어야 한다. 없으면 **통과가 아니라 실패**다(이 가드가 존재하는 이유).
if (!existsSync(ASSETS)) {
  console.error('❌ check-built-css: dist/client/assets 가 없다 — 이 검사는 `npm run build` **뒤에** 돌려야 한다.')
  console.error('   (예전엔 여기서 조용히 통과했고, 그래서 CI 에서 몇 달간 아무것도 검사하지 않았다.)')
  process.exit(1)
}
const cssFiles = readdirSync(ASSETS).filter((n) => n.endsWith('.css'))
if (cssFiles.length === 0) {
  console.error('❌ check-built-css: dist/client/assets 에 .css 가 하나도 없다 — 빌드가 깨졌거나 산출 경로가 바뀌었다.')
  process.exit(1)
}
// 어느 청크에 실릴지는 번들러가 정한다 — 전부 합쳐 본다(파일명 가정 금지).
const built = cssFiles.map((n) => readFileSync(join(ASSETS, n), 'utf-8')).join('\n')

// ── ② 기대 목록을 소스에서 뽑는다(손으로 적으면 낡는다).
const indexCss = readFileSync(resolve(ROOT, 'src/index.css'), 'utf-8')
const defined = [...new Set([...indexCss.matchAll(/\.(ur-btn[a-z-]*)\s*[{:]/g)].map((m) => m[1]))]
if (defined.length === 0) {
  console.error('❌ check-built-css: src/index.css 에서 .ur-btn* 정의를 하나도 못 찾았다 — 이 검사가 낡았다(대상 0건 = 실패).')
  process.exit(1)
}

const walk = (dir, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) { if (!/node_modules|\.git|dist/.test(p)) walk(p, out) }
    else if (/\.(tsx|ts)$/.test(e.name)) out.push(p)
  }
  return out
}
const sources = walk(resolve(ROOT, 'src')).filter((p) => !p.includes(`${'/'}tests${'/'}`))
if (sources.length < 300) {
  console.error(`❌ check-built-css: 스캔 대상이 ${sources.length}개뿐 — 경로가 낡았다(대상 0건 = 실패).`)
  process.exit(1)
}
const allSource = sources.map((p) => readFileSync(p, 'utf-8')).join('\n')

// ── ③ 소스가 쓰는 클래스는 빌드 CSS 에 있어야 한다.
let checked = 0
for (const cls of defined) {
  const used = new RegExp(`["'\`\\s]${cls}(?=["'\`\\s])`).test(allSource)
  if (!used) continue // 안 쓰면 지워지는 게 정상이다.
  checked += 1
  if (!built.includes(`.${cls}`)) {
    fail(`.${cls} 를 소스가 쓰는데 빌드 CSS 에 없다 — Tailwind 가 사용처를 못 찾아 통째로 지웠다(버튼이 높이·패딩 없이 렌더된다).`)
  }
}
if (checked === 0) {
  console.error('❌ check-built-css: 소스가 쓰는 .ur-btn* 이 하나도 없다 — 판정한 게 없으면 통과가 아니라 실패다.')
  process.exit(1)
}

if (failed) {
  console.error(`\n   고치는 법: 클래스를 문자열로 조립하지 말 것(\`ur-btn-\${size}\` → 완전한 이름으로 분기).`)
  console.error('   정말 안 쓰는 클래스면 src/index.css 정의도 함께 지운다.')
  process.exit(1)
}
console.log(`✅ built-css: 소스가 쓰는 .ur-btn* ${checked}개가 빌드 CSS(${cssFiles.length}개 파일)에 전부 살아 있다.`)
