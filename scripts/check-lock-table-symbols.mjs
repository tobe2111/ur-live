#!/usr/bin/env node
/**
 * 🛡️ 2026-07-29: CLAUDE.md 잠금표가 **사라진 심볼**을 지키고 있는 것을 차단한다.
 *
 * ## 왜
 *
 * `CLAUDE.md` 의 두 잠금표(Toss V2 / 로딩 최적화)는 "이 파일의 이 심볼을 건드리지 마라" 는
 * 형태다. 그런데 코드가 리네임·삭제돼도 표는 그대로 남는다. 그러면 표는 **틀린 지도**가 된다:
 *
 *   · 실측 ①  `kakao.routes.ts | linkUserExtraRoles 응답에 seller.username 포함`
 *     → 그 함수는 `issueLinkedRoleTokens` 로 리네임됐다(동작은 유지). 표만 낡음.
 *   · 실측 ②  `src/App.tsx | MainHomePage eager import (lazy X)`
 *     → 홈이 `HomeRoute`(둘 다 lazy)로 바뀌면서 `MainHomePage` 는 **참조 0인 죽은 파일**이 됐다.
 *       이 행을 그대로 따르면 **죽은 컴포넌트를 되살리는** 변경을 하게 된다.
 *
 * CLAUDE.md 스스로가 경고하는 실패 모양이다 — "문서가 낡아 다음 세션이 옛 구조로 오판".
 * 이 레포는 그 오판을 실제로 반복해 왔고, 그래서 문서가 아니라 기계가 세게 한다.
 *
 * ## 판정
 *
 * 잠금표 행 `| \`src/…\` | …\`Symbol\`… | … |` 에서 백틱 식별자를 뽑아, 그 파일에 문자열로
 * 존재하는지 본다. 없으면 위반.
 *
 * ## 한계 (반드시 알고 쓸 것)
 *
 *   - **문자열 존재만 본다.** 심볼이 *주석에만* 남아 있어도 통과한다 — 위 실측 ②가 정확히 그 경우라
 *     이 가드는 ②를 못 잡았다(사람이 찾았다). 즉 이 가드는 **리네임·삭제**를 잡고,
 *     "언급은 있는데 더는 살아 있지 않음"은 못 잡는다.
 *   - 잠긴 항목 칸의 자유 서술(예: `dark:` variant, `useKv: false`)은 식별자가 아닐 수 있어
 *     최소 길이(4자)와 식별자 형태로 거른다. 그래도 오탐이 나면 그 행의 백틱을 풀거나
 *     파일에 `lock-table-ok` 를 넣지 말고 **표를 사실에 맞게 고치는 것이 정답**이다.
 *
 * 기본 warn-only(exit 0). 차단: STRICT_LOCK_TABLE=1 또는 `-s`.
 */
import { readFileSync, existsSync } from 'node:fs'

const STRICT = process.env.STRICT_LOCK_TABLE === '1' || process.argv.includes('-s')
const DOC = 'CLAUDE.md'

if (!existsSync(DOC)) {
  console.error(`❌ [lock-table] ${DOC} 를 찾을 수 없다 — 스캔 대상 부재는 통과가 아니다.`)
  process.exit(1)
}

const doc = readFileSync(DOC, 'utf8')

/** `| \`src/x.ts\` | 잠긴 항목 | 회귀 시 발생 |` 형태만. 취소선(~~) 처리된 폐기 행은 제외. */
const ROW = /^\|\s*`(src\/[A-Za-z0-9_./-]+\.(?:ts|tsx|css|mjs))`\s*\|([^|]*)\|/gm

let rows = 0
const violations = []
let m
while ((m = ROW.exec(doc)) !== null) {
  const [, path, item] = m
  rows++
  if (!existsSync(path)) {
    violations.push({ path, item: item.trim(), missing: ['(파일 자체가 없음)'] })
    continue
  }
  const src = readFileSync(path, 'utf8')
  const ids = [...item.matchAll(/`([A-Za-z_][A-Za-z0-9_]{3,})`/g)].map((x) => x[1])
  const missing = ids.filter((id) => !src.includes(id))
  if (missing.length) violations.push({ path, item: item.trim(), missing })
}

// 🛡️ 스캔 0건은 통과가 아니다 — 표 형식이 바뀌었다는 뜻이고, 그러면 이 가드는 무의미해진다.
if (rows === 0) {
  console.error('❌ [lock-table] 잠금표 행을 한 건도 못 찾았다 — 표 형식이 바뀌었거나 정규식이 깨졌다.')
  process.exit(1)
}

if (violations.length) {
  console.error(`❌ [lock-table] 사라진 심볼을 지키고 있는 잠금 행 ${violations.length}건:`)
  for (const v of violations) {
    console.error(`   ${v.path}`)
    console.error(`      잠긴 항목: ${v.item.slice(0, 80)}`)
    console.error(`      ❌ 파일에 없음: ${v.missing.join(', ')}`)
  }
  console.error(`\n   → 리네임됐으면 표의 이름을 고치고, 폐기됐으면 그 행을 폐기 표시하세요.`)
  console.error(`     낡은 잠금은 다음 세션을 **틀린 방향으로** 이끕니다(죽은 심볼을 되살리려 함).`)
  process.exit(STRICT ? 1 : 0)
}

console.log(`✅ lock-table: 잠금표 ${rows}행 — 지목 심볼 전부 해당 파일에 존재.`)
