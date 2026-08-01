#!/usr/bin/env node
/**
 * 🛡️ 2026-07-29: 서브리퀘스트 **플랫폼 천장** 우회 방지.
 *
 * 배경(라이브 실측): 레인별 학습 상한이 `influencer=55` · `kakao_sweep=65` 로 50 언저리에 수렴해 있는데
 *   `company_enrich=172` — 천장의 3.4배였다. 이 레인만 다른 이유는 **부딪히는 방식**이다. 건당 4~6 fetch 라
 *   라운드가 4~9번째 리드에서 끝나는데, 그때 잡을 수 있는 예외가 오지 않아(`limit_hit:false` · `crash` 없음)
 *   하향 학습이 **한 번도 안 걸렸다**. 회복(×1.25)만 반복되는 한 방향 드리프트.
 *   같은 전수조사에서 `runCompanyAutoCollect` 는 아예 학습도 천장도 없이 `110` 을 그대로 쓰고 있었다.
 *
 *   ⇒ 자기교정 루프는 **실패를 관측할 수 있을 때만** 작동한다. 관측 불가 구간은 코드가 지키는 천장이 막는다.
 *
 * 규칙(유어애즈/도매 수집·보강 레인):
 *   R1. `resolveSubreqBudget(...)` 는 **3번째 인자(천장)** 를 넘겨야 한다.
 *   R2. `nextSubreqCap(...)` 는 **5번째 인자(천장)** 를 넘겨야 한다.
 *   R3. `FetchBudget` 예산을 만드는 파일은 `platformSubreqCap` 또는 `resolveSubreqBudget` 을 거쳐야 한다
 *       (env 숫자를 그대로 `{ left: N }` 에 넣는 레인 = 천장 무시).
 *
 * 예외: 정의부(collect-budget.ts), 테스트, `platform-cap-ok` 주석.
 *
 * 사용: node scripts/check-subreq-platform-cap.mjs [-s]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const STRICT = process.argv.includes('-s') || process.argv.includes('--strict')
const DEF_FILE = 'src/features/marketing/api/collect-budget.ts'
const SCAN_DIRS = ['src/features/marketing/api', 'src/features/supply/api', 'src/worker-ads']

function walk(dir, acc = []) {
  const abs = path.join(ROOT, dir)
  if (!fs.existsSync(abs)) return acc
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, e.name)
    if (e.isDirectory()) walk(rel, acc)
    else if (/\.ts$/.test(e.name)) acc.push(rel)
  }
  return acc
}

/** `fn(` 위치에서 균형 잡힌 괄호까지의 인자 문자열을 잘라 최상위 콤마로 나눈다(중첩 호출 안전). */
function callArgs(src, openIdx) {
  let depth = 0, i = openIdx
  for (; i < src.length; i++) {
    const c = src[i]
    if (c === '(') depth++
    else if (c === ')') { depth--; if (depth === 0) break }
  }
  if (depth !== 0) return null
  const inner = src.slice(openIdx + 1, i)
  const parts = []
  let d = 0, cur = ''
  for (const c of inner) {
    if (c === '(' || c === '[' || c === '{') d++
    if (c === ')' || c === ']' || c === '}') d--
    if (c === ',' && d === 0) { parts.push(cur.trim()); cur = '' } else cur += c
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts
}

const lineOf = (src, idx) => src.slice(0, idx).split('\n').length

const violations = []
const files = SCAN_DIRS.flatMap(d => walk(d))

// 🛡️ 2026-07-29: **측정 0 = 통과가 아니라 실패.** 대상이 비면 위반도 0이라 초록이 뜨는데,
//   그 초록은 아무것도 보장하지 않는다(같은 날 실측 3건이 그 상태로 몇 주~몇 달 방치됐다).
if (files.length === 0) {
  console.error('❌ 검사 대상 파일이 0개다 — 스캔 경로가 낡았을 가능성이 크다(통과 아님).')
  process.exit(1)
}

for (const rel of files) {
  if (rel.replace(/\\/g, '/') === DEF_FILE) continue
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8')
  if (src.includes('platform-cap-ok')) continue

  for (const [fn, minArgs, rule] of [['resolveSubreqBudget', 3, 'R1'], ['nextSubreqCap', 5, 'R2']]) {
    const re = new RegExp(`\\b${fn}\\s*\\(`, 'g')
    let m
    while ((m = re.exec(src))) {
      const open = m.index + m[0].length - 1
      const args = callArgs(src, open)
      if (!args) continue
      if (args.length < minArgs) {
        violations.push({ rel, line: lineOf(src, m.index), rule, msg: `${fn}() 에 플랫폼 천장 인자 누락(인자 ${args.length}/${minArgs}) — platformSubreqCap(env.ADS_SUBREQ_PLATFORM_CAP) 을 넘길 것` })
      }
    }
  }

  // R3 — 예산 **초기화 식 자체**가 천장을 거치는지 본다.
  //   ⚠️ 예전엔 "파일 어딘가에 platformSubreqCap 이 있으면 통과" 였는데, 그건 같은 파일의 *다른* 레인이
  //      천장을 쓰면 이 레인의 우회를 놓친다 — 실제로 클램프를 되돌려도 통과했다(가드 공허성 실측 2026-07-29).
  const budgetRe = /:\s*FetchBudget\s*=\s*\{/g
  let bm
  while ((bm = budgetRe.exec(src))) {
    const brace = src.indexOf('{', bm.index)
    let d = 0, j = brace
    for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (!d) break } }
    const init = src.slice(brace, j + 1)
    if (!/left\s*:/.test(init)) continue
    if (/platformSubreqCap|resolveSubreqBudget|budgetTotal|\bpcap\b|\btotal\b/.test(init)) continue
    violations.push({ rel, line: lineOf(src, bm.index), rule: 'R3', msg: '예산 초기화가 플랫폼 천장을 안 거친다 — resolveSubreqBudget() 또는 platformSubreqCap() 경유할 것' })
  }
}

if (!violations.length) {
  console.log('✅ 서브리퀘스트 플랫폼 천장 — 우회 0')
  process.exit(0)
}
console.log(`${STRICT ? '❌' : '⚠️'} 플랫폼 천장 우회 ${violations.length}건`)
for (const v of violations) console.log(`   ${v.rule} ${v.rel}:${v.line} — ${v.msg}`)
console.log('   → 천장을 넘겨 학습이 플랫폼 한도를 넘지 못하게 한다(collect-budget.ts 주석 참조). 예외: platform-cap-ok')
process.exit(STRICT ? 1 : 0)
