#!/usr/bin/env node
/**
 * 🛡️ 영구 방어선 — 모바일 뷰포트/스크롤 함정 재발 방지 (2026-06-22 동네딜 지도 하단 잘림 사건).
 *
 * 사건: 모바일에서 하단(네비/적용버튼/리스트 끝)이 화면 밖으로 잘림. 두 가지 고전적 함정:
 *   ① `h-screen`/`min-h-screen`(=100vh) — 모바일은 100vh 가 주소창 포함이라 실제 화면보다 큼 →
 *      `bottom-0` 콘텐츠가 화면 밖. ✅ `h-[100dvh]`/`min-h-[100dvh]` 사용.
 *   ② `flex-1 overflow-y-auto` 에 `min-h-0` 누락 — flex 자식 기본 min-height:auto 라 안 줄어듦 →
 *      스크롤 불가 + 형제(footer/적용버튼) 밀려 안 보임. ✅ `flex-1 min-h-0 overflow-y-auto`.
 *
 * ⚙️ 래칫(ratchet) 설계: 레거시(이미 160+ 파일이 h-screen) 는 건드리지 않고, **이번 커밋에서
 *   새로 추가/수정된 라인(staged diff 의 `+` 라인)만** 검사 → 신규 재발만 차단, 노이즈 0.
 *   대상: src/pages, src/components 의 .tsx (테스트 제외).
 *
 * 예외: 해당 라인에 `mobile-viewport-ok` 주석. 기본 warn-only(exit 0).
 *   차단: STRICT_MOBILE_VIEWPORT=1 또는 `-s` 플래그.
 */
import { execSync } from 'node:child_process'

const STRICT = process.env.STRICT_MOBILE_VIEWPORT === '1' || process.argv.includes('-s')

let diff = ''
try {
  diff = execSync('git diff --cached --unified=0 --no-color', { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
} catch {
  console.log('✅ mobile-viewport: staged diff 없음 (skip).')
  process.exit(0)
}

const TARGET = /^src\/(pages|components)\/.*\.tsx$/
const isTarget = (f) => TARGET.test(f) && !/\.test\.tsx$/.test(f)

// 100vh 계열 (dvh 권장)
const VH_PATTERNS = [
  /\bh-screen\b/, /\bmin-h-screen\b/, /\bmax-h-screen\b/,
  /\bh-\[100vh\]/, /\bmin-h-\[100vh\]/, /\bmax-h-\[100vh\]/,
  /100vh/,
]
// flex 스크롤 영역에 min-h-0 누락
function missesMinH0(line) {
  if (!/\bflex-1\b/.test(line)) return false
  if (!/\boverflow-(y-)?(auto|scroll)\b/.test(line)) return false
  if (/\bmin-h-0\b/.test(line) || /\bmin-h-\[/.test(line)) return false
  return true
}

const offenders = []
let curFile = null
for (const raw of diff.split('\n')) {
  if (raw.startsWith('+++ b/')) { curFile = raw.slice(6).trim(); continue }
  if (raw.startsWith('diff --git')) { curFile = null; continue }
  if (!curFile || !isTarget(curFile)) continue
  if (!raw.startsWith('+') || raw.startsWith('+++')) continue
  const line = raw.slice(1)
  if (line.includes('mobile-viewport-ok')) continue

  if (VH_PATTERNS.some((re) => re.test(line))) {
    offenders.push({ file: curFile, reason: '100vh(h-screen 등) → h-[100dvh]/min-h-[100dvh]', snippet: line.trim().slice(0, 100) })
  }
  if (missesMinH0(line)) {
    offenders.push({ file: curFile, reason: 'flex-1 overflow-y-auto 에 min-h-0 누락 → flex-1 min-h-0 overflow-y-auto', snippet: line.trim().slice(0, 100) })
  }
}

if (offenders.length === 0) {
  console.log('✅ mobile-viewport: 신규 라인에 100vh/min-h-0 함정 없음.')
  process.exit(0)
}

console.log('⚠️  모바일 하단 잘림 위험 — 새로 추가된 라인에서 발견 (CLAUDE.md "새 페이지 체크리스트 8"):')
for (const o of offenders) {
  console.log(`   - ${o.file}`)
  console.log(`     ${o.reason}`)
  console.log(`     › ${o.snippet}`)
}
console.log('')
console.log('   고치는 법: 100vh → 100dvh / 스크롤 영역엔 `min-h-0` 추가. 의도적이면 라인에 `mobile-viewport-ok` 주석.')

if (STRICT) {
  console.log('\n❌ STRICT_MOBILE_VIEWPORT — 차단.')
  process.exit(1)
}
console.log('\n(warn-only — 차단하려면 STRICT_MOBILE_VIEWPORT=1)')
process.exit(0)
