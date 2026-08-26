#!/usr/bin/env node
/**
 * 🧭 브랜치가 **의도하지 않은 영역**을 건드렸는지 — origin/main 대비 전수 대조
 *
 * 🩸 2026-08-26 실사고에서 나왔다. `check-guard-mutations` 가 **의도적으로 심어 둔 결함**이
 *   워킹트리에 있는 동안 `git add -A` 가 그걸 집어 커밋했다. 그날 나는 두 번 놓쳤다:
 *   ① 첫 수습에서 **경로를 손으로 골라** diff 했다 → 그 목록 밖의 여섯 번째 주입본을 못 봤다
 *      (`cron-beat-retirement.ts` 의 개명 판정이 통째로 빠져 있었고, CI 가 대신 잡아 줬다)
 *   ② 그 실패를 보고도 "내 변경 탓"부터 의심했다
 *
 * ⇒ 그래서 **사람이 경로를 고르지 않게** 한다. 이 검사는 브랜치가 바꾼 파일 전부를 세고,
 *   그 안에서 **주입 시그니처**를 찾는다. 사람이 무엇을 의도했는지는 묻지 않는다 —
 *   물어보는 순간 또 손으로 고르게 된다.
 *
 * 못 막는 것: 주입 패턴이 아닌 오염(다른 브랜치 코드가 섞여 들어온 경우 등).
 *   그건 이 검사가 아니라 리뷰가 볼 일이다.
 *
 * 우회: 커밋 메시지 `[SKIP_BRANCH_SCOPE]` · 예외 주석 `branch-scope-ok`
 */
import { execSync } from 'node:child_process'

/** `check-guard-mutations` 가 심는 결함의 지문. 매니페스트가 늘면 여기도 늘려라. */
const INJECTION_SIGNATURES = [
  { re: /^\+\s*if \(false\)\s*\{/m,                    what: 'if (false) — 조건 무력화' },
  { re: /^\+.*=>\s*p\s*$/m,                            what: '함수 본문을 항등으로 대체' },
  { re: /^\+\s*\/\/ \([^)]*(?:제거|무력화|삭제)\)\s*$/m, what: '"(… 제거)" 주석으로 로직 대체' },
  { re: /^\+.*__probe-[a-z]/m,                          what: '존재하지 않는 __probe 모듈 import' },
  { re: /^\+\s*const mk = \(/m,                         what: '가짜 헬퍼(mk) 주입' },
  { re: /^\+.*VALUES \(\?, 'x',/m,                      what: "식별자를 'x' 로 바꿔치기" },
]

function sh(cmd) { return execSync(cmd, { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 }) }

let base = 'origin/main'
try { sh(`git rev-parse --verify ${base}`) } catch { base = 'main' }

let diff
try {
  diff = sh(`git diff ${base}...HEAD -- src/ scripts/ public/`)
} catch {
  console.log('⚠️ branch-scope: base 브랜치를 못 찾아 검사를 건너뜁니다(shallow clone 등).')
  process.exit(0)
}

// 이 스크립트 자신과 주입을 *수행하는* 테스트는 지문을 문자열로 갖고 있어 제외한다.
const SELF = /(check-branch-scope|check-guard-mutations|ads-dispatch-bypass)/

const hits = []
// 파일 단위로 쪼개 어느 파일인지 말해 준다 — "어딘가에 있다" 는 수습에 도움이 안 된다.
for (const chunk of diff.split(/^diff --git /m).slice(1)) {
  const file = (chunk.match(/^a\/(\S+)/) || [])[1] || '(unknown)'
  if (SELF.test(file)) continue
  if (/branch-scope-ok/.test(chunk)) continue
  for (const sig of INJECTION_SIGNATURES) {
    if (sig.re.test(chunk)) hits.push(`${file} — ${sig.what}`)
  }
}

const changed = sh(`git diff --name-only ${base}...HEAD`).trim().split('\n').filter(Boolean).length

if (hits.length) {
  console.error(`❌ branch-scope: 주입 시그니처 ${hits.length}건 (변경 ${changed}개 파일)`)
  for (const h of hits) console.error(`   · ${h}`)
  console.error('')
  console.error('   `check-guard-mutations` 실행 중에 커밋했을 가능성이 큽니다.')
  console.error('   → 해당 파일을 origin/main 으로 되돌리세요:  git checkout origin/main -- <파일>')
  console.error('   → 그리고 훅이 설치돼 있는지 확인:  ls .git/hooks/pre-commit || bash scripts/install-git-hooks.sh')
  process.exit(1)
}
console.log(`✅ branch-scope: 주입 시그니처 없음 (${base} 대비 ${changed}개 파일 변경).`)
