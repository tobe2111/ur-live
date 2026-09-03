#!/usr/bin/env node
/**
 * ⬜ 모양 잠금 래칫 (2026-09-01 신설) — 소비자 표면의 모서리 체계
 *
 * ■ 체계 (docs/design/anti-slop-direction-2026-09.md §2-④)
 *   카드·이미지 12 (`rounded-xl`) · 버튼·칩·입력 pill (`rounded-full`) · 시트 상단 16 (`rounded-t-2xl`)
 *   · 뱃지 6 (`rounded-md`) · 입력 8 (`rounded-lg`). 이 다섯이 체계 **안**이다.
 *
 * ■ 무엇을 막나
 *   체계 **밖**의 값: `rounded-3xl`(24) · `rounded-t-3xl` · `rounded-sm`(2) · 임의 px(`rounded-[13px]`).
 *   한 화면에 반지름이 넷이면 컴포넌트를 각자 다른 데서 가져온 것처럼 보인다(마이페이지 실측).
 *   `rounded-2xl`(16) 은 카드에 광범위(769건)라 이번엔 체계로 인정한다 — 12 로 모으는 건 페이지 단위 작업.
 *
 * ■ 왜 래칫인가
 *   소비자 표면에 87건이 있다. 지금 필요한 것은 **더 늘지 않는 것**이고, 줄이면 `--rebaseline`.
 *
 * ■ 못 잡는 것
 *   인라인 `style={{ borderRadius: 24 }}` · CSS 파일의 radius · 대시보드(대상 밖).
 *
 * 예외: 그 줄에 `shape-lock-ok` 주석.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const BASELINE = 'scripts/shape-lock-baseline.json'
const REBASE = process.argv.includes('--rebaseline')
const SKIP = /\/(admin|Admin|seller|Seller|wholesale|Wholesale|supplier|Supplier|agency|Agency|marketing|ads|dashboard|Dashboard)|\/tests?\/|node_modules|\.git|dist/
const OFF = /\brounded(?:-[tblr]{1,2})?-(?:3xl|sm|\[[0-9]+px\])(?![\w-])/g

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) { if (!SKIP.test(p)) walk(p, out) }
    else if (/\.tsx$/.test(e.name) && !SKIP.test(p)) out.push(p)
  }
  return out
}

export function scan(files) {
  const hits = []
  for (const f of files) {
    const rel = path.relative(ROOT, f)
    fs.readFileSync(f, 'utf-8').split('\n').forEach((ln, i) => {
      const t = ln.trim()
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('{/*') || t.startsWith('/*')) return
      if (ln.includes('shape-lock-ok')) return
      const m = ln.match(OFF)
      if (m) hits.push(`${rel}:${i + 1} ${m.join(' ')}`)
    })
  }
  return hits
}

function selfTest() {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'shape-'))
  try {
    const w = (n, c) => { const p = path.join(dir, n); fs.writeFileSync(p, c); return p }
    const fail = []
    if (scan([w('Bad.tsx', '<div className="rounded-3xl p-4" />\n')]).length !== 1) fail.push('rounded-3xl 을 못 잡는다')
    if (!scan([w('BadPx.tsx', '<div className="rounded-[13px]" />\n')]).length) fail.push('임의 px 를 못 잡는다')
    if (scan([w('Ok.tsx', '<div className="rounded-xl rounded-t-2xl rounded-full rounded-md rounded-lg" />\n')]).length) fail.push('체계 안 값을 오탐한다')
    return fail
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const selfFail = selfTest()
if (selfFail.length) { console.error('❌ shape-lock: **가드 자신이 고장났다** — ' + selfFail.join(' · ')); process.exit(1) }

const files = [...walk(path.join(ROOT, 'src/pages')), ...walk(path.join(ROOT, 'src/components'))]
if (files.length < 200) { console.error(`❌ shape-lock: .tsx 를 ${files.length}개밖에 못 찾았다 — 스캔 경로가 낡았다(통과 아님).`); process.exit(1) }
const hits = scan(files)

if (REBASE) {
  fs.writeFileSync(path.join(ROOT, BASELINE), JSON.stringify({ count: hits.length, _comment: '체계 밖 모서리(3xl·sm·임의px) 동결값. 줄이면 --rebaseline 로 내린다.' }, null, 2) + '\n')
  console.log(`📌 shape-lock: 동결 ${hits.length}건`)
  process.exit(0)
}
if (!fs.existsSync(path.join(ROOT, BASELINE))) { console.error('❌ shape-lock: 동결 파일이 없다 — --rebaseline 로 만들 것(첫 실행이 늘 통과하는 것을 막는다).'); process.exit(1) }
const base = JSON.parse(fs.readFileSync(path.join(ROOT, BASELINE), 'utf-8')).count
if (hits.length > base) {
  console.error(`❌ shape-lock: 체계 밖 모서리 ${hits.length}건 (동결 ${base})`)
  hits.forEach((h) => console.error('   ' + h))
  console.error('\n   체계: 카드 xl · 컨트롤 full · 시트 t-2xl · 뱃지 md · 입력 lg. 예외 `shape-lock-ok`.')
  process.exit(1)
}
console.log(`✅ shape-lock: 체계 밖 모서리 ${hits.length}건 (≤${base}) · ${files.length}개 .tsx 검사`)
