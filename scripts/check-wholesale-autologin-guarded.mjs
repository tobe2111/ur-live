#!/usr/bin/env node
/**
 * 🏭 도매 자동 재로그인 ↔ 로그아웃 억제 회귀 잠금 (2026-06-29) — "로그아웃이 전혀 안돼" 영구차단.
 *
 *   배경(대표 신고): 도매 페이지(WholesaleCatalogPage/WholesaleLoginPage/WholesaleJoinPage/
 *   SupplierLoginPage)는 마운트 시 카카오 소비자 세션(user_id)만 있으면 자동으로
 *   `become-distributor`/`/supplier/become` 를 호출해 seller/supplier 토큰을 재발급한다.
 *   그래서 로그아웃이 토큰만 지워도 카카오 세션이 살아있으면 다음 로드에서 즉시 자동 재로그인 →
 *   "로그아웃이 안 됨". 명시 로그아웃 후엔 `wholesaleAutoLoginSuppressed()`(억제 플래그)로 막아야 한다.
 *
 *   규칙(교과서적 off-by-default): 도매/제조 페이지에서 `become-distributor`/`/supplier/become`
 *   *자동 probe* 를 호출하는 파일은 반드시 `consumeWholesaleLoginIntent` 로 게이트(=명시 로그인 직후
 *   1회만 발화)해야 한다. ambient 자동로그인(마운트마다 발화)이면 로그아웃이 풀린다.
 *   의도적 예외(명시 버튼 핸들러 등 자동 아님)는 같은 줄/근처에 `autologin-ok` 주석.
 */
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => (existsSync(resolve(ROOT, p)) ? readFileSync(resolve(ROOT, p), 'utf8') : null)

// 자동 probe 를 보유한 도매/제조 페이지 (마운트 시 user_id 로 토큰 자동발급).
const PAGES = [
  'src/pages/WholesaleCatalogPage.tsx',
  'src/pages/WholesaleLoginPage.tsx',
  'src/pages/WholesaleJoinPage.tsx',
  'src/pages/SupplierLoginPage.tsx',
]

const PROBE = /become-distributor|\/supplier\/become/

// 🏭 2026-06-29: 주석-aware 로 PROBE 검사 — 카카오 자동 probe 제거 후 남은 *설명 주석*
//   (예: `// 기존 카카오 자동 probe(become-distributor)·... 삭제`)을 실제 호출로 오인하던 false
//   positive 차단. 실제 probe 는 코드의 문자열 리터럴(`api.post('/api/wholesale/become-distributor')`)
//   에 있으므로 문자열은 보존하고 *순수 주석 라인*(블록 /* */ + 줄 //)만 제거한 뒤 검사한다.
function stripComments(src) {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, '')
  return noBlock
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n')
}

const violations = []
let scanned = 0
for (const rel of PAGES) {
  const src = read(rel)
  if (src == null) continue
  scanned++
  // 파일에 자동 probe 호출이 있나? (주석 라인 제외 — 코드의 문자열 리터럴만 검사)
  if (!PROBE.test(stripComments(src))) continue
  if (/autologin-ok/.test(src)) continue // 명시 예외
  // 로그인-의도 게이트 보유? (consumeWholesaleLoginIntent = off-by-default 발화)
  if (!/consumeWholesaleLoginIntent/.test(src)) {
    violations.push(rel)
  }
}

console.log(`🏭 도매 자동 재로그인 ↔ 로그아웃 억제 가드`)
console.log(`   스캔 ${scanned}/${PAGES.length} 페이지 (become-distributor / supplier-become 자동 probe)`)
if (violations.length === 0) {
  console.log(`✅ 위반 0 — 모든 자동 probe 가 consumeWholesaleLoginIntent() 로 게이트(명시 로그인 직후 1회만, 로그아웃 유지).`)
  process.exit(0)
}
console.log(`\n❌ 로그인-의도 게이트 누락 ${violations.length}건 (ambient 자동로그인 → 명시 로그아웃이 풀림):`)
for (const v of violations) {
  console.log(`   • ${v}`)
  console.log(`     → 자동 probe 의 early-return 에 \`|| !consumeWholesaleLoginIntent()\` 추가(@/utils/wholesale-session). 카카오 로그인 버튼은 setWholesaleLoginIntent().`)
}
const STRICT = process.env.STRICT_WHS_AUTOLOGIN === '1'
process.exit(STRICT ? 1 : 0)
