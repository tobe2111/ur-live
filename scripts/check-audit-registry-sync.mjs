#!/usr/bin/env node
/**
 * 📋 2026-07-29: 감사 레지스트리(`docs/AUDIT_INVARIANTS.md`)가 실제 게이트와 어긋나는 것 차단.
 *
 * ## 왜 필요한가
 *
 * 이 문서는 장식이 아니다. CLAUDE.md 가 **"감사 요청을 받으면 audit-gate 를 먼저 돌리고,
 * GREEN 도메인은 수동 재감사를 *건너뛰라*"** 고 지시하고, 무엇이 GREEN 인지의 목록이 바로 이 문서다.
 * 그러니 문서가 낡으면 두 방향 모두로 손해가 난다:
 *
 *   · 문서에 **빠진** 가드 → 그 영역이 "가드 미보유"로 읽혀 **이미 기계가 지키는 것을 손으로 또 판다.**
 *   · 문서의 **개수가 낡음** → "49개" 라고 적혀 있는데 실제로 72개가 돌면, 이 문서가 현재를 반영한다는
 *     믿음 자체가 깨진다.
 *
 * 실측(2026-07-29): 한 줄 점검 블록은 **49개**라고 적혀 있었고 실제 게이트는 **72개**였다.
 * 표에서 아예 빠진 가드가 **8개**(blog-fact-sync · blog-seed-currency · consumer-img-cfimage ·
 * i18n-sync · legacy-domain · platform-model-sync · schema-cost-counted · weakset-primitive).
 *
 * ## 두 가지만 본다
 *
 *   R1. `audit-gate.sh` 가 실행하는 모든 가드가 문서에 **이름으로** 등장할 것.
 *       `check-sql-*` 처럼 문서가 와일드카드로 묶은 경우는 그 접두어로 인정한다.
 *   R2. 한 줄 점검 블록의 "전체 (N개 불변식)" 이 실제 `run "` 개수와 일치할 것.
 *
 * ## 이 가드가 못 보는 것 (과신 금지)
 *
 *   - **설명이 맞는지**는 안 본다. 이름만 있고 내용이 옛것을 설명해도 통과한다.
 *   - verify.yml 전용 검사(게이트 밖)는 대상이 아니다 — 게이트가 SSOT 인 문서라서 그렇다.
 *
 * 기본 warn-only(exit 0). 차단: STRICT_AUDIT_REGISTRY=1 또는 `-s`.
 */
import { readFileSync, existsSync } from 'node:fs'

const STRICT = process.env.STRICT_AUDIT_REGISTRY === '1' || process.argv.includes('-s')
const GATE = 'scripts/audit-gate.sh'
const DOC = 'docs/AUDIT_INVARIANTS.md'

if (!existsSync(GATE) || !existsSync(DOC)) {
  console.error(`❌ audit-registry: ${GATE} 또는 ${DOC} 가 없다 — 통과가 아니다.`)
  process.exit(1)
}

const gate = readFileSync(GATE, 'utf8')
const doc = readFileSync(DOC, 'utf8')

const invoked = [...new Set([...gate.matchAll(/scripts\/(check-[a-z0-9-]+)/g)].map((m) => m[1]))].sort()
const runCount = (gate.match(/^\s{2}run "/gm) || []).length

if (invoked.length === 0 || runCount === 0) {
  // "측정 0 = 통과 아님" — 게이트 형식이 바뀌어 아무것도 못 뽑았는데 초록을 내면 이 검사가 헛돈다.
  console.error(`❌ audit-registry: 게이트에서 가드(${invoked.length})나 run 줄(${runCount})을 못 뽑았다 — 추출이 깨졌다.`)
  process.exit(1)
}

const problems = []

// ── R1. 게이트가 돌리는 가드는 문서에 이름이 있어야 한다 ─────────────────────
//   문서가 `check-sql-*` 처럼 접두어로 묶었으면 그것으로 인정한다(불필요한 소음 방지).
const docNames = new Set([...doc.matchAll(/check-[a-z0-9-]*/g)].map((m) => m[0]))
const documented = (name) => {
  if (docNames.has(name)) return true
  for (const d of docNames) if (d.length > 6 && name.startsWith(d)) return true // 접두어 묶음
  return false
}
const missing = invoked.filter((n) => !documented(n))
if (missing.length) {
  problems.push(`문서에 없는 가드 ${missing.length}건 — 그 영역이 "가드 미보유"로 오해돼 손으로 재감사하게 된다:`)
  for (const m of missing) problems.push(`      • ${m}`)
}

// ── R2. 문서가 말하는 개수 == 실제 개수 ─────────────────────────────────────
const claimed = doc.match(/전체\s*\((\d+)개\s*불변식\)/)
if (!claimed) {
  problems.push(`한 줄 점검 블록의 "전체 (N개 불변식)" 표기를 못 찾았다 — 형식이 바뀌었으면 이 가드도 함께 고칠 것.`)
} else if (Number(claimed[1]) !== runCount) {
  problems.push(`개수 불일치: 문서 ${claimed[1]}개 vs 실제 ${runCount}개 — 문서를 ${runCount} 로 고칠 것.`)
}

if (problems.length === 0) {
  console.log(`✅ audit-registry: 게이트 ${runCount}개 불변식 · 가드 ${invoked.length}종 전부 문서에 등재됨.`)
  process.exit(0)
}

const say = STRICT ? console.error : console.warn
say(`${STRICT ? '❌' : '⚠️'} audit-registry: ${DOC} 가 실제 게이트와 어긋난다`)
for (const p of problems) say(`   ${p}`)
say(`
  이 문서는 장식이 아니다 — CLAUDE.md 가 "GREEN 도메인은 수동 재감사를 건너뛰라" 고 하고,
  무엇이 GREEN 인지의 목록이 바로 이 표다. 새 가드를 audit-gate 에 넣었으면 **같은 커밋에서**
  표에 한 줄(불변식이 무엇을 보장하는가 + 왜 생겼는가)을 추가할 것.`)
process.exit(STRICT ? 1 : 0)
