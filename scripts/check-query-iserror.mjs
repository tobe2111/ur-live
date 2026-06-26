#!/usr/bin/env node
/**
 * 🛡️ 2026-06-26: "fetch 실패가 빈화면/₩0 으로 위장" 버그 클래스 방어 (도매/제조사/도매-어드민 surface).
 *
 * 배경 (전수조사 에러처리): useWholesale* 훅이 2026-06-19 감사에서 에러를 빈배열로 삼키지 않도록
 *   바뀌었는데, 소비 페이지들은 `data` 만 읽고 `isError` 를 안 봐서 일시 5xx/네트워크 실패가
 *   "데이터 0건"·"예치금 ₩0"·"승인 대기 없음" 으로 오표시됐다(판매사 재무 오인·승인큐 self-undo).
 *
 * 룰: 아래 surface 의 페이지가 `useApiQuery(` 또는 `useWholesale<Query>(` 에서 `data` 를 구조분해하면
 *   같은 파일에 `isError` 참조가 반드시 있어야 한다(에러 분기 + 재시도 노출).
 *
 * 자동 제외: 파일에 `iserror-check-ok` 주석.
 *
 * 동작: 기본 warn-only. 차단: `-s` 또는 STRICT_ISERROR=1 (exit 1).
 */
import fs from 'fs'
import path from 'path'

const STRICT = process.argv.includes('-s') || process.env.STRICT_ISERROR === '1'
const ROOT = process.cwd()

// 이 버그 클래스가 사는 surface 만 (전 앱 X — 노이즈 방지).
const TARGET_GLOBS = [
  /^src\/pages\/Wholesale.*\.tsx$/,
  /^src\/pages\/wholesale\/.*\.tsx$/,
  /^src\/pages\/Supplier.*\.tsx$/,
  /^src\/pages\/supplier-dashboard\/.*\.tsx$/,
  /^src\/pages\/AdminWholesale.*\.tsx$/,
  /^src\/pages\/admin\/AdminDistributor.*\.tsx$/,
  /^src\/pages\/AdminSuppliersPage\.tsx$/,
]

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage'])
function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (name.endsWith('.tsx')) out.push(full)
  }
  return out
}

// 쿼리 훅(데이터 조회) — 구조분해에 data 가 있으면 isError 도 봐야 함.
//   useWholesale* 중 mutation 류는 보통 useXxxMutation 이라 'Query' 의미의 조회 훅만 본다.
const QUERY_HOOK_RE = /const\s*\{([^}]*)\}\s*=\s*(useApiQuery|useWholesale[A-Z]\w*)\s*\(/g

const files = walk(path.join(ROOT, 'src', 'pages')).filter(f => {
  const rel = path.relative(ROOT, f).split(path.sep).join('/')
  return TARGET_GLOBS.some(re => re.test(rel))
})

const violations = []
for (const file of files) {
  const code = fs.readFileSync(file, 'utf8')
  if (/iserror-check-ok/.test(code)) continue
  if (code.includes('isError')) continue // 이미 에러 분기 있음 → OK
  let m
  QUERY_HOOK_RE.lastIndex = 0
  while ((m = QUERY_HOOK_RE.exec(code)) !== null) {
    const destructured = m[1]
    // data 를 구조분해(별칭 data: 포함)하는데 isError 가 파일 어디에도 없음.
    if (/\bdata\b/.test(destructured)) {
      const line = code.slice(0, m.index).split('\n').length
      const rel = path.relative(ROOT, file).split(path.sep).join('/')
      violations.push(`${rel}:${line} — ${m[2]} 의 data 만 읽고 isError 분기 없음 (fetch 실패가 빈화면/0 으로 위장)`)
      break // 파일당 1건이면 충분
    }
  }
}

if (violations.length === 0) {
  console.log('✅ 쿼리 에러상태 — 도매/제조사 surface 의 data 소비 페이지 전부 isError 분기 보유.')
  process.exit(0)
}

console.error(`${STRICT ? '❌' : '⚠️'} 쿼리 isError 분기 누락 ${violations.length}건:`)
for (const v of violations) console.error('   ' + v)
console.error('\n   수정: isError(+error/refetch) 구조분해 → 에러 분기(DashboardLoadError 또는 인라인 재시도) 렌더.')
console.error('   예외: 파일에 `iserror-check-ok` 주석.')
process.exit(STRICT ? 1 : 0)
