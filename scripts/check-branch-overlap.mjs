#!/usr/bin/env node
/**
 * 🔀 동시 세션 충돌 조기경보 — 2026-07-29 신설.
 *
 * ## 왜 (이 레포에서 실제로 반복된 마찰)
 * 세션이 여러 개 동시에 도는 레포다. 같은 라이브 증상을 보면 **같은 곳을 판다**:
 *   · 2026-07-29 하루에만 — `#840`(드라이버 격리) · `#857`(보강 처리량) · `CLASSIFY_RULES_VERSION` bump 가
 *     서로 다른 세션에서 **중복 개발**됐고, main 인계엔 *"같은 날 3건을 중복 개발하고 버렸다"* 가 남아 있다.
 *   · 같은 날 한 브랜치가 `src/worker-ads/index.ts` 때문에 **세 번** 재병합했다.
 *
 * main 인계는 이걸 *"착수 전 `origin/main` 을 보라"* 는 **룰로만** 적어 놨다. 룰만 있고 강제가 없으면
 * 결국 놓친다(이 레포가 인계 가드·시드 버전 가드를 만든 이유와 같다).
 *
 * ## 무엇을 검사하나 — **겹칠 때만** 운다
 * 단순히 "main 보다 N 커밋 뒤처짐"으로 울리면 활발한 레포에선 **매번** 울고, 매번 우는 경고는
 * 곧 우회가 습관이 된다. 그래서 **실제 겹침**만 본다:
 *
 *   ① 이 브랜치가 바꾼 파일 (merge-base…HEAD)
 *   ② merge-base 이후 **main 이** 바꾼 파일 (merge-base…origin/main)
 *   → ①∩② 가 비어 있지 않으면 경고.
 *
 * 그 교집합이 곧 "머지 버튼을 누를 때 충돌하거나, 조용히 남의 수정을 되돌릴 파일"이다.
 *
 * 기본 warn. 차단: `STRICT_BRANCH_OVERLAP=1`. 우회: 커밋 메시지 `[SKIP_OVERLAP]`.
 */
import { execSync } from 'node:child_process'

const sh = (cmd) => {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { return '' }
}
const lines = (s) => s.split('\n').map(x => x.trim()).filter(Boolean)

const base = ['origin/main', 'origin/master'].find(r => sh(`git rev-parse --verify --quiet ${r}`))
if (!base) { console.log('✅ 브랜치 겹침: 기준 브랜치 없음 (skip).'); process.exit(0) }

const head = sh('git rev-parse --abbrev-ref HEAD')
if (head === 'main' || head === 'master') { console.log('✅ 브랜치 겹침: 기본 브랜치 (skip).'); process.exit(0) }

// 병합 진행 중이면 지금이 바로 그 겹침을 처리하는 중이다 — 소음.
if (sh('git rev-parse --verify --quiet MERGE_HEAD')) { console.log('✅ 브랜치 겹침: 병합 진행 중 (skip).'); process.exit(0) }

const mergeBase = sh(`git merge-base ${base} HEAD`)
if (!mergeBase) { console.log('✅ 브랜치 겹침: merge-base 없음 (skip).'); process.exit(0) }

// 이미 최신 main 을 품고 있으면 겹칠 것이 없다.
if (sh(`git rev-parse ${base}`) === mergeBase) { console.log(`✅ 브랜치 겹침: ${base} 최신 반영됨.`); process.exit(0) }

const mine = new Set([
  ...lines(sh(`git diff --name-only ${mergeBase}...HEAD`)),
  ...lines(sh('git diff --cached --name-only --diff-filter=ACMR')),  // pre-commit 시점: 아직 커밋 전
])
const theirs = new Set(lines(sh(`git diff --name-only ${mergeBase}..${base}`)))

// 세션별 인계 파일은 각자 새 파일이라 겹칠 일이 없다 — 소음 제거.
//   ⚠️ 단 `docs/CURRENT_WORK.md`(생성된 목차)는 **제외하지 않는다.** 2026-07-29 실측:
//   인계를 세션별 파일로 쪼개 충돌 면적을 줄였지만 **목차는 여전히 공유 파일**이라,
//   다른 세션이 handoff 를 추가하면 목차가 함께 바뀌어 **GitHub 머지가 그 파일 하나로 막힌다**
//   (로컬은 `merge=union` 으로 조용히 풀려 차이를 못 느낀다 — 그래서 처음에 제외했다가 실제로 막혔다).
//   생성물이라 해소는 `git merge` 후 `node scripts/generate-handoff-index.mjs` 한 번이면 끝난다.
const IGNORE = (f) => f.startsWith('docs/handoff/')
const overlap = [...mine].filter(f => theirs.has(f) && !IGNORE(f)).sort()

if (!overlap.length) {
  const behind = sh(`git rev-list --count HEAD..${base}`) || '0'
  console.log(`✅ 브랜치 겹침 없음 (${base} 가 ${behind} 커밋 앞서 있지만 같은 파일은 안 건드림).`)
  process.exit(0)
}

const strict = process.env.STRICT_BRANCH_OVERLAP === '1'
console.log(`${strict ? '❌' : '⚠️'}  동시 세션 겹침 — ${base} 가 **이 브랜치가 고친 파일**을 그 사이에 바꿨다:`)
for (const f of overlap.slice(0, 10)) console.log(`   • ${f}`)
if (overlap.length > 10) console.log(`   … 외 ${overlap.length - 10}개`)
console.log('')
console.log(`   고치는 법: 지금 \`git merge ${base}\` 하고 **양쪽 의도를 다 살려** 해소한 뒤 검증할 것.`)
console.log('     · 한쪽을 통째로 버리지 마라 — 다른 세션이 알아낸 절반이 사라진다.')
console.log('     · 같은 증상을 봤다면 같은 곳을 팠을 가능성이 높다. 어느 쪽이 더 깊이 갔는지 보고 합쳐라.')
console.log('   미루면: GitHub 머지에서 충돌로 막히거나, 조용히 남의 수정을 되돌린다.')
console.log('   의도적이면 커밋 메시지에 [SKIP_OVERLAP].')
process.exit(strict ? 1 : 0)
