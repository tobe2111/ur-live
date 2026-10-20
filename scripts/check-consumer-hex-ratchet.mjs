#!/usr/bin/env node
/**
 * 🎨 소비자 화면의 손으로 박은 색 — **늘어나지 못하게 한다** (2026-09-15 대표 "색 정리도 진행해줘")
 *
 * ## 무엇이 문제였나 (실측)
 * 소비자 화면 806개 파일에서 hex 색이 **2,875회 / 304종** 나왔다. `src/index.css` 가 선언한 토큰은 65개다.
 * 즉 **정해 둔 색보다 안 정한 색이 훨씬 많았다.** 그중 1,927회는 토큰과 *값이 같은데* hex 로 다시 적은 것이고
 * (`#2C2F35` 682 · `#1D1F29` 604 · `#11141C` 490 = `--line`/`--surface`/`--bg` 의 다크 값),
 * 나머지 948회는 체계 밖 값이다. 화면마다 색이 조금씩 달라 "AI 로 만든 것 같다"로 읽히던 정체가 이것이다.
 *
 * ## 이 가드가 하는 일
 * **줄이는 건 자유, 늘리는 건 차단**(래칫). 파일별 상한을 `scripts/consumer-hex-baseline.json` 에 동결한다.
 * 새 화면이 hex 를 박으면 빨간불이 나고, 토큰(`bg-surface`·`border-line`·`bg-warm`·`text-tone-*` …)을 쓰면 통과한다.
 *
 * ## 무엇을 **안** 세나
 *   - 대시보드(admin/seller/agency/wholesale) — 자체 팔레트이고 라이트 고정이다
 *   - 테스트·스크립트·`src/index.css`(여기가 색의 정본이다)
 *   - 외부 브랜드 색(카카오 `#FEE500` 등)도 **센다** — 예외로 두면 목록이 새므로, 필요하면 baseline 에 남긴다
 *
 * ## 이 가드가 **못** 막는 것
 *   - 같은 파일 안에서 hex 를 하나 지우고 다른 하나를 넣는 것(총량이 같으면 통과한다)
 *   - `rgb()`/`hsl()` 로 적은 색. 이 레포의 실사용은 hex 가 압도적이라 hex 만 본다.
 *   - **색이 옳은지**. 이건 개수만 센다 — 어느 색이 맞는지는 사람이 본다.
 *
 * 줄인 뒤 동결값 갱신: `node scripts/check-consumer-hex-ratchet.mjs --rebaseline`
 */
import fs from 'node:fs'
import path from 'node:path'

const BASELINE = 'scripts/consumer-hex-baseline.json'
const SKIP_DIR = /(^|\/)(admin|seller|agency|wholesale|supplier|marketing)([-/]|$)/i
const SKIP_FILE = /(Admin|Seller|Agency|Wholesale|Supplier|Marketing|Distributor)/
const REBASE = process.argv.includes('--rebaseline')

const files = []
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) { if (!SKIP_DIR.test(p)) walk(p); continue }
    if (!/\.(tsx|ts)$/.test(e.name) || SKIP_DIR.test(p) || SKIP_FILE.test(e.name) || /\/tests?\//.test(p)) continue
    files.push(p.replace(/\\/g, '/'))
  }
}
for (const r of ['src/pages', 'src/components', 'src/features', 'src/shared']) if (fs.existsSync(r)) walk(r)

/** 주석은 세지 않는다 — 설명에 적은 hex 가 빨간불을 내면 아무도 설명을 안 쓴다. */
const strip = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')

const HEX = /#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b/g
const now = {}
for (const f of files) {
  const n = (strip(fs.readFileSync(f, 'utf8')).match(HEX) || []).length
  if (n > 0) now[f] = n
}
const total = Object.values(now).reduce((a, b) => a + b, 0)

if (REBASE) {
  fs.writeFileSync(BASELINE, JSON.stringify({ total, files: now }, null, 2) + '\n')
  console.log(`✅ consumer-hex: 동결값 갱신 — ${Object.keys(now).length}파일 / ${total}회`)
  process.exit(0)
}

if (!fs.existsSync(BASELINE)) {
  console.error(`❌ consumer-hex: ${BASELINE} 이 없다. \`--rebaseline\` 로 먼저 만들 것.`)
  process.exit(1)
}
const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'))

// 🔑 "검사 대상 0건이면 통과가 아니다" — 경로가 낡아 조용히 비는 사고를 막는다(이 레포의 반복 클래스).
if (files.length < 300) {
  console.error(`❌ consumer-hex: 검사 대상이 ${files.length}개뿐이다 — 경로 목록이 낡았다(정상 800+).`)
  process.exit(1)
}

const grown = []
for (const [f, n] of Object.entries(now)) {
  const cap = base.files[f] ?? 0
  if (n > cap) grown.push(`  ${f}  ${cap} → ${n}  (+${n - cap})`)
}
if (grown.length) {
  console.error('❌ consumer-hex: 손으로 박은 색이 늘었다 — 토큰을 쓸 것\n')
  console.error(grown.join('\n'))
  console.error('\n  쓸 수 있는 토큰: bg-surface · bg-warm · border-line · border-rule(-strong)')
  console.error('                 text-ink(-soft/-faint) · text-brand-text · bg-brand(-tint) · text-sale · text-tone-{ok,warn,bad,info}')
  console.error(`  값은 src/index.css 가 정한다. 정말 새 색이 필요하면 거기에 토큰으로 선언할 것.`)
  console.error(`  줄인 뒤 동결값 갱신: node ${process.argv[1].split('/').pop()} --rebaseline`)
  process.exit(1)
}
console.log(`✅ consumer-hex: ${files.length}파일 / ${total}회 (동결 ${base.total}회 이하).`)
