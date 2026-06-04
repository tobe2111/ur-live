#!/usr/bin/env node
/**
 * 🛡️ 2026-05-31: 다크/라이트 테마 일관성 검사.
 *
 * 룰 (CLAUDE.md 테마 정책):
 *   - 유저 대면 화이트-토글 페이지(쇼핑/상세/마이 등)는 라이트 색상에 dark: variant 필수.
 *     bg-white → dark:bg-..., text-gray-900/800/700 → dark:text-... 등.
 *   - 라이트 색상인데 같은 element 에 dark: counterpart 없으면 다크 모드에서 흰 박스/검은 텍스트.
 *
 * 제외:
 *   - seller/admin/agency 대시보드 → dark: variant 금지 (check-dashboard-theme.sh 가 별도 강제).
 *   - 순수 다크 페이지(bg-[#020202] 등) → 애초에 라이트 클래스 없어 자동 무시.
 *   - 콜백/디버그/embed → 테마 무관.
 *
 * 동작: 기본 warn-only. CI strict 는 `-s` 또는 STRICT_THEME=1 (exit 1).
 *
 * 미래 페이지 자동 적용: pre-commit hook + verify.yml CI 에 등록됨.
 */
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const STRICT = process.argv.includes('-s') || process.env.STRICT_THEME === '1'
const ROOT = process.cwd()

// 대시보드(dark 금지) + 콜백/디버그/embed/소개 = 제외
//   - seller/admin/agency: 라이트 고정 대시보드 (check-dashboard-theme.sh 별도 강제)
//   - streaming/: 셀러 방송 셋업(SellerLiveBroadcast 하위) — 대시보드 컨텍스트
//   - guide/: SellerGuide/AgencyGuide/AdminOperationsGuide 전용
//   - dashboard/: 대시보드 통계 카드 등 셀러/어드민 전용
//   (usage 추적으로 확인 — 2026-05-31. 라이트 고정이라 dark: 추가 금지)
const EXCLUDE = /(seller|admin|agency|supplier|[Ww]holesale)|components\/(streaming|guide|dashboard)\//i
const EXCLUDE_FILE = /(Callback|Debug|Embed|Introduce|Login|Register)/i
// 최상위 컴포넌트지만 대시보드 전용(Admin/SellerProducts 에서만 사용) — 라이트 고정.
const DASHBOARD_ONLY = /(ProductOptionForm|BulkUploadModal)\.tsx$/

// 라이트 색 → 필요한 dark: prefix (같은 className 에 존재해야)
// 🛡️ variant-aware: `hover:bg-gray-100` 은 `dark:hover:bg-...` 로 대응 (오탐 방지).
//   util 의 variant 체인(hover:/focus:/group-hover:/lg: 등)을 추출해 dark:<variant>prop 존재 검사.
const LIGHT_TOKENS = [
  { re: /((?:[\w-]+:)*)bg-white\b(?!\/)/g, prop: 'bg', label: 'bg-white' },
  { re: /((?:[\w-]+:)*)bg-gray-50\b/g, prop: 'bg', label: 'bg-gray-50' },
  { re: /((?:[\w-]+:)*)bg-gray-100\b/g, prop: 'bg', label: 'bg-gray-100' },
  { re: /((?:[\w-]+:)*)text-gray-900\b/g, prop: 'text', label: 'text-gray-900' },
  { re: /((?:[\w-]+:)*)text-gray-800\b/g, prop: 'text', label: 'text-gray-800' },
  { re: /((?:[\w-]+:)*)text-gray-700\b/g, prop: 'text', label: 'text-gray-700' },
]

function listTsx(dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...listTsx(p))
    else if (e.name.endsWith('.tsx')) out.push(p)
  }
  return out
}

// 변경된 파일만 검사(있으면) — pre-commit 속도. 없으면 전체.
let targetFiles = []
try {
  const staged = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' })
    .split('\n').filter(f => /^src\/(pages|components)\/.*\.tsx$/.test(f))
  targetFiles = staged.length ? staged.map(f => path.join(ROOT, f)) : []
} catch { /* not a git context */ }
if (targetFiles.length === 0) {
  targetFiles = [...listTsx('src/pages'), ...listTsx('src/components')]
}

// 강제 다크 페이지(라이트 토글 무관) — light 버튼이 섞여도 다크 고정.
//   LiveDonation: live 뷰어 위 화이트 바텀시트(의도된 흰색, Toss/Kakao 결제시트 패턴) — 다크 고정.
const FORCED_DARK_FILE = /(Shorts|LiveList|LivePage|live\/|Reel|ShortsPage|LiveDonation)/i
const violations = []
for (const f of targetFiles) {
  if (!fs.existsSync(f)) continue
  const rel = f.replace(ROOT + '/', '')
  if (EXCLUDE.test(rel) || EXCLUDE_FILE.test(rel) || FORCED_DARK_FILE.test(rel) || DASHBOARD_ONLY.test(rel)) continue
  const src = fs.readFileSync(f, 'utf8')
  // 🛡️ 정밀: "토글 의도" 신호 — dark: variant 가 이미 하나라도 있어야 partial-dark 로 판정.
  //   (dark: 0 = 순수 다크/강제 화이트로 모호 → 플래그 X, 오탐 방지)
  //   bg-[#020202] = 강제 다크 페이지 → 제외.
  if (!/dark:(bg|text|border)/.test(src)) continue
  if (/bg-\[#020202\]|data-mobile-only/.test(src)) continue
  const lines = src.split('\n')
  lines.forEach((line, i) => {
    // 주석 줄(// 또는 * 로 시작)은 className 아님 → 스킵 (오탐 방지)
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
    for (const tok of LIGHT_TOKENS) {
      tok.re.lastIndex = 0
      let m
      while ((m = tok.re.exec(line)) !== null) {
        const variant = m[1] || '' // e.g. "hover:" / "group-hover:" / "" — dark: 뒤 동일 variant 필요
        // 🛡️ 이미 dark: 유틸(예: `dark:bg-white` = 반전 버튼의 다크 variant)은 라이트 토큰 아님 → 스킵
        if (variant.includes('dark:')) continue
        // dark:<variant>bg- 또는 (variant 없는 base 라이트면) dark:(...:)bg- 아무 곳이나 허용
        const needle = variant ? `dark:${variant}${tok.prop}-` : `dark:${tok.prop}-`
        if (!line.includes(needle)) {
          violations.push(`${rel}:${i + 1}  ${variant}${tok.label} (${needle} 누락)`)
        }
      }
    }
  })
}

if (violations.length === 0) {
  console.log('✅ 테마 일관성 — 라이트 색상에 dark: variant 누락 없음')
  process.exit(0)
}

console.log(`${STRICT ? '❌' : '⚠️ '} 다크/라이트 테마 일관성 — dark: variant 누락 ${violations.length}건`)
const byFile = {}
for (const v of violations) { const fn = v.split(':')[0]; byFile[fn] = (byFile[fn] || 0) + 1 }
Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 40).forEach(([fn, c]) => console.log(`   ${fn}  (${c})`))
console.log(`\n   수정: 라이트 클래스에 dark: 추가 (bg-white→dark:bg-[#0A0A0A], text-gray-900→dark:text-white 등 — CLAUDE.md 매핑)`)
console.log('   대시보드(seller/admin/agency)는 dark: 금지(제외), 순수 다크 페이지는 자동 무시.')
if (STRICT) { console.log('\n   [STRICT] 차단됨. 우회: commit 메시지에 [SKIP_THEME_CHECK].'); process.exit(1) }
console.log('\n   (warn-only. CI strict: STRICT_THEME=1)')
process.exit(0)
