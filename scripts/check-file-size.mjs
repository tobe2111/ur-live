#!/usr/bin/env node
/**
 * 🛡️ 영구 방어선 — god 파일 재발 방지 래칫 (2026-06-29).
 *
 * 배경: 페이지/라우트가 "일단 여기에 한 블록 더" 누적으로 god 파일이 됨
 *   (MyVouchersPage 1296·GroupBuyListPage 1309·wholesale.routes 2200…) → 사후 대규모 분해 필요.
 *   사람 의지가 아니라 *기계*가 막아야 재발 0 (CLAUDE.md 철학 "수동 감사 반복 말고 기계가 지키게").
 *
 * ⚙️ 래칫 설계:
 *   ① 신규/미등록 파일이 THRESHOLD(600줄) 초과 → 경고("컴포넌트/모듈로 분리하세요").
 *   ② baseline 등록 파일(현재 600 초과한 기존 대형 파일)은 *그 줄 수보다 커지면* 차단 →
 *      줄이는 건 OK, 키우는 건 금지(god 파일이 다시 자라지 못함). 줄이면 졸업(rebaseline 으로 갱신).
 *
 * 대상: src 하위 .ts/.tsx (테스트/.d.ts 제외). pre-commit 은 staged 파일만, 게이트(-a)는 전수.
 * 예외: 파일 상단(~8줄)에 `file-size-ok` 주석 또는 commit 메시지 `[SKIP_SIZE]`. 기본 warn-only.
 *   차단: STRICT_FILE_SIZE=1 또는 -s.
 *
 * ③ `--changed-only[=<base-ref>]` (2026-07-11 — CI/PR 전용 모드): merge-base(base, HEAD)..HEAD 로
 *    *이 브랜치가 실제 바꾼 파일만* 같은 규칙(미등록 600줄 / baseline 초과)으로 판정.
 *    base 기본 `origin/main`. base ref 를 못 찾으면(얕은 clone 등) 안내 출력 후 전수(-a)로 폴백.
 *    배경: -a 전수 모드가 CI strict 로 돌면, main 자신의 머지로 baseline 동결 파일이 자라기만 해도
 *    (예: RestaurantMapPage 714→768→769) **무관한 PR 이 건드리지도 않은 파일로 실패** →
 *    "baseline 을 main 드리프트에 맞추는" 잡일 커밋 반복(오늘만 3회 재발). PR 은 자기가 바꾼
 *    파일만 책임지고, repo 전체 드리프트는 audit-gate(-a)/rebaseline 이 담당하는 게 근본 구조.
 *
 * baseline 갱신(대형 파일을 더 줄인 뒤): node scripts/check-file-size.mjs --rebaseline
 *   → 현재 THRESHOLD 초과 파일을 현재 줄 수로 동결, 그 이하로 내려온 파일은 졸업(목록에서 제거).
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const STRICT = process.env.STRICT_FILE_SIZE === '1' || process.argv.includes('-s')
const ALL = process.argv.includes('-a') || process.argv.includes('--all')
const REBASELINE = process.argv.includes('--rebaseline')
// --changed-only[=<base-ref>] — merge-base(base, HEAD)..HEAD 변경 파일만 판정 (CI/PR 용, 헤더 ③ 참조)
const changedOnlyArg = process.argv.find((a) => a === '--changed-only' || a.startsWith('--changed-only='))
const CHANGED_ONLY = Boolean(changedOnlyArg)
const CHANGED_BASE_RAW = changedOnlyArg && changedOnlyArg.includes('=')
  ? changedOnlyArg.slice('--changed-only='.length)
  : 'origin/main'
// ref 이름만 허용 (셸 인젝션 방지 — execSync 문자열에 들어감)
const CHANGED_BASE = /^[\w./@^~-]+$/.test(CHANGED_BASE_RAW) ? CHANGED_BASE_RAW : 'origin/main'
const THRESHOLD = 600

const ROOT = process.cwd()
const BASELINE_PATH = 'scripts/file-size-baseline.json'

const isTarget = (f) =>
  /^src\/.*\.(ts|tsx)$/.test(f) && !/\.(test|spec)\.(ts|tsx)$/.test(f) && !/\.d\.ts$/.test(f)

function countLines(f) {
  try {
    const txt = readFileSync(join(ROOT, f), 'utf8')
    // 마지막 개행 1개는 줄로 안 셈 (wc -l 과 동일).
    return txt.length === 0 ? 0 : txt.split('\n').length - (txt.endsWith('\n') ? 1 : 0)
  } catch { return 0 }
}
function hasOkComment(f) {
  try { return readFileSync(join(ROOT, f), 'utf8').split('\n').slice(0, 8).some((l) => l.includes('file-size-ok')) }
  catch { return false }
}
function allTargetFiles() {
  const out = execSync('git ls-files src', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return out.split('\n').map((s) => s.trim()).filter(Boolean).filter(isTarget)
}

// ── --rebaseline: 현재 THRESHOLD 초과 파일을 현재 줄 수로 동결, 이하는 졸업 ──
if (REBASELINE) {
  const next = {}
  for (const f of allTargetFiles()) {
    const n = countLines(f)
    if (n > THRESHOLD) next[f] = n
  }
  const ordered = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(join(ROOT, BASELINE_PATH), JSON.stringify(ordered, null, 2) + '\n')
  console.log(`✅ file-size baseline 갱신: ${Object.keys(ordered).length}개 대형 파일 동결 (THRESHOLD ${THRESHOLD}).`)
  process.exit(0)
}

let baseline = {}
try { baseline = JSON.parse(readFileSync(join(ROOT, BASELINE_PATH), 'utf8')) } catch { baseline = {} }

// commit 메시지 [SKIP_SIZE] (pre-commit 시)
try {
  if (existsSync(join(ROOT, '.git/COMMIT_EDITMSG'))) {
    const msg = readFileSync(join(ROOT, '.git/COMMIT_EDITMSG'), 'utf8')
    if (/\[SKIP_SIZE\]/.test(msg)) { console.log('✅ file-size: [SKIP_SIZE] — skip.'); process.exit(0) }
  }
} catch { /* ignore */ }

// --changed-only: 이 브랜치(merge-base(base, HEAD)..HEAD)가 실제 바꾼 파일만.
// base ref 미해석(얕은 clone / remote 없음)이면 전수(-a) 폴백 — 조용히 축소 판정하지 않음.
let changedOnlyFellBack = false
function changedOnlyFiles() {
  try {
    const mergeBase = execSync(`git merge-base ${CHANGED_BASE} HEAD`, { encoding: 'utf8' }).trim()
    if (!mergeBase) throw new Error('empty merge-base')
    const out = execSync(`git diff --name-only --diff-filter=ACMR ${mergeBase}..HEAD`, {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    })
    return out.split('\n').map((s) => s.trim()).filter(Boolean).filter(isTarget)
  } catch {
    changedOnlyFellBack = true
    console.log(`ℹ️  --changed-only: '${CHANGED_BASE}' merge-base 계산 실패(얕은 clone/ref 없음?) → 전수(-a) 스캔으로 폴백.`)
    console.log('   CI 라면 checkout fetch-depth: 0 또는 `git fetch origin main` 이 필요합니다.')
    return allTargetFiles()
  }
}

function targetFiles() {
  if (ALL) return allTargetFiles()
  if (CHANGED_ONLY) return changedOnlyFiles()
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' })
    return out.split('\n').map((s) => s.trim()).filter(Boolean).filter(isTarget)
  } catch { return [] }
}

const files = targetFiles()
const modeLabel = CHANGED_ONLY
  ? (changedOnlyFellBack ? '전수 폴백(-a)' : `changed-only vs ${CHANGED_BASE}`)
  : ''
if (files.length === 0) {
  // 🛡️ 2026-07-29 (대표 지시): changed-only 는 '바뀐 파일 없음'이 정상이지만,
  //   전수 모드에서 0개는 스캔이 헛도는 것이다(경로/필터 회귀) — 초록불로 넘기면 안 된다.
  if (!CHANGED_ONLY) {
    console.error('❌ file-size: 전수 스캔인데 대상 0개 — 검사가 헛돌고 있다(경로/필터 확인).')
    process.exit(1)
  }
  console.log(`✅ file-size: 대상 없음 (skip${modeLabel ? ` — ${modeLabel}` : ''}).`)
  process.exit(0)
}

const offenders = []
for (const f of files) {
  if (hasOkComment(f)) continue
  const lines = countLines(f)
  if (Object.prototype.hasOwnProperty.call(baseline, f)) {
    if (lines > baseline[f]) offenders.push({ f, lines, reason: `baseline ${baseline[f]}줄 초과 — god 파일 성장 금지(줄이거나 분리)` })
  } else if (lines > THRESHOLD) {
    offenders.push({ f, lines, reason: `${THRESHOLD}줄 초과 — 새 god 파일(컴포넌트/모듈로 분리)` })
  }
}

if (offenders.length === 0) {
  const modeNote = modeLabel ? `, ${modeLabel} — ${files.length}개 판정` : ''
  console.log(`✅ file-size: 신규/수정 파일 god 파일 없음 (cap ${THRESHOLD}줄, baseline ${Object.keys(baseline).length}개 동결${modeNote}).`)
  process.exit(0)
}

console.log('⚠️  파일 크기 래칫 — god 파일 위험 (CLAUDE.md "새 페이지 체크리스트"):')
for (const o of offenders) console.log(`   - ${o.f} (${o.lines}줄) — ${o.reason}`)
console.log('')
console.log('   고치는 법: 페이지/라우트의 카드·모달·섹션·핸들러群을 같은이름 폴더(예: foo-list/)로 추출.')
console.log('   기존 대형 파일을 더 줄였으면 → node scripts/check-file-size.mjs --rebaseline (baseline 갱신).')
console.log('   의도적이면 파일 상단에 `file-size-ok` 주석 또는 commit 메시지 [SKIP_SIZE].')

if (STRICT) { console.log('\n❌ STRICT_FILE_SIZE — 차단.'); process.exit(1) }
console.log('\n(warn-only — 차단하려면 STRICT_FILE_SIZE=1)')
process.exit(0)
